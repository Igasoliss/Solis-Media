-- =====================================================================
-- Agenda online · Solis media · opiniones visibles en la página de reservas
-- Pegar en Supabase > SQL Editor > Run. Se puede re-ejecutar.
-- Muestra el promedio de TODAS las reseñas y, como testimonios, solo las de
-- 4 o 5 estrellas que tienen comentario (las 50 más recientes). Solo el nombre de pila y la
-- inicial del apellido, nunca correo ni teléfono.
-- =====================================================================
create or replace function public.resenas_publicas()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from resenas),
    'promedio', (select round(avg(rating)::numeric, 1) from resenas),
    'items', coalesce((
      select jsonb_agg(x order by x.creada desc) from (
        select initcap(split_part(trim(r.name), ' ', 1))
                 || case when split_part(trim(r.name), ' ', 2) <> ''
                         then ' ' || upper(left(split_part(trim(r.name), ' ', 2), 1)) || '.' else '' end as nombre,
               s.rating, s.comment, s.created_at as creada
          from resenas s join reservas r on r.id = s.booking_id
         where s.rating >= 4 and coalesce(trim(s.comment), '') <> ''
         order by s.created_at desc
         limit 50) x), '[]'::jsonb)
  );
$$;

revoke all on function public.resenas_publicas() from public;
grant execute on function public.resenas_publicas() to anon, authenticated;
