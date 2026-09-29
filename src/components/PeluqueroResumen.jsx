import { formatCurrency, formatDate } from '../utils/format';
import { computeMetrics, rankServicios } from '../utils/stats';

// cortes: los cortes del peluquero ya filtrados por el período elegido.
export default function PeluqueroResumen({ peluquero, cortes, servicios }) {
  const m = computeMetrics(cortes);
  const comisionMonto = m.ingresos * ((Number(peluquero.comision) || 0) / 100);
  const porServicio = rankServicios(cortes, servicios);
  const historial = [...cortes].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));

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
        <div className="table-wrap table-wrap-scroll">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Pago</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((c) => (
                <tr key={c.id}>
                  <td data-label="Fecha">{formatDate(c.fecha)}</td>
                  <td data-label="Servicio">{servicios.find((s) => s.id === c.servicioId)?.nombre ?? '—'}</td>
                  <td data-label="Pago">{c.pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}</td>
                  <td data-label="Monto">{formatCurrency(c.monto)}</td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-secondary">
                    Sin registros en el período.
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
