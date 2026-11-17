import type { Ingredient } from "../domain/types";
import { INGREDIENTS, QUICK_ADD_GROUPS, getIngredient } from "./ingredients";
import { inSeasonIds } from "./seasonality";

/** Lignes de l'ajout rapide : produits courants d’abord, puis les fruits et légumes de saison du mois. */
export function quickAddGroups(month: number): { label: string; items: Ingredient[] }[] {
  const season = new Set(inSeasonIds(month));
  return QUICK_ADD_GROUPS.map((g) => {
    const cat = getIngredient(g.ids[0] ?? "")?.category;
    const seasonal = cat === "legumes" || cat === "fruits"
      ? INGREDIENTS.filter((i) => i.category === cat && season.has(i.id) && !g.ids.includes(i.id))
          .sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, 6)
      : [];
    const items = [...g.ids.map((id) => getIngredient(id)).filter(Boolean) as Ingredient[], ...seasonal];
    return { label: g.label, items };
  });
}
