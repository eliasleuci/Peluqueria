import { Banknote, Smartphone, Shuffle, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/format';

const OPCIONES = [
  { key: 'efectivo', label: 'Efectivo', icon: Banknote },
  { key: 'transferencia', label: 'Transferencia', icon: Smartphone },
  { key: 'mixto', label: 'Mixto', icon: Shuffle },
  { key: 'a_cobrar', label: 'A cobrar', icon: Clock },
];

// value: { pago, efectivo, transferencia, cliente } (ver utils/pagos.js). monto: total a cobrar.
export default function PagoSelector({ value, onChange, monto, permitirACobrar = true, label = 'Forma de pago' }) {
  const total = Number(monto) || 0;
  const opciones = permitirACobrar ? OPCIONES : OPCIONES.filter((o) => o.key !== 'a_cobrar');
  const set = (patch) => onChange({ ...value, ...patch });

  // En mixto, al cargar un monto se completa el otro con lo que falta.
  function setParte(campo, texto) {
    const otro = campo === 'efectivo' ? 'transferencia' : 'efectivo';
    const n = Number(texto);
    const resto = texto !== '' && !Number.isNaN(n) && n <= total ? String(total - n) : value[otro];
    set({ [campo]: texto, [otro]: resto });
  }

  const sumaMixto = (Number(value.efectivo) || 0) + (Number(value.transferencia) || 0);

  return (
    <div className="field">
      <label>{label}</label>
      <div className="pago-grid">
        {opciones.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`toggle-btn ${value.pago === o.key ? 'active' : ''}`}
            onClick={() => set({ pago: o.key })}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <o.icon size={16} strokeWidth={1.8} />
            {o.label}
          </button>
        ))}
      </div>

      {value.pago === 'mixto' && (
        <div className="stack-gap" style={{ gap: 8, marginTop: 10 }}>
          <div className="grid grid-2" style={{ gap: 8 }}>
            <div className="field">
              <label>En efectivo</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={value.efectivo}
                onChange={(e) => setParte('efectivo', e.target.value)}
              />
            </div>
            <div className="field">
              <label>En transferencia</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={value.transferencia}
                onChange={(e) => setParte('transferencia', e.target.value)}
              />
            </div>
          </div>
          <span className="hint" style={{ color: total && Math.round(sumaMixto) !== Math.round(total) ? 'var(--red)' : undefined }}>
            Suma {formatCurrency(sumaMixto)} de {formatCurrency(total)}
          </span>
        </div>
      )}

      {value.pago === 'a_cobrar' && (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Nombre del cliente que queda debiendo</label>
          <input value={value.cliente} onChange={(e) => set({ cliente: e.target.value })} placeholder="Ej: Juan Pérez" />
          <span className="hint">Queda en "A cobrar" del panel hasta que se registre el pago.</span>
        </div>
      )}
    </div>
  );
}
