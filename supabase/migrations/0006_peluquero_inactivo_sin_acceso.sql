-- BUG DE SEGURIDAD: al desactivar un peluquero (baja lógica en 'peluqueros'), su login seguía
-- teniendo acceso completo a cortes vía RLS, porque get_my_peluquero_id() solo miraba 'profiles'
-- y nunca chequeaba si esa ficha de peluquero seguía activa.
--
-- Fix: get_my_peluquero_id() devuelve NULL si el peluquero fue desactivado. Como ningún corte
-- real tiene peluquero_id nulo, todas las políticas que comparan "peluquero_id = get_my_peluquero_id()"
-- dejan de matchear ninguna fila apenas se lo desactiva — sin tener que tocar cada policy.
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
  where p.id = auth.uid() and pel.activo = true;
$$;
