import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { puedeVer, rutaPorDefecto } from '../config/permisos';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-secondary">Cargando…</p>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export function RequireRole({ routeKey, children }) {
  const { role, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!puedeVer(role, routeKey)) return <Navigate to={rutaPorDefecto(role)} replace />;
  return children;
}
