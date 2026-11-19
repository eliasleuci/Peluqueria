-- La app ya no baja todo el historial: pide cortes, ventas y asistencias por salón
-- desde una fecha (por defecto, el 1° del mes anterior). Estos índices hacen que esas
-- consultas sigan siendo rápidas aunque el salón acumule decenas de miles de registros.
create index if not exists idx_cortes_salon_fecha on cortes(salon_id, fecha);
create index if not exists idx_ventas_salon_fecha on ventas(salon_id, fecha);
create index if not exists idx_asistencias_salon_fecha on asistencias(salon_id, fecha);
create index if not exists idx_notificaciones_salon_created on notificaciones(salon_id, created_at);
