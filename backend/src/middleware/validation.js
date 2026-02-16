/**
 * API 엔드포인트를 위한 입력 검증 미들웨어
 */

/**
 * 숫자 ID 파라미터 검증
 */
function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName], 10);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
    }

    // 컨트롤러에서 사용할 파싱된 ID 저장
    req.validatedId = id;
    next();
  };
}

/**
 * 비디오 ID 형식 검증 (YouTube 비디오 ID는 11자)
 */
function validateVideoId(req, res, next) {
  const { videoId } = req.params;

  if (!videoId || typeof videoId !== 'string' || videoId.length !== 11) {
    return res.status(400).json({ error: '유효하지 않은 비디오 ID입니다.' });
  }

  // YouTube 비디오 ID에 유효한 문자인지 추가 확인
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: '유효하지 않은 비디오 ID 형식입니다.' });
  }

  next();
}

/**
 * 역할 업데이트 요청 검증
 */
function validateRoleUpdate(req, res, next) {
  const { role } = req.body;
  const validRoles = ['USER', 'MEMBER', 'LEADER'];

  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({
      error: '유효하지 않은 역할입니다.',
      validRoles
    });
  }

  next();
}

/**
 * 재생목록 내보내기 요청 검증
 */
function validatePlaylistExport(req, res, next) {
  const { songIds, title } = req.body;

  // songIds 검증
  if (!Array.isArray(songIds)) {
    return res.status(400).json({ error: 'songIds는 배열이어야 합니다.' });
  }

  if (songIds.length === 0) {
    return res.status(400).json({ error: '최소 1개 이상의 곡을 선택해주세요.' });
  }

  if (songIds.length > 100) {
    return res.status(400).json({ error: '최대 100개까지 선택 가능합니다.' });
  }

  // 모든 songIds가 양의 정수인지 검증
  const allValid = songIds.every(id => {
    const numId = Number(id);
    return Number.isInteger(numId) && numId > 0;
  });

  if (!allValid) {
    return res.status(400).json({ error: '유효하지 않은 곡 ID가 포함되어 있습니다.' });
  }

  // 제목이 제공된 경우 검증
  if (title !== undefined) {
    if (typeof title !== 'string') {
      return res.status(400).json({ error: '제목은 문자열이어야 합니다.' });
    }

    if (title.length > 100) {
      return res.status(400).json({ error: '제목은 100자 이하여야 합니다.' });
    }
  }

  next();
}

/**
 * LEADER가 자신의 권한을 강등하는 것을 방지
 */
function preventSelfDemotion(req, res, next) {
  const targetUserId = parseInt(req.params.id, 10);
  const { role } = req.body;

  if (req.user.role === 'LEADER' && req.user.id === targetUserId && role !== 'LEADER') {
    return res.status(400).json({
      error: '자신의 LEADER 권한을 변경할 수 없습니다.'
    });
  }

  next();
}

module.exports = {
  validateIdParam,
  validateVideoId,
  validateRoleUpdate,
  validatePlaylistExport,
  preventSelfDemotion,
};
