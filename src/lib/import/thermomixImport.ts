/**
 * Import des recettes Thermomix proposées (« recettes_thermomix_300_complet.json ») en BROUILLON.
 *
 * - Jamais publiées automatiquement : `published: false`, statut « brouillon », validation humaine requise.
 * - Idempotent : id « imp-tmx-0001 », sortie triée, statut de relecture déjà posé conservé.
 * - Ingrédients ramenés au catalogue par une table explicite (inconnu = rejet, jamais deviné).
 *   L'eau n'est pas un achat : sa quantité est reportée dans les étapes.
 * - Vérifications Thermomix : réglages TM5/TM6 (120 °C max en TM5), charge du bol (2,2 l, 2 l conseillé
 *   pour mixer chaud), temps cohérents avec les étapes, cuisson des œufs.
 * - Doublons écartés par identifiant et par nom normalisé (« … au Thermomix » ignoré), y compris
 *   face aux recettes déjà dans l'appli.
 */
import type { Recipe, RecipeIngredient, Unit } from "../domain/types";
import type { ExistingRecipeLike, RejectedRecipe, ReviewStatus, SourceFile, SourceIngredient, SourceRecipe } from "./recipeImport";

export interface ThermomixSourceRecipe extends SourceRecipe {
  compatibilite_thermomix?: string;
}

export interface ThermomixDraft extends Recipe {
  published: false;
  review: {
    status: ReviewStatus;
    sourceId: string;
    family: string;
    models: string;
    /** Charge approximative du bol (g + ml), hors aliments posés dans le Varoma. */
    bowlLoad: number;
    closeTo?: string;
    corrections: string[];
    warnings: string[];
  };
}

/** Nom source -> [id du catalogue, conversion éventuelle]. */
type Conv = { id: string; to?: (q: number, unit: string) => { quantity: number | null; unit: Unit | null } };
const one = (u: Unit) => () => ({ quantity: 1, unit: u });
const piece = one("piece");

const MAP: Record<string, Conv> = {
  abricot: { id: "abricot" }, abricots: { id: "abricot" },
  ail: { id: "ail", to: piece },
  ananas: { id: "ananas" },
  asperges: { id: "asperge" },
  aubergine: { id: "aubergine" },
  banane: { id: "banane" }, bananes: { id: "banane" },
  basilic: { id: "basilic", to: piece },
  "betterave cuite": { id: "betterave" }, "betteraves cuites": { id: "betterave" },
  beurre: { id: "beurre" },
  "bouillon de légumes": { id: "bouillon", to: piece },
  boulgour: { id: "boulgour" },
  brocoli: { id: "brocoli" },
  butternut: { id: "butternut" }, "courge butternut": { id: "butternut" },
  cacao: { id: "cacao" },
  cannelle: { id: "cannelle" },
  carotte: { id: "carotte" }, carottes: { id: "carotte" },
  cerise: { id: "cerise" },
  champignons: { id: "champignon" }, "champignons de Paris": { id: "champignon" },
  "chou-fleur": { id: "chou-fleur" },
  "châtaignes cuites": { id: "chataigne" },
  citron: { id: "citron", to: piece }, "jus de citron": { id: "citron", to: piece },
  "citron vert": { id: "citron-vert", to: piece },
  "clémentine": { id: "clementine" },
  coings: { id: "coing" },
  "coriandre fraîche": { id: "coriandre", to: piece },
  courgette: { id: "courgette" }, courgettes: { id: "courgette" },
  "crème liquide": { id: "creme", to: (q) => ({ quantity: q, unit: "ml" }) },
  cumin: { id: "cumin" }, "cumin moulu": { id: "cumin" },
  curry: { id: "curry" }, "curry doux": { id: "curry" },
  "céleri-rave": { id: "celeri-rave" },
  fenouil: { id: "fenouil" },
  figue: { id: "figue" },
  fraise: { id: "fraise" }, fraises: { id: "fraise" },
  framboise: { id: "framboise" },
  "fromage râpé": { id: "fromage-rape" },
  "fécule de maïs": { id: "fecule" },
  gingembre: { id: "gingembre" }, "gingembre frais": { id: "gingembre" },
  "haricots blancs cuits": { id: "haricot-blanc" },
  "haricots rouges cuits": { id: "haricot-rouge" },
  "haricots verts": { id: "haricot-vert" },
  huile: { id: "huile-neutre" },
  "huile d’olive": { id: "huile-olive" },
  "jaunes d’œufs": { id: "oeuf" }, "œufs": { id: "oeuf" },
  kiwi: { id: "kiwi" }, kiwis: { id: "kiwi" },
  lait: { id: "lait" },
  "lait de coco": { id: "lait-coco" },
  "lentilles corail": { id: "lentille-corail" },
  "lentilles vertes cuites": { id: "lentille" },
  mangue: { id: "mangue" },
  "maïs": { id: "mais" },
  melon: { id: "melon" },
  menthe: { id: "menthe", to: piece },
  moutarde: { id: "moutarde", to: (q) => ({ quantity: Math.max(1, Math.round(q / 15)), unit: "cs" }) },
  muscade: { id: "muscade" },
  myrtille: { id: "myrtille" }, myrtilles: { id: "myrtille" },
  navet: { id: "navet" },
  nectarine: { id: "nectarine" }, nectarines: { id: "nectarine" },
  noix: { id: "noix" },
  oignon: { id: "oignon" },
  orange: { id: "orange" },
  origan: { id: "origan" },
  panais: { id: "panais" },
  paprika: { id: "paprika" },
  parmesan: { id: "parmesan" }, "parmesan râpé": { id: "parmesan" },
  "patate douce": { id: "patate-douce" },
  persil: { id: "persil", to: piece },
  "petits pois": { id: "petit-pois" },
  poire: { id: "poire" }, poires: { id: "poire" },
  poireau: { id: "poireau" }, poireaux: { id: "poireau" },
  "pois chiches cuits": { id: "pois-chiche" },
  poivre: { id: "poivre" },
  poivron: { id: "poivron" }, "poivron rouge": { id: "poivron" },
  "polenta instantanée": { id: "polenta" },
  pomme: { id: "pomme" }, pommes: { id: "pomme" },
  "pommes de terre": { id: "pomme-de-terre" },
  potimarron: { id: "potimarron" },
  potiron: { id: "potiron" },
  prune: { id: "prune" }, prunes: { id: "prune" },
  "pruneaux dénoyautés": { id: "pruneau" },
  "pêche": { id: "peche" }, "pêches": { id: "peche" },
  quinoa: { id: "quinoa" },
  raisin: { id: "raisin" },
  rhubarbe: { id: "rhubarbe" },
  "riz arborio": { id: "riz-arborio" },
  sauge: { id: "sauge" },
  sel: { id: "sel" },
  sucre: { id: "sucre" },
  thym: { id: "thym" },
  tomate: { id: "tomate" }, tomates: { id: "tomate" },
  "tomates concassées": { id: "tomate-concassee" },
  "tomates séchées": { id: "tomate-sechee" },
  vanille: { id: "vanille" }, "vanille en poudre": { id: "vanille" },
  verveine: { id: "verveine" },
  "épinards": { id: "epinard" },
};

const UNITS: Record<string, Unit> = {
  g: "g", ml: "ml", "pièce": "piece", "c. à café": "cc", "c. à soupe": "cs", "pincée": "pincee", feuilles: "piece",
};

/** Ligne normalisée, ou null pour l'eau (reportée dans les étapes). */
function normalize(src: SourceIngredient, notes: string[]): RecipeIngredient | null {
  if (src.ingredient === "eau") return null;
  const conv = MAP[src.ingredient];
  if (!conv) throw new Error(`Ingrédient inconnu du catalogue : « ${src.ingredient} »`);
  const unit = UNITS[src.unite];
  if (!unit) throw new Error(`Unité inconnue : « ${src.unite} »`);
  if (conv.id === "sel" || conv.id === "poivre") return { ingredientId: conv.id, quantity: null, unit: null };
  let quantity: number | null = src.quantite;
  let u: Unit | null = unit;
  if (conv.to) ({ quantity, unit: u } = conv.to(src.quantite, src.unite));
  // Huile : 15 ml = 1 c. à soupe (unité du catalogue).
  if ((conv.id === "huile-olive" || conv.id === "huile-neutre") && unit === "ml") {
    quantity = Math.round((src.quantite / 15) * 2) / 2;
    u = "cs";
  }
  if (conv.id === "muscade" && unit === "cc") {
    quantity = 1;
    u = "pincee";
    notes.push("Muscade : 1 c. à café ramenée à 1 pincée (dose usuelle pour 4).");
  }
  if (conv.id === "bouillon") notes.push(`Bouillon : ${src.quantite} ml = 1 cube + ${src.quantite} ml d'eau.`);
  const line: RecipeIngredient = { ingredientId: conv.id, quantity, unit: u };
  if (src.facultatif) line.optional = true;
  return line;
}

// ---------------------------------------------------------------------------
// Titres

const FEM = new Set([
  "aubergine", "banane", "betterave", "cannelle", "carotte", "cerise", "clémentine", "courgette", "figue", "fraise",
  "framboise", "mangue", "menthe", "muscade", "myrtille", "nectarine", "patate", "poire", "pomme", "prune", "pêche",
  "rhubarbe", "sauge", "tomate", "vanille", "verveine",
]);
const PLURAL = new Set(["asperges", "champignons", "haricots", "petits", "épinards", "noix"]);

/** « au » corrigé selon le nom qui suit : à la, à l', aux. */
function fixAu(title: string): string {
  return title.replace(/\bau ([^\s,]+)/g, (m, word: string) => {
    const w = word.toLowerCase();
    if (PLURAL.has(w)) return `aux ${word}`;
    if (/^[aeiouyéèêh]/i.test(w) && w !== "haricots") return `à l'${word}`;
    if (FEM.has(w)) return `à la ${word}`;
    return m;
  });
}

export function fixTitle(t: string): string {
  return fixAu(
    t.replace(/ (cuits|cuite|cuites)\b/g, "")
      .replace(/\bde ([aeiouyéèêœ])/gi, "d'$1")
      .replace(/\bvert\b/, "vertes"),
  );
}

/** Nom normalisé pour repérer les doublons (accents, pluriels, « au Thermomix » ignorés). */
export function dedupKey(t: string): string {
  return t
    .toLowerCase()
    .replace(/au thermomix/g, "")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !["de", "d", "et", "au", "aux", "a", "la", "l", "le", "les"].includes(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Étapes et vérifications

const EMOJI: Record<string, string> = {
  Soupe: "🥣", Dessert: "🍮", Sauce: "🥫", Accompagnement: "🥔", "Plat végétarien": "🥬", "Apéritif": "🫓", "Plat complet": "🍚",
};

/** Somme des durées maximales en minutes écrites dans les étapes (« 15 à 20 min » compte 20). */
export function minutesInSteps(steps: string[]): number {
  let total = 0;
  for (const s of steps) {
    for (const m of s.matchAll(/(\d+)(?:\s*à\s*(\d+))?\s*min\b/g)) total += Number(m[2] ?? m[1]);
  }
  return total;
}

function fixSteps(r: ThermomixSourceRecipe, water: number[], corrections: string[], warnings: string[]): string[] {
  const queue = [...water];
  const steps = r.etapes.map((s0) => {
    let s = s0.replace(/’/g, "'");
    for (const m of s.matchAll(/(\d+)\s*ml d'eau/g)) {
      const i = queue.indexOf(Number(m[1]));
      if (i >= 0) queue.splice(i, 1);
    }
    // Eau sans quantité dans l'étape : on reporte celle de la liste d'ingrédients.
    if (/\bl'eau\b/.test(s) && queue.length > 0) s = s.replace(/\bl'eau\b/, `${queue.shift()} ml d'eau`);
    s = s.replace(/consommer dans les délais adaptés/, "consommer sous 3 jours");
    s = s.replace(/Vérifier que le centre est pris avant de servir\./, "Vérifier que le centre est pris : la lame d'un couteau doit ressortir propre. Sinon, prolonger de 5 minutes.");
    s = s.replace(/ Rincer les lentilles si présentes\./, r.ingredients.some((i) => i.ingredient.startsWith("lentilles")) ? " Rincer les lentilles." : "");
    return s;
  });
  if (steps.join("") !== r.etapes.join("").replace(/’/g, "'")) corrections.push("Étapes précisées (eau chiffrée, flans « lame propre », conservation 3 jours).");
  // Quinoa : l'étape demande 900 ml, la liste en annonçait 1 100 ml (au-dessus du repère avec le panier).
  if (steps.some((s) => s.includes("900 ml d'eau")) && water.includes(1100)) {
    corrections.push("Eau du quinoa ramenée de 1 100 à 900 ml (quantité de l'étape ; 1 100 ml dépasse le repère avec le panier).");
  }
  if (steps.some((s) => /\b1[3-9]\d\s*°C|\b[2-9]\d\d\s*°C/.test(s))) warnings.push("Température au-delà de 120 °C : réservé au TM6.");
  if (r.categorie === "Dessert" && r.ingredients.some((i) => i.ingredient.startsWith("jaunes"))) {
    warnings.push("Crème aux jaunes d'œufs cuite 9 min à 90 °C : vérifier qu'elle nappe la cuillère, refroidir vite et consommer sous 48 h.");
  }
  return steps;
}

const ODD = [/crème dessert (?:au|à la|à l')\s?melon/i, /coulis de banane/i, /purée rustique de tomate/i];

export function convertThermomix(src: ThermomixSourceRecipe): ThermomixDraft {
  const corrections: string[] = [];
  const warnings: string[] = [];
  const water = src.ingredients.filter((i) => i.ingredient === "eau").map((i) => i.quantite);
  const lines: RecipeIngredient[] = [];
  for (const raw of src.ingredients) {
    const l = normalize(raw, corrections);
    if (!l) continue;
    const dup = lines.find((x) => x.ingredientId === l.ingredientId);
    if (dup) {
      // Ex. citron + jus de citron : une seule ligne.
      if (dup.unit === l.unit && dup.quantity !== null && l.quantity !== null && dup.unit !== "piece") dup.quantity += l.quantity;
      corrections.push(`Ingrédient en double fusionné : ${raw.ingredient}.`);
      continue;
    }
    lines.push(l);
  }
  if (lines.filter((l) => !l.optional).length < 2) throw new Error("Moins de deux ingrédients");

  const steps = fixSteps(src, water.map((w) => (w === 1100 ? 900 : w)), corrections, warnings);
  if (steps.length < 3) throw new Error("Moins de trois étapes");

  const title = `${fixTitle(src.nom)} au Thermomix`;
  if (fixTitle(src.nom) !== src.nom) corrections.push(`Titre corrigé : « ${src.nom} » → « ${fixTitle(src.nom)} ».`);
  if (ODD.some((re) => re.test(title))) warnings.push("Association inhabituelle : à goûter avant publication.");

  const stepMinutes = minutesInSteps(steps);
  let cook = src.temps_cuisson_min;
  if (stepMinutes > cook) {
    corrections.push(`Temps de cuisson porté de ${cook} à ${stepMinutes} min (somme des étapes).`);
    cook = stepMinutes;
  }

  const bowlLoad = src.ingredients
    .filter((i) => i.unite === "g" || i.unite === "ml")
    .reduce((s, i) => s + (i.ingredient === "eau" && i.quantite === 1100 ? 900 : i.quantite), 0);
  if (bowlLoad > 2000) warnings.push(`Environ ${bowlLoad} g/ml au total : au-delà de 2 l, à répartir ou réduire (bol de 2,2 l).`);
  else if (bowlLoad > 1700 && /mixer/i.test(steps.join(" "))) warnings.push(`Environ ${bowlLoad} g/ml : proche de la limite pour mixer chaud, augmenter la vitesse très progressivement.`);

  const tags = [...new Set(["thermomix", ...src.tags.filter((t) => t !== "thermomix")])];
  const vegetarian = !lines.some((l) => ["lardon", "poulet", "dinde", "saumon", "cabillaud", "jambon"].includes(l.ingredientId));
  if (vegetarian && !tags.includes("végétarien")) tags.push("végétarien");

  return {
    id: `imp-${src.id}`,
    title,
    description: `${src.categorie} au Thermomix (TM5/TM6), pour ${src.portions} personnes.`,
    emoji: EMOJI[src.categorie] ?? "🥄",
    prepMinutes: src.temps_preparation_min,
    cookMinutes: cook,
    totalMinutes: src.temps_preparation_min + cook,
    servings: src.portions,
    ingredients: lines,
    equipment: [{ type: "thermomix", required: true }],
    instructions: steps,
    tags,
    published: false,
    review: {
      status: "brouillon",
      sourceId: src.id,
      family: src.categorie,
      models: "TM5/TM6",
      bowlLoad,
      corrections,
      warnings,
    },
  };
}

export function importThermomix(
  source: SourceFile & { recettes: ThermomixSourceRecipe[] },
  existing: readonly ExistingRecipeLike[],
  previous: readonly ThermomixDraft[] = [],
): { drafts: ThermomixDraft[]; rejected: RejectedRecipe[] } {
  const prevStatus = new Map(previous.map((d) => [d.id, d.review.status]));
  const existingIds = new Set(existing.map((e) => e.id));
  // Doublon = même nom qu'une recette Thermomix (déjà dans l'appli ou plus haut dans le fichier).
  // Une recette classique du même nom n'est pas un doublon : c'est un autre mode de cuisson.
  const keys = new Map<string, string>(existing.filter((e) => e.id.startsWith("tm-") || e.id.startsWith("imp-tmx-")).map((e) => [dedupKey(e.title), e.title]));
  const classic = new Map<string, ExistingRecipeLike>(existing.map((e) => [dedupKey(e.title), e]));
  const drafts: ThermomixDraft[] = [];
  const rejected: RejectedRecipe[] = [];
  const seen = new Set<string>();

  for (const src of [...source.recettes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (seen.has(src.id) || existingIds.has(`imp-${src.id}`)) {
      rejected.push({ sourceId: src.id, title: src.nom, reason: "doublon", detail: "Identifiant déjà présent." });
      continue;
    }
    seen.add(src.id);
    let d: ThermomixDraft;
    try {
      d = convertThermomix(src);
    } catch (e) {
      rejected.push({ sourceId: src.id, title: src.nom, reason: "invalide", detail: (e as Error).message });
      continue;
    }
    const key = dedupKey(d.title);
    const twin = keys.get(key);
    if (twin) {
      rejected.push({ sourceId: src.id, title: d.title, reason: "doublon", detail: `Même nom que « ${twin} ».` });
      continue;
    }
    keys.set(key, d.title);
    // Recette Thermomix déjà dans l'appli dont le nom est contenu dans celui-ci (« Compote de pommes »).
    const words = new Set(key.split(" "));
    const close = existing.find((e) => e.id.startsWith("tm-") && dedupKey(e.title).split(" ").every((w) => words.has(w)));
    if (close) d.review.closeTo = close.id;
    else if (classic.has(key)) d.review.closeTo = classic.get(key)!.id;
    d.review.status = prevStatus.get(d.id) ?? "brouillon";
    drafts.push(d);
  }
  return { drafts, rejected };
}
