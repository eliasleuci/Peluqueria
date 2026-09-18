import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import { formatCurrency, formatDate, toDateKey } from '../utils/format';
import { filterByLocal, sumMonto } from '../utils/stats';

export default function Agenda() {
  const navigate = useNavigate();
  const { data, activeLocal } = useApp();
  const hoy = toDateKey(new Date());

  const cortesHoy = useMemo(() => {
    const scoped = filterByLocal(data.cortes, activeLocal);
    return scoped.filter((c) => c.fecha === hoy).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [data.cortes, activeLocal, hoy]);

  const total = sumMonto(cortesHoy);
  const peluqueroName = (id) => data.peluqueros.find((p) => p.id === id)?.nombre ?? '—';
  const servicioName = (id) => data.servicios.find((s) => s.id === id)?.nombre ?? '—';

  return (
    <div className="stack-gap">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: 16 }}>{formatDate(hoy)}</h2>
          <p className="hint">
            {cortesHoy.length} cortes · {formatCurrency(total)} en total
          </p>
        </div>
      </div>

      {cortesHoy.length === 0 ? (
        <div className="empty-state">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#8888a8" strokeWidth="1.4">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
          <p>Sin cortes registrados hoy</p>
        </div>
      ) : (
        <div className="stack-gap">
          {cortesHoy.map((c) => (
            <div className="list-item-card" key={c.id}>
              <div style={{ fontWeight: 700, width: 48 }}>{c.hora}</div>
              <Avatar name={peluqueroName(c.peluqueroId)} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{peluqueroName(c.peluqueroId)}</div>
                <div className="hint">{servicioName(c.servicioId)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{formatCurrency(c.monto)}</div>
                <Badge color={c.pago === 'efectivo' ? 'green' : 'blue'}>
                  {c.pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => navigate('/registrar')} aria-label="Registrar corte">
        +
      </button>
    </div>
  );
}
