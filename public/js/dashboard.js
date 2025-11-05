// Variables globales
let currentUserId = null;
let isEditMode = false;

// Elementos del DOM
const userTableBody = document.getElementById('userTableBody');
const userForm = document.getElementById('userForm');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const newUserBtn = document.getElementById('newUserBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Cargar usuarios al iniciar
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
});

// Cargar usuarios desde el backend
async function loadUsers() {
  showLoading(true);
  try {
    const response = await fetch('/api/usuarios');
    if (!response.ok) throw new Error('Error al cargar usuarios');
    
    const users = await response.json();
    renderUsers(users);
  } catch (error) {
    showError('No se pudieron cargar los usuarios');
    console.error(error);
  } finally {
    showLoading(false);
  }
}

// Renderizar tabla de usuarios
function renderUsers(users) {
  userTableBody.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.id_usuarios}</td>
      <td>${user.nombres_y_apellidos}</td>
      <td>${user.correo_electronico || 'N/A'}</td>
      <td>${getRolBadge(user)}</td>
      <td>${getEstadoBadge(user.estado)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-btn" data-id="${user.id_usuarios}">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    `;
    row.querySelector('.view-btn').addEventListener('click', () => viewUser(user));
    userTableBody.appendChild(row);
  });
}

// Obtener badge de rol
function getRolBadge(user) {
  if (user.rol_usuario_superadministrador) return '<span class="badge bg-danger">Super Admin</span>';
  if (user.rol_usuario_administrador) return '<span class="badge bg-success">Admin</span>';
  return '<span class="badge bg-primary">Usuario</span>';
}

// Obtener badge de estado
function getEstadoBadge(estado) {
  return estado 
    ? '<span class="badge bg-success">Activo</span>' 
    : '<span class="badge bg-secondary">Inactivo</span>';
}

// Ver usuario (modo lectura)
function viewUser(user) {
  currentUserId = user.id_usuarios;
  isEditMode = false;
  
  document.getElementById('userId').value = user.id_usuarios;
  document.getElementById('identificacion').value = user.identificacion;
  document.getElementById('nombres').value = user.nombres_y_apellidos;
  document.getElementById('correo').value = user.correo_electronico || '';
  document.getElementById('contrasena').value = '';
  document.getElementById('estado').checked = user.estado;
  
  // Marcar rol
  if (user.rol_usuario_superadministrador) {
    document.getElementById('superadminUser').checked = true;
  } else if (user.rol_usuario_administrador) {
    document.getElementById('adminUser').checked = true;
  } else {
    document.getElementById('normalUser').checked = true;
  }
  
  // Deshabilitar campos
  setFormReadonly(true);
  editBtn.disabled = false;
  deleteBtn.disabled = false;
  submitBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
}

// Modo edición
editBtn.addEventListener('click', () => {
  isEditMode = true;
  setFormReadonly(false);
  submitBtn.style.display = 'block';
  cancelBtn.style.display = 'block';
  document.getElementById('submitText').textContent = 'Actualizar';
});

// Nuevo usuario
newUserBtn.addEventListener('click', () => {
  resetForm();
  currentUserId = null;
  isEditMode = false;
  setFormReadonly(false);
  submitBtn.style.display = 'block';
  cancelBtn.style.display = 'block';
  document.getElementById('submitText').textContent = 'Crear Usuario';
});

// Cancelar
cancelBtn.addEventListener('click', () => {
  resetForm();
});

// Submit del formulario
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userData = {
    identificacion: document.getElementById('identificacion').value,
    nombres_y_apellidos: document.getElementById('nombres').value,
    correo_electronico: document.getElementById('correo').value,
    contrasena: document.getElementById('contrasena').value,
    estado: document.getElementById('estado').checked,
    rol: document.querySelector('input[name="userType"]:checked').value
  };
  
  try {
    const url = currentUserId ? `/api/usuarios/${currentUserId}` : '/api/usuarios';
    const method = currentUserId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) throw new Error('Error al guardar usuario');
    
    showSuccess(currentUserId ? 'Usuario actualizado' : 'Usuario creado');
    resetForm();
    loadUsers();
  } catch (error) {
    showError('No se pudo guardar el usuario');
    console.error(error);
  }
});

// Eliminar usuario
deleteBtn.addEventListener('click', () => {
  const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
  modal.show();
});

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  try {
    const response = await fetch(`/api/usuarios/${currentUserId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Error al eliminar usuario');
    
    showSuccess('Usuario eliminado');
    bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
    resetForm();
    loadUsers();
  } catch (error) {
    showError('No se pudo eliminar el usuario');
    console.error(error);
  }
});

// Actualizar
refreshBtn.addEventListener('click', loadUsers);

// Utilidades
function resetForm() {
  userForm.reset();
  currentUserId = null;
  setFormReadonly(true);
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  submitBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
}

function setFormReadonly(readonly) {
  const inputs = userForm.querySelectorAll('input:not([type="hidden"])');
  inputs.forEach(input => input.disabled = readonly);
}

function showLoading(show) {
  document.querySelector('.loading-spinner').style.display = show ? 'block' : 'none';
}

function showError(message) {
  Swal.fire({ icon: 'error', title: 'Error', text: message, timer: 3000 });
}

function showSuccess(message) {
  Swal.fire({ icon: 'success', title: 'Éxito', text: message, timer: 2000, showConfirmButton: false });
}
