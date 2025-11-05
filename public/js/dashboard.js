/* ============================================
   DASHBOARD.JS - GESTIÓN DE USUARIOS
   ============================================ */

let usuarioSeleccionado = null;
let deleteModal = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Dashboard inicializado');
  
  // Inicializar modal
  deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
  
  // Cargar usuarios
  cargarUsuarios();
  
  // Event listeners
  const newUserBtn = document.getElementById('newUserBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const userForm = document.getElementById('userForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  
  if (newUserBtn) newUserBtn.addEventListener('click', nuevoUsuario);
  if (refreshBtn) refreshBtn.addEventListener('click', cargarUsuarios);
  if (userForm) userForm.addEventListener('submit', guardarUsuario);
  if (cancelBtn) cancelBtn.addEventListener('click', cancelarEdicion);
  if (deleteBtn) deleteBtn.addEventListener('click', abrirConfirmDelete);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmarDelete);
});

/* ============================================
   CARGAR USUARIOS
   ============================================ */

async function cargarUsuarios() {
  console.log('📌 Cargando usuarios...');
  try {
    const response = await fetch('/api/usuarios');
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error('Error HTTP: ' + response.status);
    }
    
    // ✅ CAMBIO AQUÍ - La API devuelve directamente un array
    const usuarios = await response.json();
    console.log('Datos recibidos:', usuarios);
    
    // Verificar si es array o objeto con success
    let usuariosList = Array.isArray(usuarios) ? usuarios : usuarios.usuarios;
    
    if (usuariosList && usuariosList.length > 0) {
      mostrarUsuarios(usuariosList);
      actualizarEstadisticas(usuariosList);
    } else {
      mostrarErrorEnTabla('No hay usuarios');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarErrorEnTabla('Error de conexión: ' + error.message);
  }
}


/* ============================================
   MOSTRAR USUARIOS EN TABLA
   ============================================ */

function mostrarUsuarios(usuarios) {
  console.log('📝 Mostrando usuarios:', usuarios.length);
  const tbody = document.getElementById('userTableBody');
  
  if (!tbody) {
    console.error('❌ Elemento userTableBody no encontrado');
    return;
  }
  
  if (!usuarios || usuarios.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          No hay usuarios registrados
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = usuarios.map(usuario => `
    <tr>
      <td>${usuario.id_usuarios || '-'}</td>
      <td>${usuario.identificacion || '-'}</td>
      <td>${usuario.nombres_y_apellidos || '-'}</td>
      <td>${usuario.correo_electronico || '-'}</td>
      <td>
        ${getRolBadge(usuario)}
      </td>
      <td>
        <span class="badge ${usuario.estado ? 'bg-success' : 'bg-danger'}">
          ${usuario.estado ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editarUsuario('${usuario.id_usuarios}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="seleccionarParaBorrar('${usuario.id_usuarios}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

/* ============================================
   MOSTRAR ERROR EN TABLA
   ============================================ */

function mostrarErrorEnTabla(mensaje) {
  const tbody = document.getElementById('userTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger py-4">
          <strong>Error:</strong> ${mensaje}
        </td>
      </tr>
    `;
  }
}

/* ============================================
   OBTENER BADGE DE ROL
   ============================================ */

function getRolBadge(usuario) {
  if (usuario.rol_usuario_superadministrador) {
    return '<span class="badge bg-danger">SuperAdmin</span>';
  } else if (usuario.rol_usuario_administrador) {
    return '<span class="badge bg-warning text-dark">Admin</span>';
  } else {
    return '<span class="badge bg-primary">Usuario</span>';
  }
}

/* ============================================
   ACTUALIZAR ESTADÍSTICAS
   ============================================ */

function actualizarEstadisticas(usuarios) {
  const totalUsersEl = document.getElementById('totalUsers');
  const activeUsersEl = document.getElementById('activeUsers');
  const adminUsersEl = document.getElementById('adminUsers');
  const superadminUsersEl = document.getElementById('superadminUsers');
  
  if (totalUsersEl) totalUsersEl.textContent = usuarios.length;
  
  if (activeUsersEl) {
    const activos = usuarios.filter(u => u.estado).length;
    activeUsersEl.textContent = activos;
  }
  
  if (adminUsersEl) {
    const admins = usuarios.filter(u => u.rol_usuario_administrador || u.rol_usuario_superadministrador).length;
    adminUsersEl.textContent = admins;
  }
  
  if (superadminUsersEl) {
    const superadmins = usuarios.filter(u => u.rol_usuario_superadministrador).length;
    superadminUsersEl.textContent = superadmins;
  }
}

/* ============================================
   NUEVO USUARIO
   ============================================ */

function nuevoUsuario() {
  console.log('➕ Nuevo usuario');
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('roleNormal').checked = true;
  document.getElementById('estado').checked = true;
  document.getElementById('submitBtn').style.display = 'inline-block';
  document.getElementById('cancelBtn').style.display = 'inline-block';
  document.getElementById('deleteBtn').disabled = true;
  usuarioSeleccionado = null;
}

/* ============================================
   EDITAR USUARIO
   ============================================ */

async function editarUsuario(idUsuario) {
  console.log('✏️ Editando usuario:', idUsuario);
  
  // Primero cargar los usuarios para obtener los datos
  try {
    const response = await fetch('/api/usuarios');
    const data = await response.json();
    
    if (!data.success) {
      alert('Error al cargar usuario');
      return;
    }
    
    const usuario = data.usuarios.find(u => u.id_usuarios == idUsuario);
    if (!usuario) {
      alert('Usuario no encontrado');
      return;
    }
    
    usuarioSeleccionado = usuario;
    
    document.getElementById('userId').value = usuario.id_usuarios || '';
    document.getElementById('identificacion').value = usuario.identificacion || '';
    document.getElementById('nombres').value = usuario.nombres_y_apellidos || '';
    document.getElementById('correo').value = usuario.correo_electronico || '';
    document.getElementById('contrasena').value = '';
    
    // Seleccionar rol
    if (usuario.rol_usuario_superadministrador) {
      document.getElementById('roleSuperAdmin').checked = true;
    } else if (usuario.rol_usuario_administrador) {
      document.getElementById('roleAdmin').checked = true;
    } else {
      document.getElementById('roleNormal').checked = true;
    }
    
    document.getElementById('estado').checked = usuario.estado || false;
    
    document.getElementById('submitBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    document.getElementById('deleteBtn').disabled = false;
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar usuario');
  }
}

/* ============================================
   GUARDAR USUARIO
   ============================================ */

async function guardarUsuario(e) {
  e.preventDefault();
  console.log('💾 Guardando usuario...');
  
  const isEdit = document.getElementById('userId').value !== '';
  const url = isEdit ? '/api/usuarios/update' : '/api/usuarios/create';
  
  const data = {
    id_usuarios: document.getElementById('userId').value || undefined,
    identificacion: document.getElementById('identificacion').value,
    nombres_y_apellidos: document.getElementById('nombres').value,
    correo_electronico: document.getElementById('correo').value,
    contrasena: document.getElementById('contrasena').value || undefined,
    rol_usuario_normal: document.getElementById('roleNormal').checked,
    rol_usuario_administrador: document.getElementById('roleAdmin').checked,
    rol_usuario_superadministrador: document.getElementById('roleSuperAdmin').checked,
    estado: document.getElementById('estado').checked
  };
  
  console.log('Enviando:', url, data);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const resultado = await response.json();
    console.log('Respuesta:', resultado);
    
    if (resultado.success) {
      alert('✅ ' + resultado.message);
      cargarUsuarios();
      cancelarEdicion();
    } else {
      alert('❌ Error: ' + resultado.message);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al guardar: ' + error.message);
  }
}

/* ============================================
   CANCELAR EDICIÓN
   ============================================ */

function cancelarEdicion() {
  console.log('❌ Cancelar');
  document.getElementById('userForm').reset();
  document.getElementById('submitBtn').style.display = 'none';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('deleteBtn').disabled = true;
  document.getElementById('roleNormal').checked = true;
  document.getElementById('estado').checked = true;
  usuarioSeleccionado = null;
}

/* ============================================
   SELECCIONAR PARA BORRAR
   ============================================ */

function seleccionarParaBorrar(idUsuario) {
  console.log('🗑️ Seleccionar para borrar:', idUsuario);
  
  // Cargar datos del usuario para mostrar en modal
  fetch('/api/usuarios')
    .then(r => r.json())
    .then(d => {
      const usuario = d.usuarios.find(u => u.id_usuarios == idUsuario);
      usuarioSeleccionado = usuario;
      deleteModal.show();
    });
}

/* ============================================
   CONFIRMAR DELETE
   ============================================ */

async function confirmarDelete() {
  if (!usuarioSeleccionado) return;
  
  console.log('🗑️ Confirmar eliminar:', usuarioSeleccionado.id_usuarios);
  
  try {
    const response = await fetch('/api/usuarios/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuarios: usuarioSeleccionado.id_usuarios })
    });
    
    const resultado = await response.json();
    console.log('Respuesta delete:', resultado);
    
    if (resultado.success) {
      alert('✅ Usuario eliminado correctamente');
      deleteModal.hide();
      cargarUsuarios();
      cancelarEdicion();
    } else {
      alert('❌ Error: ' + resultado.message);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al eliminar: ' + error.message);
  }
}

/* ============================================
   ABRIR CONFIRMAR DELETE
   ============================================ */

function abrirConfirmDelete() {
  if (!usuarioSeleccionado) {
    alert('⚠️ Selecciona un usuario para eliminar');
    return;
  }
  deleteModal.show();
}
