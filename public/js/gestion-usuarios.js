// ============================================ 
// SISTEMA DE GESTIÓN DE USUARIOS - CESDE
// ============================================

class GestionUsuarios {
    constructor() {
        this.usuarioActual = null;
        this.modoEdicion = false;
        this.usuarioEditId = null;
        
        this.inicializarEventos();
        this.cargarUsuarios();
    }

    inicializarEventos() {
        // Formulario de usuario
        document.getElementById('formUsuario').addEventListener('submit', (e) => this.manejarEnvioFormulario(e));
        
        // Cambios en el formulario
        document.getElementById('contrasena').addEventListener('input', () => this.actualizarAyudaPassword());
    }

    async cargarUsuarios() {
        this.mostrarLoading(true);
        
        try {
            const respuesta = await fetch('/api/usuarios');
            const usuarios = await respuesta.json();
            
            if (respuesta.ok) {
                this.mostrarUsuarios(usuarios);
                this.actualizarEstadisticas(usuarios);
            } else {
                this.mostrarError('Error al cargar usuarios');
            }
        } catch (error) {
            this.mostrarError('Error de conexión al cargar usuarios');
        } finally {
            this.mostrarLoading(false);
        }
    }

    mostrarUsuarios(usuarios) {
        const tbody = document.getElementById('tablaUsuariosBody');
        tbody.innerHTML = '';

        usuarios.forEach(usuario => {
            const fila = document.createElement('tr');
            fila.className = 'user-card';
            
            // Determinar el badge según el rol
            let badge = '';
            if (usuario.rol_usuario_superadministrador) {
                badge = '<span class="badge-cesde-superadmin">Super Admin</span>';
            } else if (usuario.rol_usuario_administrador) {
                badge = '<span class="badge-cesde-admin">Administrador</span>';
            } else if (usuario.rol_usuario_normal) {
                badge = '<span class="badge-cesde-estudiante">Usuario Normal</span>';
            }

            fila.innerHTML = `
                <td>${usuario.id_usuarios}</td>
                <td>${usuario.identificacion}</td>
                <td>${usuario.nombres_y_apellidos}</td>
                <td>${usuario.correo_electronico || 'N/A'}</td>
                <td>${badge}</td>
                <td>
                    <span class="badge ${usuario.estado ? 'bg-success' : 'bg-secondary'}">
                        ${usuario.estado ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="gestionUsuarios.editarUsuario(${usuario.id_usuarios})" 
                        ${!this.tienePermisosEdicion() ? 'disabled' : ''}>
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="gestionUsuarios.eliminarUsuario(${usuario.id_usuarios})"
                        ${!this.tienePermisosEliminacion() ? 'disabled' : ''}>
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(fila);
        });
    }

    actualizarEstadisticas(usuarios) {
        const total = usuarios.length;
        const activos = usuarios.filter(u => u.estado).length;
        const admins = usuarios.filter(u => u.rol_usuario_administrador || u.rol_usuario_superadministrador).length;
        const inactivos = total - activos;

        document.getElementById('totalUsers').textContent = total;
        document.getElementById('activeUsers').textContent = activos;
        document.getElementById('adminUsers').textContent = admins;
        document.getElementById('inactiveUsers').textContent = inactivos;
    }

    async editarUsuario(idUsuario) {
        this.mostrarLoading(true);
        
        try {
            const respuesta = await fetch('/api/usuarios');
            const usuarios = await respuesta.json();
            
            if (respuesta.ok) {
                const usuario = usuarios.find(u => u.id_usuarios === idUsuario);
                if (usuario) {
                    this.mostrarFormularioEdicion(usuario);
                }
            } else {
                this.mostrarError('Error al cargar datos del usuario');
            }
        } catch (error) {
            this.mostrarError('Error de conexión');
        } finally {
            this.mostrarLoading(false);
        }
    }

    mostrarFormularioEdicion(usuario) {
        this.modoEdicion = true;
        this.usuarioEditId = usuario.id_usuarios;

        // Llenar formulario
        document.getElementById('userId').value = usuario.id_usuarios;
        document.getElementById('identificacion').value = usuario.identificacion;
        document.getElementById('nombres_y_apellidos').value = usuario.nombres_y_apellidos;
        document.getElementById('correo_electronico').value = usuario.correo_electronico || '';
        document.getElementById('contrasena').value = '';
        document.getElementById('estado').checked = usuario.estado;

        // Configurar tipo de usuario
        this.configurarTipoUsuario(usuario);

        // Actualizar interfaz
        document.getElementById('formTitulo').innerHTML = '<i class="bi bi-person-gear me-2"></i>Editando Usuario';
        document.getElementById('btnSubmitText').textContent = 'Actualizar Usuario';
        document.getElementById('btnCancelar').style.display = 'block';
        document.getElementById('passwordRequired').style.display = 'none';
        
        this.actualizarAyudaPassword();
    }

    configurarTipoUsuario(usuario) {
        const radios = document.getElementsByName('tipoUsuario');
        
        for (let radio of radios) {
            radio.checked = false;
            
            if (usuario.rol_usuario_superadministrador && radio.value === 'superadmin') {
                radio.checked = true;
            } else if (usuario.rol_usuario_administrador && radio.value === 'admin') {
                radio.checked = true;
            } else if (usuario.rol_usuario_normal && radio.value === 'estudiante') {
                radio.checked = true;
            }
        }
    }

    async manejarEnvioFormulario(e) {
        e.preventDefault();
        
        const datosUsuario = this.obtenerDatosFormulario();
        
        if (!this.validarDatosUsuario(datosUsuario)) {
            return;
        }

        this.mostrarLoading(true);

        try {
            let respuesta;
            
            if (this.modoEdicion) {
                respuesta = await fetch(`/api/usuarios/${this.usuarioEditId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(datosUsuario)
                });
            } else {
                respuesta = await fetch('/api/usuarios', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(datosUsuario)
                });
            }

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                this.mostrarExito(this.modoEdicion ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
                this.limpiarFormulario();
                this.cargarUsuarios();
            } else {
                this.mostrarError(resultado.error || 'Error al procesar la solicitud');
            }
        } catch (error) {
            this.mostrarError('Error de conexión al procesar la solicitud');
        } finally {
            this.mostrarLoading(false);
        }
    }

    obtenerDatosFormulario() {
        const tipoUsuario = document.querySelector('input[name="tipoUsuario"]:checked').value;
        
        const datos = {
            identificacion: document.getElementById('identificacion').value,
            nombres_y_apellidos: document.getElementById('nombres_y_apellidos').value,
            correo_electronico: document.getElementById('correo_electronico').value,
            estado: document.getElementById('estado').checked,
            rol: tipoUsuario
        };

        // Solo incluir contraseña si se proporcionó una nueva
        const contrasena = document.getElementById('contrasena').value;
        if (contrasena) {
            datos.contrasena = contrasena;
        }

        return datos;
    }

    validarDatosUsuario(datos) {
        if (!datos.identificacion || !datos.nombres_y_apellidos || !datos.correo_electronico) {
            this.mostrarError('Todos los campos marcados con * son obligatorios');
            return false;
        }

        if (!this.modoEdicion && !datos.contrasena) {
            this.mostrarError('La contraseña es obligatoria para nuevos usuarios');
            return false;
        }

        if (!this.validarEmail(datos.correo_electronico)) {
            this.mostrarError('Por favor ingrese un email válido');
            return false;
        }

        return true;
    }

    validarEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    async eliminarUsuario(idUsuario) {
        const resultado = await Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (resultado.isConfirmed) {
            this.mostrarLoading(true);
            
            try {
                const respuesta = await fetch(`/api/usuarios/${idUsuario}`, {
                    method: 'DELETE'
                });

                const resultado = await respuesta.json();

                if (respuesta.ok) {
                    this.mostrarExito('Usuario eliminado correctamente');
                    this.cargarUsuarios();
                } else {
                    this.mostrarError(resultado.error || 'Error al eliminar usuario');
                }
            } catch (error) {
                this.mostrarError('Error de conexión al eliminar usuario');
            } finally {
                this.mostrarLoading(false);
            }
        }
    }

    limpiarFormulario() {
        document.getElementById('formUsuario').reset();
        document.getElementById('userId').value = '';
        document.getElementById('formTitulo').innerHTML = '<i class="bi bi-person-gear me-2"></i>Gestión de Usuario';
        document.getElementById('btnSubmitText').textContent = 'Crear Usuario';
        document.getElementById('btnCancelar').style.display = 'none';
        document.getElementById('passwordRequired').style.display = 'inline';
        
        this.modoEdicion = false;
        this.usuarioEditId = null;
        
        this.actualizarAyudaPassword();
    }

    actualizarAyudaPassword() {
        const ayuda = document.getElementById('passwordHelp');
        const requerido = document.getElementById('passwordRequired');
        
        if (this.modoEdicion) {
            ayuda.textContent = 'Dejar en blanco para mantener la contraseña actual';
            ayuda.className = 'text-muted';
            requerido.style.display = 'none';
        } else {
            ayuda.textContent = 'Mínimo 6 caracteres';
            ayuda.className = 'text-muted';
            requerido.style.display = 'inline';
        }
    }

    mostrarFormularioUsuario() {
        this.limpiarFormulario();
        document.getElementById('identificacion').focus();
    }

    tienePermisosEdicion() {
        // En un sistema real, verificaríamos los permisos del usuario actual
        return true;
    }

    tienePermisosEliminacion() {
        // En un sistema real, verificaríamos los permisos del usuario actual
        return true;
    }

    mostrarLoading(mostrar) {
        const spinner = document.getElementById('loadingSpinner');
        spinner.style.display = mostrar ? 'block' : 'none';
    }

    mostrarExito(mensaje) {
        Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: mensaje,
            timer: 3000,
            showConfirmButton: false
        });
    }

    mostrarError(mensaje) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensaje
        });
    }
}

// Funciones globales para llamar desde HTML
function cargarUsuarios() {
    gestionUsuarios.cargarUsuarios();
}

function mostrarFormularioUsuario() {
    gestionUsuarios.mostrarFormularioUsuario();
}

function limpiarFormulario() {
    gestionUsuarios.limpiarFormulario();
}

// Inicializar el sistema cuando se carga la página
let gestionUsuarios;
document.addEventListener('DOMContentLoaded', () => {
    gestionUsuarios = new GestionUsuarios();
});