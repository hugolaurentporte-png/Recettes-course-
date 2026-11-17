/**
 * Calendrier de saisonnalité — France métropolitaine (région "FR-METRO").
 * Inspiré des calendriers publics de l'ADEME et d'Interfel (production de plein champ).
 * Niveau 2 = pleine saison, 1 = début ou fin de saison. Mois de 1 (janvier) à 12.
 * Structure prête pour d'autres régions : il suffit d'ajouter une clé.
 */
export type SeasonLevel = 0 | 1 | 2;

type Calendar = Record<string, { full: number[]; edge?: number[] }>;

const FR_METRO: Calendar = {
  "pomme-de-terre": { full: [6, 7, 8, 9, 10, 11, 12, 1, 2], edge: [3, 4, 5] },
  carotte: { full: [7, 8, 9, 10, 11, 12, 1, 2, 3], edge: [4, 5, 6] },
  oignon: { full: [7, 8, 9, 10, 11, 12, 1, 2, 3], edge: [4, 5, 6] },
  "oignon-rouge": { full: [7, 8, 9, 10, 11, 12, 1], edge: [2, 3] },
  echalote: { full: [7, 8, 9, 10, 11, 12, 1], edge: [2, 3] },
  tomate: { full: [7, 8, 9], edge: [6, 10] },
  "tomate-cerise": { full: [7, 8, 9], edge: [6, 10] },
  courgette: { full: [6, 7, 8, 9], edge: [5, 10] },
  aubergine: { full: [7, 8, 9], edge: [6, 10] },
  poivron: { full: [7, 8, 9], edge: [6, 10] },
  champignon: { full: [9, 10, 11], edge: [1, 2, 3, 4, 5, 6, 7, 8, 12] },
  poireau: { full: [10, 11, 12, 1, 2, 3], edge: [9, 4] },
  brocoli: { full: [9, 10, 11], edge: [6, 7, 8, 12] },
  "chou-fleur": { full: [10, 11, 12, 1, 2, 3], edge: [9, 4] },
  epinard: { full: [3, 4, 5, 10, 11], edge: [2, 6, 9, 12] },
  "haricot-vert": { full: [7, 8, 9], edge: [6, 10] },
  "petit-pois": { full: [5, 6, 7], edge: [4, 8] },
  concombre: { full: [6, 7, 8, 9], edge: [5, 10] },
  salade: { full: [4, 5, 6, 7, 8, 9, 10], edge: [3, 11] },
  potiron: { full: [10, 11, 12], edge: [9, 1, 2] },
  butternut: { full: [10, 11, 12], edge: [9, 1, 2] },
  "patate-douce": { full: [10, 11, 12], edge: [9, 1] },
  navet: { full: [10, 11, 12, 1, 2], edge: [3, 9] },
  "celeri-rave": { full: [10, 11, 12, 1, 2], edge: [3, 9] },
  "celeri-branche": { full: [7, 8, 9, 10], edge: [6, 11] },
  endive: { full: [11, 12, 1, 2, 3], edge: [10, 4] },
  chou: { full: [10, 11, 12, 1, 2], edge: [3, 9] },
  "chou-blanc": { full: [10, 11, 12, 1, 2, 3], edge: [9, 4] },
  potimarron: { full: [9, 10, 11, 12], edge: [1, 2] },
  asperge: { full: [4, 5, 6], edge: [3] },
  radis: { full: [4, 5, 6, 7], edge: [3, 8, 9] },
  betterave: { full: [7, 8, 9, 10, 11, 12, 1], edge: [2, 3, 6] },
  avocat: { full: [], edge: [11, 12, 1, 2, 3] },
  pomme: { full: [9, 10, 11, 12, 1, 2], edge: [3, 4, 8] },
  poire: { full: [9, 10, 11, 12], edge: [8, 1, 2] },
  orange: { full: [12, 1, 2, 3], edge: [11, 4] },
  clementine: { full: [11, 12, 1, 2], edge: [10, 3] },
  kiwi: { full: [11, 12, 1, 2, 3], edge: [10, 4] },
  fraise: { full: [5, 6, 7], edge: [4, 8, 9] },
  framboise: { full: [6, 7, 8], edge: [9] },
  peche: { full: [7, 8], edge: [6, 9] },
  abricot: { full: [6, 7], edge: [8] },
  prune: { full: [8, 9], edge: [7] },
  raisin: { full: [9, 10], edge: [8, 11] },
  melon: { full: [7, 8], edge: [6, 9] },
  cerise: { full: [6], edge: [5, 7] },
  rhubarbe: { full: [5, 6], edge: [4, 7] },
  "courge-spaghetti": { full: [9, 10, 11], edge: [8, 12] },
  "chou-rouge": { full: [10, 11, 12, 1, 2, 3], edge: [9, 4] },
  "chou-bruxelles": { full: [10, 11, 12, 1, 2], edge: [9, 3] },
  "chou-chinois": { full: [10, 11, 12], edge: [9, 1] },
  "chou-kale": { full: [10, 11, 12, 1, 2], edge: [9, 3] },
  fenouil: { full: [6, 7, 8, 9, 10], edge: [5, 11] },
  artichaut: { full: [5, 6, 7, 8, 9], edge: [4, 10] },
  panais: { full: [10, 11, 12, 1, 2], edge: [9, 3] },
  topinambour: { full: [11, 12, 1, 2, 3], edge: [10] },
  rutabaga: { full: [10, 11, 12, 1, 2], edge: [3] },
  "radis-noir": { full: [10, 11, 12, 1, 2], edge: [3] },
  salsifis: { full: [10, 11, 12, 1, 2], edge: [3] },
  blette: { full: [6, 7, 8, 9, 10], edge: [5, 11] },
  "pois-gourmand": { full: [5, 6, 7], edge: [4, 8] },
  feve: { full: [5, 6], edge: [4, 7] },
  "oignon-nouveau": { full: [4, 5, 6], edge: [3, 7] },
  mache: { full: [10, 11, 12, 1, 2, 3], edge: [9, 4] },
  roquette: { full: [5, 6, 7, 8, 9], edge: [4, 10] },
  cresson: { full: [3, 4, 5, 10], edge: [9, 11] },
  frisee: { full: [9, 10, 11, 12], edge: [8, 1] },
  pamplemousse: { full: [12, 1, 2, 3], edge: [11, 4] },
  nectarine: { full: [7, 8], edge: [6, 9] },
  figue: { full: [8, 9], edge: [7, 10] },
  myrtille: { full: [7, 8], edge: [6, 9] },
  mure: { full: [8, 9], edge: [7] },
  groseille: { full: [6, 7], edge: [8] },
  cassis: { full: [7], edge: [6, 8] },
  pasteque: { full: [7, 8], edge: [6, 9] },
  grenade: { full: [10, 11, 12], edge: [9, 1] },
  coing: { full: [10, 11], edge: [9, 12] },
  kaki: { full: [10, 11, 12], edge: [1] },
  chataigne: { full: [10, 11], edge: [9, 12] },
};

export const SEASONALITY: Record<string, Calendar> = { "FR-METRO": FR_METRO };
export const DEFAULT_REGION = "FR-METRO";

export function seasonLevel(ingredientId: string, month: number, region = DEFAULT_REGION): SeasonLevel | null {
  const cal = SEASONALITY[region]?.[ingredientId];
  if (!cal) return null; // ingrédient non saisonnier ou inconnu
  if (cal.full.includes(month)) return 2;
  if (cal.edge?.includes(month)) return 1;
  return 0;
}

export function inSeasonIds(month: number, region = DEFAULT_REGION): string[] {
  const cal = SEASONALITY[region] ?? {};
  return Object.keys(cal).filter((id) => cal[id]?.full.includes(month));
}
