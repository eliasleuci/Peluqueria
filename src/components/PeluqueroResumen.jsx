import { useState } from 'react';
import { Pencil } from 'lucide-react';
import Badge from './Badge';
import EditarCorteModal from './EditarCorteModal';
import Avatar from './Avatar';
import { formatCurrency, formatDate, toDateKey } from '../utils/format';
import { computeMetrics, rankServicios, comisionDeCortes } from '../utils/stats';

// cortes: los cortes del peluquero ya filtrados por el período elegido.
export default function PeluqueroResumen({ peluquero, cortes, servicios }) {
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState({ servicio: '', pago: '', dia: '' });
  const m = computeMetrics(cortes);
  const { total: comisionMonto, especial: comisionEspecial } = comisionDeCortes(cortes, [peluquero], servicios);
  const porServicio = rankServicios(cortes, servicios);
  const filtrados = cortes.filter(
    (c) =>
      (!filtro.servicio || c.servicioId === filtro.servicio) &&
      (!filtro.pago || c.pago === filtro.pago) &&
      (!filtro.dia || c.fecha === filtro.dia)
  );
  const hayFiltro = filtro.servicio || filtro.pago || filtro.dia;
  const totalFiltrado = filtrados.reduce((a, c) => a + (Number(c.monto) || 0), 0);
  const fechasDisponibles = [...new Set(cortes.map((c) => c.fecha))].sort().reverse();
  const serviciosUsados = servicios.filter((sv) => cortes.some((c) => c.servicioId === sv.id));
  const historial = [...filtrados].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const servicioName = (id) => servicios.find((s) => s.id === id)?.nombre ?? '—';

  // Agrupado por día (más reciente primero), con el mismo diseño de la Agenda del día.
  const dias = [];
  for (const c of historial) {
    let dia = dias[dias.length - 1];
    if (!dia || dia.fecha !== c.fecha) {
      dia = { fecha: c.fecha, cortes: [], total: 0 };
      dias.push(dia);
    }
    dia.cortes.push(c);
    dia.total += Number(c.monto) || 0;
  }
  for (const d of dias) d.cortes.reverse(); // dentro del día, en orden de hora como la agenda
  const ahora = new Date();
  const hoy = toDateKey(ahora);
  const ayer = toDateKey(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1));
  const tituloDia = (f) => (f === hoy ? 'Hoy' : f === ayer ? 'Ayer' : formatDate(f));

  return (
    <div className="stack-gap">
      <div className="grid grid-2 kpi-grid">
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Facturado</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{formatCurrency(m.ingresos)}</div>
        </div>
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Cortes</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{m.cantidad}</div>
        </div>
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Ticket promedio</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{formatCurrency(m.ticketPromedio)}</div>
        </div>
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Comisión</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{formatCurrency(comisionMonto)}</div>
          <div className="hint">
            {peluquero.comision || 0}% en cortes
            {comisionEspecial > 0 ? ` · incluye ${formatCurrency(comisionEspecial)} de servicios especiales` : ''}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Resumen por servicio</div>
        <div className="stack-gap" style={{ gap: 8 }}>
          {porServicio.map((s) => (
            <div className="flex-between" key={s.servicio.id}>
              <span>{s.servicio.nombre}</span>
              <span className="hint">
                {s.cantidad} × · {formatCurrency(s.monto)}
              </span>
            </div>
          ))}
          {porServicio.length === 0 && <p className="text-secondary">Sin registros en el período.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Historial</div>
        {cortes.length > 0 && (
          <div className="historial-filtros">
            <select value={filtro.dia} onChange={(e) => setFiltro({ ...filtro, dia: e.target.value })} aria-label="Día">
              <option value="">Todos los días</option>
              {fechasDisponibles.map((f) => (
                <option key={f} value={f}>
                  {tituloDia(f)}
                </option>
              ))}
            </select>
            <select
              value={filtro.servicio}
              onChange={(e) => setFiltro({ ...filtro, servicio: e.target.value })}
              aria-label="Servicio"
            >
              <option value="">Todos los servicios</option>
              {serviciosUsados.map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.nombre}
                </option>
              ))}
            </select>
            <select value={filtro.pago} onChange={(e) => setFiltro({ ...filtro, pago: e.target.value })} aria-label="Pago">
              <option value="">Todo pago</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
        )}
        {cortes.length > 0 && (
          <div className="flex-between hint" style={{ margin: '10px 0', gap: 8, flexWrap: 'wrap' }}>
            <span>
              {filtrados.length} {filtrados.length === 1 ? 'corte' : 'cortes'} · {formatCurrency(totalFiltrado)}
              {hayFiltro ? ' (filtrado)' : ''} · tocá uno para editarlo
            </span>
            {hayFiltro && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFiltro({ servicio: '', pago: '', dia: '' })}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}
        {dias.length === 0 ? (
          <p className="text-secondary">{cortes.length ? 'Ningún corte coincide con el filtro.' : 'Sin registros en el período.'}</p>
        ) : (
          <div className="stack-gap historial-scroll" style={{ gap: 18 }}>
            {dias.map((d) => (
              <div key={d.fecha} className="stack-gap" style={{ gap: 8 }}>
                <div className="flex-between">
                  <span style={{ fontWeight: 600 }}>{tituloDia(d.fecha)}</span>
                  <span className="hint">
                    {d.cortes.length} {d.cortes.length === 1 ? 'corte' : 'cortes'} · {formatCurrency(d.total)}
                  </span>
                </div>
                {d.cortes.map((c) => (
                  <div
                    className="list-item-card corte-editable"
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditando(c)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditando(c)}
                  >
                    <div style={{ fontWeight: 700, width: 48, flexShrink: 0 }}>{c.hora}</div>
                    <Avatar name={peluquero.nombre} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{peluquero.nombre}</div>
                      <div className="hint">{servicioName(c.servicioId)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{formatCurrency(c.monto)}</div>
                      <Badge color={c.pago === 'efectivo' ? 'green' : 'blue'}>
                        {c.pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                      </Badge>
                    </div>
                    <Pencil size={16} className="corte-editable-icon" aria-hidden="true" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {editando && <EditarCorteModal corte={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
