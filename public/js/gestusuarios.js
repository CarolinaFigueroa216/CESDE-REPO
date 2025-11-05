// ============================================
// GESTIÓN DE USUARIOS - FRONTEND SEGURO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  setupEventListeners();
});

// ============================================
// CARGAR USUARIOS DESDE BACKEND
// ============================================

async function loadUsers() {
  try {
    const response = await fetch('/api/usuarios', { credentials: 'include' });
    
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      throw new Error('Error al cargar usuarios');
    }
    
    const users = await response.json();
    renderUsers(users);
  } catch (error) {
    console.error('Error:', error);
    showError('Error al cargar usuarios');
  }
}

// ============================================
// RENDERIZAR TABLA DE USUARIOS
// ============================================

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay usuarios</td></tr>';
    return;
  }

  users.forEach(user => {
    const roleSpan = getRoleSpan(user);
    const statusBadge = getStatusBadge(user.estado);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.id_usuarios}</td>
      <td>${user.identificacion}</td>
      <td>${user.nombres_y_apellidos}</td>
      <td>${user.correo_electronico}</td>
      <td>${roleSpan}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-primary edit-btn" data-id="${user.id_usuarios}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${user.id_usuarios}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Agregar event listeners a botones
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => editUser(e.target.closest('button').dataset.id));
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteUser(e.target.closest('button').dataset.id));
  });
}

// ============================================
// OBTENER SPAN DE ROL
// ============================================

function getRoleSpan(user) {
  if (user.rol_usuario_superadministrador) {
    return '<span class="badge bg-danger">SuperAdmin</span>';
  } else if (user.rol_usuario_administrador) {
    return '<span class="badge bg-success">Admin</span>';
  }
  return '<span class="badge bg-primary">Usuario</span>';
}

// ============================================
// OBTENER BADGE DE ESTADO
// ============================================

function getStatusBadge(estado) {
  return estado 
    ? '<span class="badge bg-success">Activo</span>'
    : '<span class="badge bg-secondary">Inactivo</span>';
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadUsers);
  }
}

// ============================================
// EDITAR USUARIO
// ============================================

async function editUser(userId) {
  const confirmed = await Swal.fire({
    icon: 'info',
    title: 'Editar Usuario',
    text: 'Esta funcionalidad estará disponible pronto',
    confirmButtonText: 'OK'
  });
}

// ============================================
// ELIMINAR USUARIO
// ============================================

async function deleteUser(userId) {
  const confirmed = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar usuario?',
    text: 'Esta acción no se puede deshacer',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmed.isConfirmed) return;

  try {
    const response = await fetch(`/api/usuarios/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Error al eliminar');

    showSuccess('Usuario eliminado correctamente');
    loadUsers();
  } catch (error) {
    console.error('Error:', error);
    showError('Error al eliminar usuario');
  }
}

// ============================================
// FUNCIONES DE ALERTAS
// ============================================

function showSuccess(message) {
  Swal.fire({
    icon: 'success',
    title: 'Éxito',
    text: message,
    timer: 2000,
    showConfirmButton: false
  });
}

function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message
  });
}
