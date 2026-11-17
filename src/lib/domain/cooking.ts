/**
 * Mode cuisine : repérer les durées dans une étape (pour proposer un minuteur)
 * et recalculer les quantités écrites dans le texte des étapes (« 600 ml d'eau »)
 * quand on change le nombre de portions. Pur et testable.
 */
import type { Unit } from "./types";
import { formatAmount, roundForCooking, toBase } from "./units";

export interface StepTimer {
  /** Texte tel qu'il apparaît dans l'étape, ex. « 8 à 10 minutes ». */
  label: string;
  /** Durée du minuteur en secondes (borne basse d'une fourchette : on vérifie au plus tôt). */
  seconds: number;
}

/** En dessous, le minuteur n'a pas d'intérêt (« mixez 5 s vitesse 5 »). */
const MIN_TIMER_SECONDS = 30;

const NUM = String.raw`(\d+(?:[,.]\d+)?)`;
const H = String.raw`(?:heures?|h)`;
const MIN = String.raw`(?:minutes?|mn|min)`;
const SEC = String.raw`(?:secondes?|sec|s)`;
// Ordre : « 1 h 30 », fourchettes, puis durées simples. Les unités doivent finir le mot.
const END = String.raw`(?![\p{L}\d])`;
const TIMER_RE = new RegExp(
  [
    String.raw`(\d+) ?h ?(\d{1,2})(?: ?${MIN})?${END}`,
    String.raw`${NUM} ?(?:à|-|–) ?${NUM} ?(${H}|${MIN}|${SEC})${END}`,
    String.raw`${NUM} ?(${H}|${MIN}|${SEC})${END}`,
  ].join("|"),
  "giu",
);

function num(s: string): number {
  return Number(s.replace(",", "."));
}

function unitSeconds(u: string): number {
  const l = u.toLowerCase();
  if (l.startsWith("h")) return 3600;
  if (l.startsWith("m")) return 60;
  return 1;
}

/** Durées d'une étape, dans l'ordre, sans doublon. */
export function findTimers(step: string): StepTimer[] {
  const out: StepTimer[] = [];
  for (const m of step.matchAll(TIMER_RE)) {
    let seconds: number;
    if (m[1] !== undefined) seconds = Number(m[1]) * 3600 + Number(m[2]) * 60;
    else if (m[3] !== undefined) seconds = num(m[3]) * unitSeconds(m[5]!);
    else seconds = num(m[6]!) * unitSeconds(m[7]!);
    seconds = Math.round(seconds);
    if (seconds < MIN_TIMER_SECONDS) continue;
    const label = m[0].trim();
    if (out.some((t) => t.seconds === seconds && t.label === label)) continue;
    out.push({ label, seconds });
  }
  return out;
}

/** « 10:00 », « 1:05:00 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** « 25 min », « 1 h 30 », « 45 s ». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

/** Morceau du texte d'une étape ; `scaled` quand une quantité a été recalculée. */
export interface StepPart {
  text: string;
  scaled?: { original: string };
}

const UNIT_WORDS: Record<string, Unit> = { kg: "kg", g: "g", ml: "ml", cl: "cl", l: "l" };
const QTY_RE = new RegExp(String.raw`(?<![\p{L}\d,.])${NUM} ?(kg|g|ml|cl|l)(?![\p{L}\d'’])`, "gu");

/**
 * Recalcule les poids et volumes cités dans une étape (eau, bouillon, lait…).
 * Les températures, vitesses du Thermomix, durées et pièces ne changent pas.
 */
export function scaleStep(step: string, from: number, to: number): StepPart[] {
  if (from <= 0 || from === to) return [{ text: step }];
  const parts: StepPart[] = [];
  let last = 0;
  for (const m of step.matchAll(QTY_RE)) {
    const unit = UNIT_WORDS[m[2]!]!;
    const base = toBase({ value: num(m[1]!), unit });
    const value = roundForCooking((base.value * to) / from, base.unit);
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: step.slice(last, idx) });
    parts.push({ text: formatAmount({ value, unit: base.unit }), scaled: { original: m[0] } });
    last = idx + m[0].length;
  }
  if (last < step.length) parts.push({ text: step.slice(last) });
  return parts;
}
