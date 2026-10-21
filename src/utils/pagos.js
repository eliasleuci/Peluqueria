// Formas de pago de cortes y ventas.
//   efectivo / transferencia: todo por un medio.
//   mixto: parte efectivo y parte transferencia (montoEfectivo + montoTransferencia = monto).
//   a_cobrar: el cliente paga después; queda pendiente hasta registrar el cobro (cobradoFecha).

export const FORMAS_PAGO = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'mixto', label: 'Mixto' },
  { key: 'a_cobrar', label: 'A cobrar' },
];

export function estaPendiente(item) {
  return item?.pago === 'a_cobrar' && !item?.cobradoFecha;
}

// Cuánta plata entró por cada medio. Un "a cobrar" pendiente todavía no aportó nada.
export function desglosePago(item) {
  const monto = Number(item?.monto) || 0;
  if (estaPendiente(item)) return { efectivo: 0, transferencia: 0 };
  if (item?.montoEfectivo != null || item?.montoTransferencia != null) {
    return { efectivo: Number(item.montoEfectivo) || 0, transferencia: Number(item.montoTransferencia) || 0 };
  }
  // Registros viejos sin desglose.
  if (item?.pago === 'efectivo') return { efectivo: monto, transferencia: 0 };
  if (item?.pago === 'transferencia') return { efectivo: 0, transferencia: monto };
  return { efectivo: 0, transferencia: 0 };
}

// Etiqueta y color del badge.
export function pagoBadge(item) {
  switch (item?.pago) {
    case 'efectivo':
      return { color: 'green', label: 'Efectivo' };
    case 'transferencia':
      return { color: 'blue', label: 'Transferencia' };
    case 'mixto':
      return { color: 'yellow', label: 'Mixto' };
    case 'a_cobrar':
      return estaPendiente(item) ? { color: 'red', label: 'A cobrar' } : { color: 'gray', label: 'Cobrado' };
    default:
      return { color: 'gray', label: item?.pago ?? '—' };
  }
}

// Estado del selector de pago en los formularios.
export function pagoInicial(item) {
  if (!item) return { pago: 'efectivo', efectivo: '', transferencia: '', cliente: '' };
  return {
    pago: item.pago,
    efectivo: item.pago === 'mixto' ? String(item.montoEfectivo ?? '') : '',
    transferencia: item.pago === 'mixto' ? String(item.montoTransferencia ?? '') : '',
    cliente: item.clienteNombre ?? '',
  };
}

// Devuelve un mensaje de error o null.
export function validarPago(estado, monto, { permitirACobrar = true } = {}) {
  if (estado.pago === 'mixto') {
    const e = Number(estado.efectivo) || 0;
    const t = Number(estado.transferencia) || 0;
    if (e <= 0 || t <= 0) return 'En pago mixto cargá cuánto fue en efectivo y cuánto en transferencia.';
    if (Math.round(e + t) !== Math.round(Number(monto) || 0)) {
      return `Efectivo + transferencia tiene que dar el total (${Math.round(Number(monto) || 0)}).`;
    }
  }
  if (estado.pago === 'a_cobrar') {
    if (!permitirACobrar) return 'Elegí cómo se cobró.';
    if (!estado.cliente.trim()) return 'Poné el nombre del cliente que queda debiendo.';
  }
  return null;
}

// Campos a guardar según el estado del selector.
export function camposPago(estado, monto) {
  const total = Number(monto) || 0;
  switch (estado.pago) {
    case 'mixto':
      return {
        pago: 'mixto',
        montoEfectivo: Number(estado.efectivo) || 0,
        montoTransferencia: Number(estado.transferencia) || 0,
        clienteNombre: estado.cliente.trim() || null,
      };
    case 'transferencia':
      return { pago: 'transferencia', montoEfectivo: 0, montoTransferencia: total, clienteNombre: estado.cliente.trim() || null };
    case 'a_cobrar':
      return { pago: 'a_cobrar', montoEfectivo: 0, montoTransferencia: 0, clienteNombre: estado.cliente.trim() };
    default:
      return { pago: 'efectivo', montoEfectivo: total, montoTransferencia: 0, clienteNombre: estado.cliente.trim() || null };
  }
}
