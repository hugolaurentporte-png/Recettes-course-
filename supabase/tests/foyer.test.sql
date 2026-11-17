-- Vérifie les droits du foyer partagé. Base Postgres vide, rôles comme Supabase :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/foyer.test.sql
-- (crée les rôles anon/authenticated et les droits par défaut de Supabase, puis charge partage.sql et foyer.sql)
\set QUIET on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
-- Supabase accorde par défaut tous les droits sur les nouveaux objets de « public » à anon.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
\ir ../partage.sql
\ir ../foyer.sql
\ir ../foyer.sql

create or replace function pg_temp.doit_echouer(q text, attendu text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if position(attendu in sqlerrm) = 0 then raise exception 'mauvaise erreur pour % : %', q, sqlerrm; end if;
    return;
  end;
  raise exception 'aurait dû échouer : %', q;
end $$;

set role anon;
-- Hugo crée le foyer, Marie le rejoint avec le code ; Intrus n'a pas le code.
select foyer_entrer('abcdefghjkmnpqrstuvwxyz2', 'hugo-cle-secrete-0000000000000000000000', 'Hugo');
select foyer_entrer('abcdefghjkmnpqrstuvwxyz2', 'marie-cle-secrete-000000000000000000000', 'Marie');
select foyer_entrer('zzzzzzzzzzzzzzzzzzzzzzzz', 'intrus-cle-secrete-00000000000000000000', 'Intrus');

select foyer_push('hugo-cle-secrete-0000000000000000000000', 'frigo',
  '[{"id":"pomme-de-terre","updatedAt":9000000000100,"deletedAt":null,"item":{"quantity":3}}]');
select foyer_push('marie-cle-secrete-000000000000000000000', 'frigo',
  '[{"id":"oeuf","updatedAt":9000000000090,"deletedAt":null,"item":{"quantity":6}}]');
-- Hugo retire les pommes de terre (plus récent) ; une vieille version arrivée après ne l’écrase pas.
-- (dates en ms dans le futur pour ne pas être concernées par le ménage des suppressions de plus de 30 jours)
select foyer_push('hugo-cle-secrete-0000000000000000000000', 'frigo',
  '[{"id":"pomme-de-terre","updatedAt":9000000000200,"deletedAt":9000000000200,"item":null}]');
select foyer_push('marie-cle-secrete-000000000000000000000', 'frigo',
  '[{"id":"pomme-de-terre","updatedAt":9000000000150,"deletedAt":null,"item":{"quantity":3}}]');

do $$ declare n int; d jsonb; begin
  select count(*) into n from foyer_pull('marie-cle-secrete-000000000000000000000', 'frigo', 0);
  if n <> 2 then raise exception 'Marie devrait voir 2 produits, elle en voit %', n; end if;
  select data into d from foyer_pull('marie-cle-secrete-000000000000000000000', 'frigo', 0) where data->>'id' = 'pomme-de-terre';
  if d->>'deletedAt' is null then raise exception 'les pommes de terre devraient rester retirées'; end if;
  select count(*) into n from foyer_pull('intrus-cle-secrete-00000000000000000000', 'frigo', 0);
  if n <> 0 then raise exception 'un autre foyer voit le frigo de Hugo (%)', n; end if;
  select count(*) into n from foyer_liste_membres('hugo-cle-secrete-0000000000000000000000');
  if n <> 2 then raise exception '2 membres attendus, % trouvés', n; end if;
end $$;

-- Sans clé de membre valide : rien.
select pg_temp.doit_echouer($q$select * from foyer_pull('inconnue-000000000000000000000000000000', 'frigo', 0)$q$, 'membre');
select pg_temp.doit_echouer($q$select foyer_push('inconnue-000000000000000000000000000000', 'frigo', '[]')$q$, 'membre');
select pg_temp.doit_echouer($q$select * from foyer_pull('abcdefghjkmnpqrstuvwxyz2', 'frigo', 0)$q$, 'membre');
-- Accès direct aux tables et aux fonctions internes : refusé.
select pg_temp.doit_echouer('select * from foyer_docs', 'permission');
select pg_temp.doit_echouer('select * from foyer_membres', 'permission');
select pg_temp.doit_echouer('select * from foyers', 'permission');
select pg_temp.doit_echouer('insert into foyer_docs values (''x'',''frigo'',''x'',''{}'',1)', 'permission');
select pg_temp.doit_echouer('select * from courses_items', 'permission');
select pg_temp.doit_echouer($q$select foyer_du_membre('hugo-cle-secrete-0000000000000000000000')$q$, 'permission');
select pg_temp.doit_echouer($q$select foyer_empreinte('x')$q$, 'permission');
-- Données invalides.
select pg_temp.doit_echouer($q$select foyer_push('hugo-cle-secrete-0000000000000000000000', 'frigo', '[{"updatedAt":1}]')$q$, 'invalide');
select pg_temp.doit_echouer($q$select foyer_push('hugo-cle-secrete-0000000000000000000000', 'Frigo;', '[]')$q$, 'invalide');
select pg_temp.doit_echouer($q$select foyer_entrer('court', 'hugo-cle-secrete-0000000000000000000000', 'x')$q$, 'invalide');

-- Marie quitte le foyer : elle n'a plus accès.
select foyer_quitter('marie-cle-secrete-000000000000000000000');
select pg_temp.doit_echouer($q$select * from foyer_pull('marie-cle-secrete-000000000000000000000', 'frigo', 0)$q$, 'membre');
reset role;
\echo 'foyer.sql : tous les contrôles sont passés'
