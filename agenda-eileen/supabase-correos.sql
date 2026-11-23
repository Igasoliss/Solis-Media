-- =====================================================================
-- Agenda online · Solis media · correos automáticos (Resend)
-- Pegar en Supabase > SQL Editor > Run, después de supabase.sql.
-- Se puede re-ejecutar.
-- =====================================================================

-- Marcas para no enviar el mismo correo dos veces
alter table public.reservas add column if not exists confirm_sent_at   timestamptz;
alter table public.reservas add column if not exists reminder_sent_at  timestamptz;
alter table public.reservas add column if not exists review_sent_at    timestamptz;
alter table public.reservas add column if not exists cancel_notified_at timestamptz;
alter table public.reservas add column if not exists cancelled_at      timestamptz;

-- Las reservas que ya existían no reciben correos (eran pruebas)
update public.reservas set confirm_sent_at = coalesce(confirm_sent_at, now()),
  reminder_sent_at = coalesce(reminder_sent_at, now()), review_sent_at = coalesce(review_sent_at, now()),
  cancel_notified_at = coalesce(cancel_notified_at, now())
 where created_at < now() and confirm_sent_at is null;

-- Datos para la página de cancelar (sin datos personales más allá del nombre)
create or replace function public.cancelar_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', split_part(r.name, ' ', 1), 'date', r.date, 'start_min', r.start_min,
    'service_id', r.service_id, 'status', r.status,
    'puede', r.status = 'confirmed' and (r.date + make_interval(mins => r.start_min)) > (now() at time zone 'America/Santiago'))
    from reservas r where r.token = p_token;
$$;

-- La paciente cancela con el enlace de su correo (hasta la hora de inicio)
create or replace function public.cancelar_web(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r reservas;
begin
  select * into r from reservas where token = p_token for update;
  if r.id is null then raise exception 'NOENCONTRADA' using errcode = 'P0001'; end if;
  if r.status = 'cancelled' then return jsonb_build_object('ok', true, 'ya', true); end if;
  if (r.date + make_interval(mins => r.start_min)) <= (now() at time zone 'America/Santiago') then
    raise exception 'PASADA' using errcode = 'P0001';
  end if;
  update reservas set status = 'cancelled', cancelled_at = now() where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cancelar_info(uuid) from public;
revoke all on function public.cancelar_web(uuid) from public;
grant execute on function public.cancelar_info(uuid) to anon, authenticated;
grant execute on function public.cancelar_web(uuid) to anon, authenticated;

-- Cada 15 minutos: recordatorios (24 h antes) y pedidos de reseña (2 h después)
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'agenda-correos') then
    perform cron.unschedule('agenda-correos');
  end if;
end $$;
select cron.schedule('agenda-correos', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://xpwscuxzbojgzoolllto.supabase.co/functions/v1/correos',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_sOqXkn77H_IqVfqULZ4jZQ_753H1bnG"}'::jsonb,
    body := '{"tipo":"programados"}'::jsonb);
$cron$);
