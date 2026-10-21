import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import MetricCard from '../components/MetricCard';
import Avatar from '../components/Avatar';
import PeriodSelector from '../components/PeriodSelector';
import LocalDrawer from '../components/LocalDrawer';
import { formatCurrency, formatDate, toDateKey } from '../utils/format';
import {
  filterByLocal,
  filterByRange,
  periodRange,
  computeMetrics,
  rankPeluqueros,
  comisionDeCortes,
  rankServicios,
  pctChange,
} from '../utils/stats';
import PagoBadge from '../components/PagoBadge';
import CobrarModal from '../components/CobrarModal';
import { estaPendiente } from '../utils/pagos';

export default function Dashboard() {
  const { data, activeLocal } = useApp();
  const { cortes, peluqueros, locales, servicios } = data;

  const hoy = toDateKey(new Date());
  const [periodo, setPeriodo] = useState({ period: 'mes', custom: { from: hoy, to: hoy } });
  const [drawer, setDrawer] = useState(null); // { localId } | { peluqueroId }
  const [cobrando, setCobrando] = useState(null); // { item, tipo, descripcion }

  // Cuentas "a cobrar" pendientes (cortes y ventas, de cualquier fecha) del local elegido.
  const pendientes = useMemo(() => {
    const servicioName = (id) => servicios.find((x) => x.id === id)?.nombre ?? 'Servicio';
    const productoName = (id) => data.productos.find((x) => x.id === id)?.nombre ?? 'Producto';
    const nombre = (id) => peluqueros.find((x) => x.id === id)?.nombre ?? '—';
    const deCortes = filterByLocal(cortes, activeLocal)
      .filter(estaPendiente)
      .map((c) => ({ item: c, tipo: 'corte', descripcion: servicioName(c.servicioId), peluquero: nombre(c.peluqueroId) }));
    const deVentas = filterByLocal(data.ventas, activeLocal)
      .filter(estaPendiente)
      .map((v) => ({
        item: v,
        tipo: 'venta',
        descripcion: `${productoName(v.productoId)}${v.cantidad > 1 ? ` ×${v.cantidad}` : ''}`,
        peluquero: nombre(v.peluqueroId),
      }));
    return [...deCortes, ...deVentas].sort((a, b) => (a.item.fecha + a.item.hora).localeCompare(b.item.fecha + b.item.hora));
  }, [cortes, data.ventas, data.productos, servicios, peluqueros, activeLocal]);
  const totalPendiente = pendientes.reduce((a, p) => a + (Number(p.item.monto) || 0), 0);

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

  const comisiones = useMemo(
    () => comisionDeCortes(cortesPeriodo, peluqueros, servicios).total,
    [cortesPeriodo, peluqueros, servicios]
  );

  const scopedPeluqueros = useMemo(
    () =>
      activeLocal === 'all'
        ? peluqueros
        : peluqueros.filter((p) => String(p.localId) === String(activeLocal)),
    [peluqueros, activeLocal]
  );

  const ranking = useMemo(
    () => rankPeluqueros(cortesPeriodo, scopedPeluqueros, servicios),
    [cortesPeriodo, scopedPeluqueros, servicios]
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
        <MetricCard
          label="A cobrar"
          value={formatCurrency(totalPendiente)}
          subtitle={pendientes.length ? `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}` : 'Nada pendiente'}
        />
      </div>

      {pendientes.length > 0 && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              Cuentas a cobrar
            </div>
            <span className="hint">Total {formatCurrency(totalPendiente)}</span>
          </div>
          <div className="stack-gap historial-scroll" style={{ gap: 8, maxHeight: 360 }}>
            {pendientes.map((p) => (
              <div className="list-item-card" key={`${p.tipo}-${p.item.id}`} style={{ padding: '12px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{p.item.clienteNombre || 'Sin nombre'}</div>
                  <div className="hint">
                    {formatDate(p.item.fecha)} · {p.descripcion} · {p.peluquero}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatCurrency(p.item.monto)}</div>
                <button className="btn btn-primary btn-sm" onClick={() => setCobrando(p)}>
                  Cobrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                      <PagoBadge item={c} conCliente />
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

      {cobrando && (
        <CobrarModal
          item={cobrando.item}
          tipo={cobrando.tipo}
          descripcion={cobrando.descripcion}
          onClose={() => setCobrando(null)}
        />
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
