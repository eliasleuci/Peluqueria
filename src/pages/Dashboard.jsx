import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import MetricCard from '../components/MetricCard';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import { formatCurrency, formatDate } from '../utils/format';
import { filterByLocal, cortesOfMonth, currentMonthKey, sumMonto, pctChange } from '../utils/stats';

function computeLocalMetrics(cortes, localId) {
  const scoped = filterByLocal(cortes, localId);
  const thisMonth = cortesOfMonth(scoped, currentMonthKey(0));
  const prevMonth = cortesOfMonth(scoped, currentMonthKey(-1));
  const ingresos = sumMonto(thisMonth);
  const ingresosPrev = sumMonto(prevMonth);
  const efectivo = sumMonto(thisMonth.filter((c) => c.pago === 'efectivo'));
  const transferencia = sumMonto(thisMonth.filter((c) => c.pago === 'transferencia'));
  return {
    ingresos,
    ingresosDelta: pctChange(ingresos, ingresosPrev),
    cantidadCortes: thisMonth.length,
    efectivo,
    efectivoPct: ingresos ? (efectivo / ingresos) * 100 : 0,
    transferencia,
    transferenciaPct: ingresos ? (transferencia / ingresos) * 100 : 0,
    thisMonth,
  };
}

export default function Dashboard() {
  const { data, activeLocal } = useApp();
  const { cortes, peluqueros, locales } = data;

  const metrics = useMemo(() => computeLocalMetrics(cortes, activeLocal), [cortes, activeLocal]);

  const ranking = useMemo(() => {
    const scopedPeluqueros =
      activeLocal === 'all' ? peluqueros : peluqueros.filter((p) => String(p.localId) === String(activeLocal));
    return scopedPeluqueros
      .map((p) => {
        const suyos = metrics.thisMonth.filter((c) => c.peluqueroId === p.id);
        return {
          peluquero: p,
          cantidad: suyos.length,
          monto: sumMonto(suyos),
        };
      })
      .filter((r) => r.cantidad > 0)
      .sort((a, b) => b.monto - a.monto);
  }, [peluqueros, activeLocal, metrics.thisMonth]);

  const ultimos5 = useMemo(() => {
    const scoped = filterByLocal(cortes, activeLocal);
    return [...scoped].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).slice(0, 5);
  }, [cortes, activeLocal]);

  const peluqueroName = (id) => peluqueros.find((p) => p.id === id)?.nombre ?? '—';

  return (
    <div className="stack-gap">
      <div className="grid grid-4">
        <MetricCard label="Ingresos del mes" value={formatCurrency(metrics.ingresos)} delta={metrics.ingresosDelta} />
        <MetricCard label="Cortes realizados" value={metrics.cantidadCortes} />
        <MetricCard
          label="Efectivo"
          value={formatCurrency(metrics.efectivo)}
          subtitle={`${metrics.efectivoPct.toFixed(0)}% del total`}
        />
        <MetricCard
          label="Transferencia"
          value={formatCurrency(metrics.transferencia)}
          subtitle={`${metrics.transferenciaPct.toFixed(0)}% del total`}
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Ranking de peluqueros</div>
          <div className="stack-gap">
            {ranking.length === 0 && <p className="text-secondary">Sin datos este mes.</p>}
            {ranking.map((r, idx) => (
              <div className="flex-between" key={r.peluquero.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="text-secondary" style={{ width: 18 }}>
                    {idx + 1}
                  </span>
                  <Avatar name={r.peluquero.nombre} size={36} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.peluquero.nombre}</div>
                    <div className="hint">{r.cantidad} cortes</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--gold)' }}>{formatCurrency(r.monto)}</div>
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
                    <td data-label="Servicio">{data.servicios.find((s) => s.id === c.servicioId)?.nombre ?? '—'}</td>
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
                      Sin registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeLocal === 'all' && (
        <div className="card">
          <div className="card-title">Comparativa de locales</div>
          <div className="grid grid-3">
            {locales.map((l) => {
              const m = computeLocalMetrics(cortes, l.id);
              return (
                <div key={l.id} className="card" style={{ background: 'var(--surface-elevated)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>{l.nombre}</div>
                  <div className="stack-gap" style={{ gap: 6 }}>
                    <div className="flex-between">
                      <span className="hint">Ingresos</span>
                      <strong>{formatCurrency(m.ingresos)}</strong>
                    </div>
                    <div className="flex-between">
                      <span className="hint">Cortes</span>
                      <strong>{m.cantidadCortes}</strong>
                    </div>
                    <div className="flex-between">
                      <span className="hint">Efectivo</span>
                      <span>{formatCurrency(m.efectivo)}</span>
                    </div>
                    <div className="flex-between">
                      <span className="hint">Transferencia</span>
                      <span>{formatCurrency(m.transferencia)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
