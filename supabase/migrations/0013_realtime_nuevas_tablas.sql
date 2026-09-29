-- Suma las tablas nuevas a Realtime para que el panel se actualice en vivo
-- (mismo patrón idempotente que 0010_realtime.sql). La RLS sigue aplicando.
do $$
declare
  t text;
begin
  foreach t in array array['servicio_precios', 'asistencias', 'notificaciones'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
