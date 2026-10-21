import Badge from './Badge';
import { pagoBadge } from '../utils/pagos';

// Badge de forma de pago. En "a cobrar" muestra también a quién se le fió (si se pide).
export default function PagoBadge({ item, conCliente = false }) {
  const { color, label } = pagoBadge(item);
  return (
    <Badge color={color}>
      {label}
      {conCliente && item?.pago === 'a_cobrar' && item?.clienteNombre ? ` · ${item.clienteNombre}` : ''}
    </Badge>
  );
}
