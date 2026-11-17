-- Liste de courses partagée (à coller une fois dans Supabase : SQL Editor → New query → Run).
-- Pas de compte : un foyer = un code secret long, partagé par lien. La table n'est lisible
-- et modifiable QUE par les deux fonctions ci-dessous, qui exigent le code.

create sequence if not exists courses_seq;

create table if not exists courses_items (
  foyer text not null,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  seq bigint not null default nextval('courses_seq'),
  primary key (foyer, id)
);
create index if not exists courses_items_foyer_seq on courses_items (foyer, seq);
alter table courses_items enable row level security;
revoke all on courses_items from anon, authenticated;

-- Envoie des articles ; le plus récent gagne (article par article).
create or replace function courses_push(p_foyer text, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_foyer is null or length(p_foyer) < 20 then raise exception 'code de foyer invalide'; end if;
  if jsonb_array_length(p_items) > 500 then raise exception 'trop d''articles'; end if;
  insert into courses_items as c (foyer, id, data, updated_at)
  select p_foyer, e->>'id', e, (e->>'updatedAt')::bigint from jsonb_array_elements(p_items) e
  on conflict (foyer, id) do update
    set data = excluded.data, updated_at = excluded.updated_at, seq = nextval('courses_seq')
    where excluded.updated_at > c.updated_at;
  -- Ménage : articles supprimés depuis plus de 30 jours.
  delete from courses_items
  where foyer = p_foyer and (data->>'deletedAt') is not null
    and (data->>'deletedAt')::bigint < (extract(epoch from now()) * 1000)::bigint - 30::bigint * 24 * 3600 * 1000;
end $$;

-- Récupère ce qui a changé depuis le dernier passage.
create or replace function courses_pull(p_foyer text, p_since bigint) returns table (data jsonb, seq bigint)
language sql stable security definer set search_path = public as $$
  select c.data, c.seq from courses_items c
  where c.foyer = p_foyer and c.seq > p_since and length(p_foyer) >= 20
  order by c.seq limit 1000;
$$;

revoke all on function courses_push(text, jsonb) from public;
revoke all on function courses_pull(text, bigint) from public;
grant execute on function courses_push(text, jsonb) to anon, authenticated;
grant execute on function courses_pull(text, bigint) to anon, authenticated;
