-- Formas de pago nuevas en cortes y ventas:
--   'mixto'    = parte en efectivo y parte en transferencia (montos en monto_efectivo / monto_transferencia)
--   'a_cobrar' = el cliente paga después. Queda pendiente hasta que se registra el cobro
--                (cobrado_fecha + cobro_pago + montos). El trabajo cuenta igual desde el día del corte.
-- Para todas las formas de pago, monto_efectivo / monto_transferencia dicen cuánta plata entró por cada medio.

do $$
declare
  t text;
begin
  foreach t in array array['cortes', 'ventas'] loop
    execute format('alter table %I drop constraint if exists %I', t, t || '_pago_check');
    execute format(
      'alter table %I add constraint %I check (pago in (''efectivo'', ''transferencia'', ''mixto'', ''a_cobrar''))',
      t, t || '_pago_check'
    );
    execute format('alter table %I add column if not exists monto_efectivo numeric', t);
    execute format('alter table %I add column if not exists monto_transferencia numeric', t);
    execute format('alter table %I add column if not exists cliente_nombre text', t);
    execute format('alter table %I add column if not exists cobrado_fecha date', t);
    execute format(
      'alter table %I add column if not exists cobro_pago text check (cobro_pago in (''efectivo'', ''transferencia'', ''mixto''))',
      t
    );
    -- Registros existentes: todo el monto por el único medio que tenían.
    execute format(
      'update %I set monto_efectivo = case when pago = ''efectivo'' then monto else 0 end,
                     monto_transferencia = case when pago = ''transferencia'' then monto else 0 end
       where monto_efectivo is null and monto_transferencia is null', t
    );
  end loop;
end $$;

create index if not exists idx_cortes_a_cobrar on cortes(salon_id) where pago = 'a_cobrar' and cobrado_fecha is null;
create index if not exists idx_ventas_a_cobrar on ventas(salon_id) where pago = 'a_cobrar' and cobrado_fecha is null;

-- registrar_venta acepta el desglose del pago y el nombre del cliente (parámetros nuevos con
-- valor por defecto: las llamadas viejas siguen funcionando).
drop function if exists registrar_venta(uuid, uuid, uuid, integer, numeric, numeric, numeric, text, text, date, time);

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
  p_hora time,
  p_monto_efectivo numeric default null,
  p_monto_transferencia numeric default null,
  p_cliente_nombre text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salon uuid := get_my_salon_id();
  v_role text := get_my_role();
  v_id uuid;
  v_efectivo numeric := p_monto_efectivo;
  v_transferencia numeric := p_monto_transferencia;
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
  if v_efectivo is null and v_transferencia is null then
    v_efectivo := case when p_pago = 'efectivo' then p_monto else 0 end;
    v_transferencia := case when p_pago = 'transferencia' then p_monto else 0 end;
  end if;

  insert into ventas (
    salon_id, local_id, peluquero_id, producto_id, cantidad, precio, monto,
    comision_monto, pago, notas, created_by, fecha, hora,
    monto_efectivo, monto_transferencia, cliente_nombre
  ) values (
    v_salon, p_local_id, p_peluquero_id, p_producto_id, p_cantidad, p_precio, p_monto,
    p_comision_monto, p_pago, nullif(p_notas, ''), auth.uid(), p_fecha, p_hora,
    coalesce(v_efectivo, 0), coalesce(v_transferencia, 0), nullif(btrim(coalesce(p_cliente_nombre, '')), '')
  ) returning id into v_id;

  update productos set stock = greatest(0, stock - p_cantidad) where id = p_producto_id;

  return v_id;
end;
$$;

grant execute on function registrar_venta(
  uuid, uuid, uuid, integer, numeric, numeric, numeric, text, text, date, time, numeric, numeric, text
) to authenticated;
