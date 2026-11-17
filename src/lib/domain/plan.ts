/** Planning des repas : entrées datées (jour + repas) et outils de calcul. Fonctions pures, testées. */

export type Meal = "midi" | "soir";
export const MEALS: Meal[] = ["midi", "soir"];
export const MEAL_LABELS: Record<Meal, string> = { midi: "Midi", soir: "Soir" };

export interface PlanEntry {
  id: string;
  /** Jour au format AAAA-MM-JJ (heure locale). */
  date: string;
  meal: Meal;
  recipeId: string;
  servings: number;
}

/** AAAA-MM-JJ en heure locale (pas en UTC, sinon décalage la nuit). */
export function toDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Les 7 jours de la semaine (lundi → dimanche) contenant `ref`, décalée de `offset` semaines. */
export function weekDays(ref: Date, offset = 0): string[] {
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateKey(d);
  });
}

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function dayLabel(key: string, today: string): string {
  const d = fromDateKey(key);
  const base = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return key === today ? `Aujourd'hui · ${base}` : base;
}

/**
 * Portions totales par recette pour les jours donnés : une recette prévue deux fois dans la semaine
 * compte deux fois (les courses ne doivent pas l'oublier).
 */
export function servingsByRecipe(entries: PlanEntry[], days: string[]): Map<string, number> {
  const set = new Set(days);
  const out = new Map<string, number>();
  for (const e of entries) {
    if (!set.has(e.date)) continue;
    out.set(e.recipeId, (out.get(e.recipeId) ?? 0) + e.servings);
  }
  return out;
}

/** Retire les entrées plus vieilles que `keepDays` jours (le planning ne grossit pas indéfiniment). */
export function prunePlan(entries: PlanEntry[], today: Date, keepDays = 14): PlanEntry[] {
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() - keepDays);
  const key = toDateKey(limit);
  return entries.filter((e) => e.date >= key);
}
