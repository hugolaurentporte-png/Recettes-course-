/**
 * Import de recettes générées (fichier « recettes_1000_import.json ») vers le format de l'appli.
 *
 * Principes :
 * - Rien n'est publié : chaque recette importée a `published: false` et un statut de relecture.
 * - Import idempotent : l'identifiant dépend uniquement de l'id source (« imp-fr-0001 ») et la sortie
 *   est triée et sans horodatage. Relancer l'import donne exactement le même fichier ; un statut
 *   de relecture déjà posé (« valide », « refuse ») est conservé.
 * - Les ingrédients et unités sont ramenés au catalogue de l'appli par une table explicite :
 *   un nom inconnu bloque l'import au lieu d'être deviné.
 * - Les étapes sont réécrites à partir des 5 familles du fichier source, avec des temps et des
 *   repères de cuisson à cœur précis (volaille, poisson, œufs), et l'équipement réellement utilisé.
 *
 * Module pur (aucun accès disque) : testé par tests/import.test.ts, lancé par scripts/import-recipes.ts.
 */
import type { Equipment, Recipe, RecipeIngredient, Unit } from "../domain/types";

// ---------------------------------------------------------------------------
// Format source

export interface SourceIngredient {
  ingredient: string;
  quantite: number;
  unite: string;
  facultatif: boolean;
}

export interface SourceRecipe {
  id: string;
  nom: string;
  categorie: string;
  portions: number;
  temps_preparation_min: number;
  temps_cuisson_min: number;
  temps_total_min: number;
  modes_cuisson: string[];
  ingredients: SourceIngredient[];
  etapes: string[];
  mois_recommandes: number[];
  tags: string[];
  source: string;
  validation_humaine_requise: boolean;
}

export interface SourceFile {
  schema_version: string;
  nombre_recettes: number;
  recettes: SourceRecipe[];
}

// ---------------------------------------------------------------------------
// Format de sortie

export type ReviewStatus = "brouillon" | "valide" | "refuse";

export interface DraftRecipe extends Recipe {
  published: false;
  review: {
    status: ReviewStatus;
    sourceId: string;
    family: FamilyKey;
    /** Recette importée quasi identique (même plat, protéine interchangeable). */
    variantOf?: string;
    /** Recette existante de l'appli qui ressemble à celle-ci, sans être un doublon. */
    closeTo?: string;
    corrections: string[];
    warnings: string[];
  };
}

export interface RejectedRecipe {
  sourceId: string;
  title: string;
  reason: "doublon" | "invalide";
  detail: string;
  duplicateOf?: string;
}

export interface ImportResult {
  drafts: DraftRecipe[];
  rejected: RejectedRecipe[];
}

// ---------------------------------------------------------------------------
// Normalisation des ingrédients et des unités

const UNIT_MAP: Record<string, Unit> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  cl: "cl",
  l: "l",
  "pièce": "piece",
  gousse: "piece",
  "c. à soupe": "cs",
  "c. à café": "cc",
  "pincée": "pincee",
};

/** Nom source -> identifiant du catalogue. */
export const INGREDIENT_MAP: Record<string, string> = {
  "huile d’olive": "huile-olive",
  sel: "sel",
  poivre: "poivre",
  oignon: "oignon",
  ail: "ail",
  "pomme de terre": "pomme-de-terre",
  riz: "riz",
  "crème fraîche": "creme",
  "fromage râpé": "fromage-rape",
  moutarde: "moutarde",
  "bouillon de légumes": "bouillon",
  thym: "thym",
  "lait de coco": "lait-coco",
  "curry doux": "curry",
  "paprika doux": "paprika",
  "blanc de poulet": "poulet",
  "escalope de dinde": "dinde",
  "filet de saumon": "saumon",
  "filet de cabillaud": "cabillaud",
  "tofu ferme": "tofu",
  "pois chiches cuits": "pois-chiche",
  "lentilles vertes sèches": "lentille",
  lardons: "lardon",
  "œuf": "oeuf",
  "haricots blancs cuits": "haricot-blanc",
  carottes: "carotte",
  courgettes: "courgette",
  poireaux: "poireau",
  "champignons de Paris": "champignon",
  brocoli: "brocoli",
  "chou-fleur": "chou-fleur",
  potimarron: "potimarron",
  "épinards": "epinard",
  aubergines: "aubergine",
  poivrons: "poivron",
  tomates: "tomate",
  "haricots verts": "haricot-vert",
  "petits pois": "petit-pois",
  fenouil: "fenouil",
  "courge butternut": "butternut",
  "patates douces": "patate-douce",
  "chou blanc": "chou-blanc",
  asperges: "asperge",
  blettes: "blette",
  navets: "navet",
  "pâtes sèches": "pates",
  quinoa: "quinoa",
  "semoule de blé": "semoule",
  boulgour: "boulgour",
};

/** Poids moyen d'un pavé de saumon (le catalogue compte le saumon en pavés). */
const SALMON_FILLET_G = 125;

/** Normalise une ligne. Les corrections faites sont ajoutées à `notes`. */
export function normalizeLine(src: SourceIngredient, notes: string[]): RecipeIngredient {
  const id = INGREDIENT_MAP[src.ingredient];
  if (!id) throw new Error(`Ingrédient inconnu du catalogue : « ${src.ingredient} »`);
  const unit = UNIT_MAP[src.unite];
  if (!unit) throw new Error(`Unité inconnue : « ${src.unite} »`);
  let line: RecipeIngredient = { ingredientId: id, quantity: src.quantite, unit };
  if (id === "sel" || id === "poivre") {
    line = { ingredientId: id, quantity: null, unit: null };
  } else if (id === "saumon" && unit === "g") {
    const pieces = Math.max(1, Math.round(src.quantite / SALMON_FILLET_G));
    line = { ingredientId: id, quantity: pieces, unit: "piece" };
    notes.push(`Saumon : ${src.quantite} g convertis en ${pieces} pavés (unité du catalogue).`);
  } else if (id === "bouillon" && unit === "ml") {
    line = { ingredientId: id, quantity: 1, unit: "piece" };
    notes.push(`Bouillon : ${src.quantite} ml remplacés par 1 cube + ${src.quantite} ml d'eau (unité du catalogue).`);
  }
  if (src.facultatif) line.optional = true;
  if (line.quantity !== null && !(line.quantity > 0)) throw new Error(`Quantité invalide pour « ${src.ingredient} »`);
  return line;
}

// ---------------------------------------------------------------------------
// Familles, légumes, protéines, féculents

export type FamilyKey = "poelee" | "gratin" | "mijote" | "curry" | "four";

const FAMILY_BY_CATEGORY: Record<string, FamilyKey> = {
  "Plat complet": "poelee",
  Gratin: "gratin",
  "Mijoté": "mijote",
  Curry: "curry",
  "Plat au four": "four",
};

export const FAMILY_LABELS: Record<FamilyKey, string> = {
  poelee: "Poêlées (plat complet)",
  gratin: "Gratins à la moutarde",
  mijote: "Cocottes au thym",
  curry: "Currys doux au lait de coco",
  four: "Plaques rôties au paprika",
};

const FAMILY_EMOJI: Record<FamilyKey, string> = { poelee: "🥘", gratin: "🧀", mijote: "🍲", curry: "🍛", four: "🥔" };

interface Veg {
  /** Article + nom pour les phrases : « les carottes ». */
  the: string;
  prep: string;
  /** Minutes : poêle (plat complet), précuisson (gratin), mijotage, curry. */
  pan: number;
  pre: number;
  stew: number;
  curry: number;
  /** Légume fragile : ajouté seulement en fin de cuisson sur la plaque du four. */
  lateOven?: number;
  gratinPrep?: string;
}

const VEG: Record<string, Veg> = {
  carotte: { the: "les carottes", prep: "Éplucher les carottes et les couper en rondelles de 5 mm.", pan: 15, pre: 10, stew: 25, curry: 20 },
  courgette: { the: "les courgettes", prep: "Laver les courgettes et les couper en demi-rondelles d'1 cm.", pan: 10, pre: 3, stew: 15, curry: 12 },
  poireau: { the: "les poireaux", prep: "Couper les poireaux en rondelles d'1 cm et les rincer soigneusement pour retirer la terre.", pan: 12, pre: 8, stew: 20, curry: 15 },
  champignon: { the: "les champignons", prep: "Nettoyer les champignons avec un papier humide et les émincer.", pan: 10, pre: 5, stew: 15, curry: 12 },
  brocoli: { the: "le brocoli", prep: "Détailler le brocoli en petits bouquets et le rincer.", pan: 10, pre: 5, stew: 15, curry: 10 },
  "chou-fleur": { the: "le chou-fleur", prep: "Détailler le chou-fleur en petits bouquets et le rincer.", pan: 15, pre: 8, stew: 20, curry: 15 },
  potimarron: { the: "le potimarron", prep: "Laver le potimarron (inutile de l'éplucher), retirer les graines et couper la chair en cubes de 2 cm.", pan: 15, pre: 10, stew: 25, curry: 20 },
  epinard: {
    the: "les épinards", prep: "Laver les épinards à grande eau et retirer les grosses tiges.", pan: 4, pre: 2, stew: 5, curry: 5, lateOven: 5,
    gratinPrep: "Faire tomber les épinards 2 à 3 minutes dans une casserole avec un fond d'eau, puis les égoutter en les pressant bien.",
  },
  aubergine: { the: "les aubergines", prep: "Laver les aubergines et les couper en cubes de 2 cm.", pan: 15, pre: 6, stew: 25, curry: 20 },
  poivron: { the: "les poivrons", prep: "Laver les poivrons, retirer les graines et les couper en lanières.", pan: 12, pre: 6, stew: 20, curry: 15 },
  tomate: {
    the: "les tomates", prep: "Laver les tomates et les couper en quartiers.", pan: 8, pre: 0, stew: 15, curry: 10,
    gratinPrep: "Couper les tomates en rondelles, les saler légèrement et les laisser égoutter 10 minutes (pas de précuisson).",
  },
  "haricot-vert": { the: "les haricots verts", prep: "Équeuter les haricots verts et les couper en deux.", pan: 15, pre: 8, stew: 20, curry: 15 },
  "petit-pois": { the: "les petits pois", prep: "Écosser les petits pois s'ils sont frais.", pan: 10, pre: 5, stew: 10, curry: 8, lateOven: 12 },
  fenouil: { the: "le fenouil", prep: "Retirer la base dure du fenouil et l'émincer finement.", pan: 15, pre: 10, stew: 25, curry: 20 },
  butternut: { the: "la courge butternut", prep: "Éplucher la courge butternut, retirer les graines et couper la chair en cubes de 2 cm.", pan: 15, pre: 10, stew: 25, curry: 20 },
  "patate-douce": { the: "les patates douces", prep: "Éplucher les patates douces et les couper en cubes de 2 cm.", pan: 15, pre: 10, stew: 20, curry: 15 },
  "chou-blanc": { the: "le chou blanc", prep: "Retirer les premières feuilles et le trognon du chou, puis l'émincer finement.", pan: 15, pre: 10, stew: 25, curry: 20 },
  asperge: { the: "les asperges", prep: "Casser la base dure des asperges, les éplucher si elles sont blanches et les couper en tronçons de 3 cm.", pan: 10, pre: 6, stew: 10, curry: 8 },
  blette: { the: "les blettes", prep: "Laver les blettes, couper les côtes en tronçons et émincer les feuilles.", pan: 8, pre: 6, stew: 15, curry: 10, lateOven: 12 },
  navet: { the: "les navets", prep: "Éplucher les navets et les couper en cubes de 2 cm.", pan: 15, pre: 10, stew: 25, curry: 20 },
};

type ProteinKind = "volaille" | "poisson" | "tofu" | "lardons" | "oeufs" | "lentilles" | "legumineuses";

interface Protein {
  kind: ProteinKind;
  /** Nom avec article : « le poulet ». */
  the: string;
  /** Groupe d'interchangeabilité pour repérer les variantes très proches. */
  group: string;
}

const PROTEINS: Record<string, Protein> = {
  poulet: { kind: "volaille", the: "le poulet", group: "volaille" },
  dinde: { kind: "volaille", the: "la dinde", group: "volaille" },
  saumon: { kind: "poisson", the: "le saumon", group: "poisson" },
  cabillaud: { kind: "poisson", the: "le cabillaud", group: "poisson" },
  tofu: { kind: "tofu", the: "le tofu", group: "tofu" },
  "pois-chiche": { kind: "legumineuses", the: "les pois chiches", group: "legumineuses" },
  "haricot-blanc": { kind: "legumineuses", the: "les haricots blancs", group: "legumineuses" },
  lentille: { kind: "lentilles", the: "les lentilles", group: "lentilles" },
  lardon: { kind: "lardons", the: "les lardons", group: "lardons" },
  oeuf: { kind: "oeufs", the: "les œufs", group: "oeufs" },
};

/** Minutes de préparation de la garniture (cuisson comprise). */
const PROTEIN_MINUTES: Record<ProteinKind, number> = {
  volaille: 10, poisson: 8, tofu: 8, lardons: 6, oeufs: 12, lentilles: 30, legumineuses: 0,
};

const STARCHES: Record<string, { step: string; minutes: number }> = {
  riz: { step: "Cuire le riz dans une grande casserole d'eau bouillante salée selon le temps indiqué sur le paquet (environ 11 minutes), puis l'égoutter.", minutes: 12 },
  pates: { step: "Cuire les pâtes dans une grande casserole d'eau bouillante salée selon le temps indiqué sur le paquet, puis les égoutter.", minutes: 12 },
  quinoa: { step: "Rincer le quinoa, puis le cuire 12 à 15 minutes dans une casserole d'eau bouillante salée. L'égoutter.", minutes: 15 },
  boulgour: { step: "Cuire le boulgour 10 à 12 minutes dans une casserole d'eau bouillante salée (ou selon le paquet), puis l'égoutter.", minutes: 12 },
  semoule: { step: "Porter à ébullition le même volume d'eau salée que de semoule, verser sur la semoule hors du feu, couvrir 5 minutes puis égrainer à la fourchette.", minutes: 7 },
  "pomme-de-terre": { step: "Éplucher les pommes de terre, les couper en cubes de 2 cm et les cuire 15 à 20 minutes dans une casserole d'eau salée, jusqu'à ce que la pointe d'un couteau s'y enfonce sans résistance. Égoutter.", minutes: 20 },
};

/** Utilise une poêle (ou la cocotte / la casserole de la recette) pour être cuite. */
function needsPan(kind: ProteinKind): boolean {
  return kind === "volaille" || kind === "poisson" || kind === "tofu" || kind === "lardons";
}

/** Étape de préparation de la garniture, dans le récipient indiqué (« dans la poêle »). */
function proteinStep(p: Protein, vessel: string): string {
  switch (p.kind) {
    case "volaille":
      return `Couper ${p.the} en morceaux de 2 à 3 cm et les faire dorer ${vessel} avec 1 c. à soupe d'huile, 8 à 10 minutes à feu moyen en remuant. La viande doit être blanche à cœur, sans aucune trace rosée (74 °C à cœur). Réserver.`;
    case "poisson":
      return `Retirer la peau et vérifier l'absence d'arêtes, puis couper ${p.the} en gros morceaux. Les cuire ${vessel} avec un filet d'huile 3 à 4 minutes par face : la chair doit être opaque à cœur et se détacher facilement (63 °C à cœur). Réserver.`;
    case "tofu":
      return `Égoutter le tofu, l'éponger, le couper en dés et le faire dorer ${vessel} avec un filet d'huile, 8 minutes sur toutes les faces. Réserver.`;
    case "lardons":
      return `Faire revenir les lardons ${vessel}, sans matière grasse, 5 à 6 minutes jusqu'à ce qu'ils soient bien dorés. Les égoutter et réserver.`;
    case "oeufs":
      return "Plonger délicatement les œufs dans une casserole d'eau bouillante et les cuire 10 minutes : le jaune doit être entièrement pris. Les refroidir sous l'eau froide, les écaler et les couper en quartiers.";
    case "lentilles":
      return "À lancer en premier : rincer les lentilles et les cuire 25 à 30 minutes dans une casserole d'eau frémissante non salée, jusqu'à ce qu'elles soient tendres. Saler en fin de cuisson et égoutter.";
    case "legumineuses":
      return `Rincer et égoutter ${p.the}.`;
  }
}

// ---------------------------------------------------------------------------
// Construction d'une recette

function elide(title: string): string {
  // « de épinards » -> « d'épinards » (le h de « haricots » est aspiré : pas d'élision).
  return title.replace(/\bde ([aeiouyéèêœ])/gi, "d'$1").replace(/\bau semoule\b/, "à la semoule");
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function noArticle(the: string): string {
  return the.replace(/^(les |le |la |l')/, "");
}

interface Built {
  steps: string[];
  equipment: Equipment[];
  cookMinutes: number;
}

function buildPoelee(v: Veg, p: Protein, starchId: string): Built {
  const starch = STARCHES[starchId];
  if (!starch) throw new Error(`Féculent inconnu : ${starchId}`);
  const pan = needsPan(p.kind);
  const steps = [
    `${v.prep} Émincer l'oignon.`,
    proteinStep(p, "dans une grande poêle"),
    starch.step,
    `Dans la ${pan ? "même " : "grande "}poêle, faire revenir l'oignon 3 minutes dans 1 c. à soupe d'huile. Ajouter ${v.the} et un fond d'eau, puis cuire environ ${v.pan} minutes à feu moyen, jusqu'à ce que les légumes soient tendres.`,
    `Ajouter ${p.the} et ${STARCH_LABEL[starchId] ?? "le féculent"}. Réchauffer le tout 3 minutes en remuant, saler, poivrer et servir bien chaud.`,
  ];
  const sequential = (pan ? PROTEIN_MINUTES[p.kind] : 0) + 3 + v.pan + 3;
  const parallel = Math.max(starch.minutes, pan ? 0 : PROTEIN_MINUTES[p.kind]) + 3;
  return { steps, equipment: ["poele", "casserole"], cookMinutes: Math.max(sequential, parallel) };
}

function buildGratin(v: Veg, p: Protein): Built {
  const pre = v.gratinPrep ?? `Précuire ${v.the} ${v.pre} minutes dans une casserole d'eau frémissante salée, puis bien les égoutter.`;
  const steps = [
    `Préchauffer le four à 190 °C. ${v.prep} Émincer l'oignon.`,
    pre,
    needsPan(p.kind)
      ? `${proteinStep(p, "dans une poêle")} Dans la même poêle, faire revenir l'oignon émincé 3 minutes.`
      : `${proteinStep(p, "")} Faire revenir l'oignon émincé 3 minutes dans une poêle avec 1 c. à soupe d'huile.`,
    `Mélanger la crème et la moutarde, saler et poivrer. Répartir ${v.the} et ${p.the} dans un plat à gratin, napper de sauce et couvrir de fromage râpé.`,
    "Enfourner 20 à 25 minutes, jusqu'à ce que le gratin soit doré et bien chaud au centre. Servir aussitôt.",
  ];
  return { steps, equipment: ["four", "casserole", "poele"], cookMinutes: Math.max(v.pre + 2, PROTEIN_MINUTES[p.kind] + 3) + 25 };
}

function buildMijote(v: Veg, p: Protein): Built {
  const fish = p.kind === "poisson";
  const pan = needsPan(p.kind) && !fish;
  const steps = [`${v.prep} Émincer l'oignon et l'ail.`];
  if (fish) steps.push("Retirer la peau du poisson, vérifier l'absence d'arêtes et le couper en gros morceaux. Le garder au réfrigérateur jusqu'à la cuisson.");
  else steps.push(proteinStep(p, "dans la cocotte"));
  steps.push(
    `Dans la cocotte, faire revenir l'oignon et l'ail 3 minutes dans 1 c. à soupe d'huile. Ajouter ${v.the} et mélanger.`,
    `Verser 500 ml d'eau et émietter le cube de bouillon, ajouter le thym. Couvrir et laisser mijoter ${v.stew} minutes à feu doux, jusqu'à ce que les légumes soient tendres.`,
    fish
      ? "Poser les morceaux de poisson dans le bouillon frémissant, couvrir et cuire 6 à 8 minutes sans remuer : la chair doit être opaque à cœur et se détacher facilement (63 °C à cœur). Rectifier l'assaisonnement et servir."
      : `Ajouter ${p.the}, laisser réchauffer 5 minutes à couvert, rectifier l'assaisonnement et servir.`,
  );
  const equipment: Equipment[] = ["cocotte"];
  if (p.kind === "oeufs" || p.kind === "lentilles") equipment.push("casserole");
  const before = pan ? PROTEIN_MINUTES[p.kind] : 0;
  const after = fish ? 8 : 5;
  const sequential = before + 3 + v.stew + after;
  const parallel = pan || fish ? 0 : PROTEIN_MINUTES[p.kind];
  return { steps, equipment, cookMinutes: Math.max(sequential, parallel + 5) };
}

function buildCurry(v: Veg, p: Protein): Built {
  const fish = p.kind === "poisson";
  const pan = needsPan(p.kind) && !fish;
  const steps = [`${v.prep} Émincer l'oignon.`];
  if (fish) steps.push("Retirer la peau du poisson, vérifier l'absence d'arêtes et le couper en gros morceaux. Le garder au réfrigérateur jusqu'à la cuisson.");
  else steps.push(proteinStep(p, "dans une grande casserole"));
  steps.push(
    STARCHES.riz!.step.replace("une grande casserole", "une autre casserole"),
    `Dans la grande casserole, faire revenir l'oignon 3 minutes dans 1 c. à soupe d'huile. Ajouter ${v.the} et le curry, mélanger 1 minute, puis verser le lait de coco et 150 ml d'eau.`,
    fish
      ? `Laisser mijoter ${v.curry} minutes à couvert. Poser les morceaux de poisson dans la sauce, couvrir et cuire 6 à 8 minutes à petit feu : la chair doit être opaque à cœur (63 °C à cœur). Saler et servir avec le riz.`
      : `Laisser mijoter ${v.curry} minutes à couvert, jusqu'à ce que les légumes soient tendres. Ajouter ${p.the}, réchauffer 5 minutes, saler et servir avec le riz.`,
  );
  const before = pan ? PROTEIN_MINUTES[p.kind] : 0;
  const sequential = before + 4 + v.curry + (fish ? 8 : 5);
  const parallel = Math.max(12, pan || fish ? 0 : PROTEIN_MINUTES[p.kind] + 5);
  return { steps, equipment: ["casserole"], cookMinutes: Math.max(sequential, parallel) };
}

function buildFour(v: Veg, p: Protein): Built {
  const late = v.lateOven;
  const steps = [
    `Préchauffer le four à 200 °C. Éplucher les pommes de terre et les couper en cubes de 2 cm. ${v.prep}`,
    late
      ? "Mélanger les pommes de terre avec l'huile, le paprika et l'ail écrasé sur une grande plaque. Enfourner 20 minutes."
      : `Mélanger les pommes de terre et ${v.the} avec l'huile, le paprika et l'ail écrasé sur une grande plaque. Enfourner 20 minutes.`,
    proteinStep(p, "dans une poêle"),
    late
      ? `Ajouter ${v.the} et ${p.the} sur la plaque, mélanger délicatement et prolonger la cuisson ${late} minutes.`
      : `Ajouter ${p.the} sur la plaque, mélanger délicatement et prolonger la cuisson 10 à 15 minutes, jusqu'à ce que les légumes soient fondants et dorés.`,
    "Vérifier que les pommes de terre sont tendres et que tout est bien chaud, saler, poivrer et servir.",
  ];
  const equipment: Equipment[] = ["four"];
  if (needsPan(p.kind)) equipment.push("poele");
  if (p.kind === "oeufs" || p.kind === "lentilles") equipment.push("casserole");
  return { steps, equipment, cookMinutes: Math.max(20, PROTEIN_MINUTES[p.kind]) + (late ?? 15) };
}

const TAGS_BY_FAMILY: Record<FamilyKey, string[]> = {
  poelee: ["plat complet", "poêle"],
  gratin: ["gratin", "four"],
  mijote: ["mijoté", "cocotte"],
  curry: ["curry", "plat complet"],
  four: ["four", "plat complet"],
};

function description(f: FamilyKey, v: Veg, p: Protein, starchId?: string): string {
  const veg = noArticle(v.the);
  const prot = noArticle(p.the);
  switch (f) {
    case "poelee": {
      const s = starchId === "pomme-de-terre" ? "pommes de terre" : noArticle(STARCH_LABEL[starchId ?? ""] ?? "féculent");
      return `Un plat complet à la poêle : ${veg}, ${prot} et ${s}.`;
    }
    case "gratin":
      return `${capitalizeFirst(veg)} et ${prot} gratinés à la crème moutardée.`;
    case "mijote":
      return `${capitalizeFirst(veg)} et ${prot} mijotés au thym en cocotte.`;
    case "curry":
      return `Curry doux au lait de coco : ${veg} et ${prot}, servi avec du riz.`;
    case "four":
      return `Tout sur une plaque : ${veg}, pommes de terre et ${prot} rôtis au paprika.`;
  }
}

const STARCH_LABEL: Record<string, string> = {
  riz: "le riz", pates: "les pâtes", quinoa: "le quinoa", boulgour: "le boulgour", semoule: "la semoule", "pomme-de-terre": "les pommes de terre",
};

export interface ExistingRecipeLike {
  id: string;
  title: string;
  ingredients: { ingredientId: string }[];
}

/** Mots du titre qui désignent le même type de plat que la famille importée. */
const FAMILY_TITLE_WORDS: Record<FamilyKey, RegExp> = {
  poelee: /\b(poelee|poele|saute|sautes|sautee)\b/,
  gratin: /\bgratin\b/,
  mijote: /\b(cocotte|mijote|mijotes|ragout)\b/,
  curry: /\bcurry\b/,
  four: /\b(plaque|roti|rotis|rotie|rosties|au four)\b/,
};

/**
 * Doublon d'une recette existante : même type de plat (d'après le titre), même légume et même garniture.
 * Recette proche : même légume et même garniture, mais un autre type de plat.
 */
export function compareWithExisting(
  family: FamilyKey,
  vegId: string,
  proteinId: string,
  existing: readonly ExistingRecipeLike[],
): { duplicateOf?: ExistingRecipeLike; closeTo?: ExistingRecipeLike } {
  let close: ExistingRecipeLike | undefined;
  for (const e of existing) {
    const ids = new Set(e.ingredients.map((l) => l.ingredientId));
    if (!ids.has(vegId) || !ids.has(proteinId)) continue;
    if (FAMILY_TITLE_WORDS[family].test(normTitle(e.title))) return { duplicateOf: e };
    close ??= e;
  }
  return close ? { closeTo: close } : {};
}

function warningsFor(f: FamilyKey, vegId: string, p: Protein, lines: RecipeIngredient[]): string[] {
  const w: string[] = [];
  if (p.kind === "oeufs") w.push("6 œufs durs pour 4 personnes comme seule protéine : portion un peu juste, 8 œufs seraient plus rassasiants.");
  if (p.kind === "lardons") w.push("180 g de lardons pour 4 personnes comme seule protéine : portion légère ; lardons déjà salés, saler peu.");
  if (f === "curry" && p.kind === "lardons") w.push("Association curry coco + lardons inhabituelle : à goûter avant publication.");
  if (f === "gratin" && (vegId === "tomate" || vegId === "courgette" || vegId === "aubergine")) w.push("Légume riche en eau : le gratin peut rendre du jus, bien égoutter.");
  if (vegId === "fenouil") w.push("Mois conseillés du fichier (octobre à avril) différents du calendrier de l'appli (juin à octobre pour le fenouil de France).");
  return w;
}

/** Corrections appliquées à toutes les recettes d'une famille (pour le rapport). */
export const FAMILY_CORRECTIONS: string[] = [
  "Étapes réécrites avec des temps précis pour chaque légume, féculent et garniture.",
  "Volaille : cuisson détaillée (8 à 10 min, plus de trace rosée, 74 °C à cœur) au lieu de « cuire complètement ».",
  "Poisson : cuisson détaillée (opaque à cœur, 63 °C) ; dans les cocottes et currys, il poche dans la sauce en fin de cuisson.",
  "Œufs : « selon la méthode indiquée » (aucune méthode donnée) remplacé par des œufs durs 10 minutes, jaune entièrement pris.",
  "Équipement complété (poêle et casserole réellement utilisées), pour que le filtre « cuisson » soit juste.",
  "Sel et poivre « selon le goût » ; ail compté en gousses ; bouillon en cube + eau ; saumon en pavés.",
  "Titres : français corrigé (« d'épinards » au lieu de « de épinards », « à la semoule » au lieu de « au semoule »).",
];

export function convertRecipe(src: SourceRecipe): { recipe: DraftRecipe; vegId: string; proteinId: string; starchId?: string } {
  const family = FAMILY_BY_CATEGORY[src.categorie];
  if (!family) throw new Error(`Famille inconnue : ${src.categorie}`);
  const notes: string[] = [];
  const lines = src.ingredients.map((l) => normalizeLine(l, notes));
  const ids = lines.map((l) => l.ingredientId);
  if (new Set(ids).size !== ids.length) throw new Error("Ingrédient en double dans la recette");
  const vegId = ids.find((id) => VEG[id]);
  const proteinId = ids.find((id) => PROTEINS[id]);
  if (!vegId || !proteinId) throw new Error("Légume ou garniture non reconnus");
  const v = VEG[vegId]!;
  const p = PROTEINS[proteinId]!;
  const starchId = family === "poelee" ? ids.find((id) => STARCHES[id]) : undefined;
  if (family === "poelee" && !starchId) throw new Error("Féculent manquant");

  const built =
    family === "poelee" ? buildPoelee(v, p, starchId!)
    : family === "gratin" ? buildGratin(v, p)
    : family === "mijote" ? buildMijote(v, p)
    : family === "curry" ? buildCurry(v, p)
    : buildFour(v, p);

  const title = elide(src.nom);
  const corrections = [...notes];
  if (title !== src.nom) corrections.push(`Titre corrigé : « ${src.nom} » → « ${title} ».`);
  if (built.cookMinutes > src.temps_cuisson_min) corrections.push(`Temps de cuisson porté de ${src.temps_cuisson_min} à ${built.cookMinutes} min (somme des étapes).`);
  const cook = Math.max(src.temps_cuisson_min, built.cookMinutes);
  const prep = src.temps_preparation_min;

  const tags = [...TAGS_BY_FAMILY[family], "familial"];
  if (["tofu", "legumineuses", "lentilles", "oeufs"].includes(p.kind)) tags.push("végétarien");
  if (p.kind === "poisson") tags.push("poisson");

  const recipe: DraftRecipe = {
    id: `imp-${src.id}`,
    title,
    description: description(family, v, p, starchId),
    emoji: FAMILY_EMOJI[family],
    prepMinutes: prep,
    cookMinutes: cook,
    totalMinutes: prep + cook,
    servings: src.portions,
    ingredients: lines,
    equipment: built.equipment.map((type) => ({ type, required: true })),
    instructions: built.steps,
    tags,
    published: false,
    review: {
      status: "brouillon",
      sourceId: src.id,
      family,
      corrections,
      warnings: warningsFor(family, vegId, p, lines),
    },
  };
  return { recipe, vegId, proteinId, starchId };
}

/**
 * Import complet. `previous` = brouillons déjà importés (pour garder leur statut de relecture).
 */
export function importRecipes(
  source: SourceFile,
  existing: readonly ExistingRecipeLike[],
  previous: readonly DraftRecipe[] = [],
): ImportResult {
  const prevStatus = new Map(previous.map((d) => [d.id, d.review.status]));
  const existingIds = new Set(existing.map((e) => e.id));
  const existingTitles = new Map(existing.map((e) => [normTitle(e.title), e]));
  const drafts: DraftRecipe[] = [];
  const rejected: RejectedRecipe[] = [];
  const seenSource = new Set<string>();
  const twins = new Map<string, string>();

  const sorted = [...source.recettes].sort((a, b) => a.id.localeCompare(b.id));
  for (const src of sorted) {
    if (seenSource.has(src.id)) {
      rejected.push({ sourceId: src.id, title: src.nom, reason: "doublon", detail: "Identifiant source présent deux fois dans le fichier." });
      continue;
    }
    seenSource.add(src.id);
    let conv: ReturnType<typeof convertRecipe>;
    try {
      conv = convertRecipe(src);
    } catch (e) {
      rejected.push({ sourceId: src.id, title: src.nom, reason: "invalide", detail: (e as Error).message });
      continue;
    }
    const { recipe, vegId, proteinId, starchId } = conv;
    if (existingIds.has(recipe.id)) {
      rejected.push({ sourceId: src.id, title: recipe.title, reason: "doublon", detail: "Identifiant déjà utilisé par une recette publiée.", duplicateOf: recipe.id });
      continue;
    }
    const sameTitle = existingTitles.get(normTitle(recipe.title));
    if (sameTitle) {
      rejected.push({ sourceId: src.id, title: recipe.title, reason: "doublon", detail: `Même titre que « ${sameTitle.title} ».`, duplicateOf: sameTitle.id });
      continue;
    }
    const cmp = compareWithExisting(recipe.review.family, vegId, proteinId, existing);
    if (cmp.duplicateOf) {
      rejected.push({
        sourceId: src.id, title: recipe.title, reason: "doublon",
        detail: `Même plat que « ${cmp.duplicateOf.title} », déjà dans l'appli.`, duplicateOf: cmp.duplicateOf.id,
      });
      continue;
    }
    if (cmp.closeTo) recipe.review.closeTo = cmp.closeTo.id;

    const twinKey = [recipe.review.family, vegId, PROTEINS[proteinId]!.group].join("|");
    const twin = twins.get(twinKey);
    if (twin) recipe.review.variantOf = twin;
    else twins.set(twinKey, recipe.id);

    const kept = prevStatus.get(recipe.id);
    if (kept) recipe.review.status = kept;
    drafts.push(recipe);
  }
  return { drafts, rejected };
}

export function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
