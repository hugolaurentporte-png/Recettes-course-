import type { Aisle, ShoppingTrip } from "./types";
import { AISLE_ORDER } from "./categorize";

/** Mois au format AAAA-MM (heure locale). */
export function monthKey(ts: number | Date): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function monthLabel(key: string): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Tickets avec un montant pour ce mois, du plus récent au plus ancien. */
export function tripsOfMonth(trips: readonly ShoppingTrip[], key: string): ShoppingTrip[] {
  return trips
    .filter((t) => typeof t.amount === "number" && monthKey(t.finishedAt) === key)
    .sort((a, b) => b.finishedAt - a.finishedAt);
}

export function totalOfMonth(trips: readonly ShoppingTrip[], key: string): number {
  return Math.round(tripsOfMonth(trips, key).reduce((s, t) => s + (t.amount ?? 0), 0) * 100) / 100;
}

/** « 12,5 » ou « 12.50 € » → 12.5 ; null si ce n'est pas un montant positif. */
export function parseEuros(input: string): number | null {
  const v = Number(input.replace(/€/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
}

export function formatEuros(v: number): string {
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Où en est le mois : part dépensée et dépense attendue à ce jour (pour dire « en avance » ou non). */
export function budgetStatus(spent: number, budget: number, now: Date, key: string) {
  const ratio = budget > 0 ? spent / budget : 0;
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const current = monthKey(now) === key;
  const elapsed = current ? now.getDate() / days : 1;
  return { ratio, remaining: Math.round((budget - spent) * 100) / 100, over: spent > budget, ahead: current && ratio > elapsed + 0.1 };
}

/**
 * Répartition du mois par rayon, à partir des prix saisis article par article.
 * Ce qui a été payé sans détail (total seul) est compté à part.
 */
export function spendByAisle(trips: readonly ShoppingTrip[], key: string): { byAisle: { aisle: Aisle; amount: number }[]; undetailed: number } {
  const sums = new Map<Aisle, number>();
  let undetailed = 0;
  for (const t of tripsOfMonth(trips, key)) {
    let detailed = 0;
    for (const it of t.items) {
      if (!it.price) continue;
      sums.set(it.aisle, (sums.get(it.aisle) ?? 0) + it.price);
      detailed += it.price;
    }
    undetailed += Math.max(0, (t.amount ?? 0) - detailed);
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    byAisle: AISLE_ORDER.filter((a) => sums.has(a)).map((a) => ({ aisle: a, amount: r(sums.get(a)!) }))
      .sort((a, b) => b.amount - a.amount),
    undetailed: r(undetailed),
  };
}
