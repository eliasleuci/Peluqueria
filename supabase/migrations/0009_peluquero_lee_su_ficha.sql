drop policy if exists peluqueros_select on peluqueros;
create policy peluqueros_select on peluqueros for select
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and id = get_my_peluquero_id())
  );
