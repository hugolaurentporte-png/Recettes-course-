import type { Ingredient } from "./types";
import type { RecipeAvailability } from "./availability";

/**
 * Petites phrases en français autour des ingrédients : « la crème », « les pommes de terre »,
 * « d'huile d'olive ». Le genre n'est pas dans le catalogue : on le déduit du nom
 * (pluriel en -s/-x, voyelle → l') et on liste ici les exceptions.
 */
const FEMININE = new Set([
  "butternut", "salade", "creme", "feta", "mozzarella", "ricotta", "pate-feuilletee", "pate-brisee",
  "semoule", "farine", "levure", "moutarde", "sauce-soja", "muscade", "chapelure", "rhubarbe",
  "ciboulette", "coriandre", "amande-poudre",
]);
/** Noms singuliers malgré le -s / -x final. */
const SINGULAR = new Set(["mais", "muscade", "riz"]);
/** H aspiré : pas d'élision (« de haricots »). */
const ASPIRATED = /^h(aricot|ach)/;

function lower(name: string): string {
  return name.charAt(0).toLocaleLowerCase("fr") + name.slice(1);
}

function isPlural(ing: Ingredient): boolean {
  if (SINGULAR.has(ing.id)) return false;
  const first = ing.name.split(/[\s-]/)[0] ?? "";
  return /[sx]$/i.test(first);
}

function elides(word: string): boolean {
  return /^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(word) || (/^h/i.test(word) && !ASPIRATED.test(word.toLowerCase()));
}

/** « la crème fraîche », « le lait », « l'ail », « les pommes de terre ». */
export function withArticle(ing: Ingredient): string {
  const n = lower(ing.name);
  if (isPlural(ing)) return `les ${n}`;
  if (elides(n)) return `l'${n}`;
  return FEMININE.has(ing.id) ? `la ${n}` : `le ${n}`;
}

/** « de pommes de terre », « d'huile d'olive ». */
export function withDe(ing: Ingredient): string {
  const n = lower(ing.name);
  return elides(n) ? `d'${n}` : `de ${n}`;
}

/** « A », « A et B », « A, B et C », « A, B et 2 autres ». */
export function joinFr(items: string[], max = 3, other = "autres"): string {
  if (items.length <= 1) return items.join("");
  if (items.length <= max) return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
  const shown = items.slice(0, max - 1);
  return `${shown.join(", ")} et ${items.length - shown.length} ${other}`;
}

export type SummaryKind = "ok" | "missing" | "verify";

export interface AvailabilitySummary {
  /** ok = tout est là ; verify = rien ne manque mais une quantité est inconnue (« À vérifier ») ; missing = il manque quelque chose. */
  tone: SummaryKind;
  /** Phrases à afficher, dans l'ordre (la première est la plus importante). */
  lines: { kind: SummaryKind; text: string }[];
}

/** Résumé court pour les cartes : « Tu as tout », « Il manque la crème », « Quantité de pommes de terre à vérifier ». */
export function summarizeAvailability(a: RecipeAvailability): AvailabilitySummary {
  const required = a.lines.filter((l) => !l.line.optional && l.ingredient);
  const missing = required.filter((l) => l.status === "missing").map((l) => l.ingredient!);
  const short = required.filter((l) => l.status === "insufficient").map((l) => l.ingredient!);
  const verify = required.filter((l) => l.status === "verify").map((l) => l.ingredient!);

  const lines: AvailabilitySummary["lines"] = [];
  if (missing.length > 0) lines.push({ kind: "missing", text: `Il manque ${joinFr(missing.map(withArticle))}` });
  if (short.length > 0) lines.push({ kind: "missing", text: `Pas assez ${joinFr(short.map(withDe))}` });
  if (verify.length === 1) lines.push({ kind: "verify", text: `Quantité ${withDe(verify[0]!)} à vérifier` });
  else if (verify.length > 1) {
    lines.push({ kind: "verify", text: `Quantités ${joinFr(verify.map(withDe), 3, "autres ingrédients")} à vérifier` });
  }

  if (missing.length + short.length > 0) return { tone: "missing", lines };
  if (verify.length > 0) return { tone: "verify", lines };
  return { tone: "ok", lines: [{ kind: "ok", text: "Tu as tout" }] };
}
