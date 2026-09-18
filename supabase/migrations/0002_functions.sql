-- Funciones helper para las políticas RLS. security definer + search_path fijo
-- para que puedan leer 'profiles' aunque el caller no tenga permiso directo sobre esa tabla.

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.get_my_salon_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select salon_id from profiles where id = auth.uid();
$$;

create or replace function public.get_my_peluquero_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select peluquero_id from profiles where id = auth.uid();
$$;
