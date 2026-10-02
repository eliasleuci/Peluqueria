-- Comisión especial por servicio (p. ej. Tintura 40%, Reflejos 40%).
-- NULL = el servicio usa el % de comisión de la ficha de cada peluquero (cortes comunes).
-- Con valor = ese % se aplica a ese servicio para cualquier peluquero.
alter table servicios add column if not exists comision_pct numeric;
