"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useRanking } from "@/lib/useRanking";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { MEALS, MEAL_LABELS, dayLabel, toDateKey, weekDays, type Meal, type PlanEntry } from "@/lib/domain/plan";
import type { Equipment } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/labels";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { CartIcon, MinusIcon, PlusIcon, SearchIcon, XIcon } from "@/components/Icons";

const NO_MODES: Equipment[] = [];

export default function PlanningPage() {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [slot, setSlot] = useState<{ date: string; meal: Meal } | null>(null);

  const today = toDateKey(new Date());
  const days = useMemo(() => weekDays(new Date(), offset), [offset]);
  const byDay = useMemo(() => {
    const m = new Map<string, PlanEntry>();
    for (const e of store.plan) m.set(`${e.date}|${e.meal}`, e);
    return m;
  }, [store.plan]);
  // Cette semaine : on ne prévoit pas les jours déjà passés.
  const visibleDays = offset === 0 ? days.filter((d) => d >= today) : days;
  const planned = visibleDays.flatMap((d) => MEALS.map((m) => byDay.get(`${d}|${m}`))).filter(Boolean).length;

  function addWeekToShopping() {
    const sum = store.addPlanToShopping(visibleDays);
    const n = sum.added + sum.updated;
    toast(
      n === 0 ? "Rien à ajouter : vous avez déjà tout" : `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses`,
      n > 0 ? { label: "Voir", run: () => router.push("/courses/") } : undefined,
    );
  }

  const weekTitle = offset === 0 ? "Cette semaine" : offset === 1 ? "Semaine prochaine" : offset === -1 ? "Semaine dernière" : `Semaine du ${dayLabel(days[0] ?? today, "")}`;

  return (
    <div className="px-4 pb-6">
      <header className="sticky top-0 z-20 -mx-4 bg-[#f7f7f5]/95 px-4 pb-3 pt-4 backdrop-blur">
        <h1 className="text-2xl font-bold">Planning des repas</h1>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" className="btn-secondary h-11 min-h-0 px-4" onClick={() => setOffset(offset - 1)} disabled={offset <= 0}
            aria-label="Semaine précédente">‹</button>
          <p className="font-semibold">{weekTitle}</p>
          <button type="button" className="btn-secondary h-11 min-h-0 px-4" onClick={() => setOffset(offset + 1)} disabled={offset >= 3}
            aria-label="Semaine suivante">›</button>
        </div>
      </header>

      <div className="space-y-3">
        {visibleDays.map((d) => (
          <section key={d} className="card overflow-hidden">
            <h2 className={`px-4 pt-3 text-sm font-bold ${d === today ? "text-brand-700" : "text-stone-700"}`}>{dayLabel(d, today)}</h2>
            <ul className="divide-y divide-stone-100">
              {MEALS.map((meal) => {
                const e = byDay.get(`${d}|${meal}`);
                const r = e ? RECIPES_BY_ID.get(e.recipeId) : undefined;
                return (
                  <li key={meal} className="flex min-h-[56px] items-center gap-2 pl-4 pr-1">
                    <span className="w-10 shrink-0 text-xs font-semibold uppercase text-stone-400">{MEAL_LABELS[meal]}</span>
                    {e && r ? (
                      <>
                        <Link href={`/recettes/${r.id}/`} className="flex min-h-[56px] flex-1 items-center gap-2 py-2">
                          <span className="text-xl" aria-hidden="true">{r.emoji}</span>
                          <span className="leading-tight">{r.title}</span>
                        </Link>
                        <div className="flex shrink-0 items-center" role="group" aria-label={`Portions pour ${r.title}`}>
                          <button type="button" className="flex h-11 w-8 items-center justify-center text-stone-500" aria-label="Moins de portions"
                            onClick={() => store.updatePlanEntry(e.id, { servings: Math.max(1, e.servings - 1) })}><MinusIcon width={16} /></button>
                          <span className="w-8 text-center text-xs font-semibold">{e.servings}&nbsp;p.</span>
                          <button type="button" className="flex h-11 w-8 items-center justify-center text-stone-500" aria-label="Plus de portions"
                            onClick={() => store.updatePlanEntry(e.id, { servings: Math.min(20, e.servings + 1) })}><PlusIcon width={16} /></button>
                        </div>
                        <button type="button" className="flex h-11 w-10 shrink-0 items-center justify-center text-stone-400"
                          aria-label={`Retirer ${r.title}`} onClick={() => store.removePlanEntry(e.id)}><XIcon width={18} /></button>
                      </>
                    ) : (
                      <button type="button" className="flex min-h-[56px] flex-1 items-center gap-2 text-left text-brand-700"
                        onClick={() => setSlot({ date: d, meal })}>
                        <PlusIcon width={18} /> Choisir une recette
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <button type="button" className="btn-primary mt-5 w-full" disabled={planned === 0} onClick={addWeekToShopping}>
        <CartIcon width={20} /> Mettre ce qui manque dans les courses
      </button>
      <p className="mt-2 px-1 text-center text-xs text-stone-500">
        {planned === 0 ? "Choisissez des recettes pour remplir la liste de courses." : `${planned} repas prévu${planned > 1 ? "s" : ""}. Ce que vous avez dans le frigo est déduit.`}
      </p>

      <Sheet open={slot !== null} onClose={() => setSlot(null)} title={slot ? `${dayLabel(slot.date, today)} · ${MEAL_LABELS[slot.meal]}` : ""}>
        {slot && (
          <RecipePicker key={`${slot.date}|${slot.meal}`} onPick={(id, servings) => {
            store.planRecipe(id, slot.date, slot.meal, servings);
            setSlot(null);
          }} />
        )}
      </Sheet>
    </div>
  );
}

function RecipePicker({ onPick }: { onPick: (recipeId: string, servings: number) => void }) {
  const [q, setQ] = useState("");
  const ranked = useRanking({ query: q, maxMinutes: null, modes: NO_MODES, onlyReady: false });
  const list = ranked.slice(0, q ? 30 : 15);
  return (
    <div>
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" width={20} height={20} />
        <input type="search" className="input pl-11" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder="Nom ou ingrédient…" aria-label="Chercher une recette" />
      </div>
      {!q && <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Suggestions avec ce que vous avez</p>}
      <ul className="mt-2 max-h-[50vh] divide-y divide-stone-100 overflow-y-auto">
        {list.map((s) => (
          <li key={s.recipe.id}>
            <button type="button" className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left"
              onClick={() => onPick(s.recipe.id, s.recipe.servings)}>
              <span className="text-2xl" aria-hidden="true">{s.recipe.emoji}</span>
              <span className="flex-1">
                <span className="block leading-tight">{s.recipe.title}</span>
                <span className="text-xs text-stone-500">
                  {formatMinutes(s.recipe.totalMinutes)} · {s.availability.allAvailable ? "vous avez tout" : `il manque ${s.availability.missingCount}`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-stone-500">Aucune recette trouvée.</li>}
      </ul>
    </div>
  );
}
