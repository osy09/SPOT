function getMe(req, res) {
  if (!req.isAuthenticated()) {
    return res.json({ user: null });
  }
  const { id, email, name, role, is_blacklisted, last_login_at } = req.user;
  res.json({ user: { id, email, name, role, is_blacklisted, last_login_at } });
}

function logout(req, res, next) {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: '로그아웃 되었습니다.' });
  });
}

module.exports = { getMe, logout };
