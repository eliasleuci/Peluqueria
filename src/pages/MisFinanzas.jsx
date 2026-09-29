import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import PeriodSelector from '../components/PeriodSelector';
import PeluqueroResumen from '../components/PeluqueroResumen';
import { toDateKey, formatCurrency } from '../utils/format';
import { filterByRange, periodRange } from '../utils/stats';

export default function MisFinanzas() {
  const { data } = useApp();
  const { profile } = useAuth();

  const hoy = toDateKey(new Date());
  const [periodo, setPeriodo] = useState({ period: 'mes', custom: { from: hoy, to: hoy } });
  const { period, custom } = periodo;

  const miId = profile?.peluqueroId;
  const yo =
    data.peluqueros.find((p) => p.id === miId) ?? { id: miId, nombre: profile?.nombre ?? 'Yo', comision: 0 };

  const rango = useMemo(() => periodRange(period, 0, custom), [period, custom]);
  const misCortes = useMemo(
    () => filterByRange(data.cortes.filter((c) => c.peluqueroId === miId), rango.from, rango.to),
    [data.cortes, miId, rango]
  );

  const misVentas = useMemo(
    () => filterByRange(data.ventas.filter((v) => v.peluqueroId === miId), rango.from, rango.to),
    [data.ventas, miId, rango]
  );
  const ventasResumen = useMemo(() => {
    const unidades = misVentas.reduce((a, v) => a + (Number(v.cantidad) || 0), 0);
    const total = misVentas.reduce((a, v) => a + (Number(v.monto) || 0), 0);
    const comision = misVentas.reduce((a, v) => a + (Number(v.comisionMonto) || 0), 0);
    return { unidades, total, comision };
  }, [misVentas]);

  return (
    <div className="stack-gap" style={{ maxWidth: 720, margin: '0 auto' }}>
      <PeriodSelector period={period} custom={custom} onChange={setPeriodo} />

      <div className="card">
        <div className="card-title">Ventas de producto</div>
        <div className="grid grid-3">
          <div className="card" style={{ background: 'var(--surface-elevated)' }}>
            <div className="hint">Unidades vendidas</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{ventasResumen.unidades}</div>
          </div>
          <div className="card" style={{ background: 'var(--surface-elevated)' }}>
            <div className="hint">Total vendido</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{formatCurrency(ventasResumen.total)}</div>
          </div>
          <div className="card" style={{ background: 'var(--surface-elevated)' }}>
            <div className="hint">Comisión por productos</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>
              {formatCurrency(ventasResumen.comision)}
            </div>
          </div>
        </div>
      </div>

      <PeluqueroResumen peluquero={yo} cortes={misCortes} servicios={data.servicios} />
    </div>
  );
}
