// ============================================
// MIDDLEWARES DE AUTENTICACIÓN Y AUTORIZACIÓN
// ============================================

/**
 * Middleware: Verificar que el usuario esté autenticado
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).redirect('/login');
  }
  next();
}

/**
 * Middleware: Verificar que sea administrador o superior
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).redirect('/login');
  }

  const { rol_usuario_administrador, rol_usuario_superadministrador } = req.session.user;

  if (!rol_usuario_administrador && !rol_usuario_superadministrador) {
    console.warn(`⚠️ Acceso denegado a admin para: ${req.session.user.nombres_y_apellidos} (IP: ${req.ip})`);
    return res.status(403).render('error', { 
      error: '🔒 Acceso denegado. Necesitas permisos de administrador.',
      user: req.session.user 
    });
  }

  next();
}

/**
 * Middleware: Verificar que sea super administrador
 */
function requireSuperAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).redirect('/login');
  }

  const { rol_usuario_superadministrador } = req.session.user;

  if (!rol_usuario_superadministrador) {
    console.warn(`⚠️ Acceso denegado a superadmin para: ${req.session.user.nombres_y_apellidos} (IP: ${req.ip})`);
    return res.status(403).render('error', { 
      error: '🔒 Acceso denegado. Solo super administradores pueden acceder.',
      user: req.session.user 
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperAdmin
};
