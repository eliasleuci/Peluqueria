// Precio de un servicio en un local puntual: usa la excepción del local si existe,
// sino cae al precio base del servicio.
export function precioServicioEnLocal(servicio, localId) {
  if (!servicio) return 0;
  const excepcion = localId != null ? servicio.preciosPorLocal?.[localId] : undefined;
  return excepcion != null ? excepcion : servicio.precio;
}
