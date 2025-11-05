// ============================================
// UTILIDADES PARA ENVÍO DE CORREOS
// ============================================

const nodemailer = require('nodemailer');

/**
 * Configurar transportador de email con Nodemailer
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Envía un código OTP por correo electrónico
 * @param {string} to - Email del destinatario
 * @param {string} otp - Código OTP a enviar
 * @returns {Promise<void>}
 */
async function sendOtpMail(to, otp) {
  try {
    // Validar que existan las credenciales SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ Credenciales SMTP no configuradas');
      throw new Error('Correo no configurado. Contacta al administrador.');
    }

    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@cesde.edu.co',
      to: to,
      subject: '🔐 Código de verificación CESDE - 2FA',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #ec167f; }
            .content { text-align: center; }
            .code { 
              background: #f0f0f0; 
              padding: 20px; 
              border-radius: 8px; 
              font-size: 32px; 
              font-weight: bold; 
              letter-spacing: 4px; 
              color: #333;
              margin: 20px 0;
              font-family: monospace;
            }
            .warning { 
              background: #fff3cd; 
              border-left: 4px solid #ffc107; 
              padding: 15px; 
              margin-top: 20px; 
              border-radius: 4px;
              font-size: 14px;
              color: #856404;
            }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎓 CESDE</div>
              <p style="color: #666; margin-top: 10px;">Sistema Académico</p>
            </div>
            
            <div class="content">
              <h2>Verificación en dos pasos</h2>
              <p>Has solicitado acceso a tu cuenta CESDE. Usa este código para continuar:</p>
              
              <div class="code">${otp}</div>
              
              <p style="color: #666; font-size: 14px;">El código expira en <strong>10 minutos</strong></p>
              
              <div class="warning">
                <strong>⚠️ Seguridad:</strong> Si no solicitaste este código, ignora este email. Nunca compartas tu código con nadie.
              </div>
            </div>
            
            <div class="footer">
              <p>Este es un correo automático. Por favor, no respondas a este mensaje.</p>
              <p>&copy; ${new Date().getFullYear()} CESDE. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Tu código de verificación CESDE es: ${otp}\n\nExpira en 10 minutos.\n\nNunca compartas este código con nadie.`
    };

    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo enviado a ${to}: ${info.messageId}`);
    
    return info;
  } catch (error) {
    console.error('❌ Error enviando correo:', error.message);
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

/**
 * Verifica la conexión SMTP (para testing)
 * @returns {Promise<void>}
 */
async function verifySmtpConnection() {
  try {
    await transporter.verify();
    console.log('✅ Conexión SMTP verificada correctamente');
  } catch (error) {
    console.error('❌ Error verificando SMTP:', error);
    throw error;
  }
}

module.exports = {
  sendOtpMail,
  verifySmtpConnection,
  transporter
};
