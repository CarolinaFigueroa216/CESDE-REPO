// ============================================
// UTILIDADES PARA OTP (One-Time Password)
// ============================================

const bcrypt = require('bcryptjs');

/**
 * Genera un código OTP aleatorio de N dígitos
 * @param {number} length - Longitud del código (por defecto 6)
 * @returns {string} Código OTP de números aleatorios
 */
function generateOtp(length = 6) {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
}

/**
 * Hashea un código OTP usando bcrypt
 * @param {string} otp - Código OTP en texto plano
 * @returns {Promise<string>} OTP hasheado
 */
async function hashOtp(otp) {
  return await bcrypt.hash(otp, 10);
}

/**
 * Verifica si un OTP coincide con su hash
 * @param {string} otp - Código OTP en texto plano
 * @param {string} hash - Hash del OTP almacenado
 * @returns {Promise<boolean>} true si coinciden
 */
async function verifyOtp(otp, hash) {
  return await bcrypt.compare(otp, hash);
}

/**
 * Calcula una fecha N minutos en el futuro
 * @param {number} minutes - Minutos a añadir (por defecto 10)
 * @returns {string} ISO timestamp de la fecha futura
 */
function addMinutes(minutes = 10) {
  const now = new Date();
  const future = new Date(now.getTime() + minutes * 60000);
  return future.toISOString();
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  addMinutes
};
