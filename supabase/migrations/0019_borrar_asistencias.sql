-- El dueño puede eliminar fichajes (p. ej. pruebas o registros cargados por error).
-- Al borrar un fichaje "tarde" también se borra el aviso de tardanza que generó.

drop policy if exists asistencias_delete on asistencias;
create policy asistencias_delete on asistencias for delete
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
  );

-- Vincular cada aviso con el fichaje que lo generó (cascade: borrar el fichaje borra el aviso).
alter table notificaciones
  add column if not exists asistencia_id uuid references asistencias(id) on delete cascade;

-- Vincular los avisos de tardanza ya existentes con su fichaje. El mensaje incluye la fecha
-- (YYYY-MM-DD) y la hora de ingreso (HH:MM), p. ej. "... el 2026-09-29 (ingreso 10:12) ...".
update notificaciones n
set asistencia_id = a.id
from asistencias a
where n.asistencia_id is null
  and n.tipo = 'tardanza'
  and n.peluquero_id = a.peluquero_id
  and n.mensaje like '%' || a.fecha::text || '%'
  and n.mensaje like '%' || to_char(a.hora_ingreso, 'HH24:MI') || '%';
