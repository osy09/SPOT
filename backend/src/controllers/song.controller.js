const prisma = require('../lib/prisma');
const axios = require('axios');
const { google } = require('googleapis');
const {
  getKstDate,
  getKstDayRange,
  getWakeupDisplayDateKst,
  formatKstDate,
  addDaysToKstDate,
} = require('../lib/kst-time');
const { sanitizeSong, sanitizeSongs } = require('../lib/song-response');
const { getApplyNotice } = require('../lib/apply-notice');

function isValidVideoId(videoId) {
  return typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

function extractVideoId(url) {
  if (typeof url !== 'string') return null;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  try {
    const parsed = new URL(trimmedUrl);
    const hostname = parsed.hostname.toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (hostname === 'youtu.be') {
      const candidate = pathSegments[0];
      return isValidVideoId(candidate) ? candidate : null;
    }

    if (hostname.endsWith('youtube.com') || hostname.endsWith('youtube-nocookie.com')) {
      if (parsed.pathname === '/watch') {
        const candidate = parsed.searchParams.get('v');
        return isValidVideoId(candidate) ? candidate : null;
      }

      const maybeIdPath = pathSegments[0];
      if (maybeIdPath === 'embed' || maybeIdPath === 'shorts' || maybeIdPath === 'live') {
        const candidate = pathSegments[1];
        return isValidVideoId(candidate) ? candidate : null;
      }
    }
  } catch {
    // Fallback to regex parsing for malformed URL text.
  }

  const fallbackPatterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of fallbackPatterns) {
    const match = trimmedUrl.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function parseYoutubeRequest(req, res) {
  const youtube_url = typeof req.body?.youtube_url === 'string' ? req.body.youtube_url.trim() : '';
  if (!youtube_url) {
    res.status(400).json({ error: 'YouTube URL을 입력해주세요.' });
    return null;
  }

  const video_id = extractVideoId(youtube_url);
  if (!video_id) {
    res.status(400).json({ error: '올바른 YouTube URL이 아닙니다.' });
    return null;
  }

  return { youtube_url, video_id };
}

async function fetchVideoInfo(videoId) {
  try {
    const res = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    return {
      title: res.data.title,
      channel_name: res.data.author_name,
    };
  } catch {
    return null;
  }
}

async function applyWakeup(req, res) {
  // Check if user is blacklisted
  if (req.user.is_blacklisted) {
    return res.status(403).json({ error: '신청이 거부되었습니다.' });
  }

  const parsedRequest = parseYoutubeRequest(req, res);
  if (!parsedRequest) return;
  const { video_id } = parsedRequest;

  const info = await fetchVideoInfo(video_id);
  if (!info) {
    return res.status(400).json({ error: '영상 정보를 가져올 수 없습니다.' });
  }

  try {
    // Race Condition 방지를 위해 트랜잭션 사용
    const result = await prisma.$transaction(async (tx) => {
      // USER 역할은 하루에 기상송 1곡만 신청 가능 (자정 기준, KST)
      if (req.user.role === 'USER') {
        const todayKst = getKstDate();
        const { start: dayStart, end: dayEnd } = getKstDayRange(todayKst);

        const todayCount = await tx.song.count({
          where: {
            user_id: req.user.id,
            type: 'WAKEUP',
            created_at: { gte: dayStart, lt: dayEnd },
          },
        });

        if (todayCount > 0) {
          throw new Error('하루에 1곡까지 신청할 수 있습니다.');
        }
      }

      // 대기열에 이미 있는지 확인 (PENDING만 - APPROVED는 스케줄 확정 곡이므로 제외)
      const inQueue = await tx.song.findFirst({
        where: {
          video_id,
          type: 'WAKEUP',
          status: 'PENDING',
        },
        select: { id: true },
      });

      if (inQueue) {
        throw new Error('이미 대기열에 있는 노래입니다.');
      }

      // 중복 확인: 최근 7일 이내 재생 여부
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recent = await tx.song.findFirst({
        where: {
          video_id,
          type: 'WAKEUP',
          status: 'PLAYED',
          play_date: { gte: sevenDaysAgo },
        },
        select: { id: true },
      });

      // 트랜잭션 내에서 곡 생성
      const song = await tx.song.create({
        data: {
          user_id: req.user.id,
          type: 'WAKEUP',
          youtube_url: `https://www.youtube.com/watch?v=${video_id}`,
          video_id,
          title: info.title,
          channel_name: info.channel_name,
          status: 'PENDING',
        },
      });

      return {
        song,
        hasRecentPlay: !!recent,
      };
    });

    res.json({
      song: sanitizeSong(result.song),
      warning: result.hasRecentPlay ? '이 곡은 최근 7일 이내에 재생된 적이 있습니다.' : null,
    });
  } catch (error) {
    // 트랜잭션 에러 처리
    if (error.message === '하루에 1곡까지 신청할 수 있습니다.' ||
        error.message === '이미 대기열에 있는 노래입니다.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('[기상송 신청 오류]', error.message);
    return res.status(500).json({ error: '신청 처리 중 오류가 발생했습니다.' });
  }
}

async function applyRadio(req, res) {
  // Check if user is blacklisted
  if (req.user.is_blacklisted) {
    return res.status(403).json({ error: '신청이 거부되었습니다.' });
  }

  const parsedRequest = parseYoutubeRequest(req, res);
  if (!parsedRequest) return;
  const { video_id } = parsedRequest;

  const info = await fetchVideoInfo(video_id);
  if (!info) {
    return res.status(400).json({ error: '영상 정보를 가져올 수 없습니다.' });
  }

  try {
    // Race Condition 방지를 위해 트랜잭션 사용
    const song = await prisma.$transaction(async (tx) => {
      // 오늘 대기열에 이미 있는지 확인 (PENDING 또는 APPROVED)
      const todayKst = getKstDate();
      const { start: dayStart, end: dayEnd } = getKstDayRange(todayKst);

      const inQueue = await tx.song.findFirst({
        where: {
          video_id,
          type: 'RADIO',
          status: { in: ['PENDING', 'APPROVED'] },
          created_at: { gte: dayStart, lt: dayEnd },
        },
        select: { id: true },
      });

      if (inQueue) {
        throw new Error('이미 오늘 대기열에 있는 노래입니다.');
      }

      // 트랜잭션 내에서 곡 생성
      return await tx.song.create({
        data: {
          user_id: req.user.id,
          type: 'RADIO',
          youtube_url: `https://www.youtube.com/watch?v=${video_id}`,
          video_id,
          title: info.title,
          channel_name: info.channel_name,
          status: 'PENDING',
        },
      });
    });

    res.json({ song: sanitizeSong(song) });
  } catch (error) {
    // 트랜잭션 에러 처리
    if (error.message === '이미 오늘 대기열에 있는 노래입니다.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('[점심방송 신청 오류]', error.message);
    return res.status(500).json({ error: '신청 처리 중 오류가 발생했습니다.' });
  }
}

async function getSchedule(req, res) {
  const displayKstDate = getWakeupDisplayDateKst();
  const nextKstDate = addDaysToKstDate(displayKstDate, 1);
  const { start: nextDayStart } = getKstDayRange(nextKstDate);

  const songs = await prisma.song.findMany({
    where: {
      type: 'WAKEUP',
      status: { in: ['APPROVED', 'PLAYED'] },
      play_date: { gte: nextDayStart },
    },
    include: { user: { select: { name: true } } },
    orderBy: { play_date: 'asc' },
  });

  res.json({ songs: sanitizeSongs(songs) });
}

async function getTodayWakeup(req, res) {
  const displayKstDate = getWakeupDisplayDateKst();
  const { start: dayStart, end: dayEnd } = getKstDayRange(displayKstDate);
  const isTomorrow = formatKstDate(displayKstDate) !== formatKstDate(getKstDate());

  const songs = await prisma.song.findMany({
    where: {
      type: 'WAKEUP',
      status: { in: ['APPROVED', 'PLAYED'] },
      play_date: { gte: dayStart, lt: dayEnd },
    },
    include: { user: { select: { name: true } } },
    orderBy: { play_date: 'asc' },
  });

  res.json({
    songs: sanitizeSongs(songs),
    display_date: formatKstDate(displayKstDate),
    is_tomorrow: isTomorrow,
  });
}

/**
 * GET /api/songs/daily
 * 오늘과 내일의 승인된 기상송 YouTube URL을 반환하는 공개 API.
 * 외부 웹 플랫폼에 기상송 URL을 제공하기 위해 사용된다.
 */
async function getDailyWakeup(req, res) {
  const todayKst    = getKstDate();
  const tomorrowKst = addDaysToKstDate(todayKst, 1);

  const { start: todayStart, end: todayEnd }       = getKstDayRange(todayKst);
  const { start: tomorrowStart, end: tomorrowEnd } = getKstDayRange(tomorrowKst);

  const [todaySongs, tomorrowSongs] = await Promise.all([
    prisma.song.findMany({
      where: {
        type: 'WAKEUP',
        status: { in: ['APPROVED', 'PLAYED'] },
        play_date: { gte: todayStart, lt: todayEnd },
      },
      select: { youtube_url: true },
      orderBy: { play_date: 'asc' },
    }),
    prisma.song.findMany({
      where: {
        type: 'WAKEUP',
        status: 'APPROVED',
        play_date: { gte: tomorrowStart, lt: tomorrowEnd },
      },
      select: { youtube_url: true },
      orderBy: { play_date: 'asc' },
    }),
  ]);

  res.json({
    today: {
      date: formatKstDate(todayKst),
      urls: todaySongs.map((s) => s.youtube_url),
    },
    tomorrow: {
      date: formatKstDate(tomorrowKst),
      urls: tomorrowSongs.map((s) => s.youtube_url),
    },
  });
}

async function getWakeupQueue(req, res) {
  const songs = await prisma.song.findMany({
    where: {
      type: 'WAKEUP',
      status: 'PENDING',
    },
    include: { user: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  });

  res.json({ songs: sanitizeSongs(songs) });
}

async function getMySongs(req, res) {
  try {
    const songs = await prisma.song.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    res.json({ songs: sanitizeSongs(songs) });
  } catch (error) {
    console.error('[내 신청 곡 조회 오류]', error.message);
    res.status(500).json({ error: '신청 기록을 불러오는데 실패했습니다.' });
  }
}

async function cancelMyPendingSong(req, res) {
  const id = req.validatedId ?? Number(req.params.id);

  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      status: true,
    },
  });

  if (!song) {
    return res.status(404).json({ error: '신청한 곡을 찾을 수 없습니다.' });
  }

  if (song.user_id !== req.user.id) {
    return res.status(403).json({ error: '본인의 신청만 취소할 수 있습니다.' });
  }

  if (song.status !== 'PENDING') {
    return res.status(400).json({ error: '대기중 상태의 신청만 취소할 수 있습니다.' });
  }

  await prisma.song.delete({ where: { id } });
  res.json({ message: '신청이 취소되었습니다.' });
}

async function searchYoutube(req, res) {
  try {
    const queryText = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!queryText) {
      return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    // YouTube Data API Key가 없으면 오류 반환
    if (!process.env.YOUTUBE_API_KEY) {
      console.error('[YouTube 검색] YOUTUBE_API_KEY가 설정되지 않음');
      return res.status(500).json({ error: 'YouTube 검색 기능이 설정되지 않았습니다.' });
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
    });

    const response = await youtube.search.list({
      part: ['snippet'],
      q: queryText,
      type: ['video'],
      maxResults: 10,
      videoCategoryId: '10', // 음악 카테고리
      regionCode: 'KR',
    });

    const results = response.data.items.map(item => ({
      video_id: item.id.videoId,
      title: item.snippet.title,
      channel_name: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
    }));

    res.json({ results });
  } catch (error) {
    console.error('[YouTube 검색 오류]', error.message);
    const statusCode = error?.response?.status || Number(error?.code);
    if (statusCode === 403) {
      return res.status(403).json({ error: 'YouTube API 할당량이 초과되었습니다.' });
    }
    res.status(500).json({ error: '검색에 실패했습니다.' });
  }
}

async function getApplyNoticeSettings(req, res) {
  const notice = await getApplyNotice();
  res.json({ notice });
}

module.exports = {
  applyWakeup,
  applyRadio,
  getSchedule,
  getTodayWakeup,
  getDailyWakeup,
  getWakeupQueue,
  getMySongs,
  cancelMyPendingSong,
  searchYoutube,
  getApplyNoticeSettings,
};
