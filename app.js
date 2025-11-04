const SUPABASE_URL = 'https://xwvexjaunujjhuhddlpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dmV4amF1bnVqamh1aGRkbHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMTkyMzksImV4cCI6MjA1ODY5NTIzOX0.xLma_qILItRihs4VwE55-6CA8Db8zdkFZXrNf04AOt0';
const LOGS_TABLE = 'system_logs';

// DOM Elements
const userTableBody = document.getElementById('userTableBody');
const userForm = document.getElementById('userForm');
const loginForm = document.getElementById('loginForm');
const refreshBtn = document.getElementById('refreshBtn');
const newUserBtn = document.getElementById('newUserBtn');
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');
const formTitle = document.getElementById('formTitle');
const userInfo = document.getElementById('userInfo');
const loadingSpinners = document.querySelectorAll('.loading-spinner');
const errorContainer = document.getElementById('errorContainer');

// Variables de estado
let currentMode = 'create';
let currentUserId = null;

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

// Eventos
document.addEventListener('DOMContentLoaded', () => {
  checkLoggedInUser();
  loadUsers();
 
  if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
  if (newUserBtn) newUserBtn.addEventListener('click', setCreateMode);
  if (editBtn) editBtn.addEventListener('click', setEditMode);
  if (deleteBtn) deleteBtn.addEventListener('click', showDeleteConfirmation);
  if (cancelBtn) cancelBtn.addEventListener('click', cancelAction);
  if (userForm) userForm.addEventListener('submit', handleUserSubmit);
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
});

function checkLoggedInUser() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user) {
    showUserInfo(`Logged in as: ${user.nombre_usuario} (${user.email})`);
  }
}

function showUserInfo(message) {
  userInfo.textContent = message;
  userInfo.style.display = 'block';
}

function displayError(message) {
  const errorAlert = document.createElement('div');
  errorAlert.className = 'alert alert-danger alert-dismissible fade show';
  errorAlert.role = 'alert';
  errorAlert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  errorContainer.appendChild(errorAlert);
 
  setTimeout(() => {
    errorAlert.remove();
  }, 5000);
}

async function loadUsers() {
  try {
    showLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
   
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
   
    const users = await res.json();
    renderUserTable(users);
  } catch (err) {
    console.error('Error loading users:', err);
    displayError(`Error loading users: ${err.message}`);
    showError('Failed to load users.');
  } finally {
    showLoading(false);
  }
}

function renderUserTable(users) {
  userTableBody.innerHTML = '';
  if (!users || users.length === 0) {
    userTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
    return;
  }

  users.forEach(user => {
    const row = document.createElement('tr');
    let userType, badgeClass;
    if (user.usuario_superadministrador) {
      userType = 'Super Admin';
      badgeClass = 'bg-danger';
      row.classList.add('superadmin-card');
    } else if (user.usuario_administrador) {
      userType = 'Admin';
      badgeClass = 'bg-success';
      row.classList.add('admin-card');
    } else {
      userType = 'User';
      badgeClass = 'bg-primary';
      row.classList.add('user-card');
    }

    row.innerHTML = `
      <td>${user.id_usuario}</td>
      <td>${user.nombre_usuario}</td>
      <td>${user.email}</td>
      <td><span class="badge ${badgeClass} user-type-badge">${userType}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-info view-details me-1" data-id="${user.id_usuario}">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    `;
    userTableBody.appendChild(row);
  });

  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const userId = btn.getAttribute('data-id');
      loadUserDetails(userId);
    });
  });

  document.querySelectorAll('#userTable tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      const userId = row.cells[0].textContent;
      loadUserDetails(userId);
    });
  });
}

async function loadUserDetails(userId) {
  try {
    showLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_usuario=eq.${userId}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
   
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
   
    const users = await res.json();
    if (users.length === 0) {
      throw new Error('User not found');
    }
   
    const user = users[0];
    populateForm(user);
    setViewMode();
    currentUserId = userId;
   
  } catch (err) {
    console.error('Error loading user details:', err);
    displayError(`Error loading user details: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function populateForm(user) {
  document.getElementById('userId').value = user.id_usuario;
  document.getElementById('identification').value = user.identificacion;
  document.getElementById('username').value = user.nombre_usuario;
  document.getElementById('email').value = user.email;
  document.getElementById('password').value = '';
 
  if (user.usuario_superadministrador) {
    document.getElementById('superadminUser').checked = true;
  } else if (user.usuario_administrador) {
    document.getElementById('adminUser').checked = true;
  } else {
    document.getElementById('normalUser').checked = true;
  }
}

function setCreateMode() {
  currentMode = 'create';
  currentUserId = null;
  userForm.reset();
  document.getElementById('userId').value = '';
  formTitle.textContent = 'Register New User';
  document.getElementById('submitText').textContent = 'Register';
  submitBtn.classList.remove('btn-warning');
  submitBtn.classList.add('btn-primary');
  submitBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'none';
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  setFormEditable(true);
}

function setViewMode() {
  currentMode = 'view';
  formTitle.textContent = 'User Details';
  submitBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  editBtn.disabled = false;
  deleteBtn.disabled = false;
  setFormEditable(false);
}

function setEditMode() {
  currentMode = 'edit';
  formTitle.textContent = 'Edit User';
  document.getElementById('submitText').textContent = 'Update';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-warning');
  submitBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'inline-block';
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  setFormEditable(true);
  document.getElementById('identification').readOnly = false;
}

function cancelAction() {
  if (currentUserId) {
    loadUserDetails(currentUserId);
    setViewMode();
  } else {
    setCreateMode();
  }
}

function setFormEditable(editable) {
  const inputs = userForm.querySelectorAll('input:not([type="hidden"]), select, textarea');
  inputs.forEach(input => {
    if (input.type === 'radio' || input.type === 'checkbox') {
      input.disabled = !editable;
    } else {
      input.readOnly = !editable;
      if (editable) {
        input.classList.remove('form-mode-view');
      } else {
        input.classList.add('form-mode-view');
      }
    }
  });
 
  const passwordField = document.getElementById('password');
  if (editable) {
    passwordField.placeholder = 'Enter new password (leave blank to keep current)';
    passwordField.required = false;
  } else {
    passwordField.placeholder = 'Password (hidden)';
    passwordField.required = true;
  }
}

async function handleUserSubmit(e) {
  e.preventDefault();
  try {
    showLoading(true, 'submit');
    await logActivity('info', 'user_management', `${currentMode} user operation started`);

    const identification = document.getElementById('identification').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;

    if (!identification || !username || !email) {
      throw new Error('Required fields are missing');
    }

    let passwordHash = null;
    if (password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const dataToSend = {
      identificacion: parseInt(identification),
      nombre_usuario: username,
      email: email,
      usuario_normal: document.querySelector('input[value="normal"]').checked ? 1 : 0,
      usuario_administrador: document.querySelector('input[value="admin"]').checked ? 1 : 0,
      usuario_superadministrador: document.querySelector('input[value="superadmin"]').checked ? 1 : 0
    };

    if (passwordHash) {
      dataToSend.clave_encriptada = passwordHash;
    }

    let method, url;
    if (currentMode === 'create') {
      method = 'POST';
      url = `${SUPABASE_URL}/rest/v1/usuarios`;
    } else {
      method = 'PATCH';
      url = `${SUPABASE_URL}/rest/v1/usuarios?id_usuario=eq.${currentUserId}`;
    }

    const res = await fetch(url, {
      method: method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(currentMode === 'create' ? [dataToSend] : dataToSend)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
    }

    const result = await res.json();
   
    if (currentMode === 'create') {
      await logActivity('info', 'user_management', 'New user created', {
        user_id: result[0].id_usuario,
        username: username,
        email: email
      });
    } else {
      await logActivity('info', 'user_management', 'User updated', {
        user_id: currentUserId,
        changes: dataToSend
      });
    }

    Swal.fire({
      icon: 'success',
      title: currentMode === 'create' ? 'User registered' : 'User updated',
      text: `User ${username} ${currentMode === 'create' ? 'created' : 'updated'} successfully`,
      timer: 2000,
      showConfirmButton: false
    });
   
    if (currentMode === 'create') {
      userForm.reset();
    }
   
    loadUsers();
    setViewMode();
   
  } catch (err) {
    await logActivity('error', 'user_management', `${currentMode} user operation failed`, {
      error: err.message,
      details: err.details || null
    });
   
    console.error('Operation error:', err);
    displayError(`Operation error: ${err.message}`);
    showError('Operation failed. Please try again.');
  } finally {
    showLoading(false, 'submit');
  }
}

function showDeleteConfirmation() {
  const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
  modal.show();
 
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      modal.hide();
      showLoading(true);
      await logActivity('info', 'user_management', 'User deletion attempt', {
        user_id: currentUserId
      });
     
      const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_usuario=eq.${currentUserId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
     
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
     
      await logActivity('info', 'user_management', 'User deleted successfully', {
        user_id: currentUserId
      });
     
      Swal.fire({
        icon: 'success',
        title: 'User deleted',
        text: 'User deleted successfully',
        timer: 2000,
        showConfirmButton: false
      });
     
      setCreateMode();
      loadUsers();
     
    } catch (err) {
      await logActivity('error', 'user_management', 'User deletion failed', {
        user_id: currentUserId,
        error: err.message
      });
     
      console.error('Delete error:', err);
      displayError(`Delete error: ${err.message}`);
      showError('Failed to delete user.');
    } finally {
      showLoading(false);
    }
  };
}

async function handleLogin(e) {
  e.preventDefault();
  try {
    showLoading(true, 'login');
    await logActivity('info', 'login', 'Login attempt started', {
      email: document.getElementById('loginEmail').value
    });

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const users = await res.json();
    const user = users[0];

    if (!user) {
      throw new Error('User not found. Please check your email address.');
    }

    if (user.clave_encriptada !== passwordHash) {
      await logActivity('warning', 'login', 'Incorrect password attempt', {
        email: email
      });
      throw new Error('Incorrect password. Please try again.');
    }

    await logActivity('info', 'login', 'Login successful', {
      user_id: user.id_usuario
    });

    Swal.fire({
      icon: 'success',
      title: 'Login successful',
      text: `Welcome, ${user.nombre_usuario}`,
      timer: 2000,
      showConfirmButton: false
    });

    localStorage.setItem('currentUser', JSON.stringify(user));
    showUserInfo(`Logged in as: ${user.nombre_usuario} (${user.email})`);
   
  } catch (err) {
    await logActivity('error', 'login', 'Login failed', {
      error: err.message,
      email: document.getElementById('loginEmail').value
    });
   
    Swal.fire({
      icon: 'error',
      title: 'Login Failed',
      text: err.message,
      timer: 3000,
      showConfirmButton: true
    });
   
  } finally {
    showLoading(false, 'login');
  }
}

function showLoading(show, target = 'all') {
  if (target === 'all') {
    loadingSpinners.forEach(sp => sp.style.display = show ? 'inline-block' : 'none');
  } else if (target === 'submit' && userForm) {
    toggleBtnLoading('submitText', userForm, show);
  } else if (target === 'login' && loginForm) {
    toggleBtnLoading('loginText', loginForm, show);
  }
}

function toggleBtnLoading(textId, form, show) {
  const textElement = form.querySelector(`#${textId}`);
  const spinner = form.querySelector('.loading-spinner');
  const button = form.querySelector('button[type="submit"]');
 
  if (textElement) textElement.style.display = show ? 'none' : 'inline-block';
  if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
  if (button) button.disabled = show;
}

function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    timer: 3000
  });
}

function displayError(message, details = '') {
  const errorContainer = document.getElementById('errorContainer');
  const errorDetails = document.getElementById('errorDetails');
 
  errorDetails.textContent = `${message} ${details}`;
  errorContainer.style.display = 'block';
 
  setTimeout(() => {
    errorContainer.style.display = 'none';
  }, 10000);
}

function copyErrorToClipboard() {
  const errorDetails = document.getElementById('errorDetails').textContent;
  navigator.clipboard.writeText(errorDetails).then(() => {
    const copyBtn = document.querySelector('#errorContainer button');
    copyBtn.innerHTML = '<i class="bi bi-check2"></i> Copiado!';
    setTimeout(() => {
      copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar';
    }, 2000);
  }).catch(err => {
    console.error('Error al copiar:', err);
  });
}