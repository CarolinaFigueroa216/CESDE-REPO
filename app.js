// ============================================
// IMPORTACIÓN DE DEPENDENCIAS Y CONFIGURACIÓN INICIAL
// ============================================

// Carga las variables de entorno desde el archivo .env
require('dotenv').config();

// Framework web para Node.js - maneja rutas, middlewares y servidor HTTP
const express = require('express');

// Gestión de sesiones de usuario (almacena datos entre peticiones HTTP)
const session = require('express-session');

// Cliente de Supabase para conectarse a la base de datos PostgreSQL
const { createClient } = require('@supabase/supabase-js');

// Módulo nativo de Node.js para manejar rutas de archivos y directorios
const path = require('path');

// Biblioteca para hashear contraseñas de forma segura (bcrypt con salt)
const bcrypt = require('bcryptjs');

// Cliente HTTP para hacer peticiones a APIs externas (reCAPTCHA)
const axios = require('axios');

// Middleware personalizado para proteger rutas según el rol del usuario
const { requireAuth, requireAdmin, requireSuperAdmin } = require('./middleware/authMiddleware');

// Utilidades para generar, hashear y verificar códigos OTP (One-Time Password)
const { generateOtp, hashOtp, verifyOtp, addMinutes } = require('./utils/otp');

// Función para enviar correos electrónicos con códigos OTP usando SMTP
const { sendOtpMail } = require('./utils/mail');

// ============================================
// CONFIGURACIÓN DE EXPRESS
// ============================================

// Crea una instancia de la aplicación Express
const app = express();

// Define el puerto del servidor; usa el del .env o 3000 por defecto
const PORT = process.env.PORT || 3000;

// Lee la URL de Supabase desde las variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;

// Lee la clave API de Supabase desde las variables de entorno
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Verifica que las credenciales de Supabase estén configuradas
if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Si faltan, muestra error en consola y detiene la aplicación
  console.error('❌ Error: Variables de entorno SUPABASE_URL o SUPABASE_KEY no definidas');
  process.exit(1); // Código de salida 1 indica error
}

// Crea el cliente de Supabase con las credenciales cargadas
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// MIDDLEWARES GLOBALES
// ============================================

// Permite que Express entienda JSON en el body de las peticiones POST/PUT
app.use(express.json());

// Permite que Express entienda datos de formularios (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Sirve archivos estáticos (CSS, JS, imágenes) desde la carpeta /public
app.use(express.static(path.join(__dirname, 'public')));

// Configura el manejo de sesiones con cookies
app.use(session({
  // Clave secreta para firmar las cookies de sesión (debe ser única y privada)
  secret: process.env.SESSION_SECRET || 'clave-secreta-temporal',
  
  // No volver a guardar la sesión si no ha cambiado (optimización)
  resave: false,
  
  // No crear sesión vacía hasta que se guarde algo
  saveUninitialized: false,
  
  // Configuración de la cookie de sesión
  cookie: { 
    secure: false,              // true solo si usas HTTPS en producción
    maxAge: 24 * 60 * 60 * 1000 // Expira en 24 horas (en milisegundos)
  }
}));

// Define EJS como motor de plantillas (permite HTML dinámico)
app.set('view engine', 'ejs');

// Define la carpeta donde están las vistas EJS
app.set('views', path.join(__dirname, 'views'));

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Función para validar si un email tiene formato correcto
const isValidEmail = (email) => {
  // Expresión regular básica para validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Función asíncrona para verificar el token de Google reCAPTCHA v2
const verifyRecaptchaV2 = async (token, remoteip = null) => {
  try {
    // Prepara los datos para enviar a Google
    const payload = {
      secret: process.env.RECAPTCHA_SECRET_KEY, // Clave secreta del servidor
      response: token                            // Token recibido del cliente
    };

    // Opcional: incluye la IP del cliente para mayor precisión
    if (remoteip) {
      payload.remoteip = remoteip;
    }

    // Hace petición POST a la API de Google para verificar el token
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: payload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Retorna la respuesta de Google (contiene success: true/false)
    return response.data;
  } catch (error) {
    // Si falla la petición, log del error y retorna fallo
    console.error('Error verificando reCAPTCHA v2:', error);
    return { success: false, 'error-codes': ['network-error'] };
  }
};

// ============================================
// PROTECCIÓN CONTRA FUERZA BRUTA
// ============================================

// Almacén en memoria de intentos fallidos de login por IP
// En producción usar Redis o base de datos
const loginAttempts = new Map();

// Verifica si una IP está bloqueada por demasiados intentos fallidos
const checkLoginAttempts = (ip) => {
  // Obtiene el registro de intentos de esa IP o crea uno nuevo
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
  const now = Date.now();
  
  // Si han pasado más de 15 minutos desde el último intento, resetear
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return { blocked: false, attempts: 0 };
  }
  
  // Si ya hay 5 o más intentos fallidos, bloquear
  if (attempts.count >= 5) {
    return { blocked: true, attempts: attempts.count };
  }
  
  // Si no está bloqueado, retornar estado actual
  return { blocked: false, attempts: attempts.count };
};

// Registra un intento fallido de login para una IP
const recordFailedAttempt = (ip) => {
  // Obtiene o crea el registro de intentos
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
  attempts.count++;                  // Incrementa el contador
  attempts.lastAttempt = Date.now(); // Actualiza timestamp
  loginAttempts.set(ip, attempts);   // Guarda en el Map
};

// Limpia los intentos fallidos de una IP (tras login exitoso)
const clearFailedAttempts = (ip) => {
  loginAttempts.delete(ip);
};

// ============================================
// RUTAS PÚBLICAS
// ============================================

// Ruta raíz - redirige según el estado de autenticación
app.get('/', (req, res) => {
  // Si ya hay sesión activa, ir a welcome
  if (req.session.user) {
    return res.redirect('/welcome');
  }
  // Si no, ir al login
  res.redirect('/login');
});

// ============================================
// LOGIN - GET
// ============================================

// Muestra la página de login
app.get('/login', (req, res) => {
  // Si ya está autenticado, redirigir a welcome
  if (req.session.user) {
    return res.redirect('/welcome');
  }
  // Renderiza la vista login.ejs sin errores ni mensajes de éxito
  res.render('login', { error: null, success: null });
});

// ============================================
// LOGIN - POST (con reCAPTCHA v2 y 2FA)
// ============================================

app.post('/login', async (req, res) => {
  // Debug: muestra en consola los datos recibidos
  console.log('=== DEBUG LOGIN ===');
  console.log('Body completo:', req.body);
  console.log('reCAPTCHA token recibido:', req.body['g-recaptcha-response']);
  
  // Extrae los campos del formulario
  const { 
    identificacion,               // Campo identificación del usuario
    contrasena,                   // Contraseña en texto plano (será comparada con bcrypt)
    'g-recaptcha-response': recaptchaToken  // Token del reCAPTCHA v2
  } = req.body;

  try {
    // ========================================
    // PASO 1: Verificar intentos de fuerza bruta
    // ========================================
    const attemptCheck = checkLoginAttempts(req.ip);
    if (attemptCheck.blocked) {
      console.log(`🚫 IP bloqueada por intentos fallidos: ${req.ip} (${attemptCheck.attempts} intentos)`);
      return res.render('login', {
        error: `🚫 Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.`,
        success: null
      });
    }

    // ========================================
    // PASO 2: Verificar reCAPTCHA v2
    // ========================================
    if (!recaptchaToken) {
      console.log('❌ No hay token de reCAPTCHA en login');
      recordFailedAttempt(req.ip);  // Cuenta como intento fallido
      return res.render('login', {
        error: '🤖 Por favor, completa la verificación "No soy un robot".',
        success: null
      });
    }

    console.log('✅ Token de reCAPTCHA recibido en login, verificando...');
    // Llama a la API de Google para validar el token
    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken, req.ip);
    console.log('Resultado de verificación login:', recaptchaResult);
    
    // Si Google rechaza el token
    if (!recaptchaResult.success) {
      console.log('❌ reCAPTCHA v2 fallido en login:', recaptchaResult['error-codes']);
      recordFailedAttempt(req.ip);
      
      // Mensajes específicos según el código de error
      let errorMessage = '🤖 Verificación de seguridad fallida.';
      if (recaptchaResult['error-codes']) {
        const errorCodes = recaptchaResult['error-codes'];
        if (errorCodes.includes('timeout-or-duplicate')) {
          errorMessage = '🤖 La verificación ha expirado. Por favor, intenta de nuevo.';
        } else if (errorCodes.includes('invalid-input-response')) {
          errorMessage = '🤖 Verificación inválida. Por favor, completa el CAPTCHA nuevamente.';
        }
      }
      
      return res.render('login', {
        error: errorMessage,
        success: null
      });
    }

    console.log('✅ reCAPTCHA verificado en login, continuando...');

    // ========================================
    // PASO 3: Buscar usuario en la BD
    // ========================================
    const { data: users, error } = await supabase
      .from('usuarios')                  // Tabla usuarios
      .select('*')                        // Selecciona todas las columnas
      .eq('identificacion', identificacion); // Donde identificacion = valor del formulario

    // Si hay error en la consulta a Supabase
    if (error) {
      console.error('❌ Error de Supabase:', error);
      recordFailedAttempt(req.ip);
      return res.render('login', {
        error: '🛑 Error del servidor al buscar usuario.',
        success: null
      });
    }

    // Si no se encontró ningún usuario con esa identificación
    if (!users || users.length === 0) {
      console.log(`🔍 Intento de login fallido - Usuario no encontrado: ${identificacion} (IP: ${req.ip})`);
      recordFailedAttempt(req.ip);
      return res.render('login', {
        error: '❌ Usuario no encontrado.',
        success: null
      });
    }

    // Usuario encontrado (primer resultado del array)
    const user = users[0];

    // ========================================
    // PASO 4: Verificar estado del usuario
    // ========================================
    if (!user.estado) {
      console.log(`⚠️ Intento de login - Usuario inactivo: ${identificacion} (IP: ${req.ip})`);
      recordFailedAttempt(req.ip);
      return res.render('login', {
        error: '⚠️ Usuario inactivo.',
        success: null
      });
    }

    // ========================================
    // PASO 5: Verificar contraseña con bcrypt
    // ========================================
    // Compara la contraseña en texto plano con el hash almacenado
    const passwordMatch = await bcrypt.compare(contrasena, user.contrasena);
    if (!passwordMatch) {
      console.log(`🔒 Intento de login fallido - Contraseña incorrecta: ${identificacion} (IP: ${req.ip})`);
      recordFailedAttempt(req.ip);
      return res.render('login', {
        error: '🔒 Contraseña incorrecta.',
        success: null
      });
    }

    // ========================================
    // PASO 6: Credenciales válidas - Iniciar flujo 2FA
    // ========================================
    
    // Limpiar intentos fallidos porque las credenciales son correctas
    clearFailedAttempts(req.ip);
    
    // Guardar estado "pendiente de 2FA" en sesión (NO dar acceso completo aún)
    req.session.pending2fa = { 
      identificacion: user.identificacion, 
      correo: user.correo_electronico 
    };

    // Invalidar cualquier OTP previo que no haya sido usado
    await supabase
      .from('user_otp')
      .update({ used: true })                       // Marcar como usado
      .eq('identificacion', user.identificacion)    // Del mismo usuario
      .eq('used', false)                            // Que no esté usado ya
      .eq('purpose', 'login_2fa');                  // Del propósito de login 2FA

    // Generar nuevo código OTP de 6 dígitos
    const otp = generateOtp(6);
    
    // Hashear el OTP antes de guardarlo (nunca guardar en texto plano)
    const otpHash = await hashOtp(otp);
    
    // Calcular fecha de expiración (10 minutos desde ahora)
    const expiresAt = addMinutes(10);

    // Guardar el OTP hasheado en la base de datos
    const { error: otpErr } = await supabase.from('user_otp').insert([{
      identificacion: user.identificacion,  // A quién pertenece el OTP
      otp_hash: otpHash,                     // Hash del código
      expires_at: expiresAt,                 // Cuándo expira
      channel: 'email',                      // Canal de envío
      purpose: 'login_2fa'                   // Propósito (login con 2FA)
    }]);

    // Si hubo error al guardar el OTP
    if (otpErr) {
      console.error('❌ Error insertando OTP:', otpErr);
      return res.render('login', {
        error: 'No se pudo generar el código de verificación. Intenta nuevamente.',
        success: null
      });
    }

    // ========================================
    // PASO 7: Enviar OTP por correo electrónico
    // ========================================
    try {
      await sendOtpMail(user.correo_electronico, otp);
    } catch (mailErr) {
      console.error('❌ Error enviando correo OTP:', mailErr);
      return res.render('login', {
        error: 'No se pudo enviar el código a tu correo. Intenta nuevamente.',
        success: null
      });
    }

    console.log(`✅ OTP enviado a ${user.correo_electronico}`);
    
    // Redirigir a la pantalla de verificación 2FA
    return res.redirect('/2fa');

  } catch (err) {
    // Error inesperado en todo el proceso de login
    console.error("❗️ Error al iniciar sesión:", err);
    recordFailedAttempt(req.ip);
    res.render('login', {
      error: '🛑 Error del servidor al procesar el inicio de sesión.',
      success: null
    });
  }
});

// ============================================
// RUTAS 2FA (Verificación de código OTP)
// ============================================

// GET /2fa - Muestra el formulario para ingresar el código OTP
app.get('/2fa', (req, res) => {
  // Si no hay estado pendiente de 2FA, redirigir al login
  if (!req.session.pending2fa) return res.redirect('/login');
  
  // Renderizar vista 2fa.ejs
  res.render('2fa', { error: null, success: null });
});

// POST /2fa - Verifica el código OTP ingresado
app.post('/2fa', async (req, res) => {
  // Obtener el estado pendiente de la sesión
  const pending = req.session.pending2fa;
  
  // Si no existe, el usuario está intentando acceder sin pasar por login
  if (!pending) return res.redirect('/login');

  // Obtener el código OTP del formulario
  const { otp } = req.body;

  // Buscar el último OTP activo (no usado) de este usuario
  const { data: rows, error } = await supabase
    .from('user_otp')
    .select('*')                                      // Seleccionar todos los campos
    .eq('identificacion', pending.identificacion)     // Del usuario actual
    .eq('used', false)                                // Que no haya sido usado
    .eq('purpose', 'login_2fa')                       // Del propósito de login 2FA
    .order('created_at', { ascending: false })        // Más reciente primero
    .limit(1);                                        // Solo el último

  // Si no se encontró ningún OTP activo
  if (error || !rows || rows.length === 0) {
    return res.render('2fa', { error: 'Código no encontrado o ya usado.', success: null });
  }

  // Obtener el registro del OTP
  const record = rows[0];

  // ========================================
  // Validación 1: Verificar si expiró
  // ========================================
  if (new Date(record.expires_at) < new Date()) {
    return res.render('2fa', { error: 'Código expirado. Solicita uno nuevo.', success: null });
  }

  // ========================================
  // Validación 2: Verificar intentos máximos
  // ========================================
  if (record.attempts >= record.max_attempts) {
    return res.render('2fa', { error: 'Se superó el número de intentos. Solicita un nuevo código.', success: null });
  }

  // ========================================
  // Validación 3: Comparar el código con bcrypt
  // ========================================
  const ok = await verifyOtp(otp, record.otp_hash);
  
  // Si el código no coincide
  if (!ok) {
    // Incrementar el contador de intentos fallidos
    await supabase.from('user_otp').update({ attempts: record.attempts + 1 }).eq('id', record.id);
    return res.render('2fa', { error: 'Código incorrecto.', success: null });
  }

  // ========================================
  // Código válido: Completar el login
  // ========================================
  
  // Marcar el OTP como usado para que no se pueda reutilizar
  await supabase.from('user_otp').update({ used: true }).eq('id', record.id);

  // Cargar los datos completos del usuario desde la BD
  const { data: users } = await supabase
    .from('usuarios')
    .select('*')
    .eq('identificacion', pending.identificacion)
    .limit(1);

  const user = users?.[0];
  
  // Si por alguna razón el usuario ya no existe, redirigir a login
  if (!user) return res.redirect('/login');

  // Crear copia del usuario sin la contraseña hasheada
  const userSession = { ...user };
  delete userSession.contrasena;
  
  // Guardar el usuario en la sesión (ahora sí tiene acceso completo)
  req.session.user = userSession;
  
  // Eliminar el estado pendiente de 2FA
  delete req.session.pending2fa;

  console.log(`✅ Login 2FA completado: ${user.nombres_y_apellidos}`);
  
  // Redirigir a la página de bienvenida
  return res.redirect('/welcome');
});

// ============================================
// POST /2fa/resend - Reenviar código OTP
// ============================================
app.post('/2fa/resend', async (req, res) => {
  // Verificar que existe estado pendiente de 2FA
  const pending = req.session.pending2fa;
  if (!pending) return res.redirect('/login');

  // ========================================
  // Protección anti-spam: Cooldown de 60 segundos
  // ========================================
  
  // Buscar el último OTP generado
  const { data: last } = await supabase
    .from('user_otp')
    .select('created_at')
    .eq('identificacion', pending.identificacion)
    .eq('used', false)
    .eq('purpose', 'login_2fa')
    .order('created_at', { ascending: false })
    .limit(1);

  // Si existe un OTP reciente
  if (last && last.length > 0) {
    // Calcular cuántos milisegundos han pasado desde su creación
    const diff = Date.now() - new Date(last[0].created_at).getTime();
    
    // Si han pasado menos de 60 segundos, rechazar
    if (diff < 60 * 1000) {
      return res.render('2fa', { error: 'Espera unos segundos antes de pedir otro código.', success: null });
    }
  }

  // ========================================
  // Generar y enviar nuevo OTP
  // ========================================
  
  // Generar nuevo código
  const otp = generateOtp(6);
  
  // Hashear el código
  const otpHash = await hashOtp(otp);

  // Guardar en la base de datos
  const { error: insErr } = await supabase.from('user_otp').insert([{
    identificacion: pending.identificacion,
    otp_hash: otpHash,
    expires_at: addMinutes(10),
    channel: 'email',
    purpose: 'login_2fa'
  }]);

  // Si hubo error al insertar
  if (insErr) {
    console.error('OTP RESEND INSERT ERROR:', insErr);
    return res.render('2fa', { error: 'No se pudo generar un nuevo código. Intenta de nuevo.', success: null });
  }

  // Intentar enviar el correo
  try {
    await sendOtpMail(pending.correo, otp);
  } catch (e) {
    console.error('SMTP RESEND ERROR:', e);
    return res.render('2fa', { error: 'No se pudo enviar el código. Intenta de nuevo.', success: null });
  }

  // Confirmar que se envió correctamente
  return res.render('2fa', { error: null, success: 'Se envió un nuevo código a tu correo.' });
});

// ============================================
// RUTAS DE REGISTRO
// ============================================

// GET /register - Muestra el formulario de registro
app.get('/register', (req, res) => {
  res.render('register', { error: null, success: null });
});

// POST /register - Procesa el registro con reCAPTCHA v2
app.post('/register', async (req, res) => {
  console.log('=== DEBUG REGISTRO ===');
  console.log('Body completo:', req.body);
  console.log('reCAPTCHA token recibido:', req.body['g-recaptcha-response']);
  
  // Extraer datos del formulario
  const { 
    nombres_y_apellidos,           // Nombre completo
    identificacion,                // Documento de identidad
    contrasena,                    // Contraseña en texto plano
    confirmar_contrasena,          // Confirmación de contraseña
    correo_electronico,            // Email
    rol,                           // Rol: normal, admin, superadmin
    'g-recaptcha-response': recaptchaToken  // Token de reCAPTCHA
  } = req.body;

  try {
    // ========================================
    // PASO 1: Verificar reCAPTCHA v2
    // ========================================
    if (!recaptchaToken) {
      console.log('❌ No hay token de reCAPTCHA en registro');
      return res.render('register', {
        error: '🤖 Por favor, completa la verificación "No soy un robot".',
        success: null
      });
    }

    console.log('✅ Token de reCAPTCHA recibido en registro, verificando...');
    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken, req.ip);
    console.log('Resultado de verificación registro:', recaptchaResult);
    
    if (!recaptchaResult.success) {
      console.log('❌ reCAPTCHA v2 fallido en registro:', recaptchaResult['error-codes']);
      
      let errorMessage = '🤖 Verificación de seguridad fallida.';
      if (recaptchaResult['error-codes']) {
        const errorCodes = recaptchaResult['error-codes'];
        if (errorCodes.includes('timeout-or-duplicate')) {
          errorMessage = '🤖 El token de verificación ha expirado. Por favor, intenta de nuevo.';
        } else if (errorCodes.includes('invalid-input-response')) {
          errorMessage = '🤖 Verificación inválida. Por favor, completa el CAPTCHA nuevamente.';
        }
      }
      
      return res.render('register', {
        error: errorMessage,
        success: null
      });
    }

    // ========================================
    // PASO 2: Validar que las contraseñas coincidan
    // ========================================
    if (contrasena !== confirmar_contrasena) {
      return res.render('register', {
        error: '🔒 Las contraseñas no coinciden.',
        success: null
      });
    }

    // ========================================
    // PASO 3: Validar formato de email
    // ========================================
    if (correo_electronico && !isValidEmail(correo_electronico)) {
      return res.render('register', {
        error: '📧 Formato de email inválido.',
        success: null
      });
    }

    // ========================================
    // PASO 4: Verificar si ya existe la identificación
    // ========================================
    const { data: existingUsers, error: checkError } = await supabase
      .from('usuarios')
      .select('identificacion')
      .eq('identificacion', identificacion);

    if (checkError) {
      console.error('Error verificando usuario:', checkError);
      return res.render('register', {
        error: '🚨 Error del servidor.',
        success: null
      });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.render('register', {
        error: '❌ Ya existe un usuario con esta identificación.',
        success: null
      });
    }

    // ========================================
    // PASO 5: Verificar si ya existe el correo electrónico
    // ========================================
    if (correo_electronico) {
      const { data: existingEmails, error: emailCheckError } = await supabase
        .from('usuarios')
        .select('correo_electronico')
        .eq('correo_electronico', correo_electronico);

      if (emailCheckError) {
        console.error('Error verificando email:', emailCheckError);
        return res.render('register', {
          error: '🚨 Error del servidor.',
          success: null
        });
      }

      if (existingEmails && existingEmails.length > 0) {
        return res.render('register', {
          error: '📧 Ya existe un usuario con este correo electrónico.',
          success: null
        });
      }
    }

    // ========================================
    // PASO 6: Hashear la contraseña con bcrypt
    // ========================================
    // bcrypt.hash(password, saltRounds) - 10 rondas es seguro y rápido
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    // ========================================
    // PASO 7: Preparar los roles del usuario
    // ========================================
    // Todos los roles empiezan en false
    let rolData = {
      rol_usuario_normal: false,
      rol_usuario_administrador: false,
      rol_usuario_superadministrador: false
    };

    // Activar solo el rol seleccionado
    switch (rol) {
      case 'admin':
        rolData.rol_usuario_administrador = true;
        break;
      case 'superadmin':
        rolData.rol_usuario_superadministrador = true;
        break;
      default:
        rolData.rol_usuario_normal = true;
    }

    // ========================================
    // PASO 8: Insertar el nuevo usuario en la BD
    // ========================================
    const { data: newUser, error: insertError } = await supabase
      .from('usuarios')
      .insert([{
        nombres_y_apellidos,
        identificacion,
        contrasena: hashedPassword,           // Contraseña hasheada
        correo_electronico: correo_electronico || null,  // Puede ser null
        estado: true,                         // Usuario activo por defecto
        ...rolData                            // Expande los 3 campos de rol
      }])
      .select();  // Retorna el usuario insertado

    if (insertError) {
      console.error('Error creando usuario:', insertError);
      return res.render('register', {
        error: '🚨 Error al crear el usuario: ' + insertError.message,
        success: null
      });
    }

    console.log(`✅ Usuario registrado exitosamente: ${nombres_y_apellidos} (${identificacion})`);
    
    // Mostrar mensaje de éxito
    res.render('register', {
      error: null,
      success: '✅ Usuario registrado exitosamente. Ahora puedes iniciar sesión.'
    });

  } catch (err) {
    console.error('❌ Error en registro:', err);
    res.render('register', {
      error: '🚨 Error del servidor. Por favor, intenta de nuevo.',
      success: null
    });
  }
});

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// GET /welcome - Página de bienvenida (requiere login completo)
app.get('/welcome', requireAuth, (req, res) => {
  res.render('welcome', { user: req.session.user });
});

// GET /dashboard - Panel de administración (requiere rol admin o superadmin)
app.get('/dashboard', requireAuth, requireAdmin, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// GET /admin - Sección administrativa (requiere admin o superadmin)
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', { user: req.session.user });
});

// GET /superadmin - Sección de super administrador (solo superadmin)
app.get('/superadmin', requireSuperAdmin, (req, res) => {
  res.render('superadmin', { user: req.session.user });
});

// GET /logout - Cierra la sesión del usuario
app.get('/logout', (req, res) => {
  // Guardar el nombre antes de destruir la sesión
  const userName = req.session.user?.nombres_y_apellidos || 'Usuario';
  
  // Destruir la sesión (elimina cookies y datos del servidor)
  req.session.destroy(() => {
    console.log(`👋 Logout: ${userName}`);
    res.redirect('/login');
  });
});

// ============================================
// API REST PARA GESTIÓN DE USUARIOS
// ============================================

// GET /api/usuarios - Listar todos los usuarios (solo admin/superadmin)
app.get('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Obtener todos los usuarios ordenados por ID
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('id_usuarios', { ascending: true });
    
    if (error) throw error;
    
    // Retornar JSON con el array de usuarios
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios - Crear nuevo usuario (solo admin/superadmin)
app.post('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Extraer datos del body JSON
    const { identificacion, nombres_y_apellidos, correo_electronico, contrasena, estado, rol } = req.body;
    
    // Validar campos obligatorios
    if (!identificacion || !nombres_y_apellidos || !correo_electronico || !contrasena) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si ya existe la identificación
    const { data: existing } = await supabase
      .from('usuarios')
      .select('identificacion')
      .eq('identificacion', identificacion);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con esta identificación' });
    }

    // Verificar si ya existe el correo
    const { data: existingEmail } = await supabase
      .from('usuarios')
      .select('correo_electronico')
      .eq('correo_electronico', correo_electronico);

    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con este correo' });
    }
    
    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    
    // Preparar roles
    let rolData = {
      rol_usuario_normal: rol === 'normal',
      rol_usuario_administrador: rol === 'admin',
      rol_usuario_superadministrador: rol === 'superadmin'
    };
    
    // Insertar el usuario
    const { data, error } = await supabase.from('usuarios').insert([{
      identificacion,
      nombres_y_apellidos,
      correo_electronico,
      contrasena: hashedPassword,
      estado: estado !== undefined ? estado : true,  // Por defecto true
      ...rolData
    }]).select();
    
    if (error) throw error;

    console.log(`✅ Usuario creado por ${req.session.user.nombres_y_apellidos}: ${nombres_y_apellidos}`);
    
    // Retornar el usuario creado como JSON
    res.json(data[0]);
  } catch (err) {
    console.error('Error creando usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id - Actualizar usuario (solo admin/superadmin)
app.put('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Obtener el ID del usuario a actualizar desde la URL
    const { id } = req.params;
    
    // Obtener los datos del body
    const { identificacion, nombres_y_apellidos, correo_electronico, contrasena, estado, rol } = req.body;
    
    // Preparar objeto de actualización
    let updateData = {
      identificacion,
      nombres_y_apellidos,
      correo_electronico,
      estado: estado !== undefined ? estado : true,
      rol_usuario_normal: rol === 'normal',
      rol_usuario_administrador: rol === 'admin',
      rol_usuario_superadministrador: rol === 'superadmin'
    };
    
    // Solo actualizar contraseña si se proporcionó una nueva
    if (contrasena && contrasena.trim() !== '') {
      updateData.contrasena = await bcrypt.hash(contrasena, 10);
    }
    
    // Actualizar el registro en la BD
    const { data, error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id_usuarios', id)
      .select();
    
    if (error) throw error;

    console.log(`✅ Usuario actualizado por ${req.session.user.nombres_y_apellidos}: ID ${id}`);
    
    // Retornar el usuario actualizado
    res.json(data[0]);
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (solo superadmin)
app.delete('/api/usuarios/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevenir que un usuario se elimine a sí mismo
    if (parseInt(id) === req.session.user.id_usuarios) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    
    // Eliminar el usuario de la BD
    const { error } = await supabase.from('usuarios').delete().eq('id_usuarios', id);
    
    if (error) throw error;

    console.log(`⚠️ Usuario eliminado por ${req.session.user.nombres_y_apellidos}: ID ${id}`);
    
    // Retornar confirmación
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ============================================
// MANEJO DE ERRORES
// ============================================

// Middleware para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).render('error', { 
    error: '🔍 Página no encontrada',
    user: req.session.user || null 
  });
});

// Middleware para errores del servidor (500)
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err.stack);
  res.status(500).render('error', { 
    error: '🚨 Error interno del servidor',
    user: req.session.user || null 
  });
});

// ============================================
// API DE GESTIÓN DE PROYECTOS ESTUDIANTILES
// ============================================

// Listar proyectos (todos los usuarios autenticados)
app.get('/api/proyectos', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proyectos_estudiantiles')
      .select('*')
      .order('fecha_subida', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo proyectos:', err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

// Crear proyecto (usuarios autenticados)
app.post('/api/proyectos', requireAuth, async (req, res) => {
  try {
    const { 
      titulo, 
      descripcion, 
      tipo, 
      archivos_url, 
      imagenes_url, 
      video_url 
    } = req.body;
    
    if (!titulo || !descripcion) {
      return res.status(400).json({ error: 'Título y descripción son obligatorios' });
    }

    const projectData = {
      titulo,
      descripcion,
      tipo: tipo || 'general',
      id_estudiante: req.session.user.id_usuarios,
      nombre_estudiante: req.session.user.nombres_y_apellidos,
      archivos_url: archivos_url || [],
      imagenes_url: imagenes_url || [],
      video_url: video_url || null,
      fecha_subida: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('proyectos_estudiantiles')
      .insert([projectData])
      .select();
    
    if (error) throw error;

    console.log(`✅ Proyecto creado por ${req.session.user.nombres_y_apellidos}: ${titulo}`);
    res.json(data[0]);
  } catch (err) {
    console.error('Error creando proyecto:', err);
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
});

// Actualizar proyecto (solo el creador o admin)
app.put('/api/proyectos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, tipo, archivos_url, imagenes_url, video_url } = req.body;

    // Verificar propiedad (solo el creador o admin puede editar)
    const { data: existing } = await supabase
      .from('proyectos_estudiantiles')
      .select('id_estudiante')
      .eq('id_proyecto', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const isOwner = existing.id_estudiante === req.session.user.id_usuarios;
    const isAdmin = req.session.user.rol_usuario_administrador || req.session.user.rol_usuario_superadministrador;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para editar este proyecto' });
    }
    
    const updateData = { titulo, descripcion, tipo, archivos_url, imagenes_url, video_url };
    
    const { data, error } = await supabase
      .from('proyectos_estudiantiles')
      .update(updateData)
      .eq('id_proyecto', id)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error('Error actualizando proyecto:', err);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
});

// Eliminar proyecto (solo el creador o admin)
app.delete('/api/proyectos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('proyectos_estudiantiles')
      .select('id_estudiante')
      .eq('id_proyecto', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const isOwner = existing.id_estudiante === req.session.user.id_usuarios;
    const isAdmin = req.session.user.rol_usuario_administrador || req.session.user.rol_usuario_superadministrador;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este proyecto' });
    }
    
    const { error } = await supabase
      .from('proyectos_estudiantiles')
      .delete()
      .eq('id_proyecto', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando proyecto:', err);
    res.status(500).json({ error: 'Error al eliminar proyecto' });
  }
});

// ============================================
// RUTAS DE SUPERADMIN - MONITOREO DEL SISTEMA
// ============================================

// Vista del panel de monitoreo
app.get('/superadmin/monitor', requireAuth, requireSuperAdmin, (req, res) => {
  res.render('superadmin-monitor', { 
    user: req.session.user,
    process: { 
      env: { 
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY 
      } 
    }
  });
});

// API: Obtener metadata del sistema
app.get('/api/system/metadata', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_metadata')
      .select('*');
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo metadata:', err);
    res.status(500).json({ error: 'Error al obtener metadata' });
  }
});

// API: Obtener logs del sistema
app.get('/api/system/logs', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { user_id } = req.query;
    
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo logs:', err);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

// API: Obtener estadísticas de usuarios
app.get('/api/system/stats/users', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('count', { count: 'exact' });
    
    if (error) throw error;
    res.json({ total_users: data?.length || 0 });
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// API: Obtener estadísticas de proyectos
app.get('/api/system/stats/projects', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proyectos_estudiantiles')
      .select('count', { count: 'exact' });
    
    if (error) throw error;
    res.json({ total_projects: data?.length || 0 });
  } catch (err) {
    console.error('Error obteniendo proyectos:', err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

// API: Registrar actividad en logs
app.post('/api/system/logs', requireAuth, async (req, res) => {
  try {
    const { level, source, message, details } = req.body;
    
    const { error } = await supabase.from('system_logs').insert([{
      level: level || 'info',
      source: source || 'unknown',
      message: message || '',
      details: details || {},
      user_id: req.session.user.id_usuarios,
      timestamp: new Date().toISOString()
    }]);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error registrando log:', err);
    res.status(500).json({ error: 'Error al registrar log' });
  }
});

// API: Exportar logs como CSV
app.get('/api/system/logs/export', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    // Convertir a CSV
    const headers = ['ID', 'Timestamp', 'Level', 'Source', 'Message', 'User ID'];
    const rows = data.map(log => [
      log.id,
      new Date(log.timestamp).toLocaleString(),
      log.level,
      log.source,
      log.message,
      log.user_id || 'System'
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="system_logs.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exportando logs:', err);
    res.status(500).json({ error: 'Error al exportar logs' });
  }
});

// ============================================
// RUTAS DE LICENCIAS CREATIVE COMMONS
// ============================================

// Vista del registro de licencias
app.get('/licencias', requireAuth, (req, res) => {
  res.render('licencias', { 
    user: req.session.user,
    process: { 
      env: { 
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY 
      } 
    }
  });
});

// API: Listar licencias activas
app.get('/api/licencias', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('licencias_creative_commons')
      .select('*')
      .eq('activa', true)
      .order('nombre', { ascending: true });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo licencias:', err);
    res.status(500).json({ error: 'Error al obtener licencias' });
  }
});

// API: Crear registro de licencia
app.post('/api/licencias/registrar', requireAuth, async (req, res) => {
  try {
    const { 
      id_licencia, 
      titulo_obra, 
      descripcion_obra, 
      url_obra, 
      archivo_adjunto 
    } = req.body;
    
    if (!id_licencia || !titulo_obra) {
      return res.status(400).json({ error: 'Licencia y título son obligatorios' });
    }

    const { data, error } = await supabase.from('registros_licencias_cc').insert([{
      id_usuario: req.session.user.id_usuarios,
      id_licencia,
      titulo_obra,
      descripcion_obra: descripcion_obra || null,
      url_obra: url_obra || null,
      archivo_adjunto: archivo_adjunto || null,
      estado: 'pendiente',
      fecha_registro: new Date().toISOString()
    }]).select();
    
    if (error) throw error;

    console.log(`✅ Licencia registrada por ${req.session.user.nombres_y_apellidos}: ${titulo_obra}`);
    res.json(data[0]);
  } catch (err) {
    console.error('Error registrando licencia:', err);
    res.status(500).json({ error: 'Error al registrar licencia' });
  }
});

// API: Listar registros del usuario
app.get('/api/licencias/mis-registros', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('registros_licencias_cc')
      .select('*, licencias_creative_commons(*)')
      .eq('id_usuario', req.session.user.id_usuarios)
      .order('fecha_registro', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo registros:', err);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});


// ============================================
// INICIO DEL SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`✅ Supabase configurado con URL: ${SUPABASE_URL}`);
  console.log(`🔐 reCAPTCHA v2 + 2FA (OTP email) configurado`);
  
  // Advertencias si faltan variables de entorno críticas
  if (!process.env.RECAPTCHA_SITE_KEY || !process.env.RECAPTCHA_SECRET_KEY) {
    console.warn('⚠️  ADVERTENCIA: Variables de reCAPTCHA no configuradas en .env');
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  ADVERTENCIA: Variables SMTP no configuradas (SMTP_USER/SMTP_PASS)');
  }

  console.log('📋 Funcionalidades activas:');
  console.log('   • Login con reCAPTCHA v2 + 2FA por email (OTP)');
  console.log('   • Registro con reCAPTCHA v2');
  console.log('   • Dashboard de administración (CRUD usuarios)');
  console.log('   • API REST protegida con middleware de roles');
  console.log('   • Protección contra fuerza bruta (5 intentos, 15 min bloqueo)');
  console.log('   • Validación de email duplicado');
  console.log('   • Hasheo de contraseñas con bcrypt');
  console.log('   • Logs detallados de seguridad');
});
