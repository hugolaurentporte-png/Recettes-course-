/**
 * Types métier partagés. Aucun import de React ni du stockage ici :
 * tout ce dossier est pur et testable.
 */

/** Unités supportées. "piece" couvre "unité" et "pièce". */
export type Unit = "g" | "kg" | "ml" | "cl" | "l" | "piece" | "cc" | "cs" | "pincee";

/** Dimension physique : seules des unités de même dimension se convertissent. */
export type Dimension = "mass" | "volume" | "count" | "spoon" | "pinch";

export interface Amount {
  value: number;
  unit: Unit;
}

/** Catégories de l'inventaire (Mon frigo). */
export type IngredientCategory =
  | "legumes"
  | "fruits"
  | "viandes"
  | "poissons"
  | "laitiers"
  | "oeufs"
  | "feculents"
  | "conserves"
  | "epicerie"
  | "condiments"
  | "surgeles"
  | "boissons";

/** Rayons de la liste de courses. */
export type Aisle =
  | "fruits-legumes"
  | "viandes-poissons"
  | "frais"
  | "epicerie"
  | "surgeles"
  | "boissons"
  | "hygiene"
  | "maison"
  | "autres";

export interface Ingredient {
  id: string;
  name: string;
  /** Nom normalisé (minuscules, sans accents) pour la recherche. */
  normalizedName: string;
  category: IngredientCategory;
  defaultUnit: Unit;
  aliases: string[];
  /** Ingrédient de base proposé dans « Mes indispensables ». */
  staple?: boolean;
  /**
   * Poids moyen d'une pièce en grammes, uniquement si une équivalence documentée existe.
   * Sans cette valeur, on ne convertit jamais pièces <-> grammes.
   */
  pieceGrams?: number;
  /** Fruit ou légume concerné par la saisonnalité. */
  seasonal?: boolean;
}

export type Equipment = "four" | "poele" | "casserole" | "cocotte" | "airfryer" | "thermomix" | "sans-cuisson";

export interface RecipeIngredient {
  ingredientId: string;
  /** null = « selon le goût » (sel, poivre…) : jamais bloquant pour la quantité. */
  quantity: number | null;
  unit: Unit | null;
  optional?: boolean;
}

export interface RecipeEquipment {
  type: Equipment;
  required: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  /** Emoji servant de visuel original tant qu'il n'y a pas de photo sous licence. */
  emoji: string;
  imageUrl?: string;
  prepMinutes: number;
  cookMinutes: number;
  /** Temps total jusqu'au service (peut inclure repos / marinade). */
  totalMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  equipment: RecipeEquipment[];
  instructions: string[];
  tags: string[];
  published: boolean;
}

/** Un ingrédient possédé (Mon frigo). */
export interface InventoryItem {
  id: string;
  /** Ingrédient du catalogue, ou « custom:<clé> » pour un produit libre (lessive, café…). */
  ingredientId: string;
  /** Produit libre seulement : nom affiché et rayon. */
  customName?: string;
  aisle?: Aisle;
  quantity: number | null;
  unit: Unit | null;
  priority: boolean;
  updatedAt: number;
}

/** Contribution d'une recette à un article de courses. */
export interface RecipeNeed {
  recipeId: string;
  recipeTitle: string;
  quantity: number | null;
  unit: Unit | null;
}

/**
 * Article de la liste de courses.
 * - Indépendant du catalogue : `ingredientId` est facultatif, `customName` est toujours rempli.
 * - Prêt pour la synchronisation : id unique, `listId`, `updatedAt`, `deletedAt` (suppression douce), `updatedBy`.
 */
export interface ShoppingItem {
  id: string;
  listId: string;
  ingredientId: string | null;
  customName: string;
  /** Clé de regroupement des doublons (nom normalisé ou ingredientId). */
  key: string;
  aisle: Aisle;
  /** true si l'utilisateur a choisi lui-même le rayon : on ne le recalcule plus. */
  aisleLocked: boolean;
  /** Quantité saisie à la main (conservée lors des ajouts depuis les recettes). */
  manual: { quantity: number | null; unit: Unit | null } | null;
  /** Besoins bruts des recettes qui ont alimenté l'article. */
  recipeNeeds: RecipeNeed[];
  /** Manque calculé pour les recettes (besoins cumulés − stock compté une seule fois). */
  recipeMissing: Amount[];
  /** Le stock existe mais sa quantité est inconnue ou non comparable. */
  toVerify: boolean;
  note: string;
  checked: boolean;
  checkedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  updatedBy: string;
}

/** Courses terminées (historique). */
export interface ShoppingTrip {
  id: string;
  listId: string;
  finishedAt: number;
  items: Pick<ShoppingItem, "customName" | "ingredientId" | "aisle" | "manual" | "recipeMissing">[];
}

/** Fréquence de saisie, pour les suggestions. */
export interface ItemHistory {
  key: string;
  name: string;
  aisle: Aisle;
  ingredientId: string | null;
  count: number;
  lastUsedAt: number;
}
