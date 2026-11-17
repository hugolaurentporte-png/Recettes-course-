"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { RECIPES } from "./data/recipes";
import { getIngredient } from "./data/ingredients";
import { rankRecipes, type Filters } from "./domain/recommend";

/** Classement des recettes pour l'état courant (stock, équipement, mois). */
export function useRanking(filters: Omit<Filters, "ownedEquipment">) {
  const { inventoryMap, settings } = useStore();
  const month = new Date().getMonth() + 1;
  const { maxMinutes, modes, query, onlyReady } = filters;
  return useMemo(
    () =>
      rankRecipes(
        RECIPES,
        { maxMinutes, modes, query, onlyReady, ownedEquipment: settings.ownedEquipment },
        { inventory: inventoryMap, getIngredient, month },
      ),
    [inventoryMap, settings.ownedEquipment, month, maxMinutes, modes, query, onlyReady],
  );
}
