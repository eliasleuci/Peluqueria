import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import AccountMenu from './components/AccountMenu';
import { NAV_ITEMS } from './components/nav';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { data, loading, dataError, activeLocal, setActiveLocal } = useApp();
  const { role } = useAuth();
  const location = useLocation();

  const currentLabel = NAV_ITEMS.find((n) => n.path === location.pathname)?.label ?? '';
  const showLocalSelect = role !== 'PELUQUERO';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-secondary">Cargando…</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--red)' }}>No se pudieron cargar los datos: {dataError}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <header className="topbar">
          <h1>{currentLabel}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showLocalSelect && (
              <div className="field local-select">
                <select value={activeLocal} onChange={(e) => setActiveLocal(e.target.value)}>
                  <option value="all">Todos los locales</option>
                  {data.locales.filter((l) => l.activo).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <AccountMenu />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
