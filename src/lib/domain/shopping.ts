import type {
  Aisle, Amount, Ingredient, InventoryItem, ItemHistory, Recipe, RecipeNeed, ShoppingItem, ShoppingTrip, Unit,
} from "./types";
import { aisleForCategory, AISLE_ORDER, guessAisle, matchIngredient } from "./categorize";
import { capitalize, itemKey } from "./normalize";
import { computeMissing, scaledNeed } from "./availability";
import { convert, sumAmounts } from "./units";

/** Contexte injecté : rend les fonctions pures et testables (horloge, identifiants, appareil). */
export interface ShoppingContext {
  now: number;
  newId: () => string;
  deviceId: string;
  listId: string;
  catalog: readonly Ingredient[];
  getIngredient: (id: string) => Ingredient | undefined;
}

export function keyForIngredient(id: string): string {
  return `ing:${id}`;
}

function amountOf(q: number | null, u: Unit | null): Amount | null {
  return q !== null && u !== null ? { value: q, unit: u } : null;
}

/** Articles visibles (non supprimés). */
export function activeItems(items: readonly ShoppingItem[]): ShoppingItem[] {
  return items.filter((i) => i.deletedAt === null);
}

/** Article non coché portant la même clé : c'est lui qu'on complète au lieu de créer un doublon. */
function findOpenDuplicate(items: readonly ShoppingItem[], key: string): ShoppingItem | undefined {
  return items.find((i) => i.deletedAt === null && !i.checked && i.key === key);
}

function newItem(ctx: ShoppingContext, fields: Partial<ShoppingItem> & Pick<ShoppingItem, "customName" | "key" | "aisle">): ShoppingItem {
  return {
    id: ctx.newId(),
    listId: ctx.listId,
    ingredientId: null,
    aisleLocked: false,
    manual: null,
    recipeNeeds: [],
    recipeMissing: [],
    toVerify: false,
    note: "",
    checked: false,
    checkedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    updatedBy: ctx.deviceId,
    ...fields,
  };
}

function touch(item: ShoppingItem, ctx: ShoppingContext, patch: Partial<ShoppingItem>): ShoppingItem {
  return { ...item, ...patch, updatedAt: ctx.now, updatedBy: ctx.deviceId };
}

function replace(items: readonly ShoppingItem[], updated: ShoppingItem): ShoppingItem[] {
  return items.map((i) => (i.id === updated.id ? updated : i));
}

export interface ManualInput {
  name: string;
  quantity?: number | null;
  unit?: Unit | null;
}

/** Additionne deux quantités manuelles si elles sont compatibles ; sinon null. */
function mergeManual(
  a: { quantity: number | null; unit: Unit | null } | null,
  b: { quantity: number | null; unit: Unit | null },
  ingredient?: Ingredient,
): { quantity: number | null; unit: Unit | null } | null {
  if (!a || a.quantity === null || a.unit === null) return b.quantity !== null ? b : a ?? b;
  if (b.quantity === null || b.unit === null) return a;
  const converted = convert({ value: b.quantity, unit: b.unit }, a.unit, ingredient);
  if (converted === null) return null;
  return { quantity: Math.round((a.quantity + converted) * 1000) / 1000, unit: a.unit };
}

/**
 * Ajout manuel d'un article (alimentaire ou non).
 * Si un article identique non coché existe, il est complété (fusion) au lieu d'être dupliqué.
 */
export function addManualItem(
  items: readonly ShoppingItem[],
  input: ManualInput,
  ctx: ShoppingContext,
): { items: ShoppingItem[]; item: ShoppingItem; merged: boolean } {
  const name = capitalize(input.name);
  if (!name) throw new Error("Le nom de l'article est vide");
  const ingredient = matchIngredient(name, ctx.catalog);
  const key = ingredient ? keyForIngredient(ingredient.id) : itemKey(name);
  const manualIn = { quantity: input.quantity ?? null, unit: input.quantity != null ? input.unit ?? "piece" : null };

  const dup = findOpenDuplicate(items, key);
  if (dup) {
    const merged = mergeManual(dup.manual, manualIn, ingredient);
    if (merged !== null) {
      const updated = touch(dup, ctx, { manual: merged });
      return { items: replace(items, updated), item: updated, merged: true };
    }
    // Unités incompatibles (ex. « 1 paquet » et « 500 g ») : on garde deux lignes distinctes.
  }

  const item = newItem(ctx, {
    customName: name,
    key,
    ingredientId: ingredient?.id ?? null,
    aisle: ingredient ? aisleForCategory(ingredient.category) : guessAisle(name, ctx.catalog),
    manual: manualIn.quantity !== null ? manualIn : null,
  });
  return { items: [...items, item], item, merged: false };
}

export interface RecipeAddSummary {
  added: number;
  updated: number;
  toVerify: number;
  alreadyAvailable: number;
}

/**
 * « Ajouter ce qu'il manque » depuis une recette.
 * - n'écrase jamais les ajouts manuels (champ `manual` intouché) ;
 * - ajouter deux fois la même recette remplace sa contribution au lieu de la doubler ;
 * - plusieurs recettes : les besoins sont cumulés puis le stock est déduit une seule fois.
 */
export function addRecipeToList(
  items: readonly ShoppingItem[],
  recipe: Recipe,
  servings: number,
  inventory: ReadonlyMap<string, InventoryItem>,
  ctx: ShoppingContext,
): { items: ShoppingItem[]; summary: RecipeAddSummary } {
  let next = [...items];
  const summary: RecipeAddSummary = { added: 0, updated: 0, toVerify: 0, alreadyAvailable: 0 };

  for (const line of recipe.ingredients) {
    if (line.optional) continue;
    const ingredient = ctx.getIngredient(line.ingredientId);
    if (!ingredient) continue;
    const need = scaledNeed(line, recipe.servings, servings);
    const stock = inventory.get(ingredient.id);
    const key = keyForIngredient(ingredient.id);
    const existing = findOpenDuplicate(next, key);

    const newNeed: RecipeNeed = {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      quantity: need?.value ?? null,
      unit: need?.unit ?? null,
    };
    const needs = [...(existing?.recipeNeeds ?? []).filter((n) => n.recipeId !== recipe.id), newNeed];
    const result = computeMissing(needs.map((n) => amountOf(n.quantity, n.unit)), stock, ingredient);
    // Indispensables possédés sans quantité (sel, huile, beurre…) : on fait confiance à l'utilisateur.
    const toVerify = result.toVerify && !(ingredient.staple && stock?.quantity === null);
    const needed = result.missing.length > 0 || toVerify || (result.absent && result.unquantified);

    if (!needed) {
      if (existing) {
        next = replace(next, touch(existing, ctx, { recipeNeeds: needs, recipeMissing: [], toVerify: false }));
      }
      summary.alreadyAvailable++;
      continue;
    }

    if (toVerify) summary.toVerify++;
    if (existing) {
      next = replace(next, touch(existing, ctx, { recipeNeeds: needs, recipeMissing: result.missing, toVerify }));
      summary.updated++;
    } else {
      next.push(
        newItem(ctx, {
          customName: ingredient.name,
          key,
          ingredientId: ingredient.id,
          aisle: aisleForCategory(ingredient.category),
          recipeNeeds: needs,
          recipeMissing: result.missing,
          toVerify,
        }),
      );
      summary.added++;
    }
  }
  return { items: next, summary };
}

/** Quantités à afficher : ajout manuel + manque des recettes, fusionnés si compatibles. */
export function displayAmounts(item: ShoppingItem): Amount[] {
  const parts: Amount[] = [...item.recipeMissing];
  const m = amountOf(item.manual?.quantity ?? null, item.manual?.unit ?? null);
  if (m) parts.push(m);
  return sumAmounts(parts);
}

export function toggleChecked(items: readonly ShoppingItem[], id: string, ctx: ShoppingContext): ShoppingItem[] {
  return items.map((i) =>
    i.id === id ? touch(i, ctx, { checked: !i.checked, checkedAt: i.checked ? null : ctx.now }) : i,
  );
}

export interface ItemEdit {
  name?: string;
  quantity?: number | null;
  unit?: Unit | null;
  aisle?: Aisle;
  note?: string;
}

/**
 * Modification d'un article.
 * Modifier la quantité à la main en fait la nouvelle référence : les contributions des recettes
 * sont alors remises à zéro (on garde la trace des recettes d'origine dans la note d'affichage).
 */
export function editItem(items: readonly ShoppingItem[], id: string, edit: ItemEdit, ctx: ShoppingContext): ShoppingItem[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const patch: Partial<ShoppingItem> = {};
    if (edit.name !== undefined && capitalize(edit.name) && capitalize(edit.name) !== i.customName) {
      const name = capitalize(edit.name);
      const ingredient = matchIngredient(name, ctx.catalog);
      patch.customName = name;
      patch.ingredientId = ingredient?.id ?? null;
      patch.key = ingredient ? keyForIngredient(ingredient.id) : itemKey(name);
      if (!i.aisleLocked && edit.aisle === undefined) {
        patch.aisle = ingredient ? aisleForCategory(ingredient.category) : guessAisle(name, ctx.catalog);
      }
    }
    if (edit.quantity !== undefined) {
      const unit = edit.quantity === null ? null : edit.unit ?? i.manual?.unit ?? "piece";
      patch.manual = edit.quantity === null ? null : { quantity: edit.quantity, unit };
      patch.recipeMissing = [];
      patch.recipeNeeds = [];
      patch.toVerify = false;
    }
    if (edit.aisle !== undefined && edit.aisle !== i.aisle) {
      patch.aisle = edit.aisle;
      patch.aisleLocked = true;
    }
    if (edit.note !== undefined) patch.note = edit.note;
    return touch(i, ctx, patch);
  });
}

/** Suppression douce : l'article reste en base avec `deletedAt` pour la future synchronisation. */
export function deleteItem(items: readonly ShoppingItem[], id: string, ctx: ShoppingContext): ShoppingItem[] {
  return items.map((i) => (i.id === id ? touch(i, ctx, { deletedAt: ctx.now }) : i));
}

/**
 * « Terminer mes courses » : archive les articles cochés, garde les autres intacts.
 */
export function finishShopping(
  items: readonly ShoppingItem[],
  ctx: ShoppingContext,
  /** Montant du ticket et prix par article (id → euros), facultatifs. */
  money: { amount?: number | null; prices?: ReadonlyMap<string, number> } = {},
): { items: ShoppingItem[]; trip: ShoppingTrip | null } {
  const bought = activeItems(items).filter((i) => i.checked);
  if (bought.length === 0) return { items: [...items], trip: null };
  const ids = new Set(bought.map((b) => b.id));
  return {
    items: items.map((i) => (ids.has(i.id) ? touch(i, ctx, { deletedAt: ctx.now }) : i)),
    trip: {
      id: ctx.newId(),
      listId: ctx.listId,
      finishedAt: ctx.now,
      items: bought.map(({ id, customName, ingredientId, aisle, manual, recipeMissing }) => {
        const price = money.prices?.get(id);
        return { customName, ingredientId, aisle, manual, recipeMissing, ...(price ? { price } : {}) };
      }),
      ...tripAmount(bought.map((b) => money.prices?.get(b.id)), money.amount),
    },
  };
}

/** Total du ticket : celui tapé, sinon la somme des prix saisis, sinon rien. */
function tripAmount(prices: (number | undefined)[], typed?: number | null): { amount?: number } {
  if (typed && typed > 0) return { amount: typed };
  const sum = prices.reduce<number>((s, p) => s + (p ?? 0), 0);
  return sum > 0 ? { amount: Math.round(sum * 100) / 100 } : {};
}

export interface AisleGroup {
  aisle: Aisle;
  items: ShoppingItem[];
}

/** Articles à acheter groupés par rayon (ordre du magasin), puis articles cochés en bas. */
export function groupForDisplay(items: readonly ShoppingItem[]): { groups: AisleGroup[]; checked: ShoppingItem[] } {
  const active = activeItems(items);
  const open = active.filter((i) => !i.checked);
  const groups = AISLE_ORDER.map((aisle) => ({
    aisle,
    items: open.filter((i) => i.aisle === aisle).sort((a, b) => a.createdAt - b.createdAt),
  })).filter((g) => g.items.length > 0);
  const checked = active.filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));
  return { groups, checked };
}

/** Met à jour l'historique de saisie (fréquence) utilisé pour les suggestions. */
export function recordUsage(history: readonly ItemHistory[], item: ShoppingItem, now: number): ItemHistory[] {
  const found = history.find((h) => h.key === item.key);
  if (found) {
    return history.map((h) =>
      h.key === item.key ? { ...h, name: item.customName, aisle: item.aisle, count: h.count + 1, lastUsedAt: now } : h,
    );
  }
  return [
    ...history,
    { key: item.key, name: item.customName, aisle: item.aisle, ingredientId: item.ingredientId, count: 1, lastUsedAt: now },
  ];
}

/**
 * Suggestions de saisie : d'abord les articles fréquents de l'utilisateur, puis le catalogue.
 * Les articles déjà présents (non cochés) dans la liste sont exclus.
 */
export function suggest(
  query: string,
  history: readonly ItemHistory[],
  items: readonly ShoppingItem[],
  catalog: readonly Ingredient[],
  limit = 8,
  products: readonly string[] = [],
): { name: string; key: string; frequent: boolean }[] {
  const q = itemKey(query);
  const inList = new Set(activeItems(items).filter((i) => !i.checked).map((i) => i.key));
  const matches = (name: string, extra: string[] = []) =>
    q === "" || [name, ...extra].some((n) => itemKey(n).split(" ").some((w) => w.startsWith(q)) || itemKey(n).startsWith(q));

  const out: { name: string; key: string; frequent: boolean }[] = [];
  const seen = new Set<string>();
  const frequent = [...history].sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt);
  for (const h of frequent) {
    if (inList.has(h.key) || seen.has(h.key) || !matches(h.name)) continue;
    out.push({ name: h.name, key: h.key, frequent: true });
    seen.add(h.key);
  }
  if (q !== "") {
    for (const ing of catalog) {
      const key = keyForIngredient(ing.id);
      if (inList.has(key) || seen.has(key) || !matches(ing.name, ing.aliases)) continue;
      out.push({ name: ing.name, key, frequent: false });
      seen.add(key);
    }
    for (const name of products) {
      if (!matches(name)) continue;
      const ing = matchIngredient(name, catalog);
      const key = ing ? keyForIngredient(ing.id) : itemKey(name);
      if (inList.has(key) || seen.has(key)) continue;
      out.push({ name, key, frequent: false });
      seen.add(key);
    }
  }
  return out.slice(0, limit);
}

