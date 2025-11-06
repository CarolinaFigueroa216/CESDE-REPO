🧠 Repositorio CESDE – Sistema de Autenticación con Node.js, EJS y Supabase

Este proyecto implementa un sistema de autenticación y gestión de acceso
desarrollado con Node.js, Express, EJS y Supabase.
Fue creado como práctica académica del CESDE para comprender la
construcción de servidores, manejo de sesiones, seguridad y
autenticación de usuarios.

Incluye características modernas como: - ✅ Registro y login seguro con
contraseñas cifradas. - 🔒 Protección contra ataques de fuerza bruta. -
🔑 Autenticación en dos pasos (2FA). - 🧩 Integración con Google
reCAPTCHA v2. - 🧠 Conexión con base de datos Supabase (PostgreSQL).

------------------------------------------------------------------------

👨‍💻 Autores
  ----------------------------------- ----------------------
| Nombre completo | Usuario |
|------------------|----------|
| Karen Tatiana Mendez Bojaca | `Karen11m` |
| Jhon Alejandro Díaz Jiménez | `aledelling` |
| David Esteban Legro Muñoz | `Legro28` |
| Juan Camilo Sepúlveda Vesga | `Poseidon221` |
| Jhoan Sebastián Méndez Rojas | `Volcan1124` |
| Manuel Alejandro Bello Cardozo | `empleadodekfc` |
| Danna Shirley Lozano Martínez | `Danna04-shir` |
| Astrid Carolina Figueroa | `Carolina Figueroa216` |
| Vanesa alejandra justinico puerto | `AlejandraPuerto` |
| Andres Sana Peña  | `AndresSana` |
| Juan David Botero Diaz | `DavidB08` |
| nilson leonardo gonzalez sandoval | `Leito1122333` |
| Santiago Sanchez Fernandez | `Italianos1622` |
| Erika forero ballesteros | `akireorerof` |
| Valeria Pardo Trujillo | `naturalezaactual` |

Proyecto desarrollado como práctica académica del módulo de Desarrollo
Web con Node.js y EJS en CESDE.

------------------------------------------------------------------------

🚀 Tecnologías utilizadas

  -----------------------------------------------------------------------
  Tecnología                          Descripción
  ----------------------------------- -----------------------------------
  Node.js                             Entorno de ejecución JavaScript
                                      para el backend.

  Express.js                          Framework para construir el
                                      servidor y manejar rutas.

  EJS (Embedded JavaScript)           Motor de plantillas que permite
                                      vistas dinámicas.

  Supabase                            Base de datos PostgreSQL +
                                      autenticación API REST.

  bcryptjs                            Cifrado seguro de contraseñas
                                      mediante hashing.

  express-session                     Manejo de sesiones persistentes en
                                      el servidor.

  axios                               Cliente HTTP para validación de
                                      reCAPTCHA.

  dotenv                              Manejo de variables de entorno.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

🧩 Estructura del proyecto

    CESDE-REPO-main/
    │
    ├── app.js                  # Punto de entrada del servidor Express
    ├── generate-hash.js        # Script para crear contraseñas cifradas
    ├── package.json            # Configuración de dependencias y scripts
    ├── .env                    # Variables de entorno privadas
    │
    ├── HTML/                   # Páginas HTML de apoyo o referencia
    ├── middleware/             # Middlewares para validar sesiones, tokens, etc.
    ├── public/                 # Archivos estáticos (CSS, JS, imágenes)
    ├── utils/                  # Funciones auxiliares (conexión Supabase, validaciones)
    ├── views/                  # Vistas EJS (login, registro, panel principal)
    └── README.md               # Documento descriptivo del proyecto

------------------------------------------------------------------------

⚙️ Instalación y configuración

1️⃣ Clonar el repositorio

    git clone https://github.com/tu-usuario/nombre-del-repo.git
    cd nombre-del-repo

2️⃣ Instalar dependencias

    npm install

3️⃣ Configurar variables de entorno

Crea un archivo .env en la raíz del proyecto con el siguiente contenido
(usa tus credenciales reales):

    SUPABASE_URL=https://tu-proyecto.supabase.co
    SUPABASE_KEY=tu_clave_de_api
    RECAPTCHA_SECRET_KEY=tu_clave_recaptcha
    SESSION_SECRET=clave_segura_para_sesiones
    PORT=3000

4️⃣ Ejecutar el servidor

    npm start

Luego abre tu navegador en:
👉 http://localhost:3000

------------------------------------------------------------------------

🔐 Flujo del sistema de autenticación

1.  Registro de usuario
    -   El usuario completa el formulario con correo y contraseña.
    -   Se valida el reCAPTCHA.
    -   La contraseña se cifra con bcryptjs y se almacena en Supabase.
2.  Inicio de sesión (login)
    -   Se compara la contraseña ingresada con el hash almacenado.
    -   Si es correcto, se crea una sesión segura con express-session.
    -   Se puede activar autenticación en dos pasos (2FA).
3.  Protección de rutas
    -   Se usan middlewares en /middleware para verificar sesiones
        activas.
    -   Los usuarios no autenticados son redirigidos al login.
4.  Seguridad adicional
    -   Implementación de bloqueo temporal por intentos fallidos.
    -   Verificación del token de Google reCAPTCHA.
    -   Hashing de contraseñas sin posibilidad de revertir.

------------------------------------------------------------------------

📂 Archivos clave

  -----------------------------------------------------------------------
  Archivo                             Función
  ----------------------------------- -----------------------------------
  app.js                              Servidor principal y configuración
                                      de rutas.

  generate-hash.js                    Genera hashes de contraseñas (útil
                                      para pruebas).

  /middleware/sessionAuth.js          Verifica si el usuario tiene sesión
                                      activa.

  /utils/supabaseClient.js            Conecta con la base de datos
                                      Supabase.

  /views/login.ejs                    Vista del formulario de inicio de
                                      sesión.

  /views/register.ejs                 Vista del formulario de registro.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

🧠 Conceptos importantes

-   Hashing: técnica para almacenar contraseñas de forma irreversible.
-   reCAPTCHA: protege contra bots o intentos automáticos.
