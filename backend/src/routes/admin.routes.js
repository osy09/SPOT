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
  getApplyNoticeSettings,
  updateApplyNoticeSettings,
  downloadTodayWakeup,
} = require('../controllers/admin.controller');
const {
  startYoutubeAuth,
  getYoutubeStatus,
  exportPlaylist,
} = require('../controllers/youtube.controller');

// 기상송 큐 관리 (LEADER, 삭제·다운로드는 MEMBER·LEADER)
router.get('/wakeup/queue', hasRole('LEADER'), getWakeupQueue);
router.delete('/wakeup/:id', hasRole('MEMBER', 'LEADER'), validateIdParam(), rejectWakeup);
router.patch('/wakeup/:id/schedule', hasRole('LEADER'), validateIdParam(), updateWakeupSchedule);
router.patch('/wakeup/:id/unapprove', hasRole('LEADER'), validateIdParam(), cancelWakeupApproval);
router.get('/wakeup/download/:videoId', hasRole('MEMBER', 'LEADER'), validateVideoId, downloadTodayWakeup);

// 점심방송 관리 (MEMBER, LEADER)
router.get('/radio/applications', hasRole('MEMBER', 'LEADER'), getRadioApplications);
router.get('/radio/playlist', hasRole('MEMBER', 'LEADER'), getTodayRadioPlaylist);
router.patch('/radio/approve-all', hasRole('MEMBER', 'LEADER'), approveAllRadio);
router.patch('/radio/:id/approve', hasRole('MEMBER', 'LEADER'), validateIdParam(), approveRadio);
router.patch('/radio/:id/reject', hasRole('MEMBER', 'LEADER'), validateIdParam(), rejectRadio);

// 감사 로그 (LEADER 전용)
router.get('/audit/logs', hasRole('LEADER'), getAuditLogs);

// YouTube 연동 (MEMBER, LEADER)
router.get('/youtube/status', hasRole('MEMBER', 'LEADER'), getYoutubeStatus);
router.post('/youtube/export', hasRole('MEMBER', 'LEADER'), validatePlaylistExport, exportPlaylist);

// YouTube 인증 (LEADER 전용)
router.get('/youtube/auth', hasRole('LEADER'), startYoutubeAuth);

// 사용자 관리 (LEADER 전용)
router.get('/users', hasRole('LEADER'), searchUsers);
router.patch('/users/:id/blacklist', hasRole('LEADER'), validateIdParam(), toggleBlacklist);
router.patch('/users/:id/role', hasRole('LEADER'), validateIdParam(), validateRoleUpdate, preventSelfDemotion, updateUserRole);
router.get('/settings/apply-notice', hasRole('LEADER'), getApplyNoticeSettings);
router.patch('/settings/apply-notice', hasRole('LEADER'), updateApplyNoticeSettings);

module.exports = router;
