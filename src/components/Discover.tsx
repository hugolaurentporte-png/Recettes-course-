"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useRanking } from "@/lib/useRanking";
import { getIngredient } from "@/lib/data/ingredients";
import { inSeasonIds } from "@/lib/data/seasonality";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { describeIdea, discover, listFr, type Idea } from "@/lib/domain/discover";
import { drawRecipe } from "@/lib/domain/random";
import { plannedAt, toDateKey } from "@/lib/domain/plan";
import type { Equipment } from "@/lib/domain/types";
import type { ScoredRecipe } from "@/lib/domain/recommend";
import { formatMinutes } from "@/lib/labels";
import { summarizeAvailability } from "@/lib/domain/phrasing";
import { Visual } from "./RecipeCard";

const NO_MODES: Equipment[] = [];
const TONE = { ok: "text-brand-700", verify: "text-amber-700", missing: "text-warm-600" } as const;
/** Légumes de saison montrés avant « + N autres ». */
const SHORT = 10;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Contenu du panneau « À découvrir » du planning : idées pour ce soir selon le frigo et la saison. */
export function Discover({ onPlanned }: { onPlanned: (title: string) => void }) {
  const store = useStore();
  const ranked = useRanking({ query: "", maxMinutes: null, modes: NO_MODES, onlyReady: false });
  const month = new Date().getMonth() + 1;
  const today = toDateKey(new Date());
  const plannedIds = useMemo(() => new Set(store.plan.filter((e) => e.date >= today).map((e) => e.recipeId)), [store.plan, today]);
  const d = useMemo(
    () => discover(ranked, { month, inventory: store.inventoryMap, getIngredient, plannedIds, inSeason: inSeasonIds(month) }),
    [ranked, month, store.inventoryMap, plannedIds],
  );
  const [drawnId, setDrawnId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ScoredRecipe | null>(null);
  const [showAll, setShowAll] = useState(false);
  const drawn = drawnId ? d.pool.find((s) => s.recipe.id === drawnId) ?? null : null;
  const tonight = plannedAt(store.plan, today, "soir");
  const tonightTitle = tonight ? RECIPES_BY_ID.get(tonight.recipeId)?.title ?? "un autre plat" : null;

  function planTonight(s: ScoredRecipe, force = false) {
    if (tonight && tonight.recipeId !== s.recipe.id && !force) {
      setConfirm(s);
      return;
    }
    store.planRecipe(s.recipe.id, today, "soir", s.recipe.servings);
    onPlanned(s.recipe.title);
  }

  if (confirm) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-warm-50 p-4">Ce soir, <strong>{tonightTitle}</strong> est déjà prévu.</p>
        <p className="font-semibold">Remplacer le plat prévu ?</p>
        <button type="button" className="btn-primary w-full" onClick={() => planTonight(confirm, true)}>Remplacer par {confirm.recipe.title}</button>
        <button type="button" className="btn-secondary w-full" onClick={() => setConfirm(null)}>Garder {tonightTitle}</button>
      </div>
    );
  }

  const fridgeSeasonal = d.seasonalNow.filter((x) => x.inFridge);
  const emptyFridge = store.inventoryMap.size === 0;

  return (
    <div className="space-y-5" data-testid="discover">
      <section>
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">🧊 Avec ce que vous avez</h3>
        {d.fridge.length > 0 ? (
          <ul className="mt-2 space-y-2">{d.fridge.map((i) => <IdeaRow key={i.s.recipe.id} i={i} onTonight={planTonight} />)}</ul>
        ) : (
          <p className="mt-2 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
            {emptyFridge ? "Votre frigo est vide pour l'instant. " : "Pas de plat faisable avec le frigo seul pour l'instant. "}
            <Link href="/frigo/" className="font-semibold text-brand-700">Remplir Mon frigo</Link> pour des idées sur mesure.
          </p>
        )}
      </section>

      {d.season.length > 0 && (
        <section>
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">🌱 Des idées de saison</h3>
          <ul className="mt-2 space-y-2">{d.season.map((i) => <IdeaRow key={i.s.recipe.id} i={i} onTonight={planTonight} />)}</ul>
        </section>
      )}

      {d.pool.length > 0 && (
        <section>
          {drawn ? (
            <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50 p-2" data-testid="discover-draw">
              <p className="mb-2 px-1 text-sm font-semibold text-brand-700">🎲 Tiré au sort</p>
              <ul><IdeaRow i={describeIdea(drawn, { month, inventory: store.inventoryMap, getIngredient })} onTonight={planTonight} /></ul>
              <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setDrawnId(drawRecipe(d.pool, drawnId)?.recipe.id ?? null)}
                disabled={d.pool.length < 2}>🎲 Une autre</button>
            </div>
          ) : (
            <button type="button" className="btn-secondary w-full border-dashed" onClick={() => setDrawnId(drawRecipe(d.pool, null)?.recipe.id ?? null)}>
              🎲 Surprenez-moi
            </button>
          )}
        </section>
      )}

      <section>
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">🍂 De saison en {MONTHS[month - 1]}</h3>
        {fridgeSeasonal.length > 0 && (
          <p className="mt-1 px-1 text-sm text-stone-600">Dans votre frigo et de saison : <strong>{listFr(fridgeSeasonal.map((x) => x.name), 4)}</strong></p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(showAll ? d.seasonalNow : d.seasonalNow.slice(0, SHORT)).map((x) => (
            <span key={x.id} className={`rounded-full px-3 py-1 text-sm ${x.inFridge ? "bg-brand-100 font-semibold text-brand-800" : "bg-stone-100 text-stone-700"}`}>
              {x.inFridge && "✓ "}{x.name}
            </span>
          ))}
          {!showAll && d.seasonalNow.length > SHORT && (
            <button type="button" className="rounded-full px-3 py-1 text-sm font-semibold text-brand-700" onClick={() => setShowAll(true)}>
              + {d.seasonalNow.length - SHORT} autres
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function IdeaRow({ i, onTonight }: { i: Idea; onTonight: (s: ScoredRecipe) => void }) {
  const r = i.s.recipe;
  const a = i.s.availability;
  const summary = summarizeAvailability(a);
  const status = summary.tone === "ok" ? "Vous avez tout" : summary.lines[0]?.text ?? "";
  // Produits du frigo utilisés, puis les légumes de saison qu'il faudrait acheter.
  const toBuy = i.seasonal.filter((n) => !i.fromFridge.includes(n));
  const why = [
    i.fromFridge.length > 0 ? `Avec ${listFr(i.fromFridge)}` : null,
    toBuy.length > 0 ? `🍂 ${listFr(toBuy, 2)} de saison` : i.seasonal.length > 0 ? "🍂 de saison" : null,
  ].filter(Boolean).join(" · ");
  return (
    <li className="card overflow-hidden" data-testid="discover-idea">
      <Link href={`/recettes/${r.id}/`} className="flex gap-3 p-3">
        <Visual id={r.id} emoji={r.emoji} className="h-16 w-16 shrink-0 rounded-xl text-3xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{r.title}</p>
          <p className="mt-0.5 text-sm text-stone-600">
            ⏱ {formatMinutes(r.totalMinutes)}
          </p>
          <p className={`mt-0.5 text-sm font-semibold ${TONE[summary.tone]}`}>{summary.tone === "ok" && "✓ "}{status}</p>
          {why && <p className="mt-0.5 text-xs text-stone-500">{why}</p>}
        </div>
      </Link>
      <button type="button" onClick={() => onTonight(i.s)}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 border-t border-stone-100 text-sm font-semibold text-brand-700">
        🌙 Prévoir ce soir
      </button>
    </li>
  );
}
