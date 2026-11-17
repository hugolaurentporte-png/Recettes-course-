-- Foyer partagé : frigo (et demain le planning) entre les téléphones d'un même foyer.
-- À coller une fois dans Supabase : SQL Editor → New query → Run. Peut être relancé sans risque.
--
-- Principe :
--  * Le foyer est identifié par le code déjà utilisé pour la liste de courses partagée
--    (voir partage.sql). Ce code sert UNIQUEMENT à rejoindre le foyer (lien ou code d'invitation).
--  * Chaque téléphone a sa propre clé secrète de membre, créée sur le téléphone et jamais affichée.
--    Le serveur n'en garde que l'empreinte (sha256).
--  * Pour lire ou modifier le frigo, il faut une clé de membre : le serveur en déduit le foyer.
--    Le téléphone ne choisit jamais le foyer qu'il lit ; une clé inconnue est refusée.
--  * Les tables ne sont accessibles que par les fonctions ci-dessous (RLS active, aucun droit direct).

create table if not exists foyers (
  id text primary key check (id ~ '^[a-z0-9]{20,64}$'),
  cree_le timestamptz not null default now()
);

create table if not exists foyer_membres (
  cle text primary key,                       -- sha256 (hex) de la clé secrète du téléphone
  foyer text not null references foyers (id) on delete cascade,
  nom text not null default '',
  rejoint_le timestamptz not null default now(),
  vu_le timestamptz not null default now()
);
create index if not exists foyer_membres_foyer on foyer_membres (foyer);

create sequence if not exists foyer_docs_seq;

-- Un document = un produit du frigo (kind 'frigo', id = ingrédient) ou un repas du planning (kind 'planning').
create table if not exists foyer_docs (
  foyer text not null references foyers (id) on delete cascade,
  kind text not null,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  seq bigint not null default nextval('foyer_docs_seq'),
  primary key (foyer, kind, id)
);
create index if not exists foyer_docs_seq_idx on foyer_docs (foyer, kind, seq);

alter table foyers enable row level security;
alter table foyer_membres enable row level security;
alter table foyer_docs enable row level security;
revoke all on foyers, foyer_membres, foyer_docs from public, anon, authenticated;
revoke all on sequence foyer_docs_seq from public, anon, authenticated;

-- ---------- Fonctions internes (non appelables depuis l'appli) ----------

create or replace function foyer_empreinte(p_cle text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_cle, 'UTF8')), 'hex');
$$;

-- Foyer du membre, ou erreur si la clé n'est membre d'aucun foyer.
create or replace function foyer_du_membre(p_membre text) returns text
language plpgsql stable security definer set search_path = public as $$
declare f text;
begin
  if p_membre is null or p_membre !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'clé de membre invalide' using errcode = '28000';
  end if;
  select m.foyer into f from foyer_membres m where m.cle = foyer_empreinte(p_membre);
  if f is null then
    raise exception 'ce téléphone n''est membre d''aucun foyer' using errcode = '42501';
  end if;
  return f;
end $$;

revoke all on function foyer_empreinte(text) from public, anon, authenticated;
revoke all on function foyer_du_membre(text) from public, anon, authenticated;

-- ---------- Fonctions appelées par l'appli ----------

-- Crée le foyer s'il n'existe pas encore, puis inscrit ce téléphone comme membre.
-- Un téléphone n'appartient qu'à un foyer à la fois : rejoindre un autre foyer quitte l'ancien.
create or replace function foyer_entrer(p_code text, p_membre text, p_nom text) returns void
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{20,64}$' then raise exception 'code de foyer invalide'; end if;
  if p_membre is null or p_membre !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'clé de membre invalide'; end if;
  h := foyer_empreinte(p_membre);
  insert into foyers (id) values (p_code) on conflict (id) do nothing;
  if (select count(*) from foyer_membres where foyer = p_code and cle <> h) >= 10 then
    raise exception 'ce foyer a déjà 10 téléphones';
  end if;
  insert into foyer_membres (cle, foyer, nom) values (h, p_code, left(coalesce(trim(p_nom), ''), 40))
  on conflict (cle) do update set foyer = excluded.foyer, nom = excluded.nom, vu_le = now();
end $$;

-- Ce téléphone quitte son foyer (le frigo partagé reste pour les autres membres).
create or replace function foyer_quitter(p_membre text) returns void
language sql security definer set search_path = public as $$
  delete from foyer_membres where cle = foyer_empreinte(p_membre);
$$;

-- Membres du foyer (prénom, date d'arrivée) : uniquement pour un membre.
create or replace function foyer_liste_membres(p_membre text)
returns table (nom text, rejoint_le timestamptz, moi boolean)
language plpgsql stable security definer set search_path = public as $$
declare f text := foyer_du_membre(p_membre);
begin
  return query
    select m.nom, m.rejoint_le, m.cle = foyer_empreinte(p_membre)
    from foyer_membres m where m.foyer = f order by m.rejoint_le;
end $$;

-- Envoie des documents ; document par document, le plus récent gagne.
create or replace function foyer_push(p_membre text, p_kind text, p_docs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare f text := foyer_du_membre(p_membre);
begin
  if p_kind is null or p_kind !~ '^[a-z]{1,20}$' then raise exception 'type de document invalide'; end if;
  if jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) > 500 then raise exception 'trop de documents'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_docs) e
    where coalesce(jsonb_typeof(e->'id'), '') <> 'string' or length(e->>'id') not between 1 and 200
       or coalesce(jsonb_typeof(e->'updatedAt'), '') <> 'number' or length(e::text) > 20000
  ) then
    raise exception 'document invalide';
  end if;

  insert into foyer_docs as d (foyer, kind, id, data, updated_at)
  select f, p_kind, e->>'id', e, (e->>'updatedAt')::bigint from jsonb_array_elements(p_docs) e
  on conflict (foyer, kind, id) do update
    set data = excluded.data, updated_at = excluded.updated_at, seq = nextval('foyer_docs_seq')
    where excluded.updated_at > d.updated_at;

  update foyer_membres set vu_le = now() where cle = foyer_empreinte(p_membre);

  -- Ménage : documents supprimés depuis plus de 30 jours.
  delete from foyer_docs
  where foyer = f and kind = p_kind and (data->>'deletedAt') is not null
    and (data->>'deletedAt')::bigint < (extract(epoch from now()) * 1000)::bigint - 30::bigint * 24 * 3600 * 1000;
end $$;

-- Récupère ce qui a changé depuis le dernier passage (seq).
create or replace function foyer_pull(p_membre text, p_kind text, p_since bigint)
returns table (data jsonb, seq bigint)
language plpgsql stable security definer set search_path = public as $$
declare f text := foyer_du_membre(p_membre);
begin
  return query
    select d.data, d.seq from foyer_docs d
    where d.foyer = f and d.kind = p_kind and d.seq > coalesce(p_since, 0)
    order by d.seq limit 1000;
end $$;

revoke all on function foyer_entrer(text, text, text) from public;
revoke all on function foyer_quitter(text) from public;
revoke all on function foyer_liste_membres(text) from public;
revoke all on function foyer_push(text, text, jsonb) from public;
revoke all on function foyer_pull(text, text, bigint) from public;
grant execute on function foyer_entrer(text, text, text) to anon, authenticated;
grant execute on function foyer_quitter(text) to anon, authenticated;
grant execute on function foyer_liste_membres(text) to anon, authenticated;
grant execute on function foyer_push(text, text, jsonb) to anon, authenticated;
grant execute on function foyer_pull(text, text, bigint) to anon, authenticated;
