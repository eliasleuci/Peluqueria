-- Faltaban dos ON DELETE al armar el esquema original, y eso hizo que borrar un salón
-- (o un login) fallara en silencio si todavía había algo apuntándolo:
--
-- 1) profiles.salon_id no tenía cascade: si un salón tenía un profile (dueño/peluquero)
--    todavía viviendo, el DELETE del salón se rechazaba por esa FK — dejando colgado
--    todo lo de abajo (locales, peluqueros, cortes...) aunque el resto de esas tablas
--    sí tenían cascade correctamente configurado.
-- 2) peluqueros.auth_user_id no tenía nada: borrar el auth.users de un peluquero
--    (por ejemplo al limpiar cuentas de prueba) fallaba si esa fila de peluquero
--    seguía existiendo. Acá va SET NULL, no CASCADE — perder el login no tiene
--    por qué borrar la ficha ni el historial del peluquero.

alter table profiles drop constraint profiles_salon_id_fkey;
alter table profiles add constraint profiles_salon_id_fkey
  foreign key (salon_id) references salones(id) on delete cascade;

alter table peluqueros drop constraint peluqueros_auth_user_id_fkey;
alter table peluqueros add constraint peluqueros_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;
