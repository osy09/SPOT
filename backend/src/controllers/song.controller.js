const prisma = require('../lib/prisma');
const axios = require('axios');
const { google } = require('googleapis');
const {
  getKstDate,
  getKstDayRange,
  getWakeupDisplayDateKst,
  formatKstDate,
} = require('../lib/kst-time');
const { sanitizeSong, sanitizeSongs } = require('../lib/song-response');

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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

  const { youtube_url } = req.body;
  if (!youtube_url) {
    return res.status(400).json({ error: 'YouTube URL을 입력해주세요.' });
  }

  const video_id = extractVideoId(youtube_url);
  if (!video_id) {
    return res.status(400).json({ error: '올바른 YouTube URL이 아닙니다.' });
  }

  // USER role can apply only one wake-up song per day (midnight 기준, KST)
  if (req.user.role === 'USER') {
    const todayKst = getKstDate();
    const { start: dayStart, end: dayEnd } = getKstDayRange(todayKst);

    const alreadyAppliedToday = await prisma.song.findFirst({
      where: {
        user_id: req.user.id,
        type: 'WAKEUP',
        created_at: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });

    if (alreadyAppliedToday) {
      return res.status(400).json({ error: 'USER 권한은 자정(한국시간) 기준 하루에 기상송 1곡만 신청할 수 있습니다.' });
    }
  }

  const info = await fetchVideoInfo(video_id);
  if (!info) {
    return res.status(400).json({ error: '영상 정보를 가져올 수 없습니다.' });
  }

  // Check if already in queue (PENDING or APPROVED)
  const inQueue = await prisma.song.findFirst({
    where: {
      video_id,
      type: 'WAKEUP',
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });

  if (inQueue) {
    return res.status(400).json({ error: '이미 대기열에 있는 노래입니다.' });
  }

  // Duplicate check: played in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = await prisma.song.findFirst({
    where: {
      video_id,
      type: 'WAKEUP',
      status: 'PLAYED',
      play_date: { gte: sevenDaysAgo },
    },
  });

  const song = await prisma.song.create({
    data: {
      user_id: req.user.id,
      type: 'WAKEUP',
      youtube_url,
      video_id,
      title: info.title,
      channel_name: info.channel_name,
      status: 'PENDING',
    },
  });

  res.json({
    song: sanitizeSong(song),
    warning: recent ? '이 곡은 최근 7일 이내에 재생된 적이 있습니다.' : null,
  });
}

async function applyRadio(req, res) {
  // Check if user is blacklisted
  if (req.user.is_blacklisted) {
    return res.status(403).json({ error: '신청이 거부되었습니다.' });
  }

  const { youtube_url } = req.body;
  if (!youtube_url) {
    return res.status(400).json({ error: 'YouTube URL을 입력해주세요.' });
  }

  const video_id = extractVideoId(youtube_url);
  if (!video_id) {
    return res.status(400).json({ error: '올바른 YouTube URL이 아닙니다.' });
  }

  const info = await fetchVideoInfo(video_id);
  if (!info) {
    return res.status(400).json({ error: '영상 정보를 가져올 수 없습니다.' });
  }

  // Check if already in today's queue (PENDING or APPROVED)
  const todayKst = getKstDate();
  const { start: dayStart, end: dayEnd } = getKstDayRange(todayKst);

  const inQueue = await prisma.song.findFirst({
    where: {
      video_id,
      type: 'RADIO',
      status: { in: ['PENDING', 'APPROVED'] },
      created_at: { gte: dayStart, lt: dayEnd },
    },
  });

  if (inQueue) {
    return res.status(400).json({ error: '이미 오늘 대기열에 있는 노래입니다.' });
  }

  const song = await prisma.song.create({
    data: {
      user_id: req.user.id,
      type: 'RADIO',
      youtube_url,
      video_id,
      title: info.title,
      channel_name: info.channel_name,
      status: 'PENDING',
    },
  });

  res.json({ song: sanitizeSong(song) });
}

async function getSchedule(req, res) {
  const displayKstDate = getWakeupDisplayDateKst();
  const { start: dayStart } = getKstDayRange(displayKstDate);

  const songs = await prisma.song.findMany({
    where: {
      type: 'WAKEUP',
      status: { in: ['APPROVED', 'PLAYED'] },
      play_date: { gte: dayStart },
    },
    include: { user: { select: { name: true } } },
    orderBy: { play_date: 'asc' },
  });

  res.json({ songs: sanitizeSongs(songs) });
}

async function getTodayWakeup(req, res) {
  const todayKstDate = getKstDate();
  const displayKstDate = getWakeupDisplayDateKst();
  const { start: dayStart, end: dayEnd } = getKstDayRange(displayKstDate);
  const isTomorrowDisplay =
    todayKstDate.year !== displayKstDate.year ||
    todayKstDate.month !== displayKstDate.month ||
    todayKstDate.day !== displayKstDate.day;

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
    display_label: isTomorrowDisplay ? '내일' : '오늘',
    is_tomorrow: isTomorrowDisplay,
    display_time_zone: 'Asia/Seoul',
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
    console.error('[Get My Songs Error]', error.message);
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
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    // YouTube Data API Key가 없으면 오류 반환
    if (!process.env.YOUTUBE_API_KEY) {
      console.error('[YouTube Search] YOUTUBE_API_KEY is not configured');
      return res.status(500).json({ error: 'YouTube 검색 기능이 설정되지 않았습니다.' });
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
    });

    const response = await youtube.search.list({
      part: ['snippet'],
      q: q.trim(),
      type: ['video'],
      maxResults: 10,
      videoCategoryId: '10', // Music category
      regionCode: 'KR',
    });

    const results = response.data.items.map(item => ({
      video_id: item.id.videoId,
      title: item.snippet.title,
      channel_name: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
      youtube_url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    res.json({ results });
  } catch (error) {
    console.error('[YouTube Search Error]', error.message);
    if (error.code === 403) {
      return res.status(403).json({ error: 'YouTube API 할당량이 초과되었습니다.' });
    }
    res.status(500).json({ error: '검색에 실패했습니다.' });
  }
}

module.exports = {
  applyWakeup,
  applyRadio,
  getSchedule,
  getTodayWakeup,
  getWakeupQueue,
  getMySongs,
  cancelMyPendingSong,
  searchYoutube,
};
