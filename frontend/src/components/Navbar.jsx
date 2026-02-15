import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const isAdmin = user && (user.role === 'MEMBER' || user.role === 'LEADER');
  const isBlocked = user?.is_blacklisted;
  const navClassName = ({ isActive }) => `cu-link text-xs sm:text-sm ${isActive ? 'is-active' : ''}`;

  return (
    <nav className="cu-nav-shell">
      <div className="cu-nav-wrap">
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
          <Link to="/" className="inline-flex items-center gap-1 mr-3 sm:mr-5 text-base sm:text-lg font-bold tracking-tight">
            <img src="/spot-logo.svg" alt="SPOT logo" className="w-8 h-8 sm:w-9 sm:h-9" />
            <span>SPOT</span>
          </Link>
          <NavLink to="/" end className={({ isActive }) => `hidden sm:block ${navClassName({ isActive })}`}>홈</NavLink>
          {user && (
            <>
              {!isBlocked && (
                <NavLink to="/apply" className={navClassName}>신청</NavLink>
              )}
              <NavLink to="/my" className={({ isActive }) => `hidden md:block ${navClassName({ isActive })}`}>마이페이지</NavLink>
              <NavLink to="/my" className={({ isActive }) => `md:hidden ${navClassName({ isActive })}`}>MY</NavLink>
            </>
          )}
          {isAdmin && !isBlocked && (
            <NavLink to="/admin" className={navClassName}>관리</NavLink>
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
