-- Cada corte guarda ("congela") el % de comisión vigente al momento de registrarse.
-- Así, si después cambia el % de un servicio o de la ficha de un peluquero, los trabajos
-- anteriores NO se recalculan (necesario para liquidaciones y balances).

alter table cortes add column if not exists comision_pct numeric;

-- % vigente para un corte: el especial del servicio si tiene; si no, el de la ficha del peluquero.
create or replace function comision_vigente(p_servicio uuid, p_peluquero uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select comision_pct from servicios where id = p_servicio),
    (select comision from peluqueros where id = p_peluquero),
    0
  );
$$;

-- Al crear un corte se congela su %. Al editarlo, solo se recalcula si cambió el servicio o
-- el peluquero (y nadie fijó un % a mano en ese mismo cambio).
create or replace function cortes_congelar_comision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.comision_pct is null then
      new.comision_pct := comision_vigente(new.servicio_id, new.peluquero_id);
    end if;
  elsif (new.servicio_id is distinct from old.servicio_id or new.peluquero_id is distinct from old.peluquero_id)
        and new.comision_pct is not distinct from old.comision_pct then
    new.comision_pct := comision_vigente(new.servicio_id, new.peluquero_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cortes_congelar_comision on cortes;
create trigger trg_cortes_congelar_comision
  before insert or update on cortes
  for each row execute function cortes_congelar_comision();

-- Congelar los cortes existentes con los % configurados hoy.
update cortes set comision_pct = comision_vigente(servicio_id, peluquero_id)
where comision_pct is null;
