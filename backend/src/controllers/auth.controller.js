function getMe(req, res) {
  if (!req.isAuthenticated()) {
    return res.json({ user: null });
  }
  const { id, email, name, role, is_blacklisted } = req.user;
  res.json({ user: { id, email, name, role, is_blacklisted } });
}

function logout(req, res, next) {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: '로그아웃 되었습니다.' });
  });
}

module.exports = { getMe, logout };
