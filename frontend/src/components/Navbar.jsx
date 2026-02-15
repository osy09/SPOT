import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const isAdmin = user && (user.role === 'MEMBER' || user.role === 'LEADER');
  const isBlocked = user?.is_blacklisted;
  const roleLabels = {
    USER: '학생',
    MEMBER: '방송부원',
    LEADER: '방송부장',
  };

  return (
    <nav className="cu-nav-shell">
      <div className="cu-nav-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link to="/" className="text-base sm:text-lg font-bold tracking-tight">SPOT</Link>
          <Link to="/" className="cu-link text-xs sm:text-sm hidden sm:block">홈</Link>
          {user && (
            <>
              {!isBlocked && (
                <Link to="/apply" className="cu-link text-xs sm:text-sm">신청</Link>
              )}
              <Link to="/my" className="cu-link text-xs sm:text-sm hidden md:block">마이페이지</Link>
              <Link to="/my" className="cu-link text-xs sm:text-sm md:hidden">MY</Link>
            </>
          )}
          {isAdmin && !isBlocked && (
            <Link to="/admin" className="cu-link text-xs sm:text-sm">관리</Link>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={toggle}
            className="cu-btn cu-btn-muted p-1.5 sm:p-2"
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <span className="text-sm hidden sm:inline" style={{ color: 'var(--cu-muted)' }}>
                {user.name}
              </span>
              <span className="cu-badge cu-badge-muted hidden md:inline-flex">
                {roleLabels[user.role] || user.role}
              </span>
              <button onClick={logout} className="cu-btn cu-btn-danger">
                로그아웃
              </button>
            </div>
          ) : (
            <a href="/auth/google" className="cu-btn cu-btn-primary">
              로그인
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
