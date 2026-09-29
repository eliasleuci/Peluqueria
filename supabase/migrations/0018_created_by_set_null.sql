-- Permitir borrar usuarios de Auth sin perder historial.
-- cortes/ventas/asistencias guardan quién registró cada fila (created_by), pero esas FKs
-- se crearon sin ON DELETE, así que Postgres bloqueaba el borrado de cualquier usuario que
-- hubiera registrado algo ("Database error deleting user").
-- Con SET NULL, al borrar el usuario las filas se conservan (monto, peluquero, fecha, etc.)
-- y solo pierden la referencia a quién las cargó.

alter table cortes drop constraint if exists cortes_created_by_fkey;
alter table cortes add constraint cortes_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table ventas drop constraint if exists ventas_created_by_fkey;
alter table ventas add constraint ventas_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table asistencias drop constraint if exists asistencias_created_by_fkey;
alter table asistencias add constraint asistencias_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
