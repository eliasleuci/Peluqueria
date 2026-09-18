export default function MetricCard({ label, value, delta, subtitle }) {
  const hasDelta = delta !== undefined && delta !== null && !Number.isNaN(delta);
  const isUp = hasDelta && delta >= 0;
  return (
    <div className="card metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {hasDelta && (
        <span className={`metric-delta ${isUp ? 'up' : 'down'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs mes anterior
        </span>
      )}
      {subtitle && <span className="hint">{subtitle}</span>}
    </div>
  );
}
