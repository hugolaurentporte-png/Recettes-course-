"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Equipment } from "@/lib/domain/types";
import type { TimeFilter } from "@/lib/domain/recommend";
import { EQUIPMENT_LABELS } from "@/lib/labels";
import { useRanking } from "@/lib/useRanking";
import { RecipeCard } from "@/components/RecipeCard";
import { SearchIcon } from "@/components/Icons";

const TIMES: { v: TimeFilter; label: string }[] = [
  { v: 15, label: "< 15 min" },
  { v: 30, label: "< 30 min" },
  { v: 45, label: "< 45 min" },
];
const MODES: Equipment[] = ["four", "poele", "casserole", "cocotte", "airfryer", "sans-cuisson"];

function RecipesInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [maxMinutes, setMax] = useState<TimeFilter>(null);
  const [modes, setModes] = useState<Equipment[]>([]);
  const [onlyReady, setOnlyReady] = useState(false);

  // Filtres reçus depuis l'accueil (?q=…&t=15&m=four&ready=1)
  useEffect(() => {
    setQuery(params.get("q") ?? "");
    const t = Number(params.get("t"));
    setMax(t === 15 || t === 30 || t === 45 ? t : null);
    const m = params.get("m");
    setModes(m && (MODES as string[]).includes(m) ? [m as Equipment] : []);
    setOnlyReady(params.get("ready") === "1");
  }, [params]);

  const results = useRanking({ query, maxMinutes, modes, onlyReady });
  const hasFilters = query !== "" || maxMinutes !== null || modes.length > 0 || onlyReady;

  function reset() {
    setQuery("");
    setMax(null);
    setModes([]);
    setOnlyReady(false);
  }

  return (
    <div className="px-4">
      <header className="sticky top-0 z-20 -mx-4 bg-[#f7f7f5]/95 px-4 pb-3 pt-4 backdrop-blur">
        <h1 className="mb-3 text-2xl font-bold">Recettes</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" width={20} height={20} />
          <input type="search" className="input pl-11" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom ou ingrédient…" aria-label="Rechercher une recette" />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <button type="button" aria-pressed={onlyReady} className={`chip ${onlyReady ? "chip-on" : ""}`} onClick={() => setOnlyReady(!onlyReady)}>
            ✓ Réalisable maintenant
          </button>
          {TIMES.map((t) => (
            <button key={t.v} type="button" aria-pressed={maxMinutes === t.v} className={`chip ${maxMinutes === t.v ? "chip-on" : ""}`}
              onClick={() => setMax(maxMinutes === t.v ? null : t.v)}>
              {t.label}
            </button>
          ))}
          {MODES.map((m) => {
            const on = modes.includes(m);
            return (
              <button key={m} type="button" aria-pressed={on} className={`chip ${on ? "chip-on" : ""}`}
                onClick={() => setModes(on ? modes.filter((x) => x !== m) : [...modes, m])}>
                {EQUIPMENT_LABELS[m]}
              </button>
            );
          })}
        </div>
      </header>

      <p className="mb-2 mt-2 px-1 text-sm text-stone-500">
        {results.length} recette{results.length > 1 ? "s" : ""}
        {hasFilters && <> · <button type="button" className="font-semibold text-brand-700 underline" onClick={reset}>Effacer les filtres</button></>}
      </p>

      {results.length === 0 ? (
        <div className="card mt-4 p-6 text-center text-stone-600">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-semibold text-stone-800">Aucune recette ne correspond</p>
          <p className="mt-1 text-sm">Essayez d&apos;enlever un filtre ou d&apos;élargir le temps disponible.</p>
          <button type="button" className="btn-secondary mt-4" onClick={reset}>Voir toutes les recettes</button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((s) => <RecipeCard key={s.recipe.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

export default function RecettesPage() {
  return (
    <Suspense>
      <RecipesInner />
    </Suspense>
  );
}
