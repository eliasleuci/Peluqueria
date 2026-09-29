-- Ventas de producto + comisión por producto.

-- Precio de venta y elegibilidad de comisión por producto.
alter table productos add column if not exists precio numeric not null default 0;
alter table productos add column if not exists genera_comision boolean not null default false;

-- % de comisión del peluquero por venta de producto (aparte de la de cortes).
alter table peluqueros add column if not exists comision_producto numeric not null default 0;

-- Registro de ventas de producto (molde: cortes).
create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  local_id uuid not null references locales(id),
  peluquero_id uuid not null references peluqueros(id),
  producto_id uuid not null references productos(id),
  cantidad integer not null default 1,
  precio numeric not null default 0,
  monto numeric not null default 0,
  comision_monto numeric not null default 0,
  pago text not null check (pago in ('efectivo', 'transferencia')),
  notas text,
  created_by uuid references auth.users(id),
  fecha date not null,
  hora time not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ventas_salon on ventas(salon_id);
create index if not exists idx_ventas_peluquero on ventas(peluquero_id);
create index if not exists idx_ventas_producto on ventas(producto_id);

alter table ventas enable row level security;

-- Lectura: DUENO todo el salón; PELUQUERO solo lo suyo. (Molde: cortes)
drop policy if exists ventas_select on ventas;
create policy ventas_select on ventas for select
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  );

-- Alta: peluquero registra lo suyo (o dueño/SUPER_ADMIN).
drop policy if exists ventas_insert on ventas;
create policy ventas_insert on ventas for insert
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (
      get_my_role() = 'PELUQUERO'
      and salon_id = get_my_salon_id()
      and peluquero_id = get_my_peluquero_id()
      and created_by = auth.uid()
      and exists (select 1 from locales l where l.id = ventas.local_id and l.salon_id = get_my_salon_id())
    )
  );

drop policy if exists ventas_update on ventas;
create policy ventas_update on ventas for update
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id() and created_by = auth.uid())
  )
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id() and created_by = auth.uid())
  );

drop policy if exists ventas_delete on ventas;
create policy ventas_delete on ventas for delete
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id() and created_by = auth.uid())
  );

-- Registra la venta y descuenta el stock en UNA transacción atómica.
-- SECURITY DEFINER: permite que un PELUQUERO descuente stock (que por RLS no podría tocar),
-- pero con chequeos de permiso propios adentro. Evita además la condición de carrera del
-- descuento leer-modificar-escribir del lado del cliente.
create or replace function registrar_venta(
  p_local_id uuid,
  p_peluquero_id uuid,
  p_producto_id uuid,
  p_cantidad integer,
  p_precio numeric,
  p_monto numeric,
  p_comision_monto numeric,
  p_pago text,
  p_notas text,
  p_fecha date,
  p_hora time
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salon uuid := get_my_salon_id();
  v_role text := get_my_role();
  v_id uuid;
begin
  if v_salon is null then
    raise exception 'Sin salón asociado';
  end if;
  if not (
    v_role = 'SUPER_ADMIN'
    or v_role = 'DUENO'
    or (v_role = 'PELUQUERO' and p_peluquero_id = get_my_peluquero_id())
  ) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from productos where id = p_producto_id and salon_id = v_salon) then
    raise exception 'Producto inválido';
  end if;
  if not exists (select 1 from locales where id = p_local_id and salon_id = v_salon) then
    raise exception 'Local inválido';
  end if;

  insert into ventas (
    salon_id, local_id, peluquero_id, producto_id, cantidad, precio, monto,
    comision_monto, pago, notas, created_by, fecha, hora
  ) values (
    v_salon, p_local_id, p_peluquero_id, p_producto_id, p_cantidad, p_precio, p_monto,
    p_comision_monto, p_pago, nullif(p_notas, ''), auth.uid(), p_fecha, p_hora
  ) returning id into v_id;

  update productos set stock = greatest(0, stock - p_cantidad) where id = p_producto_id;

  return v_id;
end;
$$;

grant execute on function registrar_venta(uuid, uuid, uuid, integer, numeric, numeric, numeric, text, text, date, time) to authenticated;
