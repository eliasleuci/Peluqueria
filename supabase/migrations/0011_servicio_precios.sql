-- Precios por local: un servicio puede costar distinto en cada local.
-- servicios.precio queda como PRECIO BASE / fallback. Esta tabla guarda solo las
-- EXCEPCIONES (servicio + local -> precio). Si no hay fila, se usa el precio base.
-- El historial no se toca: cada corte ya guarda su propio precio/monto.

create table if not exists servicio_precios (
  servicio_id uuid not null references servicios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete cascade,
  salon_id uuid not null references salones(id) on delete cascade,
  precio numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (servicio_id, local_id)
);

create index if not exists idx_servicio_precios_salon on servicio_precios(salon_id);

alter table servicio_precios enable row level security;

-- Lectura: cualquier rol del salón (o SUPER_ADMIN). Igual que servicios.
drop policy if exists servicio_precios_select on servicio_precios;
create policy servicio_precios_select on servicio_precios for select
  using (get_my_role() = 'SUPER_ADMIN' or salon_id = get_my_salon_id());

-- Escritura: solo DUENO del salón (o SUPER_ADMIN).
drop policy if exists servicio_precios_insert on servicio_precios;
create policy servicio_precios_insert on servicio_precios for insert
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
  );

drop policy if exists servicio_precios_update on servicio_precios;
create policy servicio_precios_update on servicio_precios for update
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
  )
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
  );

drop policy if exists servicio_precios_delete on servicio_precios;
create policy servicio_precios_delete on servicio_precios for delete
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
  );
