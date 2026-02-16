/**
 * 사용자 인증 확인
 */
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: '로그인이 필요합니다.' });
}

/**
 * 사용자가 특정 역할을 가지고 있는지 확인
 */
function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    // 블랙리스트 사용자 확인
    if (req.user.is_blacklisted) {
      return res.status(403).json({ error: '접근이 차단된 사용자입니다.' });
    }

    // 사용자 객체 무결성 검증
    if (!req.user.id || !req.user.email || !req.user.role) {
      console.error('[인증] 세션에 유효하지 않은 사용자 객체');
      return res.status(401).json({ error: '유효하지 않은 세션입니다.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    return next();
  };
}

module.exports = { isAuthenticated, hasRole };
