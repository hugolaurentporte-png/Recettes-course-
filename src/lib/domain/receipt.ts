import type { Aisle, Ingredient } from "./types";
import { guessAisle } from "./categorize";
import { capitalize, normalizeText } from "./normalize";

/** Une ligne d'article lue sur un ticket de caisse. */
export interface ReceiptLine {
  label: string;
  price: number;
  aisle: Aisle;
}

export interface ParsedReceipt {
  lines: ReceiptLine[];
  /** Total payé lu sur le ticket (« TOTAL », « A PAYER »…), sinon null. */
  total: number | null;
  /** Date du ticket (début de journée, heure locale), sinon null. */
  date: number | null;
}

/** Montant en fin de ligne : « 2,35 », « -0,50 », « 12.90 € », éventuellement suivi d'un code TVA (A, B, 1…). */
const TRAILING_AMOUNT = /(-?\s?\d{1,4}[,.]\d{2})\s*(?:€|eur|euros?)?\s*(?:[a-z]|\d)?\s*$/i;

/** Lignes qui ne sont pas des articles (paiement, taxes, fidélité…). */
const NOT_ITEM = [
  "total", "sous total", "a payer", "net a payer", "montant", "tva", "ht", "ttc", "cb", "carte", "visa", "mastercard",
  "espece", "especes", "rendu", "monnaie", "cheque", "paiement", "credit", "debit", "nb article", "nombre d article",
  "articles", "fidelite", "cagnotte", "solde", "points", "economie", "avantage carte", "taux", "base", "ticket",
  "transaction", "autorisation", "sans contact", "merci", "magasin", "siret", "caisse", "contact", "a reporter",
];

/** Remises : à déduire de l'article juste au-dessus. */
const DISCOUNT = ["remise", "reduction", "promo", "bon d achat", "coupon", "immediate", "offert", "deduction"];

/** Mots abrégés courants sur les tickets (début de mot), essayés si rien d'autre ne marche. */
const ABBREVIATIONS: [Aisle, string[]][] = [
  ["viandes-poissons", ["vde", "viand", "hach", "steak", "stk", "poul", "pltr", "dind", "porc", "boeuf", "bf", "veau", "agn", "saucis", "lard", "merg", "escal", "roti", "cuiss", "filet", "saum", "cabil", "crev", "poiss", "colin", "merlu", "cordon", "nugget", "chipo"]],
  ["frais", ["yaou", "yt", "yop", "from", "emment", "compt", "camemb", "mozz", "beur", "crem", "lait", "oeuf", "jamb", "jbn", "knack", "surim", "skyr", "fromb", "petit suis", "ptt"]],
  ["fruits-legumes", ["pdt", "pom", "banan", "tomat", "carot", "oign", "courg", "aubergi", "poivr", "salad", "concom", "clement", "orang", "citro", "poire", "raisin", "fraise", "avoc", "brocol", "champ", "endiv", "poire", "kiwi", "melon"]],
  ["boissons", ["eau", "cristal", "evian", "vittel", "badoit", "jus", "coca", "soda", "bier", "vin", "cafe", "the", "sirop", "lim", "orangin"]],
  ["epicerie", ["pat", "spag", "riz", "farin", "sucr", "huil", "biscu", "gat", "cere", "choco", "confit", "pain", "baguet", "brioch", "chips", "sauce", "conserv", "thon", "mais", "haric", "lentil", "semoul", "soupe", "chocapic", "nutella"]],
  ["hygiene", ["shamp", "dentif", "savon", "gel dche", "deo", "coton", "mouch", "pq", "couch", "lingett", "rasoir"]],
  ["maison", ["less", "vaiss", "epong", "poubel", "essuie", "sopalin", "javel", "nett", "adouc", "alu", "film", "litier", "croq"]],
  ["surgeles", ["surg", "glac", "frit", "pizz"]],
];

function hasAny(text: string, words: readonly string[]): boolean {
  const t = ` ${text} `;
  return words.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `));
}

function abbreviationAisle(label: string): Aisle | null {
  const words = normalizeText(label).split(" ");
  for (const [aisle, prefixes] of ABBREVIATIONS) {
    if (words.some((w) => prefixes.some((p) => (p.includes(" ") ? false : w.startsWith(p))))) return aisle;
  }
  return null;
}

export function guessReceiptAisle(label: string, catalog: readonly Ingredient[]): Aisle {
  const a = guessAisle(label, catalog);
  return a !== "autres" ? a : abbreviationAisle(label) ?? "autres";
}

function toNumber(raw: string): number {
  return Math.round(Number(raw.replace(/\s/g, "").replace(",", ".")) * 100) / 100;
}

function readDate(text: string): number | null {
  const m = text.match(/\b(\d{2})[/.-](\d{2})[/.-](\d{2}|\d{4})\b/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return new Date(year, month - 1, day, 12).getTime();
}

/** Nettoie un libellé : quantités (« 2 x 1,25 »), codes-barres, poids au kilo… */
function cleanLabel(raw: string): string {
  return raw
    .replace(/\b\d+\s*[x*]\s*\d+[,.]\d{2}\b/gi, " ")
    .replace(/\b\d[,.]\d{3}\s*kg\b/gi, " ")
    .replace(/\b\d+[,.]\d{2}\s*(?:€\s*)?\/\s*kg\b/gi, " ")
    .replace(/\b\d{8,14}\b/g, " ")
    .replace(/^\s*\d+\s+(?=[a-zà-ÿ])/i, "")
    .replace(/[*#_=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lit le texte d'un ticket (copié depuis l'appli du magasin ou extrait d'un PDF).
 * Volontairement tolérant : chaque ligne qui finit par un prix et qui n'est pas un total
 * ou un paiement devient un article. On corrige ensuite à l'écran.
 */
export function parseReceipt(text: string, catalog: readonly Ingredient[]): ParsedReceipt {
  const lines: ReceiptLine[] = [];
  const totals: { value: number; strong: boolean }[] = [];
  let date: number | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/ /g, " ").trim();
    if (!line) continue;
    date ??= readDate(line);
    const m = line.match(TRAILING_AMOUNT);
    if (!m) continue;
    const value = toNumber(m[1]!);
    const before = line.slice(0, m.index).trim();
    const n = normalizeText(before);

    if (hasAny(n, ["total", "a payer", "net a payer", "montant du"])) {
      if (!hasAny(n, ["sous total", "tva", "ht", "economie", "remise", "points", "cagnotte"])) {
        totals.push({ value, strong: hasAny(n, ["a payer", "ttc", "net a payer", "total"]) });
      }
      continue;
    }
    if (value < 0 || hasAny(n, DISCOUNT)) {
      const last = lines[lines.length - 1];
      if (last) last.price = Math.max(0, Math.round((last.price - Math.abs(value)) * 100) / 100);
      continue;
    }
    if (hasAny(n, NOT_ITEM) || value === 0) continue;
    const label = cleanLabel(before);
    // Une ligne sans vrai libellé (« 2 x 1,25 2,50 ») détaille l'article précédent.
    if (!/[a-zà-ÿ]{2,}/i.test(label)) continue;
    lines.push({ label: capitalize(label.toLowerCase()), price: value, aisle: guessReceiptAisle(label, catalog) });
  }

  const strong = totals.filter((t) => t.strong);
  const pick = (strong.length ? strong : totals).map((t) => t.value);
  const total = pick.length ? Math.max(...pick) : null;
  return { lines, total, date };
}

/** Somme des articles, arrondie au centime. */
export function sumLines(lines: readonly Pick<ReceiptLine, "price">[]): number {
  return Math.round(lines.reduce((s, l) => s + l.price, 0) * 100) / 100;
}
