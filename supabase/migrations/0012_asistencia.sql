-- Gestión de personal: fichaje de ingreso con tolerancia + avisos de tardanza.

-- Hora de entrada esperada por peluquero (nullable = sin control de tardanza).
alter table peluqueros add column if not exists hora_entrada time;

-- Registro de asistencias (un ingreso por día por peluquero).
create table if not exists asistencias (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  peluquero_id uuid not null references peluqueros(id) on delete cascade,
  local_id uuid references locales(id) on delete set null,
  fecha date not null,
  hora_ingreso time not null,
  estado text not null check (estado in ('a_tiempo', 'tarde')),
  minutos_tarde integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (peluquero_id, fecha)
);

create index if not exists idx_asistencias_salon on asistencias(salon_id);
create index if not exists idx_asistencias_peluquero on asistencias(peluquero_id);

alter table asistencias enable row level security;

-- Lectura: DUENO ve todo su salón; PELUQUERO solo lo suyo. (Molde: cortes)
drop policy if exists asistencias_select on asistencias;
create policy asistencias_select on asistencias for select
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  );

-- Alta: el peluquero ficha lo suyo (o el dueño/SUPER_ADMIN).
drop policy if exists asistencias_insert on asistencias;
create policy asistencias_insert on asistencias for insert
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (
      get_my_role() = 'PELUQUERO'
      and salon_id = get_my_salon_id()
      and peluquero_id = get_my_peluquero_id()
      and created_by = auth.uid()
    )
  );

-- Avisos persistentes para el peluquero (p. ej. "llegaste tarde").
create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  peluquero_id uuid not null references peluqueros(id) on delete cascade,
  tipo text not null default 'info',
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notificaciones_salon on notificaciones(salon_id);
create index if not exists idx_notificaciones_peluquero on notificaciones(peluquero_id);

alter table notificaciones enable row level security;

-- Lectura: el peluquero ve las suyas; el dueño las de su salón.
drop policy if exists notificaciones_select on notificaciones;
create policy notificaciones_select on notificaciones for select
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  );

-- Alta: la crea la propia sesión del peluquero al fichar tarde (o dueño/SUPER_ADMIN).
drop policy if exists notificaciones_insert on notificaciones;
create policy notificaciones_insert on notificaciones for insert
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (
      get_my_role() = 'PELUQUERO'
      and salon_id = get_my_salon_id()
      and peluquero_id = get_my_peluquero_id()
    )
  );

-- Marcar como leída: el peluquero sobre las suyas.
drop policy if exists notificaciones_update on notificaciones;
create policy notificaciones_update on notificaciones for update
  using (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  )
  with check (
    get_my_role() = 'SUPER_ADMIN'
    or (get_my_role() = 'DUENO' and salon_id = get_my_salon_id())
    or (get_my_role() = 'PELUQUERO' and peluquero_id = get_my_peluquero_id())
  );
