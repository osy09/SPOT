const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  applyWakeup,
  applyRadio,
  getSchedule,
  getTodayWakeup,
  getWakeupQueue,
  getMySongs,
  cancelMyPendingSong,
  searchYoutube,
  getApplyNoticeSettings,
} = require('../controllers/song.controller');

router.get('/schedule', getSchedule);
router.get('/today', getTodayWakeup);
router.get('/apply-notice', isAuthenticated, getApplyNoticeSettings);
router.get('/wakeup/queue', isAuthenticated, getWakeupQueue);
router.get('/my', isAuthenticated, getMySongs);
router.delete('/my/:id', isAuthenticated, validateIdParam(), cancelMyPendingSong);
router.get('/search', isAuthenticated, searchYoutube);
router.post('/wakeup', isAuthenticated, applyWakeup);
router.post('/radio', isAuthenticated, applyRadio);

module.exports = router;
