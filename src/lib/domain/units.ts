import type { Amount, Dimension, Ingredient, Unit } from "./types";

interface UnitInfo {
  dimension: Dimension;
  /** Facteur vers l'unité de base de la dimension (g, ml, pièce, cc, pincée). */
  toBase: number;
  label: string;
  plural: string;
}

export const UNITS: Record<Unit, UnitInfo> = {
  g: { dimension: "mass", toBase: 1, label: "g", plural: "g" },
  kg: { dimension: "mass", toBase: 1000, label: "kg", plural: "kg" },
  ml: { dimension: "volume", toBase: 1, label: "ml", plural: "ml" },
  cl: { dimension: "volume", toBase: 10, label: "cl", plural: "cl" },
  l: { dimension: "volume", toBase: 1000, label: "l", plural: "l" },
  piece: { dimension: "count", toBase: 1, label: "pièce", plural: "pièces" },
  cc: { dimension: "spoon", toBase: 1, label: "c. à café", plural: "c. à café" },
  cs: { dimension: "spoon", toBase: 3, label: "c. à soupe", plural: "c. à soupe" },
  pincee: { dimension: "pinch", toBase: 1, label: "pincée", plural: "pincées" },
};

/** Unités proposées dans les formulaires (les plus courantes d'abord). */
export const EDITABLE_UNITS: Unit[] = ["piece", "g", "kg", "ml", "cl", "l", "cs", "cc"];

export const BASE_UNIT: Record<Dimension, Unit> = {
  mass: "g",
  volume: "ml",
  count: "piece",
  spoon: "cc",
  pinch: "pincee",
};

export function dimensionOf(unit: Unit): Dimension {
  return UNITS[unit].dimension;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Convertit une quantité vers l'unité de base de sa dimension.
 * Si un ingrédient a un poids par pièce documenté, les pièces peuvent être exprimées en grammes
 * (option `piecesAsGrams`), jamais l'inverse sans équivalence.
 */
export function toBase(amount: Amount, ingredient?: Ingredient, piecesAsGrams = false): Amount {
  if (amount.unit === "piece" && piecesAsGrams && ingredient?.pieceGrams) {
    return { value: round(amount.value * ingredient.pieceGrams), unit: "g" };
  }
  const info = UNITS[amount.unit];
  return { value: round(amount.value * info.toBase), unit: BASE_UNIT[info.dimension] };
}

/**
 * Convertit `amount` dans l'unité `target`. Renvoie null si les unités ne sont pas compatibles
 * (ex. pièces -> grammes sans équivalence documentée).
 */
export function convert(amount: Amount, target: Unit, ingredient?: Ingredient): number | null {
  const from = UNITS[amount.unit];
  const to = UNITS[target];
  if (from.dimension === to.dimension) return round((amount.value * from.toBase) / to.toBase);
  if (ingredient?.pieceGrams) {
    if (amount.unit === "piece" && to.dimension === "mass") {
      return round((amount.value * ingredient.pieceGrams) / to.toBase);
    }
    if (from.dimension === "mass" && target === "piece") {
      return round((amount.value * from.toBase) / ingredient.pieceGrams);
    }
  }
  return null;
}

export function areCompatible(a: Unit, b: Unit, ingredient?: Ingredient): boolean {
  return convert({ value: 1, unit: a }, b, ingredient) !== null;
}

/** Choisit l'unité la plus lisible : 1500 g -> 1,5 kg ; 250 ml -> 25 cl reste 250 ml. */
export function humanize(amount: Amount): Amount {
  const base = toBase(amount);
  if (base.unit === "g" && base.value >= 1000) return { value: round(base.value / 1000), unit: "kg" };
  if (base.unit === "ml" && base.value >= 1000) return { value: round(base.value / 1000), unit: "l" };
  if (amount.unit === "cl") return base;
  // Des cuillères à soupe restent en cuillères à soupe, même ¾ (et non « 2,25 c. à café »).
  if (amount.unit === "cs") return amount;
  if (base.unit === "cc" && base.value >= 3 && base.value % 3 === 0) return { value: base.value / 3, unit: "cs" };
  return base;
}

const FRACTIONS: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"]];

/** « ½ », « 1 ½ », sinon null : réservé aux pièces et aux cuillères, où l'on parle en fractions. */
function asFraction(n: number): string | null {
  const whole = Math.floor(n);
  const rest = Math.round((n - whole) * 100) / 100;
  const f = FRACTIONS.find(([v]) => v === rest);
  if (!f) return null;
  return whole ? `${whole} ${f[1]}` : f[1];
}

export function formatNumber(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function formatAmount(amount: Amount): string {
  const h = humanize(amount);
  const info = UNITS[h.unit];
  const label = h.value > 1 ? info.plural : info.label;
  const fraction = h.unit === "piece" || h.unit === "cs" || h.unit === "cc" ? asFraction(h.value) : null;
  return `${fraction ?? formatNumber(h.value)} ${label}`;
}

/** Pour la liste des ingrédients d'une recette : « 1 ½ oignons » plutôt que « 1 ½ pièces oignons ». */
export function formatRecipeAmount(amount: Amount): string {
  if (amount.unit !== "piece") return formatAmount(amount);
  return formatAmount(amount).replace(/ pièces?$/, "");
}

/**
 * Additionne des quantités : celles de même dimension sont fusionnées,
 * les autres restent séparées (ex. « 2 pièces + 300 g »).
 */
export function sumAmounts(amounts: Amount[]): Amount[] {
  const byDim = new Map<Dimension, number>();
  for (const a of amounts) {
    const b = toBase(a);
    const dim = dimensionOf(b.unit);
    byDim.set(dim, round((byDim.get(dim) ?? 0) + b.value));
  }
  return [...byDim.entries()].map(([dim, value]) => ({ value, unit: BASE_UNIT[dim] }));
}

/** Arrondi « de cuisine » pour l'ajustement des portions. */
export function roundForCooking(value: number, unit: Unit): number {
  if (unit === "piece") {
    // On arrondit au demi : 1,5 œuf reste lisible, 1,33 non.
    return Math.max(0.5, Math.round(value * 2) / 2);
  }
  if (unit === "g" || unit === "ml") {
    if (value >= 1000) return Math.round(value / 50) * 50;
    if (value >= 100) return Math.round(value / 5) * 5;
    return Math.max(1, Math.round(value));
  }
  if (unit === "cs" || unit === "cc") {
    // Au quart de cuillère : « ¾ c. à soupe » plutôt que « 0,67 c. à soupe ».
    return Math.max(0.25, Math.round(value * 4) / 4);
  }
  if (unit === "pincee") return Math.max(1, Math.round(value));
  return Math.round(value * 100) / 100;
}

/** Recalcule une quantité pour un autre nombre de portions. */
export function scaleQuantity(quantity: number, unit: Unit, from: number, to: number): number {
  if (from <= 0) return quantity;
  return roundForCooking((quantity * to) / from, unit);
}
