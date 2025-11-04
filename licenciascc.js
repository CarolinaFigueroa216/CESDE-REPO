const SUPABASE_URL = 'https://xwvexjaunujjhuhddlpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dmV4amF1bnVqamh1aGRkbHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMTkyMzksImV4cCI6MjA1ODY5NTIzOX0.xLma_qILItRihs4VwE55-6CA8Db8zdkFZXrNf04AOt0';

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateLicensePreview();
});

function setupEventListeners() {
  // Actualizar vista previa cuando cambian opciones
  document.querySelectorAll('input[name="usoComercial"], input[name="derivadas"]').forEach(input => {
    input.addEventListener('change', updateLicensePreview);
  });
  
  // Envío del formulario
  document.getElementById('licenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitLicense();
  });
}

function updateLicensePreview() {
  const comercial = document.querySelector('input[name="usoComercial"]:checked').value === 'false';
  const derivadas = document.querySelector('input[name="derivadas"]:checked').value;
  
  const preview = document.getElementById('licensePreview');
  preview.innerHTML = '';
  
  // Siempre mostrar BY (atribución)
  preview.appendChild(createBadge('BY', 'Atribución'));
  
  if (comercial) {
    preview.appendChild(createBadge('NC', 'No Comercial'));
  }
  
  if (derivadas === 'no') {
    preview.appendChild(createBadge('ND', 'No Derivadas'));
  } else if (derivadas === 'compartir-igual') {
    preview.appendChild(createBadge('SA', 'Compartir Igual'));
  }
  
  // Actualizar nombre y descripción
  const licenseName = document.getElementById('licenseName');
  const licenseDesc = document.getElementById('licenseDescription');
  
  let name = 'CC BY';
  let desc = 'Atribución';
  
  if (comercial) {
    name += '-NC';
    desc += ' - No Comercial';
  }
  
  if (derivadas === 'no') {
    name += '-ND';
    desc += ' - No Derivadas';
  } else if (derivadas === 'compartir-igual') {
    name += '-SA';
    desc += ' - Compartir Igual';
  }
  
  licenseName.textContent = name;
  licenseDesc.textContent = desc;
}

function createBadge(code, title) {
  const badge = document.createElement('span');
  badge.className = 'license-badge';
  badge.textContent = code;
  badge.title = title;
  badge.style.fontSize = '1.5rem';
  return badge;
}

async function submitLicense() {
  if (!document.getElementById('confirmTerms').checked) {
    Swal.fire('Acepta los términos', 'Debes aceptar los términos y condiciones', 'warning');
    return;
  }

  const titulo = document.getElementById('tituloObra').value;
  if (!titulo) {
    Swal.fire('Campo requerido', 'El título de la obra es obligatorio', 'warning');
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const comercial = document.querySelector('input[name="usoComercial"]:checked').value === 'true';
    const derivadas = document.querySelector('input[name="derivadas"]:checked').value;
    
    const formData = {
      id_usuario: user.id_usuario,
      titulo_obra: titulo,
      descripcion_obra: document.getElementById('descripcionObra').value || null,
      atribucion: true, // Siempre true según nuestro formulario
      uso_comercial: comercial,
      obras_derivadas: derivadas,
      url_obra: document.getElementById('urlObra').value || null,
      estado: 'pendiente'
    };

    // Subir archivo si existe
    const fileInput = document.getElementById('archivoObra');
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileUrl = await uploadFile(file);
      formData.archivo_adjunto = fileUrl;
    }

    // Guardar en Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/registros_licencias_cc`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([formData])
    });

    if (!response.ok) throw new Error('Error al registrar la licencia');

    const result = await response.json();
    
    Swal.fire({
      icon: 'success',
      title: 'Licencia creada',
      html: `Tu obra <strong>${formData.titulo_obra}</strong> ha sido registrada con licencia <strong>${document.getElementById('licenseName').textContent}</strong>`,
      confirmButtonText: 'Entendido'
    }).then(() => {
      document.getElementById('licenseForm').reset();
      updateLicensePreview();
    });

  } catch (error) {
    console.error('Error:', error);
    Swal.fire('Error', 'No se pudo registrar la licencia: ' + error.message, 'error');
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/licencias/${file.name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: formData
  });

  if (!response.ok) throw new Error('Error al subir archivo');

  const data = await response.json();
  return `${SUPABASE_URL}/storage/v1/object/public/licencias/${file.name}`;
}