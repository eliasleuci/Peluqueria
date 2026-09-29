-- Suma la tabla ventas a Realtime (mismo patrón idempotente que 0010/0013).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ventas'
  ) then
    alter publication supabase_realtime add table public.ventas;
  end if;
end $$;
