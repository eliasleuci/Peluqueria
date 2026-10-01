import { useState } from 'react';
import { Pencil } from 'lucide-react';
import Badge from './Badge';
import EditarCorteModal from './EditarCorteModal';
import Avatar from './Avatar';
import { formatCurrency, formatDate, toDateKey } from '../utils/format';
import { computeMetrics, rankServicios } from '../utils/stats';

// cortes: los cortes del peluquero ya filtrados por el período elegido.
export default function PeluqueroResumen({ peluquero, cortes, servicios }) {
  const [editando, setEditando] = useState(null);
  const m = computeMetrics(cortes);
  const comisionMonto = m.ingresos * ((Number(peluquero.comision) || 0) / 100);
  const porServicio = rankServicios(cortes, servicios);
  const historial = [...cortes].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
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
      <div className="grid grid-2">
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
          <div className="hint">Comisión ({peluquero.comision || 0}%)</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{formatCurrency(comisionMonto)}</div>
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
        {dias.length > 0 && (
          <p className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
            Tocá un corte para editarlo o eliminarlo.
          </p>
        )}
        {dias.length === 0 ? (
          <p className="text-secondary">Sin registros en el período.</p>
        ) : (
          <div className="stack-gap" style={{ gap: 18 }}>
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
