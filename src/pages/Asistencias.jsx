import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import PeriodSelector from '../components/PeriodSelector';
import { formatDate, toDateKey } from '../utils/format';
import { filterByLocal, filterByRange, periodRange, currentMonthKey, monthKeyOf } from '../utils/stats';

export default function Asistencias() {
  const { data, activeLocal } = useApp();
  const { asistencias, peluqueros } = data;

  const hoy = toDateKey(new Date());
  const [periodo, setPeriodo] = useState({ period: 'mes', custom: { from: hoy, to: hoy } });
  const { period, custom } = periodo;

  const rango = useMemo(() => periodRange(period, 0, custom), [period, custom]);

  const registros = useMemo(() => {
    const scoped = filterByLocal(asistencias, activeLocal);
    return filterByRange(scoped, rango.from, rango.to).sort((a, b) =>
      (b.fecha + b.horaIngreso).localeCompare(a.fecha + a.horaIngreso)
    );
  }, [asistencias, activeLocal, rango]);

  // Tardanzas del mes en curso por peluquero (independiente del filtro de período).
  const tardanzasMes = useMemo(() => {
    const mes = currentMonthKey(0);
    const scoped = filterByLocal(asistencias, activeLocal).filter((a) => monthKeyOf(a.fecha) === mes);
    const porPelu = {};
    for (const a of scoped) {
      if (a.estado === 'tarde') porPelu[a.peluqueroId] = (porPelu[a.peluqueroId] || 0) + 1;
    }
    return Object.entries(porPelu)
      .map(([id, cant]) => ({ peluquero: peluqueros.find((p) => p.id === id), cantidad: cant }))
      .filter((r) => r.peluquero)
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [asistencias, activeLocal, peluqueros]);

  const peluqueroName = (id) => peluqueros.find((p) => p.id === id)?.nombre ?? '—';

  return (
    <div className="stack-gap">
      <PeriodSelector period={period} custom={custom} onChange={setPeriodo} />

      {tardanzasMes.length > 0 && (
        <div className="card">
          <div className="card-title">Tardanzas del mes</div>
          <div className="stack-gap" style={{ gap: 8 }}>
            {tardanzasMes.map((r) => (
              <div className="flex-between" key={r.peluquero.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.peluquero.nombre} size={32} />
                  <span style={{ fontWeight: 600 }}>{r.peluquero.nombre}</span>
                </div>
                <Badge color="red">{r.cantidad} {r.cantidad === 1 ? 'tardanza' : 'tardanzas'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Registro de ingresos</div>
        <div className="table-wrap table-wrap-scroll">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peluquero</th>
                <th>Turno</th>
                <th>Ingreso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((a) => (
                <tr key={a.id}>
                  <td data-label="Fecha">{formatDate(a.fecha)}</td>
                  <td data-label="Peluquero">{peluqueroName(a.peluqueroId)}</td>
                  <td data-label="Turno">{a.horaEsperada || '—'}</td>
                  <td data-label="Ingreso">{a.horaIngreso}</td>
                  <td data-label="Estado">
                    <Badge color={a.estado === 'tarde' ? 'red' : 'green'}>
                      {a.estado === 'tarde' ? `Tarde (${a.minutosTarde} min)` : 'A tiempo'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-secondary">
                    Sin ingresos registrados en el período.
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
