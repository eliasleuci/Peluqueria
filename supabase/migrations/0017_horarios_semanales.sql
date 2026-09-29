-- Horarios por día de la semana, con hasta 2 franjas por día (horario cortado),
-- para locales (atención) y peluqueros (control de asistencia).
-- Formato JSON: { "lun": [{"desde":"09:00","hasta":"13:00"}, {"desde":"16:00","hasta":"20:00"}],
--                 "mar": [...], ..., "dom": [] }   -- [] = cerrado / día libre

alter table locales add column if not exists horario_semanal jsonb;
alter table peluqueros add column if not exists horario_semanal jsonb;

-- Convertir el horario de texto viejo de los locales (p. ej. "Lun a Sáb 9:00 - 20:00" o
-- "10:00 a 21:00"): se toman las dos horas y se aplican de lunes a sábado, domingo cerrado.
update locales l
set horario_semanal = (
  select jsonb_build_object(
    'lun', r, 'mar', r, 'mie', r, 'jue', r, 'vie', r, 'sab', r, 'dom', '[]'::jsonb
  )
  from (
    select jsonb_build_array(jsonb_build_object(
      'desde', lpad(m[1], 5, '0'),
      'hasta', lpad(m[2], 5, '0')
    )) as r
    from regexp_match(l.horario, '(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})') as m
  ) x
)
where l.horario_semanal is null
  and l.horario ~ '\d{1,2}:\d{2}\D+\d{1,2}:\d{2}';

-- Asistencia: pasa de "un ingreso por día" a "un ingreso por franja".
alter table asistencias add column if not exists franja smallint not null default 1;
alter table asistencias add column if not exists hora_esperada time;
alter table asistencias drop constraint if exists asistencias_peluquero_id_fecha_key;
alter table asistencias drop constraint if exists asistencias_peluquero_fecha_franja_key;
alter table asistencias add constraint asistencias_peluquero_fecha_franja_key unique (peluquero_id, fecha, franja);
