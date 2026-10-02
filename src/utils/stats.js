import { toDateKey } from './format';

export function filterByLocal(items, localId) {
  if (localId === 'all') return items;
  return items.filter((item) => String(item.localId) === String(localId));
}

export function monthKeyOf(dateKey) {
  return dateKey.slice(0, 7); // YYYY-MM
}

export function cortesOfMonth(cortes, monthKey) {
  return cortes.filter((c) => monthKeyOf(c.fecha) === monthKey);
}

export function currentMonthKey(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function sumMonto(cortes) {
  return cortes.reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
}

export function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function isToday(dateKey) {
  return dateKey === toDateKey(new Date());
}

// --- Rangos de fecha (todos devuelven { from, to } con claves YYYY-MM-DD inclusivas) ---

export function filterByRange(cortes, fromKey, toKey) {
  return cortes.filter((c) => c.fecha >= fromKey && c.fecha <= toKey);
}

export function dayRange(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const key = toDateKey(d);
  return { from: key, to: key };
}

export function weekRange(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  // getDay(): 0=Dom..6=Sáb. Queremos semana lunes→domingo.
  const dow = (d.getDay() + 6) % 7; // 0=Lun..6=Dom
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateKey(monday), to: toDateKey(sunday) };
}

export function monthRange(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toDateKey(first), to: toDateKey(last) };
}

// period ∈ 'hoy' | 'semana' | 'mes' | 'custom'. offset = 0 (actual) o -1 (anterior).
export function periodRange(period, offset = 0, custom = null) {
  if (period === 'hoy') return { ...dayRange(offset), label: 'hoy' };
  if (period === 'semana') return { ...weekRange(offset), label: 'esta semana' };
  if (period === 'custom') {
    const from = custom?.from || toDateKey(new Date());
    const to = custom?.to || from;
    if (offset === 0) return { from, to, label: 'el rango elegido' };
    // Período anterior de igual duración, justo antes del rango.
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const days = Math.round((end - start) / 86400000) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - (days - 1));
    return { from: toDateKey(prevStart), to: toDateKey(prevEnd), label: 'el rango anterior' };
  }
  return { ...monthRange(offset), label: 'este mes' };
}

// --- Agregaciones sobre un array de cortes ya filtrado ---

export function computeMetrics(cortes) {
  const ingresos = sumMonto(cortes);
  const cantidad = cortes.length;
  const efectivo = sumMonto(cortes.filter((c) => c.pago === 'efectivo'));
  const transferencia = sumMonto(cortes.filter((c) => c.pago === 'transferencia'));
  const descuentos = cortes.reduce((acc, c) => acc + (Number(c.descuento) || 0), 0);
  return {
    ingresos,
    cantidad,
    efectivo,
    transferencia,
    descuentos,
    ticketPromedio: cantidad ? ingresos / cantidad : 0,
    efectivoPct: ingresos ? (efectivo / ingresos) * 100 : 0,
    transferenciaPct: ingresos ? (transferencia / ingresos) * 100 : 0,
  };
}

// % de comisión VIGENTE hoy para un servicio y peluquero: el especial del servicio si tiene
// (tinturas, reflejos...), si no, el % de la ficha del peluquero.
export function pctComisionVigente(servicioId, peluquero, servicios = []) {
  const especial = servicios.find((s) => s.id === servicioId)?.comisionPct;
  return especial != null ? especial : Number(peluquero?.comision) || 0;
}

// % de comisión de un corte: el que quedó congelado al registrarlo; si es un corte viejo sin
// congelar, el vigente.
export function pctComisionCorte(corte, peluquero, servicios = []) {
  if (corte.comisionPct != null) return corte.comisionPct;
  return pctComisionVigente(corte.servicioId, peluquero, servicios);
}

// Comisión total de cortes. Devuelve también cuánto viene de servicios especiales.
export function comisionDeCortes(cortes, peluqueros = [], servicios = []) {
  let total = 0;
  let especial = 0;
  for (const c of cortes) {
    const p = peluqueros.find((x) => x.id === c.peluqueroId);
    const monto = (Number(c.monto) || 0) * (pctComisionCorte(c, p, servicios) / 100);
    total += monto;
    if (servicios.find((s) => s.id === c.servicioId)?.comisionPct != null) especial += monto;
  }
  return { total, especial };
}

export function rankPeluqueros(cortes, peluqueros, servicios = []) {
  return peluqueros
    .map((p) => {
      const suyos = cortes.filter((c) => c.peluqueroId === p.id);
      const monto = sumMonto(suyos);
      return {
        peluquero: p,
        cantidad: suyos.length,
        monto,
        ticket: suyos.length ? monto / suyos.length : 0,
        comision: comisionDeCortes(suyos, [p], servicios).total,
      };
    })
    .filter((r) => r.cantidad > 0)
    .sort((a, b) => b.monto - a.monto);
}

export function rankServicios(cortes, servicios) {
  const acc = {};
  for (const c of cortes) {
    if (!acc[c.servicioId]) acc[c.servicioId] = { cantidad: 0, monto: 0 };
    acc[c.servicioId].cantidad += 1;
    acc[c.servicioId].monto += Number(c.monto) || 0;
  }
  return Object.entries(acc)
    .map(([sid, v]) => ({
      servicio: servicios.find((s) => s.id === sid) ?? { id: sid, nombre: '—' },
      cantidad: v.cantidad,
      monto: v.monto,
    }))
    .sort((a, b) => b.monto - a.monto);
}
