import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';

const Home = lazy(() => import('./pages/Home'));
const Apply = lazy(() => import('./pages/Apply'));
const Admin = lazy(() => import('./pages/Admin'));
const MyPage = lazy(() => import('./pages/MyPage'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  if (user.role !== 'MEMBER' && user.role !== 'LEADER') return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen cu-empty">
        로딩 중...
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Navbar />
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh] cu-empty">로딩 중...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/apply" element={<ProtectedRoute><Apply /></ProtectedRoute>} />
            <Route path="/my" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </ToastProvider>
  );
}
