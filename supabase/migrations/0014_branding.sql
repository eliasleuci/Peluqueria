-- Branding por cliente (PWA): logo por salón para el ícono de "agregar a inicio".

-- URL pública del logo de cada salón.
alter table salones add column if not exists logo_url text;

-- Bucket público donde viven los logos.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Lectura pública de los logos (el celular baja el ícono sin sesión).
drop policy if exists logos_read on storage.objects;
create policy logos_read on storage.objects for select
  using (bucket_id = 'logos');

-- Escritura/borrado de logos: solo SUPER_ADMIN (get_my_role() de 0002_functions.sql).
drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and get_my_role() = 'SUPER_ADMIN');

drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and get_my_role() = 'SUPER_ADMIN')
  with check (bucket_id = 'logos' and get_my_role() = 'SUPER_ADMIN');

drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and get_my_role() = 'SUPER_ADMIN');

-- Permitir a SUPER_ADMIN guardar logo_url en salones (hoy salones no tiene política de escritura).
drop policy if exists salones_update_superadmin on salones;
create policy salones_update_superadmin on salones for update
  using (get_my_role() = 'SUPER_ADMIN')
  with check (get_my_role() = 'SUPER_ADMIN');

-- Vista pública de branding: la Edge Function de Netlify lee (slug -> nombre, logo_url)
-- con la anon key, sin exponer el resto de la tabla salones.
create or replace view salon_branding as
  select slug, nombre, logo_url from salones where activo is true;

grant select on salon_branding to anon, authenticated;
