-- Schéma Supabase (PostgreSQL) pour la future synchronisation.
-- ⚠️ NON APPLIQUÉ : à exécuter seulement après validation, sur un projet Supabase dédié.
-- La V1 fonctionne sans compte : tout est dans le navigateur (IndexedDB) avec les mêmes champs.

create extension if not exists "pgcrypto";

-- ---------- Catalogue (public, lecture seule pour les utilisateurs) ----------
create table ingredients (
  id text primary key,
  name text not null,
  normalized_name text not null,
  category text not null,
  default_unit text not null check (default_unit in ('g','kg','ml','cl','l','piece','cc','cs','pincee')),
  aliases text[] not null default '{}',
  staple boolean not null default false,
  piece_grams numeric check (piece_grams > 0)
);
create index ingredients_normalized_name_idx on ingredients (normalized_name);

create table recipes (
  id text primary key,
  title text not null,
  description text not null default '',
  image_url text,
  prep_minutes int not null check (prep_minutes > 0),
  cook_minutes int not null check (cook_minutes >= 0),
  total_minutes int not null,
  servings int not null check (servings > 0),
  instructions text[] not null check (cardinality(instructions) >= 3),
  tags text[] not null default '{}',
  published boolean not null default false,
  check (total_minutes >= prep_minutes + cook_minutes)
);
create index recipes_published_total_idx on recipes (published, total_minutes);

create table recipe_ingredients (
  recipe_id text not null references recipes(id) on delete cascade,
  ingredient_id text not null references ingredients(id),
  quantity numeric check (quantity > 0),
  unit text check (unit in ('g','kg','ml','cl','l','piece','cc','cs','pincee')),
  optional boolean not null default false,
  primary key (recipe_id, ingredient_id),
  check ((quantity is null) = (unit is null))
);
create index recipe_ingredients_ingredient_idx on recipe_ingredients (ingredient_id);

create table recipe_equipment (
  recipe_id text not null references recipes(id) on delete cascade,
  equipment_type text not null check (equipment_type in ('four','poele','casserole','cocotte','airfryer','sans-cuisson')),
  required boolean not null default true,
  primary key (recipe_id, equipment_type)
);

create table ingredient_seasonality (
  ingredient_id text not null references ingredients(id) on delete cascade,
  region text not null default 'FR-METRO',
  month smallint not null check (month between 1 and 12),
  seasonality_level smallint not null check (seasonality_level between 0 and 2),
  primary key (ingredient_id, region, month)
);

-- ---------- Foyers (synchronisation familiale) ----------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon foyer',
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  primary key (household_id, user_id)
);
create index household_members_user_idx on household_members (user_id);

create or replace function is_household_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members m where m.household_id = h and m.user_id = auth.uid());
$$;

-- ---------- Données personnelles ----------
create table user_inventory (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  ingredient_id text not null references ingredients(id),
  quantity numeric check (quantity > 0),
  unit text check (unit in ('g','kg','ml','cl','l','piece','cc','cs','pincee')),
  priority boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (household_id, ingredient_id),
  check ((quantity is null) = (unit is null))
);

-- Une liste par foyer pour commencer ; plusieurs listes possibles plus tard.
create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null default 'Courses'
);

-- Même forme que ShoppingItem côté application (src/lib/domain/types.ts).
create table shopping_items (
  id uuid primary key,                       -- généré sur l'appareil : création hors ligne possible
  list_id uuid not null references shopping_lists(id) on delete cascade,
  ingredient_id text references ingredients(id),   -- facultatif : articles libres
  custom_name text not null check (length(trim(custom_name)) > 0),
  key text not null,                          -- clé de regroupement des doublons
  aisle text not null,
  aisle_locked boolean not null default false,
  manual_quantity numeric check (manual_quantity > 0),
  manual_unit text,
  recipe_needs jsonb not null default '[]',   -- [{recipeId, recipeTitle, quantity, unit}]
  recipe_missing jsonb not null default '[]', -- [{value, unit}]
  to_verify boolean not null default false,
  note text not null default '',
  checked boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),  -- « dernier qui écrit gagne » article par article
  deleted_at timestamptz,                         -- suppression douce, propagée aux autres appareils
  updated_by text not null                        -- identifiant de l'appareil
);
create index shopping_items_list_updated_idx on shopping_items (list_id, updated_at);
create index shopping_items_list_open_idx on shopping_items (list_id) where deleted_at is null and not checked;

create table shopping_trips (
  id uuid primary key,
  list_id uuid not null references shopping_lists(id) on delete cascade,
  finished_at timestamptz not null,
  items jsonb not null
);

-- ---------- Sécurité (RLS) ----------
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_equipment enable row level security;
alter table ingredient_seasonality enable row level security;
create policy "catalogue lisible" on ingredients for select using (true);
create policy "recettes publiées lisibles" on recipes for select using (published);
create policy "ingrédients de recettes lisibles" on recipe_ingredients for select using (true);
create policy "équipement lisible" on recipe_equipment for select using (true);
create policy "saisonnalité lisible" on ingredient_seasonality for select using (true);

alter table households enable row level security;
alter table household_members enable row level security;
alter table user_inventory enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_items enable row level security;
alter table shopping_trips enable row level security;

create policy "voir mon foyer" on households for select using (is_household_member(id));
create policy "voir les membres de mon foyer" on household_members for select using (is_household_member(household_id));
create policy "inventaire du foyer" on user_inventory for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "listes du foyer" on shopping_lists for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "articles du foyer" on shopping_items for all
  using (exists (select 1 from shopping_lists l where l.id = list_id and is_household_member(l.household_id)))
  with check (exists (select 1 from shopping_lists l where l.id = list_id and is_household_member(l.household_id)));
create policy "historique du foyer" on shopping_trips for all
  using (exists (select 1 from shopping_lists l where l.id = list_id and is_household_member(l.household_id)))
  with check (exists (select 1 from shopping_lists l where l.id = list_id and is_household_member(l.household_id)));
