-- Comisión de venta de producto como MONTO FIJO por unidad (p. ej. $7.000 por perfume),
-- definido en cada producto e igual para cualquier vendedor. 0 = no genera comisión.
-- Reemplaza al esquema anterior (flag genera_comision + % por peluquero), que queda sin uso.
alter table productos add column if not exists comision_fija numeric not null default 0;
