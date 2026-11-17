"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { RECIPES } from "./data/recipes";
import { getIngredient } from "./data/ingredients";
import { rankRecipes, type Filters } from "./domain/recommend";
import { withoutDisliked } from "./domain/carnet";
import type { Equipment } from "./domain/types";

/**
 * Classement des recettes pour l'état courant (stock, équipement, mois).
 * `extraEquipment` : matériel choisi explicitement (ex. Thermomix dans « Qu'est-ce qu'on mange ? ») :
 * on le considère comme possédé même s'il n'est pas coché dans Mon frigo.
 * Les recettes « pas pour nous » du carnet ne sont plus proposées (ni dans « Qu'est-ce qu'on mange ? », ni au tirage
 * au sort) ; quand on cherche par le nom, elles restent trouvables, en fin de liste.
 */
export function useRanking(filters: Omit<Filters, "ownedEquipment">, extraEquipment: Equipment[] = []) {
  const { inventoryMap, settings, disliked } = useStore();
  const month = new Date().getMonth() + 1;
  const { maxMinutes, modes, query, onlyReady } = filters;
  const extraKey = extraEquipment.join(",");
  const ranked = useMemo(
    () => {
      const extra = extraKey ? (extraKey.split(",") as Equipment[]) : [];
      const owned = [...new Set([...settings.ownedEquipment, ...extra])];
      return rankRecipes(
        RECIPES,
        { maxMinutes, modes, query, onlyReady, ownedEquipment: owned },
        { inventory: inventoryMap, getIngredient, month },
      );
    },
    [inventoryMap, settings.ownedEquipment, extraKey, month, maxMinutes, modes, query, onlyReady],
  );
  const searching = (query ?? "").trim() !== "";
  return useMemo(() => withoutDisliked(ranked, disliked, (s) => s.recipe.id, searching), [ranked, disliked, searching]);
}
