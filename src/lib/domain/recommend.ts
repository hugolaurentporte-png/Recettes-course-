import type { Equipment, Ingredient, InventoryItem, Recipe } from "./types";
import { recipeAvailability, type RecipeAvailability } from "./availability";
import { itemKey, normalizeText } from "./normalize";
import { seasonLevel } from "../data/seasonality";

/** Pondérations initiales du score (à ajuster après essais). Total = 1. */
export const DEFAULT_WEIGHTS = {
  availability: 0.45,
  priority: 0.25,
  season: 0.15,
  time: 0.1,
  cooking: 0.05,
};
export type Weights = typeof DEFAULT_WEIGHTS;

export type TimeFilter = 15 | 30 | 45 | null;

export interface Filters {
  /** Contrainte stricte : temps total maximum. */
  maxMinutes: TimeFilter;
  /** Contrainte stricte : la recette doit utiliser au moins un de ces modes de cuisson. */
  modes: Equipment[];
  /** Contrainte stricte : équipement que l'utilisateur possède (les recettes exigeant autre chose sont exclues). */
  ownedEquipment: Equipment[] | null;
  /** Recherche texte : nom de recette ou ingrédient. */
  query: string;
  /** Uniquement les recettes réalisables tout de suite. */
  onlyReady?: boolean;
}

export const EMPTY_FILTERS: Filters = { maxMinutes: null, modes: [], ownedEquipment: null, query: "" };

export interface Context {
  inventory: ReadonlyMap<string, InventoryItem>;
  getIngredient: (id: string) => Ingredient | undefined;
  month: number;
  region?: string;
  /** Modes de cuisson préférés (léger bonus). */
  preferredModes?: Equipment[];
  weights?: Weights;
}

export interface ScoredRecipe {
  recipe: Recipe;
  availability: RecipeAvailability;
  /** Ingrédients prioritaires (« à utiliser rapidement ») utilisés par la recette. */
  priorityUsed: string[];
  /** Score de saisonnalité 0..1, null si la recette n'a aucun produit saisonnier. */
  season: number | null;
  /** Tous les fruits et légumes saisonniers de la recette sont de saison. */
  inSeason: boolean;
  score: number;
  breakdown: Record<keyof Weights, number>;
}

export function recipeModes(recipe: Recipe): Equipment[] {
  return recipe.equipment.filter((e) => e.required).map((e) => e.type);
}

export function seasonScore(recipe: Recipe, month: number, region?: string): number | null {
  const levels = recipe.ingredients
    .map((l) => seasonLevel(l.ingredientId, month, region))
    .filter((l): l is 0 | 1 | 2 => l !== null);
  if (levels.length === 0) return null;
  return levels.reduce<number>((s, l) => s + l / 2, 0) / levels.length;
}

/** Applique les filtres stricts. Le score ne sert qu'à classer ce qui reste. */
export function matchesFilters(recipe: Recipe, filters: Filters, getIngredient: Context["getIngredient"]): boolean {
  if (!recipe.published) return false;
  if (filters.maxMinutes !== null && recipe.totalMinutes > filters.maxMinutes) return false;
  const required = recipeModes(recipe);
  if (filters.modes.length > 0 && !filters.modes.some((m) => required.includes(m))) return false;
  if (filters.ownedEquipment) {
    const owned = new Set<Equipment>([...filters.ownedEquipment, "sans-cuisson"]);
    if (required.some((m) => !owned.has(m))) return false;
  }
  const q = normalizeText(filters.query);
  if (q) {
    // Sans accents, et au singulier comme au pluriel (« quenelle » = « quenelles »).
    const k = itemKey(filters.query);
    const has = (text: string) => normalizeText(text).includes(q) || itemKey(text).includes(k);
    const inTitle = has(recipe.title);
    const inIngredients = recipe.ingredients.some((l) => {
      const ing = getIngredient(l.ingredientId);
      return ing && (has(ing.normalizedName) || ing.aliases.some(has));
    });
    const inTags = recipe.tags.some(has);
    if (!inTitle && !inIngredients && !inTags) return false;
  }
  return true;
}

export function scoreRecipe(recipe: Recipe, ctx: Context): ScoredRecipe {
  const w = ctx.weights ?? DEFAULT_WEIGHTS;
  const availability = recipeAvailability(recipe, ctx.inventory, ctx.getIngredient);

  const priorityIds = [...ctx.inventory.values()].filter((i) => i.priority).map((i) => i.ingredientId);
  const priorityUsed = recipe.ingredients.map((l) => l.ingredientId).filter((id) => priorityIds.includes(id));
  const priority = priorityUsed.length === 0 ? 0 : Math.min(1, 0.6 + 0.4 * (priorityUsed.length / priorityIds.length));

  const season = seasonScore(recipe, ctx.month, ctx.region);
  const levels = recipe.ingredients
    .map((l) => seasonLevel(l.ingredientId, ctx.month, ctx.region))
    .filter((l) => l !== null);
  const inSeason = levels.length > 0 && levels.every((l) => l === 2);

  // Plus c'est court, mieux c'est (plafonné à 2 h).
  const time = Math.max(0, 1 - recipe.totalMinutes / 120);
  const preferred = ctx.preferredModes ?? [];
  const cooking = preferred.length === 0 ? 0.5 : recipeModes(recipe).some((m) => preferred.includes(m)) ? 1 : 0;

  // La disponibilité pénalise fortement chaque ingrédient manquant.
  const avail = availability.coverage * (availability.missingCount === 0 ? 1 : 0.8);

  const breakdown = {
    availability: avail * w.availability,
    priority: priority * w.priority,
    season: (season ?? 0.5) * w.season,
    time: time * w.time,
    cooking: cooking * w.cooking,
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { recipe, availability, priorityUsed, season, inSeason, score, breakdown };
}

/**
 * Classement final. Les recettes réalisables immédiatement passent toujours devant,
 * puis celles où il manque 1, 2, puis 3 ingrédients ou plus ; le score départage.
 * Si le stock est vide, tout est au même niveau et le score (saison, temps) décide.
 */
export function rankRecipes(recipes: readonly Recipe[], filters: Filters, ctx: Context): ScoredRecipe[] {
  return recipes
    .filter((r) => matchesFilters(r, filters, ctx.getIngredient))
    .map((r) => scoreRecipe(r, ctx))
    .filter((s) => !filters.onlyReady || s.availability.allAvailable)
    .sort(
      (a, b) =>
        a.availability.bucket - b.availability.bucket ||
        b.score - a.score ||
        a.recipe.totalMinutes - b.recipe.totalMinutes ||
        a.recipe.title.localeCompare(b.recipe.title, "fr"),
    );
}
