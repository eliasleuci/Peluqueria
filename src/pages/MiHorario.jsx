import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Badge from '../components/Badge';
import { toDateKey, formatDate } from '../utils/format';

export default function MiHorario() {
  const { data, marcarIngreso, marcarNotificacionLeida } = useApp();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [marcando, setMarcando] = useState(false);

  const miId = profile?.peluqueroId;
  const yo = data.peluqueros.find((p) => p.id === miId);
  const hoy = toDateKey(new Date());
  const asistenciaHoy = data.asistencias.find((a) => a.peluqueroId === miId && a.fecha === hoy);
  const misAsistencias = data.asistencias
    .filter((a) => a.peluqueroId === miId)
    .sort((a, b) => (b.fecha + b.horaIngreso).localeCompare(a.fecha + a.horaIngreso))
    .slice(0, 15);
  const avisos = data.notificaciones.filter((n) => n.peluqueroId === miId && !n.leida);

  async function handleMarcar() {
    setMarcando(true);
    try {
      const r = await marcarIngreso();
      if (r.estado === 'tarde') {
        showToast(`Fichaste tarde: ${r.minutosTarde} min.`, 'error');
      } else {
        showToast(`✓ Ingreso registrado a las ${r.horaIngreso}`);
      }
    } catch (err) {
      showToast(err.message ?? String(err), 'error');
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div className="stack-gap" style={{ maxWidth: 640, margin: '0 auto' }}>
      {avisos.map((n) => (
        <div key={n.id} className="alert-banner" style={{ justifyContent: 'space-between' }}>
          <span>⚠️ {n.mensaje}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => marcarNotificacionLeida(n.id)}>
            Entendido
          </button>
        </div>
      ))}

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="card-title" style={{ justifyContent: 'center' }}>Marcar ingreso</div>
        <p className="hint" style={{ marginBottom: 16 }}>
          {yo?.horaEntrada ? `Tu horario de entrada es ${yo.horaEntrada} (tolerancia de 5 min).` : 'No tenés hora de entrada configurada.'}
        </p>
        {asistenciaHoy ? (
          <div className="stack-gap" style={{ gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 22 }}>Ya fichaste hoy a las {asistenciaHoy.horaIngreso}</div>
            <Badge color={asistenciaHoy.estado === 'tarde' ? 'red' : 'green'}>
              {asistenciaHoy.estado === 'tarde' ? `Tarde (${asistenciaHoy.minutosTarde} min)` : 'A tiempo'}
            </Badge>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ fontSize: 18, padding: '14px 28px' }} onClick={handleMarcar} disabled={marcando}>
            {marcando ? 'Registrando…' : '⏰ Marcar mi ingreso'}
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-title">Mis últimos ingresos</div>
        <div className="table-wrap table-wrap-scroll">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {misAsistencias.map((a) => (
                <tr key={a.id}>
                  <td data-label="Fecha">{formatDate(a.fecha)}</td>
                  <td data-label="Hora">{a.horaIngreso}</td>
                  <td data-label="Estado">
                    <Badge color={a.estado === 'tarde' ? 'red' : 'green'}>
                      {a.estado === 'tarde' ? `Tarde (${a.minutosTarde} min)` : 'A tiempo'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {misAsistencias.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-secondary">
                    Todavía no marcaste ningún ingreso.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
