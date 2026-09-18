-- TDB — esquema multi-tenant (salones -> locales/servicios/peluqueros/productos/cortes -> profiles)
create extension if not exists pgcrypto;

create table if not exists salones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table if not exists locales (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  nombre text not null,
  direccion text,
  telefono text,
  horario text,
  meta_mensual numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists servicios (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  nombre text not null,
  precio numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists peluqueros (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  local_id uuid references locales(id),
  nombre text not null,
  comision numeric not null default 0,
  fecha_ingreso date,
  telefono text,
  email text,
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  local_id uuid references locales(id),
  nombre text not null,
  categoria text,
  stock numeric not null default 0,
  unidad text not null default 'unidades',
  stock_minimo numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cortes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  local_id uuid not null references locales(id),
  peluquero_id uuid not null references peluqueros(id),
  servicio_id uuid not null references servicios(id),
  fecha date not null,
  hora time not null,
  precio numeric not null default 0,
  descuento numeric not null default 0,
  monto numeric not null default 0,
  pago text not null check (pago in ('efectivo', 'transferencia')),
  notas text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists salon_config (
  salon_id uuid primary key references salones(id) on delete cascade,
  meta_peluquero numeric not null default 0
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  salon_id uuid references salones(id),
  role text not null check (role in ('SUPER_ADMIN', 'DUENO', 'PELUQUERO')),
  peluquero_id uuid references peluqueros(id),
  nombre text,
  created_at timestamptz not null default now()
);

create index if not exists idx_locales_salon on locales(salon_id);
create index if not exists idx_servicios_salon on servicios(salon_id);
create index if not exists idx_peluqueros_salon on peluqueros(salon_id);
create index if not exists idx_productos_salon on productos(salon_id);
create index if not exists idx_cortes_salon on cortes(salon_id);
create index if not exists idx_cortes_peluquero on cortes(peluquero_id);
create index if not exists idx_cortes_local on cortes(local_id);
create index if not exists idx_profiles_salon on profiles(salon_id);
