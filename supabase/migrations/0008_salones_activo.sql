-- Permite pausar un cliente (salón) por falta de pago, sin borrar nada — y que eso
-- corte el acceso de verdad a nivel de base, no solo en la UI. Mismo patrón que ya
-- usamos para peluqueros.activo: get_my_salon_id() devuelve NULL si el salón está
-- pausado, y como ningún dato real tiene salon_id nulo, todas las políticas que
-- comparan "salon_id = get_my_salon_id()" dejan de matchear — para el dueño Y para
-- sus peluqueros (que dependen de get_my_peluquero_id(), por eso también se actualiza).

alter table salones add column if not exists activo boolean not null default true;

create or replace function public.get_my_salon_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.salon_id
  from profiles p
  join salones s on s.id = p.salon_id
  where p.id = auth.uid() and s.activo = true;
$$;

create or replace function public.get_my_peluquero_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.peluquero_id
  from profiles p
  join peluqueros pel on pel.id = p.peluquero_id
  join salones s on s.id = pel.salon_id
  where p.id = auth.uid() and pel.activo = true and s.activo = true;
$$;
