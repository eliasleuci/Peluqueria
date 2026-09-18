-- "Eliminar peluquero" pasa a ser baja lógica: si tiene cortes cargados, un delete físico
-- rompe la referencia (cortes.peluquero_id) y Postgres lo rechaza con 409. En vez de eso,
-- se marca activo=false y deja de listarse, sin perder el historial de facturación.
alter table peluqueros add column if not exists activo boolean not null default true;
