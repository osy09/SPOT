const prisma = require('../lib/prisma');
const { spawn } = require('child_process');
const {
  getKstDate,
  getKstDayRange,
  getWakeupDisplayDateKst,
  parseKstDateInput,
  kstDateToUtcDate,
  formatKstDate,
} = require('../lib/kst-time');
const { sanitizeSong, sanitizeSongs } = require('../lib/song-response');

async function getWakeupQueue(req, res) {
  const songs = await prisma.song.findMany({
    where: { type: 'WAKEUP', status: 'PENDING' },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { created_at: 'asc' },
  });
  res.json({ songs: sanitizeSongs(songs) });
}

async function rejectWakeup(req, res) {
  const { id } = req.params;
  await prisma.song.delete({ where: { id: Number(id) } });
  res.json({ message: '기상송이 삭제되었습니다.' });
}

async function updateWakeupSchedule(req, res) {
  const { id } = req.params;
  const { play_date } = req.body;

  if (!play_date) {
    return res.status(400).json({ error: '재생 날짜를 입력해주세요.' });
  }

  const parsedKstDate = parseKstDateInput(play_date);
  if (!parsedKstDate) {
    return res.status(400).json({ error: '올바른 날짜 형식이 아닙니다.' });
  }

  // Check if the date is in the past based on 08:00 KST display 기준
  const minAllowedKstDate = getWakeupDisplayDateKst();
  const minAllowedStartUtc = kstDateToUtcDate(minAllowedKstDate, 0, 0, 0, 0);
  const requestedStartUtc = kstDateToUtcDate(parsedKstDate, 0, 0, 0, 0);
  if (requestedStartUtc < minAllowedStartUtc) {
    return res.status(400).json({ error: `${formatKstDate(minAllowedKstDate)}(KST) 이전 날짜로 설정할 수 없습니다.` });
  }

  const song = await prisma.song.findUnique({
    where: { id: Number(id) },
  });

  if (!song) {
    return res.status(404).json({ error: '기상송을 찾을 수 없습니다.' });
  }

  if (song.type !== 'WAKEUP') {
    return res.status(400).json({ error: '기상송만 스케줄을 변경할 수 있습니다.' });
  }

  const updated = await prisma.song.update({
    where: { id: Number(id) },
    data: {
      status: 'APPROVED',
      play_date: requestedStartUtc,
    },
  });

  res.json({ song: sanitizeSong(updated), message: '스케줄이 변경되었습니다.' });
}

async function cancelWakeupApproval(req, res) {
  const { id } = req.params;

  const song = await prisma.song.findUnique({
    where: { id: Number(id) },
  });

  if (!song) {
    return res.status(404).json({ error: '기상송을 찾을 수 없습니다.' });
  }

  if (song.type !== 'WAKEUP') {
    return res.status(400).json({ error: '기상송만 승인 취소할 수 있습니다.' });
  }

  if (song.status !== 'APPROVED') {
    return res.status(400).json({ error: '승인된 기상송만 승인 취소할 수 있습니다.' });
  }

  const updated = await prisma.song.update({
    where: { id: Number(id) },
    data: {
      status: 'PENDING',
      play_date: null,
    },
  });

  res.json({ song: sanitizeSong(updated), message: '기상송 승인이 취소되었습니다.' });
}

async function getRadioApplications(req, res) {
  const songs = await prisma.song.findMany({
    where: { type: 'RADIO', status: 'PENDING' },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { created_at: 'asc' },
  });
  res.json({ songs: sanitizeSongs(songs) });
}

async function approveAllRadio(req, res) {
  const now = new Date();
  const result = await prisma.song.updateMany({
    where: { type: 'RADIO', status: 'PENDING' },
    data: { status: 'APPROVED', play_date: now },
  });

  res.json({
    updatedCount: result.count,
    message: result.count > 0
      ? `${result.count}개의 신청이 승인되었습니다.`
      : '승인할 신청이 없습니다.',
  });
}

async function approveRadio(req, res) {
  const { id } = req.params;
  const song = await prisma.song.update({
    where: { id: Number(id) },
    data: { status: 'APPROVED', play_date: new Date() },
  });
  res.json({ song: sanitizeSong(song) });
}

async function rejectRadio(req, res) {
  const { id } = req.params;
  const song = await prisma.song.update({
    where: { id: Number(id) },
    data: { status: 'REJECTED' },
  });
  res.json({ song: sanitizeSong(song) });
}

async function getTodayRadioPlaylist(req, res) {
  const todayKstDate = getKstDate();
  const { start: dayStart, end: dayEnd } = getKstDayRange(todayKstDate);

  const songs = await prisma.song.findMany({
    where: {
      type: 'RADIO',
      status: 'APPROVED',
      play_date: { gte: dayStart, lt: dayEnd },
    },
    include: { user: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  });
  res.json({ songs: sanitizeSongs(songs) });
}

async function getAuditLogs(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 30));
  const skip = (page - 1) * pageSize;

  const where = {};

  const queryText = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (queryText) {
    where.OR = [
      { user_email: { contains: queryText } },
      { user_name: { contains: queryText } },
      { method: { contains: queryText } },
      { path: { contains: queryText } },
    ];
  }

  if (req.query.userId !== undefined) {
    const userId = Number.parseInt(req.query.userId, 10);
    if (Number.isNaN(userId) || userId <= 0) {
      return res.status(400).json({ error: '유효하지 않은 userId입니다.' });
    }
    where.user_id = userId;
  }

  if (req.query.method !== undefined) {
    const method = String(req.query.method).toUpperCase();
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!allowedMethods.includes(method)) {
      return res.status(400).json({ error: '유효하지 않은 method입니다.' });
    }
    where.method = method;
  }

  if (req.query.status !== undefined) {
    const status = Number.parseInt(req.query.status, 10);
    if (Number.isNaN(status) || status < 100 || status > 599) {
      return res.status(400).json({ error: '유효하지 않은 status입니다.' });
    }
    where.status_code = status;
  }

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: pageSize,
    }),
  ]);

  res.json({
    logs,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

// Blacklist management
async function searchUsers(req, res) {
  const { q } = req.query;
  if (!q) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    },
    select: { id: true, email: true, name: true, role: true, is_blacklisted: true },
  });
  res.json({ users });
}

async function toggleBlacklist(req, res) {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

  // Prevent blocking LEADER and MEMBER
  if (user.role === 'LEADER' || user.role === 'MEMBER') {
    return res.status(403).json({ error: '방송부원과 방송부장은 차단할 수 없습니다.' });
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: { is_blacklisted: !user.is_blacklisted },
  });
  res.json({ user: updated });
}

async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  if (!['USER', 'MEMBER', 'LEADER'].includes(role)) {
    return res.status(400).json({ error: '올바른 역할이 아닙니다.' });
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: { role },
  });
  res.json({ user: updated });
}

async function downloadTodayWakeup(req, res) {
  let ytDlpProcess = null;
  let ffmpegProcess = null;

  try {
    const displayKstDate = getWakeupDisplayDateKst();
    const { start: dayStart, end: dayEnd } = getKstDayRange(displayKstDate);

    const songs = await prisma.song.findMany({
      where: {
        type: 'WAKEUP',
        status: { in: ['APPROVED', 'PLAYED'] },
        play_date: { gte: dayStart, lt: dayEnd },
      },
      include: { user: { select: { name: true } } },
      orderBy: { play_date: 'asc' },
    });

    if (songs.length === 0) {
      return res.status(404).json({ error: `${formatKstDate(displayKstDate)}(KST) 기준 기상송이 없습니다.` });
    }

    const { videoId } = req.params;
    const { downloadToken } = req.query;
    const song = songs.find(s => s.video_id === videoId);

    if (!song) {
      return res.status(404).json({ error: '해당 곡을 찾을 수 없습니다.' });
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[Download] Starting download for: ${song.title} (${videoId})`);

    const sanitizedTitle = song.title.replace(/[<>:"/\\|?*]/g, '_');

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sanitizedTitle)}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    const safeToken = (
      typeof downloadToken === 'string' &&
      /^[a-zA-Z0-9_-]{16,128}$/.test(downloadToken)
    ) ? downloadToken : null;

    const markDownloadStarted = () => {
      if (!safeToken) return;

      const cookieParts = [
        `spot_download_token=${encodeURIComponent(safeToken)}`,
        'Path=/',
        'Max-Age=120',
        'SameSite=Lax',
      ];

      if (process.env.NODE_ENV === 'production') {
        cookieParts.push('Secure');
      }

      res.append('Set-Cookie', cookieParts.join('; '));
    };

    // Use yt-dlp as extractor to avoid frequent YouTube decipher/signature breakages
    ytDlpProcess = spawn('yt-dlp', [
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      '--no-progress',
      '--extractor-args', 'youtube:player_client=android,web',
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-o', '-',
      url,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    console.log('[Download] yt-dlp process started');

    // Create ffmpeg process
    ffmpegProcess = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',
      '-f', 'mp3',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      '-ar', '44100',
      '-ac', '2',
      'pipe:1'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log('[Download] FFmpeg process started');

    let ytDlpError = '';
    let ffmpegError = '';
    let completed = false;

    ytDlpProcess.on('error', (error) => {
      console.error('[Download] yt-dlp start error:', error.message);
      if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.kill('SIGKILL');
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'yt-dlp를 실행하지 못했습니다.' });
      }
    });

    ytDlpProcess.stderr.on('data', (data) => {
      ytDlpError += data.toString();
    });

    ytDlpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('[Download] yt-dlp exited with code:', code);
        if (ytDlpError) {
          console.error('[Download] yt-dlp stderr:', ytDlpError);
        }
        if (ffmpegProcess && !ffmpegProcess.killed) {
          ffmpegProcess.kill('SIGKILL');
        }
        if (!res.headersSent) {
          res.status(502).json({ error: 'YouTube 오디오 추출에 실패했습니다.' });
        }
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error('[Download] FFmpeg error:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'MP3 변환에 실패했습니다.' });
      }
    });

    ffmpegProcess.stderr.on('data', (data) => {
      ffmpegError += data.toString();
    });

    ffmpegProcess.stdin.on('error', (error) => {
      // EPIPE can happen if ffmpeg exits before yt-dlp stream fully ends
      if (error.code !== 'EPIPE') {
        console.error('[Download] FFmpeg stdin error:', error.message);
      }
    });

    ffmpegProcess.on('close', (code) => {
      completed = true;
      if (code !== 0) {
        console.error('[Download] FFmpeg exited with code:', code);
        if (ffmpegError) {
          console.error('[Download] FFmpeg stderr:', ffmpegError);
        }
        if (!res.headersSent) {
          res.status(500).json({ error: 'MP3 변환 중 오류가 발생했습니다.' });
          return;
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
    });

    // Cleanup on client disconnect
    res.on('close', () => {
      if (!completed) {
        console.log('[Download] Client disconnected, cleaning up');
      }
      if (ytDlpProcess && !ytDlpProcess.killed) ytDlpProcess.kill('SIGKILL');
      if (ffmpegProcess && !ffmpegProcess.killed) ffmpegProcess.kill('SIGKILL');
    });

    // Pipe streams. Mark download start only when first MP3 bytes are ready.
    ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);
    ffmpegProcess.stdout.once('data', (chunk) => {
      markDownloadStarted();
      res.write(chunk);
      ffmpegProcess.stdout.pipe(res);
    });

  } catch (error) {
    console.error('[Download] Error:', error.message);
    console.error('[Download] Stack:', error.stack);

    // Cleanup
    if (ytDlpProcess && !ytDlpProcess.killed) ytDlpProcess.kill('SIGKILL');
    if (ffmpegProcess && !ffmpegProcess.killed) ffmpegProcess.kill('SIGKILL');

    if (!res.headersSent) {
      if (error.message.includes('Video unavailable')) {
        return res.status(404).json({ error: '영상을 찾을 수 없습니다.' });
      }
      return res.status(500).json({ error: '다운로드에 실패했습니다: ' + error.message });
    }
  }
}

module.exports = {
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
};
