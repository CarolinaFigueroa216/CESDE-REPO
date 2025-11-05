// ============================================
// MONITOR DEL SISTEMA - SUPERADMIN (OPTIMIZADO)
// ============================================

let currentStep = 1;
const totalSteps = 3;

// ============================================
// 1. CARGAR METADATA DEL SISTEMA
// ============================================

async function loadAppMetadata() {
  try {
    // Obtener estadísticas desde el backend
    const usersRes = await fetch('/api/system/stats/users', { credentials: 'include' });
    const usersData = await usersRes.json();
    
    const projectsRes = await fetch('/api/system/stats/projects', { credentials: 'include' });
    const projectsData = await projectsRes.json();

    const metadata = {
      'Nombre de App': 'CESDE Academic System',
      'Versión': '1.0.0',
      'Entorno': 'Producción',
      'Última Actualización': new Date().toLocaleString(),
      'URL Supabase': window.SUPABASE_URL?.substring(0, 40) + '...' || 'Configurado',
      'Usuarios Activos': usersData.total_users || 0,
      'Proyectos Totales': projectsData.total_projects || 0,
      'Tablas Base de Datos': 'usuarios, proyectos_estudiantiles, system_logs, licencias_cc',
      'Buckets Almacenamiento': 'archivos, imágenes, vídeos, licencias'
    };

    const metadataTable = document.getElementById('appMetadata');
    if (!metadataTable) return;

    metadataTable.innerHTML = '';

    for (const [key, value] of Object.entries(metadata)) {
      const row = document.createElement('tr');
      const bgColor = typeof value === 'number' ? 'bg-light' : '';
      row.innerHTML = `
        <th class="text-dark">${key}</th>
        <td class="${bgColor}"><strong>${value}</strong></td>
      `;
      metadataTable.appendChild(row);
    }
  } catch (error) {
    console.error('Error cargando metadata:', error);
  }
}

// ============================================
// 2. CARGAR LOGS DE ACTIVIDAD
// ============================================

async function loadActivityLogs(filter = '') {
  try {
    let url = '/api/system/logs';
    if (filter && !isNaN(filter)) {
      url += `?user_id=${filter}`;
    }

    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Error cargando logs');
    
    const logs = await response.json();
    renderLogEntries(logs);
  } catch (error) {
    console.error('Error cargando logs:', error);
    document.getElementById('logEntries').innerHTML = 
      '<div class="alert alert-danger">Error al cargar logs</div>';
  }
}

// ============================================
// 3. RENDERIZAR ENTRADAS DE LOG
// ============================================

function renderLogEntries(logs) {
  const logContainer = document.getElementById('logEntries');
  if (!logContainer) return;

  logContainer.innerHTML = '';

  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<div class="alert alert-info">No hay registros de logs</div>';
    return;
  }

  logs.forEach(log => {
    const timestamp = new Date(log.timestamp).toLocaleString('es-ES');
    const badgeColor = getBadgeColor(log.level);
    const userDisplay = log.user_id ? `Usuario: ${log.user_id}` : 'Sistema';

    const logEntry = document.createElement('div');
    logEntry.className = `alert alert-${badgeColor} mb-2`;
    logEntry.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong>${log.source}</strong><br>
          <small class="text-muted">${log.message}</small>
        </div>
        <div class="text-end">
          <span class="badge bg-${badgeColor}">${log.level.toUpperCase()}</span><br>
          <small class="text-muted">${timestamp}</small><br>
          <small class="text-muted">${userDisplay}</small>
        </div>
      </div>
      ${log.details ? `<pre class="small mt-2 mb-0"><code>${JSON.stringify(log.details, null, 2)}</code></pre>` : ''}
    `;

    logContainer.appendChild(logEntry);
  });
}

// ============================================
// 4. OBTENER COLOR DE BADGE
// ============================================

function getBadgeColor(level) {
  const colors = {
    'error': 'danger',
    'warning': 'warning',
    'info': 'info',
    'debug': 'secondary'
  };
  return colors[level] || 'light';
}

// ============================================
// 5. VERIFICAR ESTADO DEL SISTEMA
// ============================================

async function checkSystemHealth() {
  try {
    // Simular estados (en producción obtendrías de endpoints reales)
    document.getElementById('dbStatus').innerHTML = 
      '<i class="bi bi-check-circle-fill text-success"></i> Conectada';
    
    document.getElementById('storageStatus').innerHTML = 
      '<i class="bi bi-check-circle-fill text-success"></i> Disponible';
    
    document.getElementById('apiStatus').innerHTML = 
      '<i class="bi bi-check-circle-fill text-success"></i> Respondiendo';
    
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('es-ES');
  } catch (error) {
    console.error('Error verificando salud:', error);
    document.getElementById('dbStatus').innerHTML = 
      '<i class="bi bi-x-circle-fill text-danger"></i> Error';
  }
}

// ============================================
// 6. CARGAR GRÁFICOS
// ============================================

async function loadCharts() {
  try {
    // Gráfico de actividad de usuarios (datos simulados)
    const userCtx = document.getElementById('userActivityChart');
    if (userCtx) {
      new Chart(userCtx, {
        type: 'line',
        data: {
          labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'],
          datasets: [{
            label: 'Inicios de Sesión',
            data: [12, 19, 8, 15, 22, 10, 5],
            borderColor: '#ec167f',
            backgroundColor: 'rgba(236, 22, 127, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'Usuarios Nuevos',
            data: [5, 8, 6, 10, 12, 7, 3],
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // Gráfico de almacenamiento
    const storageCtx = document.getElementById('storageUsageChart');
    if (storageCtx) {
      new Chart(storageCtx, {
        type: 'doughnut',
        data: {
          labels: ['Archivos', 'Imágenes', 'Vídeos'],
          datasets: [{
            data: [45, 30, 25],
            backgroundColor: [
              'rgba(255, 99, 132, 0.8)',
              'rgba(54, 162, 235, 0.8)',
              'rgba(255, 206, 86, 0.8)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)'
            ],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error cargando gráficos:', error);
  }
}

// ============================================
// 7. CARGAR ESQUEMA DE BD
// ============================================

function loadDbSchema() {
  const schema = `
=== ESQUEMA DE BASE DE DATOS CESDE ===

📋 TABLA: usuarios
├─ id_usuarios (PK, bigint)
├─ identificacion (text unique)
├─ nombres_y_apellidos (text)
├─ correo_electronico (text unique)
├─ contrasena (text - bcrypt hash)
├─ estado (boolean)
├─ rol_usuario_normal (boolean)
├─ rol_usuario_administrador (boolean)
├─ rol_usuario_superadministrador (boolean)
└─ created_at (timestamp)

📋 TABLA: proyectos_estudiantiles
├─ id_proyecto (PK, bigint)
├─ titulo (text)
├─ descripcion (text)
├─ tipo (text)
├─ id_estudiante (FK)
├─ nombres_y_apellidos (text)
├─ archivos_url (text[])
├─ imagenes_url (text[])
├─ video_url (text)
└─ fecha_subida (timestamp)

📋 TABLA: system_logs
├─ id (PK, bigint)
├─ timestamp (timestamp)
├─ level (text: error, warning, info, debug)
├─ source (text)
├─ message (text)
├─ details (jsonb)
├─ user_id (FK)
└─ ip_address (text)

📋 TABLA: licencias_creative_commons
├─ id_licencia (PK, bigint)
├─ nombre (text)
├─ descripcion (text)
├─ atribucion (boolean)
├─ comercial (boolean)
├─ derivadas (text)
└─ activa (boolean)

📋 TABLA: registros_licencias_cc
├─ id_registro (PK, bigint)
├─ id_usuario (FK)
├─ id_licencia (FK)
├─ titulo_obra (text)
├─ descripcion_obra (text)
├─ url_obra (text)
├─ archivo_adjunto (text)
├─ estado (text: pendiente, aprobado, rechazado)
└─ fecha_registro (timestamp)

🗂️ STORAGE BUCKETS
├─ archivos (proyectos)
├─ imagenes (demostración)
├─ videos (proyectos)
└─ licencias (documentos)
  `;

  const schemaContainer = document.getElementById('dbSchema');
  if (schemaContainer) {
    schemaContainer.innerHTML = `<pre style="background: #f8f9fa; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;">${schema}</pre>`;
  }
}

// ============================================
// 8. EXPORTAR LOGS A CSV
// ============================================

async function exportLogs() {
  try {
    const response = await fetch('/api/system/logs/export', { credentials: 'include' });
    if (!response.ok) throw new Error('Error exportando logs');
    
    // Descargar el archivo CSV
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cesde_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exportando:', error);
    alert('Error al exportar logs');
  }
}

// ============================================
// 9. SETUP DE EVENTOS
// ============================================

function setupEventListeners() {
  const refreshBtn = document.getElementById('refreshLogsBtn');
  const searchBtn = document.getElementById('searchLogsBtn');
  const exportBtn = document.getElementById('exportLogsBtn');
  const filterInput = document.getElementById('logFilter');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadActivityLogs());
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const filter = filterInput?.value || '';
      loadActivityLogs(filter);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportLogs);
  }

  if (filterInput) {
    filterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchBtn?.click();
      }
    });
  }
}

// ============================================
// 10. INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadAppMetadata();
  loadActivityLogs();
  checkSystemHealth();
  loadCharts();
  loadDbSchema();
  setupEventListeners();

  // Auto-refresh cada 5 minutos
  setInterval(() => {
    loadActivityLogs();
    checkSystemHealth();
  }, 5 * 60 * 1000);
});
