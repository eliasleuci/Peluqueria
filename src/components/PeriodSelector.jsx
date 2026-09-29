const OPCIONES = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'custom', label: 'Personalizado' },
];

export default function PeriodSelector({ period, custom, onChange }) {
  function setPeriod(key) {
    onChange({ period: key, custom });
  }
  function setCustom(patch) {
    onChange({ period: 'custom', custom: { ...custom, ...patch } });
  }

  return (
    <div className="stack-gap" style={{ gap: 10 }}>
      <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
        {OPCIONES.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`tab-btn${period === o.key ? ' active' : ''}`}
            onClick={() => setPeriod(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Desde
            <input
              type="date"
              value={custom?.from || ''}
              max={custom?.to || undefined}
              onChange={(e) => setCustom({ from: e.target.value })}
            />
          </label>
          <label className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Hasta
            <input
              type="date"
              value={custom?.to || ''}
              min={custom?.from || undefined}
              onChange={(e) => setCustom({ to: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
