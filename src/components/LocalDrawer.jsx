import { useState } from 'react';
import Avatar from './Avatar';
import PeluqueroResumen from './PeluqueroResumen';
import { formatCurrency } from '../utils/format';
import { computeMetrics, rankPeluqueros, rankServicios } from '../utils/stats';

// periodCortes: cortes ya filtrados por el período (todos los locales).
// initial: { localId } o { peluqueroId } según desde dónde se abrió.
export default function LocalDrawer({ periodCortes, peluqueros, servicios, locales, period, initial, onClose }) {
  const [localId] = useState(initial.localId ?? null);
  const [peluqueroId, setPeluqueroId] = useState(initial.peluqueroId ?? null);

  const peluquero = peluqueroId ? peluqueros.find((p) => p.id === peluqueroId) : null;
  const local = localId ? locales.find((l) => l.id === localId) : null;

  function handleBack() {
    // Si estamos viendo un peluquero al que llegamos desde un local, volvemos al local.
    if (peluquero && local) {
      setPeluqueroId(null);
    } else {
      onClose();
    }
  }

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-box">
        <div className="flex-between" style={{ marginBottom: 20 }}>
          {peluquero && local ? (
            <button className="btn btn-secondary btn-sm" onClick={handleBack}>
              ← Volver a {local.nombre}
            </button>
          ) : (
            <div />
          )}
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {peluquero ? (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <Avatar name={peluquero.nombre} size={48} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{peluquero.nombre}</div>
                <div className="hint">{locales.find((l) => l.id === peluquero.localId)?.nombre ?? '—'}</div>
              </div>
            </div>
            <PeluqueroResumen
              peluquero={peluquero}
              cortes={periodCortes.filter((c) => c.peluqueroId === peluquero.id)}
              servicios={servicios}
            />
          </>
        ) : (
          local && (
            <LocalDetalle
              local={local}
              periodCortes={periodCortes}
              peluqueros={peluqueros}
              servicios={servicios}
              period={period}
              onSelectPeluquero={setPeluqueroId}
            />
          )
        )}
      </div>
    </div>
  );
}

function LocalDetalle({ local, periodCortes, peluqueros, servicios, period, onSelectPeluquero }) {
  const cortes = periodCortes.filter((c) => String(c.localId) === String(local.id));
  const m = computeMetrics(cortes);
  const delPelu = peluqueros.filter((p) => String(p.localId) === String(local.id));
  const ranking = rankPeluqueros(cortes, delPelu, servicios);
  const servicioRank = rankServicios(cortes, servicios);
  const metaPct = local.metaMensual ? Math.min(100, (m.ingresos / local.metaMensual) * 100) : null;

  return (
    <div className="stack-gap">
      <div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{local.nombre}</div>
        {local.direccion && <div className="hint">{local.direccion}</div>}
      </div>

      <div className="grid grid-2">
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Ingresos</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{formatCurrency(m.ingresos)}</div>
        </div>
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Cortes</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{m.cantidad}</div>
        </div>
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Efectivo ({m.efectivoPct.toFixed(0)}%)</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(m.efectivo)}</div>
        </div>
        <div className="card" style={{ background: 'var(--surface-elevated)' }}>
          <div className="hint">Transferencia ({m.transferenciaPct.toFixed(0)}%)</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(m.transferencia)}</div>
        </div>
      </div>

      {period === 'mes' && metaPct !== null && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <span className="card-title" style={{ marginBottom: 0 }}>
              Meta mensual
            </span>
            <span className="hint">
              {metaPct.toFixed(0)}% de {formatCurrency(local.metaMensual)}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${metaPct}%` }} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Peluqueros del local</div>
        <div className="stack-gap" style={{ gap: 6 }}>
          {ranking.map((r, idx) => (
            <div
              className="flex-between clickable-row"
              key={r.peluquero.id}
              onClick={() => onSelectPeluquero(r.peluquero.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="text-secondary" style={{ width: 16 }}>
                  {idx + 1}
                </span>
                <Avatar name={r.peluquero.nombre} size={32} />
                <div>
                  <div style={{ fontWeight: 600 }}>{r.peluquero.nombre}</div>
                  <div className="hint">
                    {r.cantidad} cortes · ticket {formatCurrency(r.ticket)}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(r.monto)}</div>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-secondary">Sin cortes en el período.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Servicios más vendidos</div>
        <div className="stack-gap" style={{ gap: 8 }}>
          {servicioRank.map((s) => (
            <div className="flex-between" key={s.servicio.id}>
              <span>{s.servicio.nombre}</span>
              <span className="hint">
                {s.cantidad} × · {formatCurrency(s.monto)}
              </span>
            </div>
          ))}
          {servicioRank.length === 0 && <p className="text-secondary">Sin registros en el período.</p>}
        </div>
      </div>
    </div>
  );
}
