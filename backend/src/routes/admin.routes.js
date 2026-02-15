const router = require('express').Router();
const { hasRole } = require('../middleware/auth');
const {
  validateIdParam,
  validateVideoId,
  validateRoleUpdate,
  validatePlaylistExport,
  preventSelfDemotion,
} = require('../middleware/validation');
const {
  getWakeupQueue,
  rejectWakeup,
  updateWakeupSchedule,
  cancelWakeupApproval,
  getRadioApplications,
  approveAllRadio,
  approveRadio,
  rejectRadio,
  getTodayRadioPlaylist,
  getAuditLogs,
  searchUsers,
  toggleBlacklist,
  updateUserRole,
  downloadTodayWakeup,
} = require('../controllers/admin.controller');
const {
  startYoutubeAuth,
  getYoutubeStatus,
  exportPlaylist,
} = require('../controllers/youtube.controller');

// Wake-up queue management (LEADER, deletion/download for MEMBER/LEADER)
router.get('/wakeup/queue', hasRole('LEADER'), getWakeupQueue);
router.delete('/wakeup/:id', hasRole('MEMBER', 'LEADER'), validateIdParam(), rejectWakeup);
router.patch('/wakeup/:id/schedule', hasRole('LEADER'), validateIdParam(), updateWakeupSchedule);
router.patch('/wakeup/:id/unapprove', hasRole('LEADER'), validateIdParam(), cancelWakeupApproval);
router.get('/wakeup/download/:videoId', hasRole('MEMBER', 'LEADER'), validateVideoId, downloadTodayWakeup);

// Radio management (MEMBER, LEADER)
router.get('/radio/applications', hasRole('MEMBER', 'LEADER'), getRadioApplications);
router.get('/radio/playlist', hasRole('MEMBER', 'LEADER'), getTodayRadioPlaylist);
router.patch('/radio/approve-all', hasRole('MEMBER', 'LEADER'), approveAllRadio);
router.patch('/radio/:id/approve', hasRole('MEMBER', 'LEADER'), validateIdParam(), approveRadio);
router.patch('/radio/:id/reject', hasRole('MEMBER', 'LEADER'), validateIdParam(), rejectRadio);

// Audit logs (LEADER only)
router.get('/audit/logs', hasRole('LEADER'), getAuditLogs);

// YouTube integration (MEMBER, LEADER)
router.get('/youtube/status', hasRole('MEMBER', 'LEADER'), getYoutubeStatus);
router.post('/youtube/export', hasRole('MEMBER', 'LEADER'), validatePlaylistExport, exportPlaylist);

// YouTube auth (LEADER only)
router.get('/youtube/auth', hasRole('LEADER'), startYoutubeAuth);

// User management (LEADER only)
router.get('/users', hasRole('LEADER'), searchUsers);
router.patch('/users/:id/blacklist', hasRole('LEADER'), validateIdParam(), toggleBlacklist);
router.patch('/users/:id/role', hasRole('LEADER'), validateIdParam(), validateRoleUpdate, preventSelfDemotion, updateUserRole);

module.exports = router;
