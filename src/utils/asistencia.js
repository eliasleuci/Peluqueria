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
