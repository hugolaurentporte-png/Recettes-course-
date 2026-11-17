import type { ScoredRecipe } from "./recommend";

/**
 * Tirage au sort d'une recette quand on n'a pas d'idée.
 * On tire de préférence parmi les recettes faisables ou presque (2 ingrédients manquants au plus),
 * s'il y en a assez pour que le hasard ait du sens ; sinon parmi toutes. On évite de retomber
 * sur la recette précédente.
 */
export function drawRecipe(pool: readonly ScoredRecipe[], previousId: string | null, rand: () => number = Math.random): ScoredRecipe | null {
  if (pool.length === 0) return null;
  const close = pool.filter((s) => s.availability.missingCount <= 2);
  const base = close.length >= 5 ? close : pool;
  const candidates = base.length > 1 ? base.filter((s) => s.recipe.id !== previousId) : base;
  return candidates[Math.floor(rand() * candidates.length)] ?? null;
}
