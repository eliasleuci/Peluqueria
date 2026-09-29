-- Habilita Supabase Realtime en las tablas del negocio para que los cambios
-- (p. ej. un peluquero registrando un corte) lleguen en vivo al panel del dueño,
-- sin necesidad de recargar la página. La RLS existente sigue aplicando: cada
-- usuario solo recibe los cambios de las filas que tiene permitido leer.
-- Idempotente: no falla si alguna tabla ya está en la publicación.
do $$
declare
  t text;
begin
  foreach t in array array['cortes', 'peluqueros', 'productos', 'locales', 'servicios', 'salon_config'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
