const router = require('express').Router();
const passport = require('passport');
const { getMe, logout } = require('../controllers/auth.controller');

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: true,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}?error=auth_failed` }),
  (req, res) => res.redirect(process.env.FRONTEND_URL)
);

router.get('/me', getMe);
router.post('/logout', logout);

module.exports = router;
