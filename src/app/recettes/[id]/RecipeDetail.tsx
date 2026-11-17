"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { getIngredient } from "@/lib/data/ingredients";
import { recipeAvailability, type LineStatus } from "@/lib/domain/availability";
import { seasonLevel } from "@/lib/data/seasonality";
import { formatAmount } from "@/lib/domain/units";
import { EQUIPMENT_LABELS, formatMinutes } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { Visual } from "@/components/RecipeCard";
import { BackIcon, CalendarIcon, CartIcon, MinusIcon, PlusIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { MEALS, MEAL_LABELS, dayLabel, toDateKey, weekDays, type Meal } from "@/lib/domain/plan";

const STATUS_STYLE: Record<LineStatus, { icon: string; cls: string; label: string }> = {
  ok: { icon: "✓", cls: "text-brand-700", label: "Disponible" },
  verify: { icon: "?", cls: "text-warm-600", label: "Quantité à vérifier" },
  insufficient: { icon: "!", cls: "text-warm-600", label: "Pas assez" },
  missing: { icon: "✗", cls: "text-red-700", label: "Manquant" },
};

export function RecipeDetail({ id }: { id: string }) {
  const recipe = RECIPES_BY_ID.get(id)!;
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [servings, setServings] = useState(recipe.servings);
  const [planning, setPlanning] = useState(false);
  const a = useMemo(
    () => recipeAvailability(recipe, store.inventoryMap, getIngredient, servings),
    [recipe, store.inventoryMap, servings],
  );
  const month = new Date().getMonth() + 1;
  const toAdd = a.lines.filter((l) => !l.line.optional && l.status !== "ok").length;

  function addMissing() {
    const sum = store.addRecipe(recipe, servings);
    const n = sum.added + sum.updated;
    toast(
      n === 0 ? "Rien à ajouter : vous avez tout" : `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses`,
      n > 0 ? { label: "Voir", run: () => router.push("/courses/") } : undefined,
    );
  }

  return (
    <div>
      <div className="relative">
        <Visual id={recipe.id} emoji={recipe.emoji} className="h-48 text-8xl" />
        <Link href="/recettes/" aria-label="Retour aux recettes"
          className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow">
          <BackIcon />
        </Link>
      </div>

      <div className="px-4">
        <h1 className="mt-4 text-2xl font-bold leading-tight">{recipe.title}</h1>
        <p className="mt-1 text-stone-600">{recipe.description}</p>

        <dl className="card mt-4 grid grid-cols-3 divide-x divide-stone-100 text-center">
          <div className="p-3"><dt className="text-xs text-stone-500">Préparation</dt><dd className="font-semibold">{formatMinutes(recipe.prepMinutes)}</dd></div>
          <div className="p-3"><dt className="text-xs text-stone-500">Cuisson</dt><dd className="font-semibold">{recipe.cookMinutes ? formatMinutes(recipe.cookMinutes) : "—"}</dd></div>
          <div className="p-3"><dt className="text-xs text-stone-500">Total</dt><dd className="font-semibold">{formatMinutes(recipe.totalMinutes)}</dd></div>
        </dl>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-bold">Ingrédients</h2>
          <div className="flex items-center gap-2" role="group" aria-label="Nombre de portions">
            <button type="button" className="btn-secondary h-11 min-h-0 w-11 px-0" aria-label="Moins de portions"
              onClick={() => setServings(Math.max(1, servings - 1))}><MinusIcon width={18} /></button>
            <span className="w-16 text-center text-sm font-semibold" aria-live="polite">{servings} pers.</span>
            <button type="button" className="btn-secondary h-11 min-h-0 w-11 px-0" aria-label="Plus de portions"
              onClick={() => setServings(Math.min(20, servings + 1))}><PlusIcon width={18} /></button>
          </div>
        </div>

        <ul className="card mt-3 divide-y divide-stone-100">
          {a.lines.map((l) => {
            const st = STATUS_STYLE[l.status];
            const season = seasonLevel(l.line.ingredientId, month);
            return (
              <li key={l.line.ingredientId} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 w-5 text-center font-bold ${l.line.optional && l.status === "missing" ? "text-stone-400" : st.cls}`} aria-label={st.label}>{l.line.optional && l.status === "missing" ? "–" : st.icon}</span>
                <div className="flex-1">
                  <p>
                    {l.need ? <span className="font-semibold">{formatAmount(l.need)} </span> : null}
                    {l.ingredient?.name ?? l.line.ingredientId}
                    {!l.need && <span className="text-stone-500"> (selon le goût)</span>}
                    {l.line.optional && <span className="text-stone-500"> — facultatif</span>}
                    {season === 2 && <span className="ml-1 text-xs" title="De saison">🌱</span>}
                  </p>
                  {l.status !== "ok" && l.line.optional && l.status === "missing" && (
                    <p className="text-xs text-stone-500">Absent, peut être omis</p>
                  )}
                  {l.status !== "ok" && !(l.line.optional && l.status === "missing") && (
                    <p className={`text-xs ${st.cls}`}>
                      {st.label}
                      {l.status === "insufficient" && l.missing.length > 0 && ` : il manque ${l.missing.map(formatAmount).join(" + ")}`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {toAdd > 0 ? (
          <button type="button" className="btn-primary mt-4 w-full" onClick={addMissing}>
            <CartIcon width={20} /> Ajouter ce qu&apos;il manque aux courses
          </button>
        ) : (
          <p className="mt-4 rounded-2xl bg-brand-50 p-4 text-center font-semibold text-brand-700">✓ Vous avez tout ce qu&apos;il faut</p>
        )}

        <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setPlanning(true)}>
          <CalendarIcon width={20} /> Ajouter au planning
        </button>

        <h2 className="mt-8 text-lg font-bold">Matériel</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {recipe.equipment.map((e) => (
            <span key={e.type} className="chip">{EQUIPMENT_LABELS[e.type]}{e.required ? "" : " (facultatif)"}</span>
          ))}
        </div>

        <h2 className="mt-8 text-lg font-bold">Préparation</h2>
        <ol className="mb-8 mt-3 space-y-4">
          {recipe.instructions.map((step, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{idx + 1}</span>
              <p className="pt-1 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      <Sheet open={planning} onClose={() => setPlanning(false)} title="Quand ?">
        {planning && (
          <PlanPicker onPick={(date, meal) => {
            store.planRecipe(recipe.id, date, meal, servings);
            setPlanning(false);
            toast(`Ajouté au planning : ${dayLabel(date, "").toLowerCase()}, ${MEAL_LABELS[meal].toLowerCase()}`,
              { label: "Voir", run: () => router.push("/planning/") });
          }} />
        )}
      </Sheet>
    </div>
  );
}

/** Choix du jour et du repas sur les 10 prochains jours. */
function PlanPicker({ onPick }: { onPick: (date: string, meal: Meal) => void }) {
  const { plan } = useStore();
  const today = toDateKey(new Date());
  const days = [...weekDays(new Date()), ...weekDays(new Date(), 1)].filter((d) => d >= today).slice(0, 10);
  const taken = new Set(plan.map((e) => `${e.date}|${e.meal}`));
  return (
    <ul className="max-h-[60vh] divide-y divide-stone-100 overflow-y-auto">
      {days.map((d) => (
        <li key={d} className="flex items-center gap-2 py-2">
          <span className="flex-1 text-sm font-medium">{dayLabel(d, today)}</span>
          {MEALS.map((m) => (
            <button key={m} type="button" className="chip" onClick={() => onPick(d, m)}
              aria-label={`${dayLabel(d, today)}, ${MEAL_LABELS[m]}${taken.has(`${d}|${m}`) ? " (remplace le repas prévu)" : ""}`}>
              {MEAL_LABELS[m]}{taken.has(`${d}|${m}`) ? " •" : ""}
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}
