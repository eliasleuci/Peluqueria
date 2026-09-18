-- Mismo motivo que 0004: "Eliminar local" no puede ser un delete físico si tiene
-- peluqueros/productos/cortes referenciándolo (rompe la FK, Postgres devuelve 409).
-- Pasa a ser baja lógica.
alter table locales add column if not exists activo boolean not null default true;
