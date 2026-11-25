-- =====================================================================
-- Agenda online · Solís Media · plan y suscripción del profesional
-- Pegar en Supabase > SQL Editor > Run. Se puede re-ejecutar.
-- Una sola fila (id = 1). La profesional solo la puede LEER desde su panel.
-- La edita Solís Media desde Supabase (Table Editor o SQL), y más adelante
-- un webhook de Mercado Pago.
--
-- plan:   agenda | landing_admin | pack | todo
-- estado: prueba | activa | pendiente | vencida | cancelada
-- =====================================================================
create table if not exists public.suscripcion (
  id int primary key default 1 check (id = 1),
  plan text not null default 'agenda'
    check (plan in ('agenda','landing_admin','pack','todo')),
  estado text not null default 'prueba'
    check (estado in ('prueba','activa','pendiente','vencida','cancelada')),
  desde date,
  proximo_cobro date,
  monto int,
  link_pago text,
  nota text,
  actualizado_at timestamptz not null default now()
);

alter table public.suscripcion enable row level security;
drop policy if exists suscripcion_admin_lee on public.suscripcion;
create policy suscripcion_admin_lee on public.suscripcion
  for select to authenticated using (public.es_admin());
revoke insert, update, delete on public.suscripcion from anon, authenticated;
grant select on public.suscripcion to authenticated;

-- Fila inicial: período de prueba del plan Agenda (no se cobra nada todavía).
insert into public.suscripcion (id, plan, estado, desde, monto)
values (1, 'agenda', 'prueba', current_date, 24990)
on conflict (id) do nothing;

-- Ejemplo para activar el plan cuando la clienta pague:
-- update public.suscripcion set estado = 'activa', plan = 'agenda', monto = 24990,
--   desde = current_date, proximo_cobro = current_date + interval '1 month',
--   actualizado_at = now() where id = 1;
