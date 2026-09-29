import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Badge from '../components/Badge';
import { toDateKey, formatDate, nowTimeKey } from '../utils/format';
import { Clock, AlertTriangle } from 'lucide-react';
import { semanaDePeluquero, franjasDelDia, resumenSemana } from '../utils/horarios';
import { elegirFranja } from '../utils/asistencia';

export default function MiHorario() {
  const { data, marcarIngreso, marcarNotificacionLeida } = useApp();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [marcando, setMarcando] = useState(false);

  const miId = profile?.peluqueroId;
  const yo = data.peluqueros.find((p) => p.id === miId);
  const hoy = toDateKey(new Date());
  const semana = semanaDePeluquero(yo, data.locales);
  const franjasHoy = franjasDelDia(semana);
  const fichajesHoy = data.asistencias.filter((a) => a.peluqueroId === miId && a.fecha === hoy);
  const fichajeDe = (numero) => fichajesHoy.find((a) => a.franja === numero);
  const proxima = elegirFranja(
    franjasHoy,
    fichajesHoy.map((a) => a.franja),
    nowTimeKey()
  );
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
        showToast(`✓ Ingreso registrado a las ${r.horaIngreso}${r.horaEsperada ? ` (turno ${r.horaEsperada})` : ''}`);
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
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} /> {n.mensaje}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => marcarNotificacionLeida(n.id)}>
            Entendido
          </button>
        </div>
      ))}

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="card-title">Marcar ingreso</div>

        {franjasHoy.length === 0 ? (
          <p className="hint" style={{ marginBottom: 16 }}>Hoy no tenés turno asignado (franco).</p>
        ) : (
          <div className="stack-gap" style={{ gap: 8, marginBottom: 16, textAlign: 'left' }}>
            {franjasHoy.map((f, i) => {
              const fichaje = fichajeDe(i + 1);
              return (
                <div className="flex-between list-item-card" key={i} style={{ padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {franjasHoy.length > 1 ? `Turno ${i + 1}` : 'Hoy'}: {f.desde} a {f.hasta}
                    </div>
                    {fichaje && <div className="hint">Ingresaste a las {fichaje.horaIngreso}</div>}
                  </div>
                  {fichaje ? (
                    <Badge color={fichaje.estado === 'tarde' ? 'red' : 'green'}>
                      {fichaje.estado === 'tarde' ? `Tarde (${fichaje.minutosTarde} min)` : 'A tiempo'}
                    </Badge>
                  ) : (
                    <Badge color="gray">Pendiente</Badge>
                  )}
                </div>
              );
            })}
            <p className="hint">Tolerancia de 5 minutos sobre el inicio de cada turno.</p>
          </div>
        )}

        {proxima ? (
          <button
            className="btn btn-primary"
            style={{ fontSize: 17, padding: '14px 28px', display: 'inline-flex', gap: 8, alignItems: 'center' }}
            onClick={handleMarcar}
            disabled={marcando}
          >
            <Clock size={20} />
            {marcando
              ? 'Registrando…'
              : proxima.franja
                ? `Marcar ingreso · turno ${proxima.franja.desde}`
                : 'Marcar ingreso (fuera de horario)'}
          </button>
        ) : (
          <div style={{ fontWeight: 700, fontSize: 18 }}>Ya marcaste todos tus ingresos de hoy</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Mi horario semanal</div>
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>{resumenSemana(semana)}</p>
      </div>

      <div className="card">
        <div className="card-title">Mis últimos ingresos</div>
        <div className="table-wrap table-wrap-scroll">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Ingreso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {misAsistencias.map((a) => (
                <tr key={a.id}>
                  <td data-label="Fecha">{formatDate(a.fecha)}</td>
                  <td data-label="Turno">{a.horaEsperada || '—'}</td>
                  <td data-label="Ingreso">{a.horaIngreso}</td>
                  <td data-label="Estado">
                    <Badge color={a.estado === 'tarde' ? 'red' : 'green'}>
                      {a.estado === 'tarde' ? `Tarde (${a.minutosTarde} min)` : 'A tiempo'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {misAsistencias.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-secondary">
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
