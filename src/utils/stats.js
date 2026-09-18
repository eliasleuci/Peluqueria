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
