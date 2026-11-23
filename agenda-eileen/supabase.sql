-- =====================================================================
-- Agenda online · Solis media · v2 (diseño con panel, clientes y reseñas)
-- Pegar completo en Supabase > SQL Editor > Run. Se puede re-ejecutar.
-- Requiere la tabla public.administradoras y la función public.es_admin()
-- de la v1 (se crean aquí si no existen).
-- =====================================================================

create table if not exists public.administradoras (email text primary key);
alter table public.administradoras enable row level security;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradoras where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- Configuración del negocio: perfil, servicios y horario (una sola fila)
create table if not exists public.ajustes (
  id         int primary key default 1 check (id = 1),
  perfil     jsonb not null default '{}'::jsonb,
  servicios  jsonb not null default '[]'::jsonb,
  agenda     jsonb not null default '{"weekly":{},"overrides":{},"extras":[],"blocks":[],"seq":1}'::jsonb,
  actualizado timestamptz not null default now()
);

create table if not exists public.reservas (
  id          uuid primary key default gen_random_uuid(),
  token       uuid not null default gen_random_uuid() unique,
  service_id  text not null,
  date        date not null,
  start_min   int  not null check (start_min between 0 and 1439),
  end_min     int  not null check (end_min between 1 and 1440 and end_min > start_min),
  name        text not null check (char_length(name) between 2 and 80),
  email       text check (char_length(email) <= 120),
  phone       text check (char_length(phone) <= 30),
  note        text check (char_length(note) <= 300),
  status      text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  source      text not null default 'web' check (source in ('web','panel')),
  created_at  timestamptz not null default now()
);
create index if not exists reservas_date_idx on public.reservas (date);

create table if not exists public.resenas (
  booking_id  uuid primary key references public.reservas(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now()
);

alter table public.ajustes  enable row level security;
alter table public.reservas enable row level security;
alter table public.resenas  enable row level security;

drop policy if exists admin_ajustes on public.ajustes;
create policy admin_ajustes on public.ajustes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists admin_reservas on public.reservas;
create policy admin_reservas on public.reservas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists admin_resenas on public.resenas;
create policy admin_resenas on public.resenas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.ajustes, public.reservas, public.resenas to authenticated;
revoke all on public.ajustes, public.reservas, public.resenas, public.administradoras from anon;
grant execute on function public.es_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Público: perfil, servicios visibles, horario (sin motivos de bloqueo)
-- y horas ocupadas (sin nombres ni datos personales).
-- ---------------------------------------------------------------------
create or replace function public.agenda_publica()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', a.perfil,
    'servicios', coalesce((select jsonb_agg(s) from jsonb_array_elements(a.servicios) s
                           where coalesce((s->>'active')::boolean, true)), '[]'::jsonb),
    'weekly', a.agenda->'weekly',
    'overrides', a.agenda->'overrides',
    'extras', a.agenda->'extras',
    'blocks', coalesce((select jsonb_agg(b - 'reason') from jsonb_array_elements(a.agenda->'blocks') b), '[]'::jsonb),
    'ocupadas', coalesce((select jsonb_agg(jsonb_build_object('date', r.date, 'start_min', r.start_min, 'end_min', r.end_min))
                 from reservas r where r.status = 'confirmed'
                   and r.date >= (now() at time zone 'America/Santiago')::date - 1), '[]'::jsonb)
  ) from ajustes a where a.id = 1;
$$;

-- ¿Está abierto todo el tramo [ini, fin) ese día, sin bloqueos?
create or replace function public.tramo_abierto(p_agenda jsonb, p_date date, ini int, fin int)
returns boolean language plpgsql immutable as $$
declare
  base jsonb; m int; ok boolean; r jsonb; e jsonb; b jsonb;
  dow text := extract(dow from p_date)::int::text;
begin
  -- Día cerrado completo
  for b in select * from jsonb_array_elements(coalesce(p_agenda->'blocks','[]')) loop
    if (b->>'date')::date = p_date and (b->'start_min' is null or jsonb_typeof(b->'start_min') = 'null') then
      return false;
    end if;
  end loop;
  base := coalesce(p_agenda->'overrides'->(p_date::text), p_agenda->'weekly'->dow, '[]'::jsonb);
  m := ini;
  while m < fin loop
    ok := false;
    for r in select * from jsonb_array_elements(base) loop
      if m >= (r->>0)::int and m < (r->>1)::int then ok := true; end if;
    end loop;
    for e in select * from jsonb_array_elements(coalesce(p_agenda->'extras','[]')) loop
      if (e->>'date')::date = p_date and m >= (e->>'start_min')::int and m < (e->>'end_min')::int then ok := true; end if;
    end loop;
    for b in select * from jsonb_array_elements(coalesce(p_agenda->'blocks','[]')) loop
      if (b->>'date')::date = p_date and jsonb_typeof(b->'start_min') = 'number'
         and m >= (b->>'start_min')::int and m < (b->>'end_min')::int then ok := false; end if;
    end loop;
    if not ok then return false; end if;
    m := m + 5;
  end loop;
  return true;
end $$;

-- Reserva desde la web: valida servicio, horario y que la hora siga libre.
create or replace function public.reservar_web(
  p_service text, p_date date, p_start int, p_name text, p_email text, p_phone text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a ajustes; svc jsonb; dur int; fin int; nueva reservas;
  hoy date := (now() at time zone 'America/Santiago')::date;
  ahora int := extract(hour from (now() at time zone 'America/Santiago'))::int * 60
             + extract(minute from (now() at time zone 'America/Santiago'))::int;
begin
  select * into a from ajustes where id = 1;
  select s into svc from jsonb_array_elements(a.servicios) s
   where s->>'id' = p_service and coalesce((s->>'active')::boolean, true) limit 1;
  if svc is null then raise exception 'SERVICIO' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_name,''))) < 2 then raise exception 'NOMBRE' using errcode = 'P0001'; end if;
  if coalesce(p_email,'') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'CORREO' using errcode = 'P0001'; end if;
  dur := (svc->>'duration')::int;
  fin := p_start + dur;
  if p_date < hoy or p_date > hoy + 31 or (p_date = hoy and p_start < ahora + 120) then
    raise exception 'OCUPADA' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_date::text));
  if not tramo_abierto(a.agenda, p_date, p_start, fin) or exists (
    select 1 from reservas r where r.date = p_date and r.status = 'confirmed'
       and r.start_min < fin and p_start < r.end_min) then
    raise exception 'OCUPADA' using errcode = 'P0001';
  end if;
  insert into reservas (service_id, date, start_min, end_min, name, email, phone, note, source)
  values (p_service, p_date, p_start, fin, trim(p_name), trim(p_email),
          nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_note,'')),''), 'web')
  returning * into nueva;
  return jsonb_build_object('ok', true, 'token', nueva.token);
end $$;

-- Reseña con el enlace personal que la profesional envía por WhatsApp
create or replace function public.resena_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', split_part(r.name, ' ', 1), 'date', r.date, 'service_id', r.service_id,
                            'done', exists(select 1 from resenas x where x.booking_id = r.id))
    from reservas r where r.token = p_token and r.status = 'confirmed';
$$;

create or replace function public.enviar_resena(p_token uuid, p_rating int, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r reservas;
begin
  select * into r from reservas where token = p_token and status = 'confirmed';
  if r.id is null then raise exception 'NOENCONTRADA' using errcode = 'P0001'; end if;
  if p_rating not between 1 and 5 then raise exception 'ESTRELLAS' using errcode = 'P0001'; end if;
  insert into resenas (booking_id, rating, comment) values (r.id, p_rating, nullif(trim(coalesce(p_comment,'')),''))
  on conflict (booking_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.agenda_publica() from public;
revoke all on function public.reservar_web(text, date, int, text, text, text, text) from public;
revoke all on function public.resena_info(uuid) from public;
revoke all on function public.enviar_resena(uuid, int, text) from public;
grant execute on function public.agenda_publica() to anon, authenticated;
grant execute on function public.reservar_web(text, date, int, text, text, text, text) to anon, authenticated;
grant execute on function public.resena_info(uuid) to anon, authenticated;
grant execute on function public.enviar_resena(uuid, int, text) to anon, authenticated;

-- Datos iniciales (solo si la fila no existe)
insert into public.ajustes (id, perfil, servicios, agenda) values (1, '{}'::jsonb, '[{"id": "pap", "name": "Toma de PAP", "duration": 20, "price": "$18.000", "description": "Precio de noviembre. Desde los 25 años o al año de iniciar actividad sexual.", "active": true}, {"id": "vph", "name": "Test de VPH", "duration": 20, "price": "Consultar", "description": "Detección del virus papiloma humano.", "active": true}, {"id": "its", "name": "Test rápido de ITS", "duration": 30, "price": "Consultar", "description": "VIH, sífilis y hepatitis B, con resultado en la consulta.", "active": true}, {"id": "anticoncepcion", "name": "Consulta de anticoncepción", "duration": 40, "price": "Consultar", "description": "Te ayudo a elegir tu método y hacemos su control.", "active": true}, {"id": "gineco", "name": "Control ginecológico", "duration": 40, "price": "Consultar", "description": "Control integral y revisión de tus exámenes del año.", "active": true}, {"id": "ginecoestetica", "name": "Ginecoestética", "duration": 60, "price": "Consultar", "description": "Evaluación y tratamiento, con un enfoque integral.", "active": true}]'::jsonb, '{"weekly": {"0": [], "1": [[480, 1200]], "2": [[480, 1200]], "3": [[480, 1200]], "4": [[480, 1200]], "5": [[480, 1200]], "6": []}, "overrides": {}, "extras": [], "blocks": [], "seq": 1}'::jsonb) on conflict (id) do nothing;
