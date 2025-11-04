// middleware/authMiddleware.js

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.rol_usuario_administrador) {
    return res.status(403).render('error', {
      error: '⛔ Acceso denegado. Se requieren permisos de administrador.'
    });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.rol_usuario_superadministrador) {
    return res.status(403).render('error', {
      error: '⛔ Acceso denegado. Se requieren permisos de superadministrador.'
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
