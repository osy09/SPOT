/**
 * Input validation middleware for API endpoints
 */

/**
 * Validates numeric ID parameters
 */
function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName], 10);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
    }

    // Store parsed ID for use in controllers
    req.validatedId = id;
    next();
  };
}

/**
 * Validates video ID format (YouTube video IDs are 11 characters)
 */
function validateVideoId(req, res, next) {
  const { videoId } = req.params;

  if (!videoId || typeof videoId !== 'string' || videoId.length !== 11) {
    return res.status(400).json({ error: '유효하지 않은 비디오 ID입니다.' });
  }

  // Additional check for valid YouTube video ID characters
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: '유효하지 않은 비디오 ID 형식입니다.' });
  }

  next();
}

/**
 * Validates role update requests
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
 * Validates playlist export request
 */
function validatePlaylistExport(req, res, next) {
  const { songIds, title } = req.body;

  // Validate songIds
  if (!Array.isArray(songIds)) {
    return res.status(400).json({ error: 'songIds는 배열이어야 합니다.' });
  }

  if (songIds.length === 0) {
    return res.status(400).json({ error: '최소 1개 이상의 곡을 선택해주세요.' });
  }

  if (songIds.length > 100) {
    return res.status(400).json({ error: '최대 100개까지 선택 가능합니다.' });
  }

  // Validate all songIds are positive integers
  const allValid = songIds.every(id => {
    const numId = Number(id);
    return Number.isInteger(numId) && numId > 0;
  });

  if (!allValid) {
    return res.status(400).json({ error: '유효하지 않은 곡 ID가 포함되어 있습니다.' });
  }

  // Validate title if provided
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
 * Prevents LEADER from demoting themselves
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
