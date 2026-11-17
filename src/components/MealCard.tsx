"use client";

import Link from "next/link";
import type { ScoredRecipe } from "@/lib/domain/recommend";
import { recipeModes } from "@/lib/domain/recommend";
import { summarizeAvailability } from "@/lib/domain/phrasing";
import { EQUIPMENT_LABELS, formatMinutes } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { useToast } from "./Toast";
import { CartIcon } from "./Icons";
import { Visual } from "./RecipeCard";

const TONE = {
  ok: "text-brand-700",
  verify: "text-amber-700",
  missing: "text-warm-600",
} as const;

/** Carte d'un résultat « Qu'est-ce qu'on mange ? » : temps total, matériel et ce qu'il faut savoir sur le frigo. */
export function MealCard({ s }: { s: ScoredRecipe }) {
  const store = useStore();
  const toast = useToast();
  const r = s.recipe;
  const all = recipeModes(r);
  const modes = all.filter((m) => m !== "sans-cuisson" || all.length === 1);
  const summary = summarizeAvailability(s.availability);

  function addMissing() {
    const sum = store.addRecipe(r, r.servings);
    const n = sum.added + sum.updated;
    toast(n === 0 ? "Rien à ajouter : tu as tout" : `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses`);
  }

  return (
    <article className="card overflow-hidden" data-testid="meal-card">
      <Link href={`/recettes/${r.id}/`} className="flex gap-3 p-3">
        <Visual id={r.id} emoji={r.emoji} className="h-20 w-20 shrink-0 rounded-xl text-4xl" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{r.title}</h3>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-stone-600">
            <span>⏱ {formatMinutes(r.totalMinutes)}</span>
            <span>🍳 {modes.map((m) => EQUIPMENT_LABELS[m]).join(", ")}</span>
          </p>
          <div className="mt-1.5 space-y-0.5">
            {summary.lines.map((line) => (
              <p key={line.text} className={`text-sm font-semibold ${TONE[line.kind]}`}>
                {line.kind === "ok" && "✓ "}
                {line.kind === "verify" && (
                  <span className="mr-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">À vérifier</span>
                )}
                {line.text}
              </p>
            ))}
          </div>
        </div>
      </Link>
      {summary.tone === "missing" && (
        <button type="button" onClick={addMissing}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 border-t border-stone-100 text-sm font-semibold text-brand-700">
          <CartIcon width={18} height={18} /> Ajouter ce qui manque aux courses
        </button>
      )}
    </article>
  );
}
