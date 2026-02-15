function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: '로그인이 필요합니다.' });
}

function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    // Check if user is blacklisted
    if (req.user.is_blacklisted) {
      return res.status(403).json({ error: '접근이 차단된 사용자입니다.' });
    }

    // Verify user object integrity
    if (!req.user.id || !req.user.email || !req.user.role) {
      console.error('[Auth] Invalid user object in session');
      return res.status(401).json({ error: '유효하지 않은 세션입니다.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    return next();
  };
}

module.exports = { isAuthenticated, hasRole };
