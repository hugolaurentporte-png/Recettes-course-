import type { Aisle, Ingredient, IngredientCategory } from "./types";
import { itemKey, normalizeText } from "./normalize";
import { PRODUCT_AISLE } from "../data/products";

const PRODUCT_BY_KEY: ReadonlyMap<string, Aisle> = new Map([...PRODUCT_AISLE].map(([n, a]) => [itemKey(n), a]));

export const AISLE_LABELS: Record<Aisle, string> = {
  "fruits-legumes": "Fruits et légumes",
  "viandes-poissons": "Viandes et poissons",
  frais: "Produits frais",
  epicerie: "Épicerie",
  surgeles: "Surgelés",
  boissons: "Boissons",
  hygiene: "Hygiène et beauté",
  maison: "Maison et entretien",
  autres: "Autres",
};

export const AISLE_ORDER: Aisle[] = [
  "fruits-legumes", "viandes-poissons", "frais", "epicerie", "surgeles", "boissons", "hygiene", "maison", "autres",
];

export const AISLE_ICONS: Record<Aisle, string> = {
  "fruits-legumes": "🥕",
  "viandes-poissons": "🥩",
  frais: "🧀",
  epicerie: "🥫",
  surgeles: "❄️",
  boissons: "🧃",
  hygiene: "🧴",
  maison: "🧽",
  autres: "🛒",
};

export function aisleForCategory(c: IngredientCategory): Aisle {
  switch (c) {
    case "legumes":
    case "fruits":
      return "fruits-legumes";
    case "viandes":
    case "poissons":
      return "viandes-poissons";
    case "laitiers":
    case "oeufs":
      return "frais";
    case "surgeles":
      return "surgeles";
    case "boissons":
      return "boissons";
    default:
      return "epicerie";
  }
}

/** Mots-clés pour les produits hors catalogue (y compris non alimentaires). Ordre = priorité. */
const KEYWORDS: [Aisle, string[]][] = [
  ["surgeles", ["surgele", "glace", "glaces", "frite surgelee", "pizza surgelee", "esquimau"]],
  ["hygiene", ["shampoing", "shampooing", "dentifrice", "brosse a dent", "savon", "gel douche", "deodorant", "coton", "rasoir", "mouchoir", "papier toilette", "pq", "couche", "lingette", "creme solaire", "serviette hygienique", "tampon", "apres shampoing", "bebe", "lait infantile", "petit pot", "liniment", "pansement", "doliprane", "paracetamol", "serum", "demaquillant", "coton tige", "fil dentaire", "bain de bouche"]],
  ["maison", ["lessive", "liquide vaisselle", "eponge", "sac poubelle", "essuie tout", "sopalin", "javel", "nettoyant", "pastille lave vaisselle", "adoucissant", "ampoule", "pile", "aluminium", "film alimentaire", "allumette", "bougie", "croquette", "litiere", "patee", "sac congelation", "papier cuisson", "gant", "detachant", "lave vaisselle", "rincage", "vitre", "wc"]],
  ["boissons", ["eau", "jus", "soda", "coca", "biere", "vin", "cafe", "the", "sirop", "limonade", "tisane"]],
  ["frais", ["yaourt", "fromage", "beurre", "creme", "lait", "oeuf", "jambon", "pate fraiche", "compote", "dessert", "skyr", "faisselle", "camembert", "emmental", "gruyere"]],
  ["viandes-poissons", ["viande", "poulet", "boeuf", "porc", "veau", "agneau", "steak", "saucisse", "poisson", "saumon", "thon frais", "crevette", "jambon cru"]],
  ["fruits-legumes", ["fruit", "legume", "salade", "pomme", "banane", "tomate", "carotte", "oignon", "ail", "herbe", "citron"]],
  ["epicerie", ["pate", "riz", "farine", "sucre", "sel", "huile", "conserve", "biscuit", "gateau", "cereale", "chocolat", "confiture", "miel", "epice", "sauce", "moutarde", "ketchup", "mayonnaise", "chips", "pain", "brioche", "semoule", "lentille", "bocal"]],
];

function containsWord(haystack: string, needle: string): boolean {
  return (` ${haystack} `).includes(` ${needle} `) || (` ${haystack} `).includes(` ${needle}s `);
}

/** Retrouve un ingrédient du catalogue à partir d'un nom libre (nom exact ou alias). */
export function matchIngredient(name: string, catalog: readonly Ingredient[]): Ingredient | undefined {
  const k = itemKey(name);
  const n = normalizeText(name);
  return catalog.find(
    (i) => itemKey(i.name) === k || i.normalizedName === n || i.aliases.some((a) => a === n || itemKey(a) === k),
  );
}

/**
 * Classement automatique d'un article libre.
 * 1. catalogue d'ingrédients ; 2. mots-clés (y compris non alimentaires) ; 3. « Autres ».
 */
export function guessAisle(name: string, catalog: readonly Ingredient[]): Aisle {
  const ing = matchIngredient(name, catalog);
  if (ing) return aisleForCategory(ing.category);
  const known = PRODUCT_BY_KEY.get(itemKey(name));
  if (known) return known;
  const n = normalizeText(name);
  for (const [aisle, words] of KEYWORDS) {
    if (words.some((w) => containsWord(n, w))) return aisle;
  }
  return "autres";
}
