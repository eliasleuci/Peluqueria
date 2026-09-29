import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import OlvideClave from './pages/OlvideClave.jsx';
import RestablecerClave from './pages/RestablecerClave.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RegistrarCorte from './pages/RegistrarCorte.jsx';
import RegistrarVenta from './pages/RegistrarVenta.jsx';
import Agenda from './pages/Agenda.jsx';
import Peluqueros from './pages/Peluqueros.jsx';
import Inventario from './pages/Inventario.jsx';
import Configuracion from './pages/Configuracion.jsx';
import MiHorario from './pages/MiHorario.jsx';
import MisFinanzas from './pages/MisFinanzas.jsx';
import Asistencias from './pages/Asistencias.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { RequireAuth, RequireRole } from './components/RouteGuards.jsx';
import BrandingSync from './components/BrandingSync.jsx';
import { rutaPorDefecto } from './config/permisos.js';

function IndexRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={rutaPorDefecto(role)} replace />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <BrandingSync />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/olvide-clave" element={<OlvideClave />} />
              <Route path="/restablecer-clave" element={<RestablecerClave />} />
              {/* URL de instalación por cliente (branding PWA). El ícono ya se capturó al instalar
                  vía la Edge Function; en runtime solo llevamos al flujo normal. */}
              <Route path="/p/:slug" element={<Navigate to="/" replace />} />

              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RequireRole routeKey="admin">
                      <Admin />
                    </RequireRole>
                  </RequireAuth>
                }
              />

              <Route
                element={
                  <RequireAuth>
                    <App />
                  </RequireAuth>
                }
              >
                <Route index element={<IndexRedirect />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireRole routeKey="dashboard">
                      <Dashboard />
                    </RequireRole>
                  }
                />
                <Route
                  path="/registrar"
                  element={
                    <RequireRole routeKey="registrar">
                      <RegistrarCorte />
                    </RequireRole>
                  }
                />
                <Route
                  path="/registrar-venta"
                  element={
                    <RequireRole routeKey="registrarventa">
                      <RegistrarVenta />
                    </RequireRole>
                  }
                />
                <Route
                  path="/mi-horario"
                  element={
                    <RequireRole routeKey="mihorario">
                      <MiHorario />
                    </RequireRole>
                  }
                />
                <Route
                  path="/mis-finanzas"
                  element={
                    <RequireRole routeKey="misfinanzas">
                      <MisFinanzas />
                    </RequireRole>
                  }
                />
                <Route
                  path="/agenda"
                  element={
                    <RequireRole routeKey="agenda">
                      <Agenda />
                    </RequireRole>
                  }
                />
                <Route
                  path="/asistencias"
                  element={
                    <RequireRole routeKey="asistencias">
                      <Asistencias />
                    </RequireRole>
                  }
                />
                <Route
                  path="/peluqueros"
                  element={
                    <RequireRole routeKey="peluqueros">
                      <Peluqueros />
                    </RequireRole>
                  }
                />
                <Route
                  path="/inventario"
                  element={
                    <RequireRole routeKey="inventario">
                      <Inventario />
                    </RequireRole>
                  }
                />
                <Route
                  path="/configuracion"
                  element={
                    <RequireRole routeKey="configuracion">
                      <Configuracion />
                    </RequireRole>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  </StrictMode>
);
