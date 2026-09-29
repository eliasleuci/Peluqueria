// Convierte "HH:MM" a minutos desde medianoche.
function aMinutos(hora) {
  const [h, m] = (hora || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Evalúa un ingreso contra la hora esperada, con tolerancia (5 min por defecto).
// Devuelve { estado: 'a_tiempo' | 'tarde', minutosTarde }.
// Si no hay hora esperada, no se puede evaluar tardanza => 'a_tiempo'.
export function evaluarIngreso(horaIngreso, horaEsperada, toleranciaMin = 5) {
  const ingreso = aMinutos(horaIngreso);
  const esperada = aMinutos(horaEsperada);
  if (ingreso == null || esperada == null) {
    return { estado: 'a_tiempo', minutosTarde: 0 };
  }
  const diff = ingreso - esperada;
  if (diff > toleranciaMin) {
    return { estado: 'tarde', minutosTarde: diff };
  }
  return { estado: 'a_tiempo', minutosTarde: 0 };
}

// Elige a qué franja corresponde un fichaje hecho a `horaActual` ("HH:MM").
// - franjas: franjas del día ordenadas ([{ desde, hasta }]); números 1..n según ese orden.
// - marcadas: números de franja ya fichados hoy.
// Toma la primera franja sin fichar que todavía no terminó (así, si a la tarde no se marcó
// la mañana, cuenta para la tarde y no como una tardanza de horas). Si todas terminaron,
// la última sin fichar. Sin horario ese día: permite un único ingreso "libre" (franja 1).
// Devuelve { numero, franja } o null si ya no quedan ingresos por marcar.
export function elegirFranja(franjas, marcadas, horaActual) {
  if (franjas.length === 0) {
    return marcadas.includes(1) ? null : { numero: 1, franja: null };
  }
  const pendientes = franjas
    .map((f, i) => ({ numero: i + 1, franja: f }))
    .filter((x) => !marcadas.includes(x.numero));
  if (pendientes.length === 0) return null;
  return pendientes.find((x) => x.franja.hasta > horaActual) ?? pendientes[pendientes.length - 1];
}
