const { google } = require('googleapis');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { encrypt, decrypt } = require('../lib/crypto');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

// Step 1: Leader initiates YouTube auth for the shared department account
async function startYoutubeAuth(req, res) {
  // Generate secure state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  req.session.youtubeOAuthState = state;
  req.session.youtubeOAuthInitiatedBy = req.user.id;

  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube'],
    state: state,
  });
  res.json({ url });
}

// Step 2: OAuth callback - store refresh token
async function youtubeCallback(req, res) {
  try {
    const { code, state } = req.query;

    const nonce = res.locals.cspNonce || '';

    if (!code) {
      return res.status(400).send(`<script nonce="${nonce}">alert("인증 코드가 없습니다."); window.close();</script>`);
    }

    // Verify state to prevent CSRF attacks
    if (!state || !req.session.youtubeOAuthState || state !== req.session.youtubeOAuthState) {
      console.error('[YouTube Callback] Invalid state parameter');
      return res.status(403).send(`<script nonce="${nonce}">alert("잘못된 요청입니다."); window.close();</script>`);
    }

    // Verify user is authenticated and is LEADER
    if (!req.session.youtubeOAuthInitiatedBy) {
      console.error('[YouTube Callback] No initiating user in session');
      return res.status(403).send(`<script nonce="${nonce}">alert("세션이 만료되었습니다."); window.close();</script>`);
    }

    // Verify the initiating user is still LEADER
    const user = await prisma.user.findUnique({
      where: { id: req.session.youtubeOAuthInitiatedBy },
    });

    if (!user || user.role !== 'LEADER') {
      console.error('[YouTube Callback] User is not LEADER');
      return res.status(403).send(`<script nonce="${nonce}">alert("권한이 없습니다."); window.close();</script>`);
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (tokens.refresh_token) {
      // Encrypt refresh token before storing
      const encryptedToken = encrypt(tokens.refresh_token);
      await prisma.systemToken.upsert({
        where: { key: 'youtube_refresh_token' },
        update: { value: encryptedToken },
        create: { key: 'youtube_refresh_token', value: encryptedToken },
      });
    }

    // Clear OAuth state from session
    delete req.session.youtubeOAuthState;
    delete req.session.youtubeOAuthInitiatedBy;

    res.send(`<script nonce="${nonce}">window.close();</script>`);
  } catch (error) {
    console.error('[YouTube Callback Error]', error.message);
    const nonce = res.locals.cspNonce || '';
    res.status(500).send(`<script nonce="${nonce}">alert("YouTube 연결에 실패했습니다."); window.close();</script>`);
  }
}

// Check if YouTube is connected
async function getYoutubeStatus(req, res) {
  try {
    const token = await prisma.systemToken.findUnique({
      where: { key: 'youtube_refresh_token' },
    });
    res.json({ connected: !!token });
  } catch (error) {
    console.error('[YouTube Status Error]', error.message);
    res.status(500).json({ error: 'YouTube 연결 상태 확인에 실패했습니다.' });
  }
}

// Export approved radio songs as a YouTube playlist
async function exportPlaylist(req, res) {
  try {
    const { songIds, title } = req.body;
    if (!songIds || !songIds.length) {
      return res.status(400).json({ error: '곡을 선택해주세요.' });
    }

    const tokenRecord = await prisma.systemToken.findUnique({
      where: { key: 'youtube_refresh_token' },
    });
    if (!tokenRecord) {
      return res.status(400).json({ error: 'YouTube 계정이 연결되지 않았습니다.' });
    }

    // Decrypt refresh token before use
    const refreshToken = decrypt(tokenRecord.value);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Create playlist
    const playlistTitle = title || `SPOT 점심방송 - ${new Date().toLocaleDateString('ko-KR')}`;
    const playlistRes = await youtube.playlists.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: { title: playlistTitle, description: 'DGSw 방송부 점심방송 재생목록' },
        status: { privacyStatus: 'unlisted' },
      },
    });
    const playlistId = playlistRes.data.id;

    // Add songs to playlist
    const songs = await prisma.song.findMany({
      where: { id: { in: songIds.map(Number) } },
      orderBy: { created_at: 'asc' },
    });

    for (const song of songs) {
      await youtube.playlistItems.insert({
        part: 'snippet',
        requestBody: {
          snippet: {
            playlistId,
            resourceId: { kind: 'youtube#video', videoId: song.video_id },
          },
        },
      });
    }

    res.json({
      playlistId,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
    });
  } catch (error) {
    console.error('[YouTube Export Error]', error.message);
    if (error.message.includes('API has not been used')) {
      return res.status(400).json({
        error: 'YouTube Data API v3가 활성화되지 않았습니다. Google Cloud Console에서 활성화해주세요.'
      });
    }
    return res.status(500).json({ error: '재생목록 생성에 실패했습니다.' });
  }
}

module.exports = { startYoutubeAuth, youtubeCallback, getYoutubeStatus, exportPlaylist };
