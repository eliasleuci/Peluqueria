-- El peluquero puede editar y borrar TODOS los cortes a su nombre (no solo los que cargó él:
-- también los que el dueño cargó por él). Sigue sin poder tocar cortes de otros peluqueros
-- ni reasignar un corte a otro peluquero u otro salón. El dueño sigue pudiendo todo en su salón.

drop policy if exists cortes_update on cortes;
create policy cortes_update on cortes for update
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  )
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (
      get_my_role() = 'PELUQUERO'
      and salon_id = get_my_salon_id()
      and peluquero_id = get_my_peluquero_id()
      and exists (select 1 from locales l where l.id = cortes.local_id and l.salon_id = get_my_salon_id())
    )
  );

drop policy if exists cortes_delete on cortes;
create policy cortes_delete on cortes for delete
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  );
