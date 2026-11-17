import type { Recipe } from "./types";

/**
 * Parcours « Qu'est-ce qu'on mange ? » : moment du repas (entrée, plat, dessert)
 * puis type de recette. Une recette peut appartenir à plusieurs moments et plusieurs types
 * (une soupe peut être une entrée ou un repas complet, une quiche une entrée ou un plat).
 */
export type Course = "entree" | "plat" | "dessert";

export interface MealType {
  id: string;
  label: string;
  emoji: string;
}

export interface CourseDef {
  id: Course;
  label: string;
  emoji: string;
  hint: string;
  types: MealType[];
}

export const COURSES: CourseDef[] = [
  {
    id: "entree", label: "Entrée", emoji: "🥗", hint: "Salades, soupes, tartinades…",
    types: [
      { id: "salade", label: "Salade", emoji: "🥗" },
      { id: "soupe", label: "Soupe", emoji: "🥣" },
      { id: "tartinade", label: "Tartinade", emoji: "🫓" },
      { id: "tarte-salee", label: "Tarte & cake salé", emoji: "🥧" },
    ],
  },
  {
    id: "plat", label: "Plat", emoji: "🍲", hint: "Gratins, pâtes, plats mijotés…",
    types: [
      { id: "gratin", label: "Gratin", emoji: "🧀" },
      { id: "quiche", label: "Quiche & tarte", emoji: "🥧" },
      { id: "pates", label: "Pâtes", emoji: "🍝" },
      { id: "mijote", label: "Plat mijoté", emoji: "🍲" },
      { id: "soupe-repas", label: "Soupe-repas", emoji: "🥣" },
      { id: "salade-repas", label: "Salade-repas", emoji: "🥗" },
      { id: "poisson", label: "Poisson", emoji: "🐟" },
      { id: "poelee", label: "Poêlée", emoji: "🍳" },
      { id: "roti", label: "Rôti au four", emoji: "🍗" },
      { id: "oeufs", label: "Œufs", emoji: "🥚" },
      { id: "riz", label: "Riz", emoji: "🍚" },
      { id: "sandwich", label: "Burger, wrap, croque", emoji: "🍔" },
      { id: "accompagnement", label: "Accompagnement", emoji: "🥔" },
    ],
  },
  {
    id: "dessert", label: "Dessert", emoji: "🍰", hint: "Gâteaux, tartes, compotes…",
    types: [
      { id: "gateau", label: "Gâteau", emoji: "🍰" },
      { id: "tarte", label: "Tarte & crumble", emoji: "🥧" },
      { id: "compote", label: "Compote & fruits", emoji: "🍎" },
      { id: "creme", label: "Crème & mousse", emoji: "🍮" },
      { id: "crepes", label: "Crêpes & pancakes", emoji: "🥞" },
      { id: "rapide", label: "Dessert rapide", emoji: "⚡" },
    ],
  },
];

export const COURSES_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c])) as Record<Course, CourseDef>;

export type MealClass = Partial<Record<Course, string[]>>;

/** Classement des recettes du catalogue (relu à la main). */
const CLASSES: Record<string, MealClass> = {
  "poelee-pdt-lardons": { plat: ["poelee"] },
  "gratin-pdt-carottes": { plat: ["gratin", "accompagnement"] },
  "omelette-champignons": { plat: ["oeufs"] },
  "pates-carbonara": { plat: ["pates"] },
  "soupe-legumes": { entree: ["soupe"], plat: ["soupe-repas"] },
  "veloute-potiron": { entree: ["soupe"], plat: ["soupe-repas"] },
  "quiche-lorraine": { entree: ["tarte-salee"], plat: ["quiche"] },
  "hachis-parmentier": { plat: ["gratin"] },
  "poulet-curry-coco": { plat: ["poelee"] },
  "risotto-champignons": { plat: ["riz"] },
  ratatouille: { plat: ["mijote", "accompagnement"] },
  "salade-nicoise": { entree: ["salade"], plat: ["salade-repas"] },
  "croque-monsieur": { plat: ["sandwich"] },
  bolognaise: { plat: ["pates"] },
  "saumon-four-legumes": { plat: ["poisson", "roti"] },
  "dahl-lentilles": { plat: ["mijote"] },
  "chili-con-carne": { plat: ["mijote"] },
  "boeuf-bourguignon": { plat: ["mijote"] },
  tartiflette: { plat: ["gratin"] },
  "gratin-courgettes": { plat: ["gratin", "accompagnement"] },
  lasagnes: { plat: ["pates", "gratin"] },
  crepes: { dessert: ["crepes"] },
  "salade-lentilles": { entree: ["salade"], plat: ["salade-repas"] },
  "pates-pesto-courgettes": { plat: ["pates"] },
  "poulet-roti-pdt": { plat: ["roti"] },
  "airfryer-pdt": { plat: ["accompagnement"] },
  "airfryer-poulet": { plat: ["roti"] },
  taboule: { entree: ["salade"], plat: ["accompagnement"] },
  "salade-tomate-mozza": { entree: ["salade"] },
  "wraps-poulet": { plat: ["sandwich"] },
  "soupe-poireaux-pdt": { entree: ["soupe"], plat: ["soupe-repas"] },
  "endives-jambon": { plat: ["gratin"] },
  "cabillaud-poele-citron": { plat: ["poisson", "poelee"] },
  "pates-thon-tomate": { plat: ["pates"] },
  "chou-fleur-gratin": { plat: ["gratin", "accompagnement"] },
  shakshuka: { plat: ["oeufs"] },
  "puree-maison": { plat: ["accompagnement"] },
  "riz-cantonais": { plat: ["riz", "poelee"] },
  "tarte-chevre-tomates": { entree: ["tarte-salee"], plat: ["quiche"] },
  "papillote-poisson": { plat: ["poisson"] },
  "couscous-legumes": { plat: ["mijote"] },
  "compote-pommes": { dessert: ["compote"] },
  "gateau-chocolat": { dessert: ["gateau"] },
  "crumble-pommes": { dessert: ["tarte"] },
  "porc-moutarde": { plat: ["poelee"] },
  "soupe-lentilles-corail": { entree: ["soupe"], plat: ["soupe-repas"] },
  "gnocchis-poele-epinards": { plat: ["pates", "poelee"] },
  "blanquette-veau": { plat: ["mijote"] },
  "poulet-basquaise": { plat: ["mijote"] },
  "potee-chou": { plat: ["mijote"] },
  "moules-marinieres": { plat: ["poisson"] },
  "navarin-agneau": { plat: ["mijote"] },
  "curry-pois-chiches": { plat: ["mijote"] },
  "soupe-oignon": { entree: ["soupe"], plat: ["soupe-repas"] },
  "veloute-butternut": { entree: ["soupe"], plat: ["soupe-repas"] },
  "veloute-brocoli": { entree: ["soupe"], plat: ["soupe-repas"] },
  minestrone: { entree: ["soupe"], plat: ["soupe-repas"] },
  gaspacho: { entree: ["soupe"] },
  "salade-grecque": { entree: ["salade"] },
  "salade-quinoa-avocat": { entree: ["salade"], plat: ["salade-repas"] },
  "salade-endives-noix": { entree: ["salade"] },
  "burger-maison": { plat: ["sandwich"] },
  "gratin-dauphinois": { plat: ["gratin", "accompagnement"] },
  "galettes-pdt": { plat: ["poelee", "accompagnement"] },
  "gratin-pates-jambon": { plat: ["gratin", "pates"] },
  "one-pot-pasta": { plat: ["pates"] },
  "pates-saumon": { plat: ["pates", "poisson"] },
  "pates-champignons": { plat: ["pates"] },
  "tarte-poireaux": { entree: ["tarte-salee"], plat: ["quiche"] },
  "quiche-courgette-chevre": { entree: ["tarte-salee"], plat: ["quiche"] },
  "cake-sale": { entree: ["tarte-salee"] },
  "crevettes-ail": { plat: ["poisson", "poelee"] },
  "saumon-soja-miel": { plat: ["poisson"] },
  "airfryer-saumon": { plat: ["poisson"] },
  "poulet-citron-four": { plat: ["roti"] },
  "dinde-creme-champignons": { plat: ["poelee"] },
  "saucisses-lentilles": { plat: ["mijote"] },
  "chou-fleur-roti": { plat: ["roti", "accompagnement"] },
  "legumes-rotis": { plat: ["roti", "accompagnement"] },
  "frittata-courgettes": { plat: ["oeufs"] },
  "oeufs-cocotte": { plat: ["oeufs"] },
  "puree-patate-douce": { plat: ["accompagnement"] },
  "haricots-verts-ail": { plat: ["accompagnement"] },
  "riz-au-lait": { dessert: ["creme"] },
  "clafoutis-cerises": { dessert: ["gateau"] },
  "mousse-chocolat": { dessert: ["creme"] },
  pancakes: { dessert: ["crepes"] },
  "banana-bread": { dessert: ["gateau"] },
  "salade-fruits": { dessert: ["compote"] },
  porridge: { dessert: ["compote"] },
  "tm-risotto-champignons": { plat: ["riz"] },
  "tm-veloute-potiron": { entree: ["soupe"], plat: ["soupe-repas"] },
  "tm-soupe-poireaux": { entree: ["soupe"], plat: ["soupe-repas"] },
  "tm-puree": { plat: ["accompagnement"] },
  "tm-bolognaise": { plat: ["pates"] },
  "tm-dahl-lentilles": { plat: ["mijote"] },
  "tm-houmous": { entree: ["tartinade"] },
  "tm-compote-pommes": { dessert: ["compote"] },
};

/** Un dessert prêt en 20 minutes ou moins est aussi un « dessert rapide ». */
export const QUICK_DESSERT_MINUTES = 20;

/**
 * Pour une recette absente du tableau (ajout futur) : déduction à partir des étiquettes,
 * pour qu'elle apparaisse quand même dans le parcours.
 */
function inferClass(recipe: Recipe): MealClass {
  const tags = new Set(recipe.tags);
  if (tags.has("dessert")) {
    const t: string[] = [];
    if (tags.has("tarte")) t.push("tarte");
    else if (tags.has("compote") || tags.has("coulis")) t.push("compote");
    else if (tags.has("crème")) t.push("creme");
    else if (recipe.equipment.some((e) => e.required && e.type === "four")) t.push("gateau");
    return { dessert: t };
  }
  if (tags.has("soupe")) return { entree: ["soupe"], plat: ["soupe-repas"] };
  if (tags.has("salade")) return { entree: ["salade"], plat: ["salade-repas"] };
  if (tags.has("apéritif")) return { entree: tags.has("tartinade") ? ["tartinade"] : [] };
  const plat: string[] = [];
  if (tags.has("gratin")) plat.push("gratin");
  if (tags.has("pâtes")) plat.push("pates");
  if (tags.has("mijoté") || tags.has("cocotte") || tags.has("curry")) plat.push("mijote");
  if (tags.has("poêle")) plat.push("poelee");
  if (tags.has("tarte")) plat.push("quiche");
  if (tags.has("poisson")) plat.push("poisson");
  if (tags.has("riz")) plat.push("riz");
  if (tags.has("œufs")) plat.push("oeufs");
  if (tags.has("accompagnement")) plat.push("accompagnement");
  // Plat au four qui n'est ni un gratin ni une tarte : rôti / plaque au four.
  if (tags.has("four") && !tags.has("gratin") && !tags.has("tarte")) plat.push("roti");
  return { plat };
}

export function mealClass(recipe: Recipe): MealClass {
  const base = CLASSES[recipe.id] ?? inferClass(recipe);
  if (!base.dessert) return base;
  const quick = recipe.totalMinutes <= QUICK_DESSERT_MINUTES && !base.dessert.includes("rapide");
  return quick ? { ...base, dessert: [...base.dessert, "rapide"] } : base;
}

/** La recette correspond-elle au moment choisi et au type choisi (null = « Toutes les idées ») ? */
export function matchesMeal(recipe: Recipe, course: Course, type: string | null): boolean {
  const types = mealClass(recipe)[course];
  if (!types) return false;
  return type === null || types.includes(type);
}

export function isCourse(v: string | null): v is Course {
  return v === "entree" || v === "plat" || v === "dessert";
}
