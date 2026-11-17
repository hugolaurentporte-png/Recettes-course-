"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { getIngredient } from "@/lib/data/ingredients";
import { recipeAvailability } from "@/lib/domain/availability";
import { MEALS, nextDay, toDateKey, type PlanEntry } from "@/lib/domain/plan";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { CartIcon, XIcon } from "@/components/Icons";

function slotLabel(e: PlanEntry, today: string): string {
  const day = e.date === today ? (e.meal === "soir" ? "Ce soir" : "Ce midi") : (e.meal === "soir" ? "Demain soir" : "Demain midi");
  return day;
}

/** Plats prévus pour aujourd'hui et demain : visibles sur l'accueil des deux membres du foyer. */
export function PlannedMeals() {
  const store = useStore();
  const today = toDateKey(new Date());
  const tomorrow = nextDay(today);
  const entries = [today, tomorrow]
    .flatMap((d) => MEALS.map((m) => store.plan.find((e) => e.date === d && e.meal === m)))
    .filter((e): e is PlanEntry => !!e && RECIPES_BY_ID.has(e.recipeId));
  if (entries.length === 0) return null;
  return (
    <section className="mt-5 space-y-3" aria-label="Plats prévus">
      {entries.map((e) => <PlannedCard key={e.id} entry={e} label={slotLabel(e, today)} />)}
    </section>
  );
}

function PlannedCard({ entry, label }: { entry: PlanEntry; label: string }) {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const recipe = RECIPES_BY_ID.get(entry.recipeId)!;
  const a = recipeAvailability(recipe, store.inventoryMap, getIngredient, entry.servings);
  const toAdd = a.lines.filter((l) => !l.line.optional && l.status !== "ok").length;
  const href = `/recettes/${recipe.id}/`;

  async function addMissing() {
    setBusy(true);
    try {
      const sum = await store.addPlannedToShopping(entry);
      const n = sum ? sum.added + sum.updated : 0;
      toast(
        n === 0 ? "Rien à ajouter : tout est déjà là" : `${n} article${n > 1 ? "s" : ""} dans la liste commune`,
        n > 0 ? { label: "Voir", run: () => router.push("/courses/") } : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    store.removePlanEntry(entry.id);
    toast(`${recipe.title} retiré du planning`, {
      label: "Annuler",
      run: () => store.planRecipe(entry.recipeId, entry.date, entry.meal, entry.servings),
    });
  }

  return (
    <article className="card overflow-hidden" aria-label={`${label} : ${recipe.title}`}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <Link href={href} className="flex flex-1 items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl" aria-hidden="true">{recipe.emoji}</span>
          <span className="flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-brand-700">👥 {label}</span>
            <span className="block font-semibold leading-tight">{recipe.title}</span>
            <span className="text-sm text-stone-500">
              {entry.servings} pers. · {toAdd === 0 ? "vous avez tout" : `il manque ${toAdd} ingrédient${toAdd > 1 ? "s" : ""}`}
            </span>
          </span>
        </Link>
        <button type="button" onClick={remove} aria-label={`Retirer ${recipe.title} du planning`}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-400">
          <XIcon width={18} />
        </button>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <Link href={href} className="btn-secondary flex-1 whitespace-nowrap px-3">Voir la recette</Link>
        {toAdd > 0 && (
          <button type="button" className="btn-primary flex-[1.3] whitespace-nowrap px-3" disabled={busy} onClick={() => void addMissing()}
            aria-label="Ajouter ce qui manque aux courses">
            <CartIcon width={18} className="shrink-0" /> {busy ? "Ajout…" : "Aux courses"}
          </button>
        )}
      </div>
    </article>
  );
}
