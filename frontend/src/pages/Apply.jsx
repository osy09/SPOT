import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import SongCard from '../components/SongCard';

const WAKEUP_QUEUE_MANAGER_ROLES = new Set(['MEMBER', 'LEADER']);
const DEFAULT_APPLY_NOTICE = {
  wakeupPrimary: '기상송은 먼저 신청된 순서대로 승인됩니다.',
  radioPrimary: '점심방송은 매주 화, 목요일 진행합니다.',
  common: '부적절한 곡은 거절될 수 있습니다.',
};

export default function Apply() {
  const { user } = useAuth();
  const [tab, setTab] = useState('wakeup');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [wakeupQueue, setWakeupQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [deletingQueueSongId, setDeletingQueueSongId] = useState(null);
  const [applyNotice, setApplyNotice] = useState(DEFAULT_APPLY_NOTICE);
  const searchTimerRef = useRef(null);
  const searchRequestSeqRef = useRef(0);
  const { showToast } = useToast();
  const normalizedRole = typeof user?.role === 'string' ? user.role.toUpperCase() : '';
  const canManageWakeupQueue = WAKEUP_QUEUE_MANAGER_ROLES.has(normalizedRole);

  const clearSearchTimer = () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  };

  const loadWakeupQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await api.get('/api/songs/wakeup/queue');
      setWakeupQueue(res.data.songs);
    } catch {
      setWakeupQueue([]);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    loadWakeupQueue();
    api.get('/api/songs/apply-notice')
      .then((res) => {
        if (!res.data?.notice) return;
        setApplyNotice({
          wakeupPrimary: res.data.notice.wakeupPrimary || DEFAULT_APPLY_NOTICE.wakeupPrimary,
          radioPrimary: res.data.notice.radioPrimary || DEFAULT_APPLY_NOTICE.radioPrimary,
          common: res.data.notice.common || DEFAULT_APPLY_NOTICE.common,
        });
      })
      .catch(() => {
        setApplyNotice(DEFAULT_APPLY_NOTICE);
      });
    return () => {
      clearSearchTimer();
    };
  }, []);

  // YouTube URL 감지 함수
  const isYouTubeUrl = (text) => {
    const patterns = [
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /youtube\.com\/shorts\//,
    ];
    return patterns.some(pattern => pattern.test(text));
  };

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setInput(value);
    if (error) setError(''); // 입력이 변경되면 에러 메시지 초기화

    // URL이 아니고 2글자 이상이면 자동 검색
    clearSearchTimer();
    if (!isYouTubeUrl(value) && value.trim().length >= 2) {
      // 디바운스를 위한 타이머
      searchTimerRef.current = setTimeout(async () => {
        await performSearch(value);
      }, 500); // 0.5초 대기 후 검색
    } else {
      searchRequestSeqRef.current += 1;
      setSearching(false);
      setSearchResults([]);
    }
  };

  const performSearch = async (query) => {
    const queryText = query.trim();
    if (!queryText) {
      setSearchResults([]);
      return;
    }

    const requestSeq = searchRequestSeqRef.current + 1;
    searchRequestSeqRef.current = requestSeq;
    setSearching(true);
    try {
      const res = await api.get(`/api/songs/search?q=${encodeURIComponent(queryText)}`);
      if (requestSeq !== searchRequestSeqRef.current) return;
      setSearchResults(res.data.results);
    } catch {
      // 검색 실패 시 조용히 처리 (에러 토스트 표시 안 함)
      if (requestSeq !== searchRequestSeqRef.current) return;
      setSearchResults([]);
    } finally {
      if (requestSeq === searchRequestSeqRef.current) {
        setSearching(false);
      }
    }
  };

  const handleSelectSong = (song) => {
    clearSearchTimer();
    searchRequestSeqRef.current += 1;
    setInput(`https://www.youtube.com/watch?v=${song.video_id}`);
    if (error) setError('');
    setSearchResults([]);
    setSearching(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}/;
    if (!youtubeUrlRegex.test(input)) {
      const errorMessage = '유효한 YouTube URL을 입력해주세요.';
      setError(errorMessage);
      showToast(errorMessage, 'warning');
      return;
    }

    setError(''); // 유효성 검사 통과 시 에러 메시지 초기화
    setLoading(true);

    try {
      if (tab === 'wakeup') {
        const res = await api.post('/api/songs/wakeup', { youtube_url: input });
        showToast(`"${res.data.song.title}" 기상송 신청 완료!`, 'success');
        if (res.data.warning) {
          showToast(res.data.warning, 'warning');
        }
        await loadWakeupQueue();
      } else {
        const res = await api.post('/api/songs/radio', { youtube_url: input });
        showToast(`"${res.data.song.title}" 점심방송 신청 완료!`, 'success');
      }
      setInput('');
      clearSearchTimer();
      searchRequestSeqRef.current += 1;
      setSearchResults([]);
      setSearching(false);
    } catch (err) {
      showToast(err.response?.data?.error || '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQueueSong = async (id) => {
    if (!canManageWakeupQueue) return;
    if (!confirm('이 기상송을 대기열에서 삭제하시겠습니까?')) return;

    setDeletingQueueSongId(id);
    try {
      await api.delete(`/api/admin/wakeup/${id}`);
      showToast('기상송이 삭제되었습니다.', 'success');
      await loadWakeupQueue();
    } catch (err) {
      showToast(err.response?.data?.error || '기상송 삭제에 실패했습니다.', 'error');
    } finally {
      setDeletingQueueSongId(null);
    }
  };

  return (
    <div className="cu-page">
      <h2 className="cu-title mb-4 sm:mb-5">노래 신청</h2>

      {user?.is_blacklisted ? (
        <div
          className="p-4 sm:p-6 rounded-xl border"
          style={{
            borderColor: 'color-mix(in srgb, var(--cu-danger) 35%, var(--cu-line))',
            background: 'var(--cu-danger-soft)',
          }}
        >
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--cu-danger)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--cu-danger)' }}>신청이 거부되었습니다</h3>
              <p className="text-sm" style={{ color: 'var(--cu-danger)' }}>
                계정이 차단되어 노래 신청을 할 수 없습니다. 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="cu-card space-y-4 sm:space-y-5">
          {/* 기상송/점심방송 탭 */}
          <div className="cu-tabbar">
            <button
              onClick={() => setTab('wakeup')}
              className={`cu-tab ${
                tab === 'wakeup'
                  ? 'is-active'
                  : ''
              }`}
            >
              기상송
            </button>
            <button
              onClick={() => setTab('radio')}
              className={`cu-tab ${
                tab === 'radio'
                  ? 'is-active'
                  : ''
              }`}
            >
              점심방송
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                YouTube URL 또는 노래 이름
              </label>
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="노래 제목, 아티스트 이름 또는 YouTube URL..."
                required
                className="cu-input"
              />
              {error && <p className="text-xs mt-1.5" style={{ color: 'var(--cu-danger)' }}>{error}</p>}
              {searching && (
                <div className="absolute right-3 top-9 text-xs cu-empty">
                  검색 중...
                </div>
              )}
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto cu-subcard p-2">
                <p className="text-xs px-2 py-1" style={{ color: 'var(--cu-muted)' }}>검색 결과</p>
                {searchResults.map((song) => (
                  <button
                    key={song.video_id}
                    type="button"
                    onClick={() => handleSelectSong(song)}
                    className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors text-left"
                    style={{
                      borderColor: 'var(--cu-line)',
                      background: 'color-mix(in srgb, var(--cu-panel) 95%, transparent)',
                    }}
                  >
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-16 h-12 sm:w-20 sm:h-14 object-cover rounded border"
                      style={{ borderColor: 'var(--cu-line)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--cu-muted)' }}>{song.channel_name}</p>
                    </div>
                    <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--cu-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cu-btn cu-btn-primary w-full py-2.5 text-sm"
            >
              {loading ? '처리 중...' : '신청하기'}
            </button>
          </form>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--cu-accent-soft)', borderColor: 'color-mix(in srgb, var(--cu-accent) 25%, var(--cu-line))' }}>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--cu-accent)' }}>안내사항</h3>
            <ul className="text-xs space-y-1" style={{ color: 'var(--cu-accent)' }}>
              <li>• {tab === 'wakeup' ? applyNotice.wakeupPrimary : applyNotice.radioPrimary}</li>
              <li>• {applyNotice.common}</li>
            </ul>
          </div>

          {tab === 'wakeup' && (
            <section className="pt-2">
              <h3 className="text-base sm:text-lg font-semibold mb-3">기상송 대기열</h3>
              {queueLoading ? (
                <p className="cu-empty">대기열을 불러오는 중...</p>
              ) : wakeupQueue.length === 0 ? (
                <p className="cu-empty">대기 중인 기상송이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {wakeupQueue.map((song, index) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      showUser
                      actions={
                        <div className="flex flex-col items-end gap-1">
                          <span className="cu-badge cu-badge-muted">
                            대기 {index + 1}번
                          </span>
                          {canManageWakeupQueue && (
                            <button
                              onClick={() => handleDeleteQueueSong(song.id)}
                              disabled={deletingQueueSongId === song.id}
                              className="cu-btn cu-btn-danger"
                            >
                              {deletingQueueSongId === song.id ? '삭제 중...' : '삭제'}
                            </button>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
