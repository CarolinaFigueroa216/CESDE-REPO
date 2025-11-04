// Configuración de Supabase
const SUPABASE_URL = 'https://xwvexjaunujjhuhddlpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dmV4amF1bnVqamh1aGRkbHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMTkyMzksImV4cCI6MjA1ODY5NTIzOX0.xLma_qILItRihs4VwE55-6CA8Db8zdkFZXrNf04AOt0';

// Tablas de Supabase
const PROJECTS_TABLE = 'proyectos_estudiantiles';
const LOGS_TABLE = 'system_logs';

// Configuración de buckets de almacenamiento
const STORAGE_BUCKETS = {
  FILES: 'archivos',
  IMAGES: 'imagenes',
  VIDEOS: 'videos'
};

// Clase para errores detallados
class DetailedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DetailedError';
    this.details = details;
  }
}

// Función para registrar logs
async function logActivity(level, source, message, details = {}) {
  const user = JSON.parse(localStorage.getItem('currentUser'));
 
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${LOGS_TABLE}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        level: level,
        source: source,
        message: message,
        details: details,
        user_id: user ? user.id_usuario : null,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Función para verificar que los buckets existan
async function verifyStorageBuckets() {
  try {
    await logActivity('info', 'system', 'Verificando buckets de almacenamiento');
   
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
   
    if (!response.ok) throw new Error('Error al verificar buckets');
   
    const buckets = await response.json();
    const requiredBuckets = Object.values(STORAGE_BUCKETS);
   
    requiredBuckets.forEach(bucket => {
      if (!buckets.find(b => b.name === bucket)) {
        const msg = `Bucket faltante: "${bucket}". Por favor crearlo en Supabase Storage.`;
        console.error(`⚠️ ${msg}`);
        logActivity('warning', 'system', msg);
      }
    });
   
    await logActivity('info', 'system', 'Verificación de buckets completada');
  } catch (error) {
    await logActivity('error', 'system', 'Error en verificación de buckets', {
      error: error.message
    });
    console.error('Error en verificación de buckets:', error);
  }
}

// Función para subir un solo archivo
async function uploadSingleFile(file, folder) {
  try {
    // Validar tamaño del archivo (límite de 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      const errorDetails = {
        maxAllowed: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        actualSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
      };
     
      await logActivity('error', 'upload', 'Archivo demasiado grande', {
        fileName: file.name,
        ...errorDetails
      });
     
      throw new DetailedError(
        `Archivo demasiado grande (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
        errorDetails
      );
    }

    const formData = new FormData();
    formData.append('file', file);

    await logActivity('info', 'upload', 'Iniciando subida de archivo', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      bucket: folder
    });

    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${folder}/${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = `Error ${response.status} al subir ${file.name}`;
     
      await logActivity('error', 'upload', errorMsg, {
        status: response.status,
        bucket: folder,
        details: errorData
      });
     
      throw new DetailedError(errorMsg, {
        status: response.status,
        details: errorData
      });
    }

    const data = await response.json();
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${folder}/${encodeURIComponent(file.name)}`;
   
    await logActivity('info', 'upload', 'Archivo subido exitosamente', {
      fileName: file.name,
      fileUrl: fileUrl
    });
   
    return fileUrl;

  } catch (error) {
    await logActivity('error', 'upload', `Error al subir archivo ${file.name}`, {
      error: error.message,
      fileName: file.name
    });
    throw error;
  }
}

// Función para subir archivos con reintentos
async function uploadFilesWithRetry(files, folder, maxRetries = 2) {
  const urls = [];
 
  for (const file of files) {
    let retryCount = 0;
    let lastError = null;
   
    while (retryCount <= maxRetries) {
      try {
        const fileUrl = await uploadSingleFile(file, folder);
        urls.push(fileUrl);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        retryCount++;
       
        await logActivity('warning', 'upload', `Intento ${retryCount} fallido para ${file.name}`, {
          error: error.message,
          retryCount: retryCount
        });
       
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
   
    if (lastError) {
      await logActivity('error', 'upload', `Error al subir archivo ${file.name} después de ${maxRetries} intentos`, {
        fileName: file.name,
        error: lastError.message
      });
     
      throw new DetailedError(
        `Error al subir archivo ${file.name} después de ${maxRetries} intentos`,
        {
          originalError: lastError,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      );
    }
  }

  return urls;
}

// Función para mostrar alerta de error
function showErrorAlert(error) {
  let errorMessage = 'Error al subir el proyecto';
  let errorDetails = '';
  let suggestions = '';

  if (error instanceof DetailedError) {
    errorDetails = JSON.stringify(error.details, null, 2);
    if (error.details?.suggestion) {
      suggestions = `<p><strong>Sugerencia:</strong> ${error.details.suggestion}</p>`;
    }
  }

  if (error.message.includes('Failed to fetch')) {
    errorMessage = 'Error de conexión: No se pudo contactar al servidor';
    suggestions = '<p><strong>Sugerencia:</strong> Verifica tu conexión a internet e intenta nuevamente</p>';
  } else if (error.message.includes('permission denied') || error.message.includes('401')) {
    errorMessage = 'Error de autenticación: No tienes permisos para esta acción';
    suggestions = '<p><strong>Sugerencia:</strong> Cierra sesión y vuelve a iniciar, o contacta al administrador</p>';
  } else if (error.message.includes('bucket not found')) {
    errorMessage = 'Error de configuración: El directorio de almacenamiento no existe';
    suggestions = '<p><strong>Solución:</strong> Crea el bucket en Supabase Storage > Buckets</p>';
  } else if (error.message.includes('Payload too large')) {
    errorMessage = 'Error: El archivo es demasiado grande';
    suggestions = '<p><strong>Sugerencia:</strong> Intenta con archivos más pequeños o comprime los archivos</p>';
  } else {
    errorMessage = error.message;
  }

  const errorModal = document.createElement('div');
  errorModal.className = 'error-modal';
  errorModal.style = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;

  errorModal.innerHTML = `
    <div class="error-content" style="
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 80%;
      max-height: 80vh;
      overflow: auto;
      width: 500px;
    ">
      <h3 style="color: #dc3545; margin-top: 0;">Error al subir proyecto</h3>
      <p><strong>Mensaje:</strong> ${escapeHtml(errorMessage)}</p>
      ${suggestions}
     
      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
          Detalles técnicos (selecciona para copiar):
        </label>
        <textarea id="errorDetailsText" style="
          width: 100%;
          height: 150px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: monospace;
          background: #f8f9fa;
          white-space: pre-wrap;
          word-wrap: break-word;
        " readonly>${escapeHtml(formatErrorDetails(error, errorDetails))}</textarea>
      </div>
     
      <div style="display: flex; justify-content: space-between; margin-top: 15px;">
        <button id="copyErrorBtn" style="
          padding: 8px 15px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Copiar detalles</button>
       
        <button id="closeErrorBtn" style="
          padding: 8px 15px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(errorModal);

  document.getElementById('copyErrorBtn').addEventListener('click', async () => {
    const textarea = document.getElementById('errorDetailsText');
    try {
      await navigator.clipboard.writeText(textarea.value);
      const copyBtn = document.getElementById('copyErrorBtn');
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => copyBtn.textContent = 'Copiar detalles', 2000);
    } catch (err) {
      textarea.select();
      document.execCommand('copy');
      alert('Detalles copiados al portapapeles');
    }
  });

  document.getElementById('closeErrorBtn').addEventListener('click', () => {
    document.body.removeChild(errorModal);
  });
}

// Función para escapar HTML
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Función para formatear detalles del error
function formatErrorDetails(error, details) {
  return `Mensaje: ${error.message}\n\n` +
         `Tipo: ${error.name}\n\n` +
         `Detalles:\n${details}\n\n` +
         `Stack trace:\n${error.stack || 'No disponible'}`;
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  verifyStorageBuckets();

  const projectForm = document.getElementById('projectForm');
 
  // Preview de imágenes
  document.getElementById('projectImages').addEventListener('change', function(e) {
    const previewContainer = document.getElementById('imagePreviews');
    previewContainer.innerHTML = '';
   
    Array.from(e.target.files).forEach(file => {
      if (!file.type.match('image.*')) {
        console.warn(`Archivo ${file.name} no es una imagen válida`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.classList.add('preview-media', 'img-thumbnail', 'me-2');
        img.style.maxHeight = '100px';
        previewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });

  // Envío del formulario
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
   
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
      alert('Debes iniciar sesión primero');
      window.location.href = 'index.html';
      return;
    }

    const submitBtn = projectForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Subiendo...';

    try {
      await logActivity('info', 'project', 'Inicio de envío de proyecto', {
        user_id: user.id_usuario
      });

      const projectData = {
        titulo: document.getElementById('projectTitle').value,
        descripcion: document.getElementById('projectDescription').value,
        tipo: document.getElementById('projectType').value,
        id_estudiante: user.id_usuario,
        nombre_estudiante: user.nombre_usuario,
        video_url: document.getElementById('projectVideoUrl').value || null,
        fecha_subida: new Date().toISOString()
      };

      // Subir archivos principales
      const files = document.getElementById('projectFiles').files;
      if (files.length > 0) {
        await logActivity('info', 'project', 'Subiendo archivos principales', {
          count: files.length
        });
        projectData.archivos_url = await uploadFilesWithRetry(files, STORAGE_BUCKETS.FILES);
      }

      // Subir imágenes
      const images = document.getElementById('projectImages').files;
      if (images.length > 0) {
        await logActivity('info', 'project', 'Subiendo imágenes', {
          count: images.length
        });
        projectData.imagenes_url = await uploadFilesWithRetry(images, STORAGE_BUCKETS.IMAGES);
      }

      // Subir video
      const videoFile = document.getElementById('projectVideoFile').files[0];
      if (videoFile) {
        await logActivity('info', 'project', 'Subiendo video');
        const videoUrls = await uploadFilesWithRetry([videoFile], STORAGE_BUCKETS.VIDEOS);
        projectData.video_url = videoUrls[0];
      }

      // Guardar en base de datos
      await logActivity('info', 'project', 'Guardando metadatos del proyecto en base de datos');
     
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${PROJECTS_TABLE}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        await logActivity('error', 'project', 'Error al guardar proyecto en la base de datos', {
          status: response.status,
          details: errorData
        });
       
        throw new DetailedError(
          'Error al guardar proyecto en la base de datos',
          {
            status: response.status,
            details: errorData
          }
        );
      }

      const result = await response.json();
     
      await logActivity('info', 'project', 'Proyecto guardado exitosamente', {
        project_id: result[0].id_proyecto,
        title: projectData.titulo
      });
     
      alert('¡Proyecto subido exitosamente!');
      projectForm.reset();
      document.getElementById('imagePreviews').innerHTML = '';

    } catch (error) {
      await logActivity('error', 'project', 'Error al enviar proyecto', {
        error: error.message,
        details: error.details || null,
        user_id: user.id_usuario
      });
     
      console.error('Error completo:', error);
      showErrorAlert(error);
     
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-upload"></i> Subir Proyecto';
    }
  });
});