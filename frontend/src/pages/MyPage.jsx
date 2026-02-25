import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import SongCard from '../components/SongCard';

function formatLastLogin(value) {
  if (!value) return '기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록 없음';
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');

  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}`;
}

const roleLabels = {
  USER: '학생',
  MEMBER: '방송부원',
  LEADER: '방송부장',
};

const statusLabels = {
  PENDING: '대기중',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  PLAYED: '재생됨',
};

const typeLabels = {
  WAKEUP: '기상송',
  RADIO: '점심방송',
};

export default function MyPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [songs, setSongs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [cancellingSongId, setCancellingSongId] = useState(null);

  useEffect(() => {
    api.get('/api/songs/my').then(r => setSongs(r.data.songs));
  }, []);

  const filteredSongs = useMemo(() => {
    if (filter === 'all') return songs;
    if (filter === 'wakeup') return songs.filter((song) => song.type === 'WAKEUP');
    if (filter === 'radio') return songs.filter((song) => song.type === 'RADIO');
    return songs;
  }, [filter, songs]);


  const cancelSong = async (songId) => {
    if (!confirm('대기중인 신청을 취소하시겠습니까?')) return;

    setCancellingSongId(songId);
    try {
      await api.delete(`/api/songs/my/${songId}`);
      setSongs(prev => prev.filter(song => song.id !== songId));
      showToast('신청이 취소되었습니다.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || '신청 취소에 실패했습니다.', 'error');
    } finally {
      setCancellingSongId(null);
    }
  };

  return (
    <div className="cu-page">
      <h2 className="cu-title mb-5">마이페이지</h2>

      {/* Blocked Warning */}
      {user?.is_blacklisted && (
        <div
          className="p-4 rounded-xl border mb-6"
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
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--cu-danger)' }}>계정이 차단되었습니다</h3>
              <p className="text-sm" style={{ color: 'var(--cu-danger)' }}>
                현재 노래 신청 및 기타 기능을 사용할 수 없습니다. 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Info */}
      <div className="cu-card mb-6">
        <h3 className="text-lg font-semibold mb-4">사용자 정보</h3>
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--cu-muted)' }}>이름</span>
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--cu-muted)' }}>이메일</span>
            <span className="text-sm font-medium break-all">{user?.email}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--cu-muted)' }}>역할</span>
            <span className="text-sm font-medium">
              {roleLabels[user?.role] || user?.role}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--cu-muted)' }}>상태</span>
            <span className="text-sm font-medium">
              {`${user?.is_blacklisted ? '차단됨' : '정상'} (최근로그인 : ${formatLastLogin(user?.last_login_at)})`}
            </span>
          </div>
        </div>
      </div>


      {/* Filter */}
      <div className="cu-tabbar mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`cu-tab ${
            filter === 'all'
              ? 'is-active'
              : ''
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('wakeup')}
          className={`cu-tab ${
            filter === 'wakeup'
              ? 'is-active'
              : ''
          }`}
        >
          기상송
        </button>
        <button
          onClick={() => setFilter('radio')}
          className={`cu-tab ${
            filter === 'radio'
              ? 'is-active'
              : ''
          }`}
        >
          점심방송
        </button>
      </div>

      {/* Song List */}
      <div>
        <h3 className="text-lg font-semibold mb-3">나의 신청 기록</h3>
        {filteredSongs.length === 0 ? (
          <p className="cu-empty text-center py-8">신청 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {filteredSongs.map(song => (
              <SongCard
                key={song.id}
                song={song}
                actions={
                  <div className="flex flex-wrap justify-end gap-1 sm:flex-col sm:items-end">
                    <span className="cu-badge cu-badge-muted">
                      {typeLabels[song.type]}
                    </span>
                    <span
                      className={`cu-badge ${
                        song.status === 'APPROVED' || song.status === 'PLAYED'
                          ? 'cu-badge-success'
                          : song.status === 'REJECTED'
                          ? 'cu-badge-danger'
                          : 'cu-badge-warning'
                      }`}
                    >
                      {statusLabels[song.status]}
                    </span>
                    {song.status === 'PENDING' && (
                      <button
                        onClick={() => cancelSong(song.id)}
                        disabled={cancellingSongId === song.id}
                        className="cu-btn cu-btn-danger"
                      >
                        {cancellingSongId === song.id ? '취소 중...' : '신청 취소'}
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
