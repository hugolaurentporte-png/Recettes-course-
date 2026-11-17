import { INGREDIENTS } from "@/lib/data/ingredients";
import { RECIPES } from "@/lib/data/recipes";
import { itemKey, normalizeText } from "./normalize";
import type { Ingredient, Recipe } from "./types";

/** Ingrédients du catalogue qui correspondent à ce qui est tapé, dès la première lettre. */
export function searchIngredients(q: string, limit = 8, list: Ingredient[] = INGREDIENTS): Ingredient[] {
  const n = normalizeText(q);
  const k = itemKey(q);
  if (!n) return [];
  const score = (i: Ingredient) => {
    const names = [i.normalizedName, ...i.aliases];
    if (names.some((x) => x.startsWith(n) || itemKey(x).startsWith(k))) return 0;
    if (names.some((x) => x.split(" ").some((w) => w.startsWith(n)))) return 1;
    if (names.some((x) => x.includes(n))) return 2;
    return 9;
  };
  return list.map((i) => [i, score(i)] as const)
    .filter(([, s]) => s < 9)
    .sort((a, b) => a[1] - b[1] || a[0].name.localeCompare(b[0].name, "fr"))
    .slice(0, limit)
    .map(([i]) => i);
}

/** Recettes dont le nom correspond à ce qui est tapé (début de mot en premier). */
export function searchRecipeTitles(q: string, limit = 5, list: Recipe[] = RECIPES): Recipe[] {
  const n = normalizeText(q);
  if (!n) return [];
  const score = (r: Recipe) => {
    const t = normalizeText(r.title);
    if (t.startsWith(n)) return 0;
    if (t.split(" ").some((w) => w.startsWith(n))) return 1;
    if (t.includes(n)) return 2;
    return 9;
  };
  return list.filter((r) => r.published)
    .map((r) => [r, score(r)] as const)
    .filter(([, s]) => s < 9)
    .sort((a, b) => a[1] - b[1] || a[0].title.localeCompare(b[0].title, "fr"))
    .slice(0, limit)
    .map(([r]) => r);
}
