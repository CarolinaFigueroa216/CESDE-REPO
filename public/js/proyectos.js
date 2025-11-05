// ============================================
// GESTIÓN DE PROYECTOS ESTUDIANTILES
// ============================================

const STORAGE_BUCKETS = {
  FILES: 'archivos',
  IMAGES: 'imagenes',
  VIDEOS: 'videos'
};

// Clase para errores
class DetailedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DetailedError';
    this.details = details;
  }
}

// Subir archivo a Supabase Storage
async function uploadSingleFile(file, bucket) {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  
  if (file.size > MAX_FILE_SIZE) {
    throw new DetailedError(
      `Archivo demasiado grande: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      { maxSize: '50MB', actual: `${(file.size / (1024 * 1024)).toFixed(2)}MB` }
    );
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}_${safeName}`;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new DetailedError(`Error al subir ${file.name}`, { 
      status: response.status, 
      details: errorData 
    });
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}

// Subir múltiples archivos con reintentos
async function uploadFilesWithRetry(files, bucket, maxRetries = 2) {
  const urls = [];
  
  for (const file of files) {
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount <= maxRetries) {
      try {
        const fileUrl = await uploadSingleFile(file, bucket);
        urls.push(fileUrl);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (lastError) {
      throw new DetailedError(
        `Error al subir ${file.name} después de ${maxRetries} intentos`,
        { originalError: lastError.message }
      );
    }
  }

  return urls;
}

// Setup para preview de imágenes
function setupImagePreview() {
  const imageInput = document.getElementById('projectImages');
  const previewContainer = document.getElementById('imagePreviews');
  
  if (!imageInput || !previewContainer) return;

  imageInput.addEventListener('change', function(e) {
    previewContainer.innerHTML = '';
    
    Array.from(e.target.files).forEach((file, index) => {
      if (!file.type.match('image.*')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-media img-thumbnail';
        
        const img = document.createElement('img');
        img.src = event.target.result;
        img.alt = `Preview ${index}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '<i class="bi bi-x"></i>';
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          wrapper.remove();
        });
        
        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        previewContainer.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });
  });
}

// Setup para lista de archivos
function setupFilesList() {
  const fileInput = document.getElementById('projectFiles');
  const filesList = document.getElementById('filesList');
  
  if (!fileInput || !filesList) return;

  fileInput.addEventListener('change', function(e) {
    filesList.innerHTML = '';
    
    Array.from(e.target.files).forEach((file, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>
          <i class="bi bi-file"></i> ${file.name}
        </span>
        <small class="text-muted">${(file.size / 1024 / 1024).toFixed(2)}MB</small>
      `;
      filesList.appendChild(li);
    });
  });
}

// Manejar submit del formulario
async function handleProjectSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const submitBtn = document.getElementById('submitBtn');
  const loadingAlert = document.getElementById('loadingAlert');
  const errorAlert = document.getElementById('errorAlert');
  const successAlert = document.getElementById('successAlert');
  
  // Limpiar alertas
  errorAlert.style.display = 'none';
  successAlert.style.display = 'none';
  
  submitBtn.disabled = true;
  loadingAlert.style.display = 'block';

  try {
    // Preparar datos
    const projectData = {
      titulo: document.getElementById('projectTitle').value,
      descripcion: document.getElementById('projectDescription').value,
      tipo: document.getElementById('projectType').value
    };

    // Subir archivos principales
    const files = document.getElementById('projectFiles').files;
    if (files.length > 0) {
      document.getElementById('loadingText').textContent = `Subiendo archivos (1/${files.length})...`;
      projectData.archivos_url = await uploadFilesWithRetry(Array.from(files), STORAGE_BUCKETS.FILES);
    }

    // Subir imágenes
    const images = document.getElementById('projectImages').files;
    if (images.length > 0) {
      document.getElementById('loadingText').textContent = `Subiendo imágenes (1/${images.length})...`;
      projectData.imagenes_url = await uploadFilesWithRetry(Array.from(images), STORAGE_BUCKETS.IMAGES);
    }

    // Subir video
    const videoFile = document.getElementById('projectVideoFile')?.files[0];
    if (videoFile) {
      document.getElementById('loadingText').textContent = 'Subiendo video...';
      const videoUrls = await uploadFilesWithRetry([videoFile], STORAGE_BUCKETS.VIDEOS);
      projectData.video_url = videoUrls[0];
    } else if (document.getElementById('projectVideoUrl')?.value) {
      projectData.video_url = document.getElementById('projectVideoUrl').value;
    }

    // Guardar en backend
    document.getElementById('loadingText').textContent = 'Guardando proyecto...';
    
    const response = await fetch('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(projectData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al guardar el proyecto');
    }

    // Éxito
    loadingAlert.style.display = 'none';
    successAlert.style.display = 'block';
    
    // Limpiar formulario
    form.reset();
    document.getElementById('imagePreviews').innerHTML = '';
    document.getElementById('filesList').innerHTML = '';

    // Redirigir después de 2 segundos
    setTimeout(() => {
      window.location.href = '/welcome';
    }, 2000);

  } catch (error) {
    loadingAlert.style.display = 'none';
    errorAlert.style.display = 'block';
    document.getElementById('errorMessage').textContent = error.message;
    console.error('Error:', error);
  } finally {
    submitBtn.disabled = false;
  }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  setupImagePreview();
  setupFilesList();
  
  const projectForm = document.getElementById('projectForm');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectSubmit);
  }
});
