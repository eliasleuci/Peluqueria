// Horario semanal: { lun: [{ desde: 'HH:MM', hasta: 'HH:MM' }, ...], ..., dom: [] }
// Hasta 2 franjas por día (horario cortado). [] = cerrado / día libre.

export const MAX_FRANJAS = 2;

export const DIAS = [
  { key: 'lun', label: 'Lunes', short: 'Lun', dow: 1 },
  { key: 'mar', label: 'Martes', short: 'Mar', dow: 2 },
  { key: 'mie', label: 'Miércoles', short: 'Mié', dow: 3 },
  { key: 'jue', label: 'Jueves', short: 'Jue', dow: 4 },
  { key: 'vie', label: 'Viernes', short: 'Vie', dow: 5 },
  { key: 'sab', label: 'Sábado', short: 'Sáb', dow: 6 },
  { key: 'dom', label: 'Domingo', short: 'Dom', dow: 0 },
];

export function semanaVacia() {
  return Object.fromEntries(DIAS.map((d) => [d.key, []]));
}

// Horario por defecto razonable para una peluquería: Lun–Sáb 09–20, Dom cerrado.
export function semanaPorDefecto() {
  const s = semanaVacia();
  for (const d of DIAS) if (d.key !== 'dom') s[d.key] = [{ desde: '09:00', hasta: '20:00' }];
  return s;
}

// Normaliza lo que venga de la DB (null, claves faltantes, franjas incompletas).
export function normalizarSemana(valor) {
  const s = semanaVacia();
  if (!valor || typeof valor !== 'object') return s;
  for (const d of DIAS) {
    const franjas = Array.isArray(valor[d.key]) ? valor[d.key] : [];
    s[d.key] = franjas
      .filter((f) => f && typeof f === 'object')
      .map((f) => ({ desde: String(f.desde ?? '').slice(0, 5), hasta: String(f.hasta ?? '').slice(0, 5) }))
      .slice(0, MAX_FRANJAS);
  }
  return s;
}

export function tieneAlgunHorario(semana) {
  return DIAS.some((d) => (semana?.[d.key] ?? []).length > 0);
}

// Devuelve un mensaje de error o null si el horario es válido.
export function validarSemana(semana) {
  for (const d of DIAS) {
    const franjas = semana?.[d.key] ?? [];
    for (const f of franjas) {
      if (!f.desde || !f.hasta) return `${d.label}: completá desde y hasta en cada franja.`;
      if (f.hasta <= f.desde) return `${d.label}: la hora de fin debe ser posterior a la de inicio.`;
    }
    if (franjas.length === 2 && franjas[1].desde < franjas[0].hasta) {
      return `${d.label}: la segunda franja debe empezar después de que termine la primera.`;
    }
  }
  return null;
}

function formatFranjas(franjas) {
  return franjas.map((f) => `${f.desde}–${f.hasta}`).join(' y ');
}

// Resumen legible, agrupando días consecutivos iguales: "Lun a Vie 09:00–13:00 y 16:00–20:00 · Sáb 09:00–14:00 · Dom cerrado"
export function resumenSemana(semana) {
  if (!tieneAlgunHorario(semana)) return 'Sin horario cargado';
  const partes = [];
  let i = 0;
  while (i < DIAS.length) {
    const texto = (semana[DIAS[i].key] ?? []).length ? formatFranjas(semana[DIAS[i].key]) : 'cerrado';
    let j = i;
    while (j + 1 < DIAS.length) {
      const sig = (semana[DIAS[j + 1].key] ?? []).length ? formatFranjas(semana[DIAS[j + 1].key]) : 'cerrado';
      if (sig !== texto) break;
      j++;
    }
    const dias = i === j ? DIAS[i].short : `${DIAS[i].short} a ${DIAS[j].short}`;
    partes.push(`${dias} ${texto}`);
    i = j + 1;
  }
  return partes.join(' · ');
}

export function diaKeyDe(fecha = new Date()) {
  return DIAS.find((d) => d.dow === fecha.getDay()).key;
}

// Franjas de un día concreto (ordenadas por hora de inicio).
export function franjasDelDia(semana, fecha = new Date()) {
  return [...(semana?.[diaKeyDe(fecha)] ?? [])].sort((a, b) => a.desde.localeCompare(b.desde));
}

// Horario efectivo de un peluquero: el propio; si no tiene, compatibilidad con la vieja
// "hora de entrada" única; si tampoco, el horario de su local.
export function semanaDePeluquero(peluquero, locales = []) {
  if (peluquero?.horarioSemanal && tieneAlgunHorario(peluquero.horarioSemanal)) return peluquero.horarioSemanal;
  if (peluquero?.horaEntrada) {
    const s = semanaVacia();
    for (const d of DIAS) s[d.key] = [{ desde: peluquero.horaEntrada, hasta: '23:59' }];
    return s;
  }
  const local = locales.find((l) => l.id === peluquero?.localId);
  return local?.horarioSemanal ?? semanaVacia();
}
