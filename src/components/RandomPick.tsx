"use client";

import { useEffect, useRef, useState } from "react";
import type { ScoredRecipe } from "@/lib/domain/recommend";
import { drawRecipe } from "@/lib/domain/random";
import { MealCard } from "./MealCard";

/** Bouton « Au hasard » : tire une recette parmi `pool` et l'affiche, avec « Une autre ». */
export function RandomPick({ pool, label = "🎲 Pas d'idée ? Tirer au sort" }: { pool: ScoredRecipe[]; label?: string }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // Garder la carte à jour si le frigo change, et l'oublier si elle ne fait plus partie du choix.
  const picked = pickedId ? pool.find((s) => s.recipe.id === pickedId) ?? null : null;

  useEffect(() => {
    if (picked) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pickedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pool.length === 0) return null;

  function draw() {
    setPickedId(drawRecipe(pool, pickedId)?.recipe.id ?? null);
  }

  return (
    <div ref={ref} className="mt-3">
      {picked ? (
        <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50 p-2" data-testid="random-pick">
          <p className="mb-2 px-1 text-sm font-semibold text-brand-700">🎲 Tiré au sort pour toi</p>
          <MealCard s={picked} />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={draw} disabled={pool.length < 2}>🎲 Une autre</button>
            <button type="button" className="btn-secondary px-4" onClick={() => setPickedId(null)} aria-label="Fermer le tirage">✕</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary w-full border-dashed" onClick={draw}>{label}</button>
      )}
    </div>
  );
}
