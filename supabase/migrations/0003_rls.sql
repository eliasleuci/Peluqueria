-- RLS: aislamiento por salon_id + restricción de escritura por rol.
-- Todas las tablas de negocio quedan denegadas por defecto salvo lo que estas políticas permitan explícitamente.
-- Cada policy se borra antes de crearse de nuevo para poder re-correr este archivo sin errores.

alter table salones enable row level security;
alter table locales enable row level security;
alter table servicios enable row level security;
alter table peluqueros enable row level security;
alter table productos enable row level security;
alter table cortes enable row level security;
alter table salon_config enable row level security;
alter table profiles enable row level security;

-- ---------- salones ----------
-- Solo lectura para DUENO/PELUQUERO de su propio salón; SUPER_ADMIN ve todos.
-- Sin políticas de escritura: el alta/edición de salones la hace el panel SUPER_ADMIN
-- vía Edge Function con service_role (que ignora RLS).
drop policy if exists salones_select on salones;
create policy salones_select on salones for select
  using (get_my_role() = 'SUPER_ADMIN' or id = get_my_salon_id());

-- ---------- locales ----------
drop policy if exists locales_select on locales;
create policy locales_select on locales for select
  using (get_my_role() = 'SUPER_ADMIN' or salon_id = get_my_salon_id());

drop policy if exists locales_insert on locales;
create policy locales_insert on locales for insert
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists locales_update on locales;
create policy locales_update on locales for update
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()))
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists locales_delete on locales;
create policy locales_delete on locales for delete
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

-- ---------- servicios ----------
drop policy if exists servicios_select on servicios;
create policy servicios_select on servicios for select
  using (get_my_role() = 'SUPER_ADMIN' or salon_id = get_my_salon_id());

drop policy if exists servicios_insert on servicios;
create policy servicios_insert on servicios for insert
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists servicios_update on servicios;
create policy servicios_update on servicios for update
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()))
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists servicios_delete on servicios;
create policy servicios_delete on servicios for delete
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

-- ---------- peluqueros ----------
-- Nadie con rol PELUQUERO puede leer/escribir esta tabla (evita ver comisión/datos de compañeros);
-- su propia identidad viaja en profiles/JWT, no necesita consultar 'peluqueros' directamente.
drop policy if exists peluqueros_select on peluqueros;
create policy peluqueros_select on peluqueros for select
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists peluqueros_insert on peluqueros;
create policy peluqueros_insert on peluqueros for insert
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists peluqueros_update on peluqueros;
create policy peluqueros_update on peluqueros for update
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()))
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists peluqueros_delete on peluqueros;
create policy peluqueros_delete on peluqueros for delete
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

-- ---------- productos ----------
drop policy if exists productos_select on productos;
create policy productos_select on productos for select
  using (get_my_role() = 'SUPER_ADMIN' or salon_id = get_my_salon_id());

drop policy if exists productos_insert on productos;
create policy productos_insert on productos for insert
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists productos_update on productos;
create policy productos_update on productos for update
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()))
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists productos_delete on productos;
create policy productos_delete on productos for delete
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

-- ---------- salon_config ----------
drop policy if exists salon_config_select on salon_config;
create policy salon_config_select on salon_config for select
  using (get_my_role() = 'SUPER_ADMIN' or salon_id = get_my_salon_id());

drop policy if exists salon_config_insert on salon_config;
create policy salon_config_insert on salon_config for insert
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

drop policy if exists salon_config_update on salon_config;
create policy salon_config_update on salon_config for update
  using (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()))
  with check (get_my_role() = 'SUPER_ADMIN' or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id()));

-- ---------- cortes ----------
-- DUENO/SUPER_ADMIN: todo el salón. PELUQUERO: solo sus propias filas.
drop policy if exists cortes_select on cortes;
create policy cortes_select on cortes for select
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  );

drop policy if exists cortes_insert on cortes;
create policy cortes_insert on cortes for insert
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (
      get_my_role() = 'PELUQUERO'
      and salon_id = get_my_salon_id()
      and peluquero_id = get_my_peluquero_id()
      and created_by = auth.uid()
      and exists (
        select 1 from locales l
        where l.id = cortes.local_id and l.salon_id = get_my_salon_id()
      )
    )
  );

-- PELUQUERO solo puede tocar los cortes que él mismo cargó (created_by = su propio uid).
drop policy if exists cortes_update on cortes;
create policy cortes_update on cortes for update
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id() and created_by = auth.uid())
  )
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (
      get_my_role() = 'PELUQUERO'
      and salon_id = get_my_salon_id()
      and peluquero_id = get_my_peluquero_id()
      and created_by = auth.uid()
      and exists (
        select 1 from locales l
        where l.id = cortes.local_id and l.salon_id = get_my_salon_id()
      )
    )
  );

drop policy if exists cortes_delete on cortes;
create policy cortes_delete on cortes for delete
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id() and created_by = auth.uid())
  );

-- ---------- profiles ----------
-- Solo SELECT vía RLS para usuarios normales. El alta/edición de profiles (incluido el 'role')
-- corre exclusivamente por Edge Functions con service_role, que ignoran RLS — así nadie
-- puede auto-asignarse SUPER_ADMIN ni cambiar su propio salon_id desde el cliente.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
  );
