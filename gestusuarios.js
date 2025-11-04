const SUPABASE_URL = 'https://xwvexjaunujjhuhddlpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dmV4amF1bnVqamh1aGRkbHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMTkyMzksImV4cCI6MjA1ODY5NTIzOX0.xLma_qILItRihs4VwE55-6CA8Db8zdkFZXrNf04AOt0';

// Variables de estado
let selectedLicense = null;
let currentStep = 1;
const totalSteps = 3;

document.addEventListener('DOMContentLoaded', async () => {
  await checkLoggedInUser();
  await loadLicenses();
  setupEventListeners();
});

async function checkLoggedInUser() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

async function loadLicenses() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/licencias_creative_commons?select=*&activa=eq.true`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar licencias');
    
    const licenses = await response.json();
    renderLicenses(licenses);
  } catch (error) {
    console.error('Error:', error);
    Swal.fire('Error', 'No se pudieron cargar las licencias disponibles', 'error');
  }
}

function renderLicenses(licenses) {
  const container = document.getElementById('licensesContainer');
  container.innerHTML = '';
  
  licenses.forEach(license => {
    const licenseCard = document.createElement('div');
    licenseCard.className = 'col-md-6';
    licenseCard.innerHTML = `
      <div class="card license-card h-100" data-id="${license.id_licencia}">
        <div class="card-body text-center">
          <div class="license-icon">
            ${getLicenseIcon(license)}
          </div>
          <h5 class="card-title">${license.nombre}</h5>
          <p class="card-text">${license.descripcion || ''}</p>
          <div class="d-flex justify-content-center gap-2">
            ${renderLicenseBadges(license)}
          </div>
        </div>
      </div>
    `;
    container.appendChild(licenseCard);
  });
  
  // Event listeners para selección
  document.querySelectorAll('.license-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.license-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedLicense = licenses.find(l => l.id_licencia == this.dataset.id);
    });
  });
}

function getLicenseIcon(license) {
  // En un caso real, usarías el icono_url de la base de datos
  const baseURL = 'https://mirrors.creativecommons.org/presskit/icons';
  const icons = [];
  
  if (license.atribucion) icons.push('by');
  if (license.comercial === false) icons.push('nc');
  if (license.derivadas === 'no') icons.push('nd');
  if (license.derivadas === 'compartir-igual') icons.push('sa');
  
  return icons.map(icon => 
    `<img src="${baseURL}/${icon}.svg" alt="${icon}" width="40" title="${getBadgeText(icon)}">`
  ).join('');
}

function renderLicenseBadges(license) {
  const badges = [];
  if (license.atribucion) badges.push('BY');
  if (license.comercial === false) badges.push('NC');
  if (license.derivadas === 'no') badges.push('ND');
  if (license.derivadas === 'compartir-igual') badges.push('SA');
  
  return badges.map(badge => 
    `<span class="badge bg-secondary">${badge}</span>`
  ).join('');
}

function getBadgeText(code) {
  const texts = {
    'by': 'Atribución',
    'nc': 'No Comercial',
    'nd': 'No Derivadas',
    'sa': 'Compartir Igual'
  };
  return texts[code] || code;
}

function setupEventListeners() {
  // Navegación entre pasos
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
  
  // Envío del formulario
  document.getElementById('submitLicense').addEventListener('click', submitLicense);
}

function goToStep(step) {
  document.querySelectorAll('.license-step').forEach(el => el.style.display = 'none');
  document.getElementById(`step${step}`).style.display = 'block';
  currentStep = step;
  
  // Actualizar barra de progreso
  const progress = (step / totalSteps) * 100;
  document.getElementById('progressBar').style.width = `${progress}%`;
  document.getElementById('progressText').textContent = `${step}/${totalSteps}`;
}

function validateObraForm() {
  const titulo = document.getElementById('tituloObra').value;
  if (!titulo) {
    Swal.fire('Campo requerido', 'El título de la obra es obligatorio', 'warning');
    return false;
  }
  return true;
}

function updateConfirmationData() {
  document.getElementById('confirmLicenseName').textContent = selectedLicense.nombre;
  document.getElementById('confirmLicenseDesc').textContent = selectedLicense.descripcion || '';
  
  const iconsContainer = document.getElementById('licenseIconsConfirm');
  iconsContainer.innerHTML = getLicenseIcon(selectedLicense);
  
  document.getElementById('confirmTitulo').textContent = document.getElementById('tituloObra').value;
  document.getElementById('confirmDescripcion').textContent = document.getElementById('descripcionObra').value || 'N/A';
  
  const url = document.getElementById('urlObra').value;
  const file = document.getElementById('archivoObra').files[0];
  document.getElementById('confirmArchivo').textContent = url || (file ? file.name : 'Ninguno');
}

async function submitLicense() {
  if (!document.getElementById('confirmTerms').checked) {
    Swal.fire('Acepta los términos', 'Debes aceptar los términos y condiciones', 'warning');
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const obraForm = document.getElementById('obraForm');
    const formData = {
      id_usuario: user.id_usuario,
      id_licencia: selectedLicense.id_licencia,
      titulo_obra: document.getElementById('tituloObra').value,
      descripcion_obra: document.getElementById('descripcionObra').value || null,
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
      title: 'Licencia registrada',
      html: `Tu obra <strong>${formData.titulo_obra}</strong> ha sido registrada con licencia <strong>${selectedLicense.nombre}</strong>.<br><br>
             Recibirás una notificación cuando sea revisada.`,
      confirmButtonText: 'Entendido'
    }).then(() => {
      window.location.reload();
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