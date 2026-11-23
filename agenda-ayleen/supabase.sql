-- =====================================================================
-- Agenda online · Solis media · base de datos para Supabase
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a ejecutar sin perder datos.
-- =====================================================================

create table if not exists public.citas (
  id        uuid primary key default gen_random_uuid(),
  creada    timestamptz not null default now(),
  estado    text not null default 'confirmada' check (estado in ('confirmada','atendida','cancelada')),
  fecha     date not null,
  hora      time not null,
  minutos   int  not null check (minutos between 5 and 480),
  servicio  text not null,
  precio    int  not null default 0,
  nombre    text not null check (char_length(nombre) between 2 and 80),
  rut       text check (char_length(rut) <= 12),
  telefono  text not null check (char_length(telefono) between 8 and 20),
  email     text check (char_length(email) <= 80),
  nota      text check (char_length(nota) <= 300)
);
create index if not exists citas_fecha_idx on public.citas (fecha);

create table if not exists public.bloqueos (
  id      uuid primary key default gen_random_uuid(),
  fecha   date not null,
  desde   time,           -- null = día completo
  hasta   time,
  motivo  text
);

-- Correos que pueden entrar al panel profesional
create table if not exists public.administradoras (
  email text primary key
);

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradoras where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- Seguridad por fila: nadie lee ni escribe directo salvo las administradoras
alter table public.citas           enable row level security;
alter table public.bloqueos        enable row level security;
alter table public.administradoras enable row level security;

drop policy if exists admin_citas on public.citas;
create policy admin_citas on public.citas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists admin_bloqueos on public.bloqueos;
create policy admin_bloqueos on public.bloqueos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Lo que ve el público: solo horarios ocupados, sin nombres ni datos personales
create or replace function public.horarios_ocupados(p_desde date, p_hasta date)
returns table (fecha date, hora time, minutos int)
language sql stable security definer set search_path = public as $$
  select c.fecha, c.hora, c.minutos from citas c
   where c.estado <> 'cancelada' and c.fecha between p_desde and p_hasta
  union all
  select b.fecha, coalesce(b.desde, '00:00'::time),
         case when b.desde is null then 1440
              else (extract(epoch from (b.hasta - b.desde)) / 60)::int end
    from bloqueos b
   where b.fecha between p_desde and p_hasta;
$$;

-- Reservar: valida que la hora siga libre (evita dobles reservas simultáneas)
create or replace function public.reservar(
  p_fecha date, p_hora time, p_minutos int, p_servicio text, p_precio int,
  p_nombre text, p_rut text, p_telefono text, p_email text, p_nota text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare nuevo uuid;
begin
  if p_fecha < current_date or p_fecha > current_date + 60 then
    raise exception 'fecha fuera de rango';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_fecha::text));
  if exists (
    select 1 from horarios_ocupados(p_fecha, p_fecha) o
     where p_hora < o.hora + make_interval(mins => o.minutos)
       and o.hora < p_hora + make_interval(mins => p_minutos)
  ) then
    raise exception 'hora ocupada';
  end if;
  insert into citas (fecha, hora, minutos, servicio, precio, nombre, rut, telefono, email, nota)
  values (p_fecha, p_hora, p_minutos, p_servicio, coalesce(p_precio,0),
          trim(p_nombre), nullif(trim(p_rut),''), p_telefono, nullif(trim(p_email),''), nullif(trim(p_nota),''))
  returning id into nuevo;
  return nuevo;
end $$;

revoke all on function public.horarios_ocupados(date, date) from public;
revoke all on function public.reservar(date, time, int, text, int, text, text, text, text, text) from public;
grant execute on function public.horarios_ocupados(date, date) to anon, authenticated;
grant execute on function public.reservar(date, time, int, text, int, text, text, text, text, text) to anon, authenticated;

-- =====================================================================
-- ÚLTIMO PASO: cambia el correo por el de la matrona (el mismo con que
-- creas su usuario en Authentication > Users) y ejecuta esta línea.
-- =====================================================================
-- insert into public.administradoras (email) values ('correo-de-la-matrona@ejemplo.cl') on conflict do nothing;
