-- =====================================================================
-- Agenda online · Solis media · consentimiento de datos al reservar
-- Pegar en Supabase > SQL Editor > Run. Se puede re-ejecutar.
-- =====================================================================
alter table public.reservas add column if not exists consentimiento_at timestamptz;

-- La versión anterior (7 parámetros) se reemplaza por esta, que exige el consentimiento
drop function if exists public.reservar_web(text, date, int, text, text, text, text);

create or replace function public.reservar_web(
  p_service text, p_date date, p_start int, p_name text, p_email text, p_phone text, p_note text,
  p_consent boolean default null)
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
  if coalesce(p_consent, false) = false then raise exception 'CONSENTIMIENTO' using errcode = 'P0001'; end if;
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
  insert into reservas (service_id, date, start_min, end_min, name, email, phone, note, source, consentimiento_at)
  values (p_service, p_date, p_start, fin, trim(p_name), trim(p_email),
          nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_note,'')),''), 'web', now())
  returning * into nueva;
  return jsonb_build_object('ok', true, 'token', nueva.token);
end $$;

revoke all on function public.reservar_web(text, date, int, text, text, text, text, boolean) from public;
grant execute on function public.reservar_web(text, date, int, text, text, text, text, boolean) to anon, authenticated;
