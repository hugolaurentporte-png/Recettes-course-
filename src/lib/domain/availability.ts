import type { Amount, Ingredient, InventoryItem, Recipe, RecipeIngredient } from "./types";
import { convert, scaleQuantity, sumAmounts } from "./units";

/**
 * Résultat du calcul de manque pour UN ingrédient, éventuellement demandé par plusieurs recettes.
 * - missing : quantités manquantes (vide si rien ne manque ou si on ne peut pas le calculer)
 * - toVerify : on a du stock mais on ne peut pas comparer (quantité inconnue ou unités incompatibles)
 * - absent : l'ingrédient n'est pas du tout dans le stock
 */
export interface MissingResult {
  missing: Amount[];
  toVerify: boolean;
  absent: boolean;
  /** Au moins un besoin sans quantité (« selon le goût ») alors que l'ingrédient est absent. */
  unquantified: boolean;
}

/**
 * Calcule ce qui manque pour un ingrédient.
 * Les besoins sont d'abord additionnés, puis le stock est soustrait UNE SEULE FOIS.
 * (Additionner les manques recette par recette compterait le stock plusieurs fois.)
 */
export function computeMissing(
  needs: (Amount | null)[],
  stock: InventoryItem | undefined,
  ingredient?: Ingredient,
): MissingResult {
  const quantified = needs.filter((n): n is Amount => n !== null);
  const hasUnquantified = quantified.length < needs.length;

  if (!stock) {
    return {
      missing: sumAmounts(quantified),
      toVerify: false,
      absent: true,
      unquantified: hasUnquantified,
    };
  }

  // Le stock existe. Sans quantité connue, on ne peut rien affirmer : « à vérifier »,
  // sauf si aucun besoin n'est chiffré (sel, poivre…) : alors c'est disponible.
  if (stock.quantity === null || stock.unit === null) {
    return { missing: [], toVerify: quantified.length > 0, absent: false, unquantified: false };
  }

  const stockAmount: Amount = { value: stock.quantity, unit: stock.unit };
  const totals = sumAmounts(quantified);
  const missing: Amount[] = [];
  let toVerify = false;
  let stockUsed = false;

  for (const total of totals) {
    const available = stockUsed ? null : convert(stockAmount, total.unit, ingredient);
    if (available === null) {
      // Pas d'équivalence documentée entre l'unité du stock et celle du besoin.
      toVerify = true;
      continue;
    }
    stockUsed = true;
    const diff = Math.round((total.value - available) * 1000) / 1000;
    if (diff > 0) missing.push({ value: diff, unit: total.unit });
  }

  return { missing, toVerify, absent: false, unquantified: false };
}

export type LineStatus = "ok" | "verify" | "insufficient" | "missing";

export interface LineAvailability {
  line: RecipeIngredient;
  ingredient: Ingredient | undefined;
  /** Quantité nécessaire pour le nombre de portions demandé. */
  need: Amount | null;
  status: LineStatus;
  missing: Amount[];
}

export interface RecipeAvailability {
  lines: LineAvailability[];
  /** Ingrédients obligatoires manquants ou en quantité insuffisante. */
  missingCount: number;
  /** Ingrédients présents dont la quantité est à vérifier. */
  verifyCount: number;
  /** true uniquement si aucune quantité connue n'est insuffisante et rien ne manque. */
  allAvailable: boolean;
  /** 0 = réalisable, 1, 2, 3 = « 3 ou plus ». */
  bucket: 0 | 1 | 2 | 3;
  /** Proportion des ingrédients obligatoires couverts (0..1), pour le score. */
  coverage: number;
}

export function scaledNeed(line: RecipeIngredient, recipeServings: number, servings: number): Amount | null {
  if (line.quantity === null || line.unit === null) return null;
  return { value: scaleQuantity(line.quantity, line.unit, recipeServings, servings), unit: line.unit };
}

export function recipeAvailability(
  recipe: Recipe,
  inventory: ReadonlyMap<string, InventoryItem>,
  getIngredient: (id: string) => Ingredient | undefined,
  servings = recipe.servings,
): RecipeAvailability {
  const lines: LineAvailability[] = recipe.ingredients.map((line) => {
    const ingredient = getIngredient(line.ingredientId);
    const need = scaledNeed(line, recipe.servings, servings);
    const stock = inventory.get(line.ingredientId);
    const r = computeMissing([need], stock, ingredient);
    let status: LineStatus;
    if (r.absent) status = "missing";
    else if (r.missing.length > 0) status = "insufficient";
    // Indispensables possédés sans quantité (beurre, huile…) : on fait confiance à l'utilisateur.
    else if (r.toVerify && !(ingredient?.staple && stock?.quantity === null)) status = "verify";
    else status = "ok";
    return { line, ingredient, need, status, missing: r.missing };
  });

  const required = lines.filter((l) => !l.line.optional);
  const missingCount = required.filter((l) => l.status === "missing" || l.status === "insufficient").length;
  const verifyCount = required.filter((l) => l.status === "verify").length;
  const covered = required.filter((l) => l.status === "ok" || l.status === "verify").length;
  const coverage = required.length === 0 ? 1 : covered / required.length;

  return {
    lines,
    missingCount,
    verifyCount,
    allAvailable: missingCount === 0,
    bucket: (Math.min(missingCount, 3) as 0 | 1 | 2 | 3),
    coverage,
  };
}

