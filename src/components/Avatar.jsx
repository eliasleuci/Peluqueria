import { initials, colorForString } from '../utils/format';

export default function Avatar({ name, size = 40 }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: colorForString(name || ''),
      }}
    >
      {initials(name)}
    </div>
  );
}
