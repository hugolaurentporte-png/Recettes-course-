/** Planning des repas : entrées datées (jour + repas) et outils de calcul. Fonctions pures, testées. */

export type Meal = "midi" | "soir";
export const MEALS: Meal[] = ["midi", "soir"];
export const MEAL_LABELS: Record<Meal, string> = { midi: "Midi", soir: "Soir" };

export interface PlanEntry {
  /** Un créneau = un plat : l'identifiant est le créneau lui-même (voir `slotId`), pour que les deux téléphones parlent du même repas. */
  id: string;
  /** Jour au format AAAA-MM-JJ (heure locale). */
  date: string;
  meal: Meal;
  recipeId: string;
  servings: number;
  /** Dernière modification (ms) : le plus récent gagne entre les deux téléphones. */
  updatedAt?: number;
  /** Plat retiré du planning (gardé un temps pour que l'autre téléphone le retire aussi). */
  deletedAt?: number | null;
  /** Téléphone qui a fait la dernière modification. */
  updatedBy?: string;
}

export function slotId(date: string, meal: Meal): string {
  return `${date}|${meal}`;
}

/** Plats réellement prévus (sans ceux qu'on a retirés). */
export function activePlan(entries: readonly PlanEntry[]): PlanEntry[] {
  return entries.filter((e) => !e.deletedAt);
}

/**
 * Anciens plannings (avant le partage) : un identifiant aléatoire par entrée.
 * On passe à un identifiant par créneau, en gardant la dernière entrée de chaque créneau.
 */
export function normalizePlan(entries: readonly PlanEntry[]): PlanEntry[] {
  const bySlot = new Map<string, PlanEntry>();
  for (const e of entries) {
    const id = slotId(e.date, e.meal);
    bySlot.set(id, { ...e, id, updatedAt: e.updatedAt ?? 1, deletedAt: e.deletedAt ?? null });
  }
  return [...bySlot.values()];
}

/** Prévoit (ou remplace) le plat d'un créneau. */
export function setSlot(
  entries: readonly PlanEntry[],
  slot: { date: string; meal: Meal; recipeId: string; servings: number },
  now: number,
  deviceId: string,
): PlanEntry[] {
  const id = slotId(slot.date, slot.meal);
  const prev = entries.find((e) => e.id === id);
  const entry: PlanEntry = {
    id, ...slot, deletedAt: null, updatedBy: deviceId,
    // Toujours plus récent que la version précédente, même si l'horloge de l'autre téléphone avance.
    updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
  };
  return prev ? entries.map((e) => (e.id === id ? entry : e)) : [...entries, entry];
}

/** Modifie (portions) ou retire un plat prévu. */
export function patchSlot(
  entries: readonly PlanEntry[],
  id: string,
  patch: Partial<Pick<PlanEntry, "servings" | "deletedAt">>,
  now: number,
  deviceId: string,
): PlanEntry[] {
  return entries.map((e) =>
    e.id === id ? { ...e, ...patch, updatedBy: deviceId, updatedAt: Math.max(now, (e.updatedAt ?? 0) + 1) } : e);
}

/** Le plat prévu à ce créneau, s'il y en a un. */
export function plannedAt(entries: readonly PlanEntry[], date: string, meal: Meal): PlanEntry | undefined {
  return entries.find((e) => e.id === slotId(date, meal) && !e.deletedAt);
}

/** Lendemain d'un jour AAAA-MM-JJ. */
export function nextDay(key: string): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
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
    if (!set.has(e.date) || e.deletedAt) continue;
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
