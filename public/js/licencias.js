// ============================================
// GESTIÓN DE LICENCIAS CREATIVE COMMONS
// ============================================

let selectedLicense = null;
let currentStep = 1;
const totalSteps = 3;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  await loadLicenses();
  await loadMisRegistros();
  setupEventListeners();
});

// Cargar licencias
async function loadLicenses() {
  try {
    const response = await fetch('/api/licencias', { credentials: 'include' });
    if (!response.ok) throw new Error('Error al cargar licencias');
    
    const licenses = await response.json();
    renderLicenses(licenses);
  } catch (error) {
    console.error('Error:', error);
    Swal.fire('Error', 'No se pudieron cargar las licencias', 'error');
  }
}

// Renderizar licencias
function renderLicenses(licenses) {
  const container = document.getElementById('licensesContainer');
  container.innerHTML = '';
  
  licenses.forEach(license => {
    const licenseCard = document.createElement('div');
    licenseCard.className = 'col-md-6';
    licenseCard.innerHTML = `
      <div class="card license-card h-100 cursor-pointer" data-id="${license.id_licencia}">
        <div class="card-body text-center">
          <div class="license-icon mb-3">
            ${renderLicenseIcons(license)}
          </div>
          <h5 class="card-title">${license.nombre}</h5>
          <p class="card-text small">${license.descripcion || ''}</p>
          <div class="d-flex justify-content-center gap-2">
            ${renderLicenseBadges(license)}
          </div>
        </div>
      </div>
    `;
    container.appendChild(licenseCard);
  });
  
  // Event listeners
  document.querySelectorAll('.license-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.license-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedLicense = licenses.find(l => l.id_licencia == this.dataset.id);
    });
  });
}

// Renderizar iconos de licencia
function renderLicenseIcons(license) {
  const icons = [];
  if (license.atribucion) icons.push('BY');
  if (license.comercial === false) icons.push('NC');
  if (license.derivadas === 'no') icons.push('ND');
  if (license.derivadas === 'compartir-igual') icons.push('SA');
  
  return icons.map(icon => `<span class="badge bg-info">${icon}</span>`).join('');
}

// Renderizar badges
function renderLicenseBadges(license) {
  const badges = [];
  if (license.atribucion) badges.push('Atribución');
  if (license.comercial === false) badges.push('No Comercial');
  if (license.derivadas === 'no') badges.push('No Derivadas');
  if (license.derivadas === 'compartir-igual') badges.push('Compartir Igual');
  
  return badges.map(badge => `<span class="badge bg-secondary">${badge}</span>`).join('');
}

// Setup de eventos
function setupEventListeners() {
  document.getElementById('nextStep1').addEventListener('click', () => {
    if (!selectedLicense) {
      Swal.fire('Selección requerida', 'Por favor selecciona una licencia', 'warning');
      return;
    }
    goToStep(2);
  });
  
  document.getElementById('prevStep2').addEventListener('click', () => goToStep(1));
  document.getElementById('nextStep2').addEventListener('click', () => {
    if (!validateObraForm()) return;
    updateConfirmationData();
    goToStep(3);
  });
  
  document.getElementById('prevStep3').addEventListener('click', () => goToStep(2));
  document.getElementById('submitLicense').addEventListener('click', submitLicense);
}

// Navegar entre pasos
function goToStep(step) {
  document.querySelectorAll('.license-step').forEach(el => el.style.display = 'none');
  document.getElementById(`step${step}`).style.display = 'block';
  currentStep = step;
  
  const progress = (step / totalSteps) * 100;
  document.getElementById('progressBar').style.width = `${progress}%`;
  document.getElementById('progressText').textContent = `${step}/${totalSteps}`;
}

// Validar formulario
function validateObraForm() {
  const titulo = document.getElementById('tituloObra').value.trim();
  if (!titulo) {
    Swal.fire('Campo requerido', 'El título de la obra es obligatorio', 'warning');
    return false;
  }
  return true;
}

// Actualizar confirmación
function updateConfirmationData() {
  document.getElementById('confirmLicenseName').textContent = selectedLicense.nombre;
  document.getElementById('confirmLicenseDesc').textContent = selectedLicense.descripcion || '';
  
  const iconsContainer = document.getElementById('licenseIconsConfirm');
  iconsContainer.innerHTML = renderLicenseIcons(selectedLicense);
  
  document.getElementById('confirmTitulo').textContent = document.getElementById('tituloObra').value;
  document.getElementById('confirmDescripcion').textContent = document.getElementById('descripcionObra').value || 'N/A';
  
  const url = document.getElementById('urlObra').value;
  const file = document.getElementById('archivoObra').files[0];
  document.getElementById('confirmArchivo').textContent = url || (file ? file.name : 'Ninguno');
}

// Enviar registro
async function submitLicense() {
  if (!document.getElementById('confirmTerms').checked) {
    Swal.fire('Acepta los términos', 'Debes aceptar los términos y condiciones', 'warning');
    return;
  }

  try {
    let archivo_adjunto = null;
    
    // Subir archivo si existe
    const fileInput = document.getElementById('archivoObra');
    if (fileInput.files.length > 0) {
      archivo_adjunto = await uploadFile(fileInput.files[0]);
    }

    const response = await fetch('/api/licencias/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id_licencia: selectedLicense.id_licencia,
        titulo_obra: document.getElementById('tituloObra').value,
        descripcion_obra: document.getElementById('descripcionObra').value || null,
        url_obra: document.getElementById('urlObra').value || null,
        archivo_adjunto
      })
    });

    if (!response.ok) throw new Error('Error al registrar');

    Swal.fire({
      icon: 'success',
      title: 'Obra Registrada',
      text: `Tu obra ha sido registrada con éxito bajo la licencia ${selectedLicense.nombre}`,
      confirmButtonText: 'Entendido'
    }).then(() => {
      document.getElementById('obraForm').reset();
      goToStep(1);
      loadMisRegistros();
    });

  } catch (error) {
    Swal.fire('Error', 'No se pudo registrar la obra: ' + error.message, 'error');
  }
}

// Subir archivo a Storage
async function uploadFile(file) {
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('El archivo es demasiado grande (máximo 50MB)');
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}_${safeName}`;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/licencias/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: formData
  });

  if (!response.ok) throw new Error('Error al subir archivo');

  return `${SUPABASE_URL}/storage/v1/object/public/licencias/${fileName}`;
}

// Cargar mis registros
async function loadMisRegistros() {
  try {
    const response = await fetch('/api/licencias/mis-registros', { credentials: 'include' });
    if (!response.ok) throw new Error('Error al cargar registros');
    
    const registros = await response.json();
    renderMisRegistros(registros);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Renderizar mis registros
function renderMisRegistros(registros) {
  const container = document.getElementById('misRegistros');
  
  if (!registros || registros.length === 0) {
    container.innerHTML = '<p class="text-muted">Aún no tienes obras registradas</p>';
    return;
  }

  let html = '<div class="row g-3">';
  
  registros.forEach(reg => {
    const estado = reg.estado === 'aprobado' ? 'success' : reg.estado === 'rechazado' ? 'danger' : 'warning';
    html += `
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">${reg.titulo_obra}</h5>
            <p class="card-text small">${reg.licencias_creative_commons.nombre}</p>
            <span class="badge bg-${estado}">${reg.estado.toUpperCase()}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}
