// Configuración de Supabase (usando la misma que en los otros archivos)
const SUPABASE_URL = 'https://xwvexjaunujjhuhddlpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dmV4amF1bnVqamh1aGRkbHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMTkyMzksImV4cCI6MjA1ODY5NTIzOX0.xLma_qILItRihs4VwE55-6CA8Db8zdkFZXrNf04AOt0';

// Tablas de Supabase para metadata y logs
const METADATA_TABLE = 'system_metadata';
const LOGS_TABLE = 'system_logs';

// Configuración de buckets de almacenamiento
const STORAGE_BUCKETS = {
  FILES: 'archivos',
  IMAGES: 'imagenes',
  VIDEOS: 'videos'
};

// Clase para manejo de errores detallados
class DetailedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DetailedError';
    this.details = details;
  }
}

// Función para mostrar loading spinner
function showLoading(show, elementId = null) {
  const spinner = elementId ?
    document.getElementById(elementId).querySelector('.loading-spinner') :
    document.querySelector('.loading-spinner');

  if (spinner) {
    spinner.style.display = show ? 'block' : 'none';
  }
}

// Función para cargar metadata de la aplicación
async function loadAppMetadata() {
  try {
    showLoading(true, 'appMetadata');

    // Solo metadata estática (los dinámicos se llenan después)
    const staticMetadata = {
      'Application Name': 'CESDE Academic System',
      'Version': '1.0.0',
      'Environment': 'Production',
      'Last Updated': new Date().toLocaleString(),
      'Supabase URL': SUPABASE_URL,
      'Database Tables': 'usuarios, proyectos_estudiantiles, system_metadata, system_logs',
      'Storage Buckets': Object.values(STORAGE_BUCKETS).join(', ')
    };

    const metadataTable = document.getElementById('appMetadata');
    metadataTable.innerHTML = '';

    // Llenar solo los campos estáticos
    for (const [key, value] of Object.entries(staticMetadata)) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <th>${key}</th>
        <td>${value}</td>
      `;
      metadataTable.appendChild(row);
    }

    // Añadir filas dinámicas (sin sobrescribir)
    addMetadataRow('Active Users', 'Loading...');
    addMetadataRow('Total Projects', 'Loading...');

    // Cargar datos dinámicos
    await loadStatistics();

  } catch (error) {
    console.error('Error loading metadata:', error);
    showError('Failed to load application metadata');
  } finally {
    showLoading(false, 'appMetadata');
  }
}

// Función auxiliar para añadir filas (NUEVA)
function addMetadataRow(key, value) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <th>${key}</th>
    <td>${value}</td>
  `;
  document.getElementById('appMetadata').appendChild(row);
}

// Función para cargar estadísticas de uso
async function loadStatistics() {
  try {
    // Obtener conteo de usuarios
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=count`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (usersRes.ok) {
      const usersData = await usersRes.json();
      updateMetadataField('Active Users', usersData[0].count);
    }

    // Obtener conteo de proyectos (ESTE ES EL CAMBIO CLAVE)
    const projectsRes = await fetch(`${SUPABASE_URL}/rest/v1/proyectos_estudiantiles?select=count`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      updateMetadataField('Total Projects', projectsData[0].count);
    }

  } catch (error) {
    console.error('Error loading statistics:', error);
    updateMetadataField('Active Users', 'Error');
    updateMetadataField('Total Projects', 'Error');
  }
}

// Función auxiliar para actualizar campos (NUEVA)
function updateMetadataField(key, value) {
  const metadataTable = document.getElementById('appMetadata');
  const rows = metadataTable.getElementsByTagName('tr');

  for (let row of rows) {
    if (row.cells[0].textContent === key) {
      row.cells[1].textContent = value;
      break;
    }
  }
}

// Función para cargar el esquema de la base de datos
async function loadDbSchema() {
  try {
    // En un entorno real, esto podría venir de una consulta a information_schema
    const schema = {
      usuarios: [
        'id_usuario: integer (PK)',
        'identificacion: integer',
        'nombre_usuario: text',
        'email: text',
        'clave_encriptada: text',
        'usuario_normal: boolean',
        'usuario_administrador: boolean',
        'usuario_superadministrador: boolean',
        'fecha_creacion: timestamp'
      ],
      proyectos_estudiantiles: [
        'id_proyecto: integer (PK)',
        'titulo: text',
        'descripcion: text',
        'tipo: text',
        'id_estudiante: integer (FK)',
        'nombre_estudiante: text',
        'archivos_url: text[]',
        'imagenes_url: text[]',
        'video_url: text',
        'fecha_subida: timestamp'
      ],
      system_metadata: [
        'id: integer (PK)',
        'key: text',
        'value: text',
        'description: text',
        'last_updated: timestamp'
      ],
      system_logs: [
        'id: integer (PK)',
        'timestamp: timestamp',
        'level: text (error, warning, info, debug)',
        'source: text',
        'message: text',
        'details: jsonb',
        'user_id: integer (FK)',
        'ip_address: text'
      ]
    };

    // Formatear el esquema para mostrarlo
    let schemaText = '';
    for (const [table, columns] of Object.entries(schema)) {
      schemaText += `${table}:\n  ${columns.join('\n  ')}\n\n`;
    }

    document.getElementById('dbSchema').innerHTML = `<code>${schemaText}</code>`;

  } catch (error) {
    console.error('Error loading database schema:', error);
    document.getElementById('dbSchema').innerHTML = '<code>Error loading schema information</code>';
  }
}

// Función para cargar logs de actividad
async function loadActivityLogs(filter = '') {
  try {
    showLoading(true, 'logEntries');
    let url = `${SUPABASE_URL}/rest/v1/${LOGS_TABLE}?select=*&order=timestamp.desc`;

    // Solo filtrar si el filtro es un número válido
    if (filter && !isNaN(filter)) {
      url += `&user_id=eq.${filter}`;
    }

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const logs = await res.json();
    renderLogEntries(logs);

  } catch (error) {
    console.error('Error loading activity logs:', error);
    showError('Failed to load activity logs');
  } finally {
    showLoading(false, 'logEntries');
  }
}

// Función para renderizar entradas de log
function renderLogEntries(logs) {
  const logContainer = document.getElementById('logEntries');
  logContainer.innerHTML = '';

  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<div class="alert alert-info">No log entries found</div>';
    return;
  }

  logs.forEach(log => {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${log.level}`;

    const timestamp = new Date(log.timestamp).toLocaleString();
    let details = '';

    try {
      if (log.details && typeof log.details === 'object') {
        details = JSON.stringify(log.details, null, 2);
      } else if (log.details) {
        details = log.details;
      }
    } catch (e) {
      details = 'Could not parse details';
    }

    logEntry.innerHTML = `
      <div class="d-flex justify-content-between">
        <strong>${log.source}</strong>
        <small>${timestamp}</small>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span class="badge bg-${getBadgeColor(log.level)}">${log.level.toUpperCase()}</span>
        <small>User: ${log.user_id || 'System'}</small>
      </div>
      <p>${log.message}</p>
      ${details ? `<pre class="small">${details}</pre>` : ''}
    `;

    logContainer.appendChild(logEntry);
  });
}

// Función para obtener color de badge según nivel de log
function getBadgeColor(level) {
  switch (level) {
    case 'error': return 'danger';
    case 'warning': return 'warning text-dark';
    case 'info': return 'info text-dark';
    case 'debug': return 'secondary';
    default: return 'light text-dark';
  }
}

// Función para verificar el estado del sistema
async function checkSystemHealth() {
  try {
    // Verificar conexión a la base de datos
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=count`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const dbStatus = document.getElementById('dbStatus');
    if (dbRes.ok) {
      dbStatus.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Database connection successful';
    } else {
      dbStatus.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i> Database connection failed';
    }

    // Verificar almacenamiento
    const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });

    const storageStatus = document.getElementById('storageStatus');
    if (storageRes.ok) {
      const buckets = await storageRes.json();
      const missingBuckets = Object.values(STORAGE_BUCKETS).filter(
        b => !buckets.find(bucket => bucket.name === b)
      );

      if (missingBuckets.length === 0) {
        storageStatus.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> All storage buckets available';
      } else {
        storageStatus.innerHTML = `
          <i class="bi bi-exclamation-triangle-fill text-warning"></i> Missing buckets: ${missingBuckets.join(', ')}
        `;
      }
    } else {
      storageStatus.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i> Storage connection failed';
    }

    // Verificar API
    const apiRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const apiStatus = document.getElementById('apiStatus');
    if (apiRes.ok) {
      apiStatus.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> API is responding';
    } else {
      apiStatus.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i> API connection failed';
    }

  } catch (error) {
    console.error('Error checking system health:', error);
  }
}

// Función para cargar gráficos de estadísticas
async function loadCharts() {
  try {
    // Obtener datos de uso de almacenamiento desde Supabase
    const storageRes = await fetch(`${SUPABASE_URL}/rest/v1/proyectos_estudiantiles?select=tamano_archivos,tamano_imagenes,tamano_videos`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!storageRes.ok) throw new Error('Error fetching storage data');

    const projects = await storageRes.json();

    // Calcular totales (convertir bytes a MB)
    const totals = projects.reduce((acc, project) => {
      acc.files += project.tamano_archivos || 0;
      acc.images += project.tamano_imagenes || 0;
      acc.videos += project.tamano_videos || 0;
      return acc;
    }, { files: 0, images: 0, videos: 0 });

    // Datos para el gráfico (convertidos a MB con 2 decimales)
    const storageUsageData = {
      labels: ['Files', 'Images', 'Videos'],
      datasets: [{
        label: 'Storage Usage (MB)',
        data: [
          parseFloat((totals.files / (1024 * 1024)).toFixed(2)),
          parseFloat((totals.images / (1024 * 1024)).toFixed(2)),
          parseFloat((totals.videos / (1024 * 1024)).toFixed(2))
        ],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1
      }]


    };

    // Configurar gráfico de uso de almacenamiento
    const storageUsageCtx = document.getElementById('storageUsageChart').getContext('2d');
    new Chart(storageUsageCtx, {
      type: 'bar',
      data: storageUsageData,
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `${context.dataset.label}: ${context.raw} MB`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Megabytes (MB)' }
          }
        }
      }
    });

    // Mantener el gráfico de actividad de usuarios (existente)
    const userActivityData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'User Logins',
        data: [6, 59, 10, 20, 56, 55],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }, {
        label: 'New Users',
        data: [28, 48, 40, 19, 86, 27],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    };

    const userActivityCtx = document.getElementById('userActivityChart').getContext('2d');
    new Chart(userActivityCtx, {
      type: 'line',
      data: userActivityData,
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

  } catch (error) {
    console.error('Error loading charts:', error);
    // Mostrar datos por defecto en caso de error
    renderDefaultCharts();
  }
  // ... (después del catch en loadCharts)

  // Añadir esto al final de la función:
  // Actualización automática cada 5 minutos
  const updateInterval = 5 * 60 * 1000;
  setTimeout(loadCharts, updateInterval);
}

// Función de respaldo si falla la conexión
function renderDefaultCharts() {
  const storageUsageCtx = document.getElementById('storageUsageChart').getContext('2d');
  new Chart(storageUsageCtx, {
    type: 'bar',
    data: {
      labels: ['Files', 'Images', 'Videos'],
      datasets: [{
        label: 'Storage Usage (MB)',
        data: [100, 70, 20],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Función para exportar logs
async function exportLogs() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${LOGS_TABLE}?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const logs = await res.json();
    const csvContent = convertToCSV(logs);
    downloadCSV(csvContent, 'system_logs_export.csv');

  } catch (error) {
    console.error('Error exporting logs:', error);
    showError('Failed to export logs');
  }
}

// Función para convertir datos a CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';

  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header];

      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }

      // Escapar comillas y comas
      if (typeof value === 'string') {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      return value || '';
    });

    csv += values.join(',') + '\n';
  });

  return csv;
}

// Función para descargar CSV
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Función para mostrar errores
function showError(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  document.querySelector('.container').prepend(alert);
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // Cargar metadata inicial
  loadAppMetadata();
  loadDbSchema();

  // Configurar eventos
  document.getElementById('refreshLogsBtn').addEventListener('click', () => loadActivityLogs());
  document.getElementById('exportLogsBtn').addEventListener('click', exportLogs);

  // Elimina este evento:
  // document.getElementById('logFilter').addEventListener('input', (e) => {
  //   loadActivityLogs(e.target.value);
  // });

  // Nuevo evento para el botón de búsqueda:
  document.getElementById('searchLogsBtn').addEventListener('click', () => {
    const filter = document.getElementById('logFilter').value;
    loadActivityLogs(filter);
  });

  // Permitir buscar con Enter
  document.getElementById('logFilter').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('searchLogsBtn').click();
    }
  });

  // Cargar logs iniciales
  loadActivityLogs();

  // Verificar salud del sistema
  checkSystemHealth();

  // Cargar gráficos
  loadCharts();

  // Configurar formulario de configuración
  document.getElementById('configForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Configuration saved (this is a demo)');
  });

  // Cargar configuración actual
  document.getElementById('logRetention').value = 30;
  document.getElementById('maxFileSize').value = 50;
});