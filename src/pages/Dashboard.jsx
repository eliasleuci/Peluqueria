import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import MetricCard from '../components/MetricCard';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PeriodSelector from '../components/PeriodSelector';
import LocalDrawer from '../components/LocalDrawer';
import { formatCurrency, formatDate, toDateKey } from '../utils/format';
import {
  filterByLocal,
  filterByRange,
  periodRange,
  computeMetrics,
  rankPeluqueros,
  rankServicios,
  pctChange,
} from '../utils/stats';

export default function Dashboard() {
  const { data, activeLocal } = useApp();
  const { cortes, peluqueros, locales, servicios } = data;

  const hoy = toDateKey(new Date());
  const [periodo, setPeriodo] = useState({ period: 'mes', custom: { from: hoy, to: hoy } });
  const [drawer, setDrawer] = useState(null); // { localId } | { peluqueroId }

  const { period, custom } = periodo;

  // Cortes del período actual, filtrados por el local activo del topbar.
  const scoped = useMemo(() => filterByLocal(cortes, activeLocal), [cortes, activeLocal]);

  const rango = useMemo(() => periodRange(period, 0, custom), [period, custom]);
  const rangoPrev = useMemo(() => periodRange(period, -1, custom), [period, custom]);

  const cortesPeriodo = useMemo(() => filterByRange(scoped, rango.from, rango.to), [scoped, rango]);
  const cortesPeriodoPrev = useMemo(
    () => filterByRange(scoped, rangoPrev.from, rangoPrev.to),
    [scoped, rangoPrev]
  );

  // Cortes del período sin filtrar por local (para el drawer de detalle por local).
  const cortesPeriodoTodos = useMemo(
    () => filterByRange(cortes, rango.from, rango.to),
    [cortes, rango]
  );

  const m = useMemo(() => computeMetrics(cortesPeriodo), [cortesPeriodo]);
  const mPrev = useMemo(() => computeMetrics(cortesPeriodoPrev), [cortesPeriodoPrev]);

  const comisiones = useMemo(() => {
    const byId = Object.fromEntries(peluqueros.map((p) => [p.id, Number(p.comision) || 0]));
    return cortesPeriodo.reduce((acc, c) => acc + (Number(c.monto) || 0) * ((byId[c.peluqueroId] || 0) / 100), 0);
  }, [cortesPeriodo, peluqueros]);

  const scopedPeluqueros = useMemo(
    () =>
      activeLocal === 'all'
        ? peluqueros
        : peluqueros.filter((p) => String(p.localId) === String(activeLocal)),
    [peluqueros, activeLocal]
  );

  const ranking = useMemo(
    () => rankPeluqueros(cortesPeriodo, scopedPeluqueros),
    [cortesPeriodo, scopedPeluqueros]
  );

  const servicioRank = useMemo(() => rankServicios(cortesPeriodo, servicios), [cortesPeriodo, servicios]);

  const ultimos5 = useMemo(
    () => [...cortesPeriodo].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).slice(0, 5),
    [cortesPeriodo]
  );

  const peluqueroName = (id) => peluqueros.find((p) => p.id === id)?.nombre ?? '—';
  const localActivo = activeLocal !== 'all' ? locales.find((l) => l.id === activeLocal) : null;

  return (
    <div className="stack-gap">
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <PeriodSelector period={period} custom={custom} onChange={setPeriodo} />
        {localActivo && (
          <button className="btn btn-secondary btn-sm" onClick={() => setDrawer({ localId: localActivo.id })}>
            Ver detalle del local
          </button>
        )}
      </div>

      <div className="grid grid-3">
        <MetricCard
          label="Ingresos"
          value={formatCurrency(m.ingresos)}
          delta={pctChange(m.ingresos, mPrev.ingresos)}
        />
        <MetricCard label="Cortes" value={m.cantidad} delta={pctChange(m.cantidad, mPrev.cantidad)} />
        <MetricCard label="Comisiones estimadas" value={formatCurrency(comisiones)} />
        <MetricCard
          label="Efectivo"
          value={formatCurrency(m.efectivo)}
          subtitle={`${m.efectivoPct.toFixed(0)}% del total`}
        />
        <MetricCard
          label="Transferencia"
          value={formatCurrency(m.transferencia)}
          subtitle={`${m.transferenciaPct.toFixed(0)}% del total`}
        />
        <MetricCard label="Descuentos" value={formatCurrency(m.descuentos)} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Ranking de peluqueros</div>
          <div className="stack-gap">
            {ranking.length === 0 && <p className="text-secondary">Sin datos en el período.</p>}
            {ranking.map((r, idx) => (
              <div
                className="flex-between clickable-row"
                key={r.peluquero.id}
                onClick={() => setDrawer({ peluqueroId: r.peluquero.id })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="text-secondary" style={{ width: 18 }}>
                    {idx + 1}
                  </span>
                  <Avatar name={r.peluquero.nombre} size={36} />
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
          </div>
        </div>

        <div className="card">
          <div className="card-title">Últimos registros</div>
          <div className="table-wrap table-wrap-scroll">
            <table className="table-responsive">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peluquero</th>
                  <th>Servicio</th>
                  <th>Pago</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {ultimos5.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Fecha">{formatDate(c.fecha)}</td>
                    <td data-label="Peluquero">{peluqueroName(c.peluqueroId)}</td>
                    <td data-label="Servicio">{servicios.find((s) => s.id === c.servicioId)?.nombre ?? '—'}</td>
                    <td data-label="Pago">
                      <Badge color={c.pago === 'efectivo' ? 'green' : 'blue'}>
                        {c.pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                      </Badge>
                    </td>
                    <td data-label="Monto">{formatCurrency(c.monto)}</td>
                  </tr>
                ))}
                {ultimos5.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-secondary">
                      Sin registros en el período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Servicios más vendidos</div>
        <div className="table-wrap">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Cantidad</th>
                <th>Facturado</th>
              </tr>
            </thead>
            <tbody>
              {servicioRank.map((s) => (
                <tr key={s.servicio.id}>
                  <td data-label="Servicio">{s.servicio.nombre}</td>
                  <td data-label="Cantidad">{s.cantidad}</td>
                  <td data-label="Facturado">{formatCurrency(s.monto)}</td>
                </tr>
              ))}
              {servicioRank.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-secondary">
                    Sin registros en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeLocal === 'all' && (
        <div className="card">
          <div className="card-title">Comparativa de locales</div>
          <div className="grid grid-3">
            {locales.map((l) => {
              const lc = computeMetrics(cortesPeriodoTodos.filter((c) => String(c.localId) === String(l.id)));
              const metaPct =
                period === 'mes' && l.metaMensual ? Math.min(100, (lc.ingresos / l.metaMensual) * 100) : null;
              return (
                <div
                  key={l.id}
                  className="card clickable-row"
                  style={{ background: 'var(--surface-elevated)', margin: 0 }}
                  onClick={() => setDrawer({ localId: l.id })}
                >
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>{l.nombre}</div>
                  <div className="stack-gap" style={{ gap: 6 }}>
                    <div className="flex-between">
                      <span className="hint">Ingresos</span>
                      <strong>{formatCurrency(lc.ingresos)}</strong>
                    </div>
                    <div className="flex-between">
                      <span className="hint">Cortes</span>
                      <strong>{lc.cantidad}</strong>
                    </div>
                    <div className="flex-between">
                      <span className="hint">Efectivo</span>
                      <span>{formatCurrency(lc.efectivo)}</span>
                    </div>
                    <div className="flex-between">
                      <span className="hint">Transferencia</span>
                      <span>{formatCurrency(lc.transferencia)}</span>
                    </div>
                    {metaPct !== null && (
                      <div style={{ marginTop: 4 }}>
                        <div className="flex-between" style={{ marginBottom: 4 }}>
                          <span className="hint">Meta</span>
                          <span className="hint">{metaPct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${metaPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {drawer && (
        <LocalDrawer
          periodCortes={cortesPeriodoTodos}
          peluqueros={peluqueros}
          servicios={servicios}
          locales={locales}
          period={period}
          initial={drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
