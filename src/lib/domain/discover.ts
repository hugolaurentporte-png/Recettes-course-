import type { Ingredient, InventoryItem } from "./types";
import type { ScoredRecipe } from "./recommend";
import { mealClass } from "./meal";
import { seasonLevel } from "../data/seasonality";

/**
 * « À découvrir » (planning) : des idées de plat pour le soir, d'après le frigo et la saison.
 * La liste reçue est déjà classée (frigo d'abord) et sans les recettes « pas pour nous ».
 * Fonctions pures, testées.
 */

export interface Idea {
  s: ScoredRecipe;
  /** Fruits et légumes de pleine saison utilisés par la recette (noms). */
  seasonal: string[];
  /** Produits du frigo utilisés par la recette, en commençant par ceux à finir vite (noms). */
  fromFridge: string[];
}

export interface Discoveries {
  /** Faisables tout de suite ou presque (2 ingrédients manquants au plus, souvent sel ou bouillon). */
  fridge: Idea[];
  /** De saison, même s'il faut passer au magasin (où il manque le moins de choses). */
  season: Idea[];
  /** Parmi quoi tirer au sort : tous les plats du soir proposables. */
  pool: ScoredRecipe[];
  /** Fruits et légumes de saison ce mois-ci : d'abord ceux qu'on a dans le frigo. */
  seasonalNow: { id: string; name: string; inFridge: boolean }[];
}

export interface DiscoverContext {
  month: number;
  inventory: ReadonlyMap<string, InventoryItem>;
  getIngredient: (id: string) => Ingredient | undefined;
  /** Recettes déjà prévues au planning : pas la peine de les reproposer. */
  plannedIds?: ReadonlySet<string>;
  /** Nombre d'idées par rubrique. */
  size?: number;
  /** Liste des fruits et légumes de saison (injectée pour les tests). */
  inSeason: readonly string[];
}

/** Pourquoi cette idée : produits du frigo et légumes de saison qu'elle utilise. */
export function describeIdea(s: ScoredRecipe, ctx: Pick<DiscoverContext, "month" | "inventory" | "getIngredient">): Idea {
  const ids = [...new Set(s.recipe.ingredients.map((l) => l.ingredientId))];
  const name = (id: string) => ctx.getIngredient(id)?.name ?? id;
  const seasonal = ids.filter((id) => seasonLevel(id, ctx.month) === 2).map(name);
  const owned = ids.filter((id) => ctx.inventory.has(id) && !ctx.getIngredient(id)?.staple);
  const priority = owned.filter((id) => ctx.inventory.get(id)?.priority);
  const fromFridge = [...priority, ...owned.filter((id) => !priority.includes(id))].map(name);
  return { s, seasonal, fromFridge };
}

/**
 * Garde des idées variées : pas deux recettes avec les mêmes légumes de saison, ni deux plats du même type
 * (soupe, gratin…) autour du même produit principal. Ordre conservé.
 */
export function pickVaried(ideas: readonly Idea[], size: number, seen = new Set<string>()): Idea[] {
  const out: Idea[] = [];
  for (const i of ideas) {
    if (out.length >= size) break;
    const main = i.fromFridge[0] ?? i.seasonal[0] ?? i.s.recipe.id;
    const keys = [`s:${[...i.seasonal].sort().join(",")}`, `t:${mealClass(i.s.recipe).plat?.[0] ?? ""}:${main}`];
    if (i.seasonal.length === 0) keys.shift();
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(i);
  }
  return out;
}

export function discover(ranked: readonly ScoredRecipe[], ctx: DiscoverContext): Discoveries {
  const size = ctx.size ?? 4;
  const planned = ctx.plannedIds ?? new Set<string>();
  // Un vrai plat pour le soir : pas un simple accompagnement (purée, pommes de terre rôties…).
  const isDinner = (types: string[] | undefined) => !!types && types.some((t) => t !== "accompagnement");
  const pool = ranked.filter((s) => isDinner(mealClass(s.recipe).plat) && !planned.has(s.recipe.id));
  const ideas = pool.map((s) => describeIdea(s, ctx));

  // Frigo : le classement met déjà les recettes faisables devant ; à égalité, celles qui finissent les produits
  // « à utiliser vite », puis celles de saison.
  const fridge = ideas
    .filter((i) => i.s.availability.missingCount <= 2 && i.fromFridge.length > 0)
    .sort(
      (a, b) =>
        a.s.availability.missingCount - b.s.availability.missingCount ||
        b.s.priorityUsed.length - a.s.priorityUsed.length ||
        b.seasonal.length - a.seasonal.length ||
        b.s.score - a.s.score,
    );
  const seen = new Set<string>();
  const fridgePicks = pickVaried(fridge, size, seen);

  const taken = new Set(fridgePicks.map((i) => i.s.recipe.id));
  // Saison : de préférence à 2 ingrédients manquants au plus ; frigo vide ou presque, on prend celles où il manque le moins.
  const seasonal = ideas.filter((i) => !taken.has(i.s.recipe.id) && i.s.inSeason && i.seasonal.length > 0);
  const close = seasonal.filter((i) => i.s.availability.missingCount <= 2);
  const season = (close.length >= size ? close : seasonal)
    .sort(
      (a, b) =>
        a.s.availability.missingCount - b.s.availability.missingCount ||
        b.seasonal.length - a.seasonal.length ||
        b.s.score - a.s.score,
    );
  const seasonPicks = pickVaried(season, size, seen);

  const seasonalNow = ctx.inSeason
    .map((id) => ({ id, name: ctx.getIngredient(id)?.name ?? id, inFridge: ctx.inventory.has(id) }))
    .filter((x) => ctx.getIngredient(x.id))
    .sort((a, b) => Number(b.inFridge) - Number(a.inFridge) || a.name.localeCompare(b.name, "fr"));

  return { fridge: fridgePicks, season: seasonPicks, pool, seasonalNow };
}

/** « potimarron, poireau et carotte » */
export function listFr(names: readonly string[], max = 3): string {
  const n = names.slice(0, max).map((x) => x.toLowerCase());
  if (names.length > max) return `${n.join(", ")}…`;
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`;
}
