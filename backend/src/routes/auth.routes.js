const router = require('express').Router();
const passport = require('passport');
const { getMe, logout } = require('../controllers/auth.controller');

// Note: Passport.js Google OAuth20 Strategy handles state verification internally
// Additional custom state verification can cause session issues during OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}?error=auth_failed` }),
  (req, res) => {
    console.log('[Google OAuth] Login successful:', req.user.email);
    res.redirect(process.env.FRONTEND_URL);
  }
);

router.get('/me', getMe);
router.post('/logout', logout);

module.exports = router;
