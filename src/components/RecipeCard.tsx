"use client";

import Link from "next/link";
import type { ScoredRecipe } from "@/lib/domain/recommend";
import { recipeModes } from "@/lib/domain/recommend";
import { EQUIPMENT_LABELS, formatMinutes } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { useToast } from "./Toast";
import { CartIcon } from "./Icons";
import { CarnetBadge } from "./CarnetBlock";

const GRADIENTS = [
  "from-amber-100 to-orange-200",
  "from-lime-100 to-green-200",
  "from-rose-100 to-red-200",
  "from-sky-100 to-cyan-200",
  "from-yellow-100 to-amber-200",
];

function gradientFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function Visual({ id, emoji, className = "" }: { id: string; emoji: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradientFor(id)} ${className}`} aria-hidden="true">
      <span className="drop-shadow-sm">{emoji}</span>
    </div>
  );
}

export function AvailabilityBadge({ s }: { s: ScoredRecipe }) {
  const a = s.availability;
  if (a.allAvailable) {
    return (
      <p className="text-sm font-semibold text-brand-700">
        ✓ Tous les ingrédients disponibles{a.verifyCount > 0 ? " (quantités à vérifier)" : ""}
      </p>
    );
  }
  const names = a.lines
    .filter((l) => !l.line.optional && (l.status === "missing" || l.status === "insufficient"))
    .map((l) => l.ingredient?.name ?? l.line.ingredientId);
  return (
    <p className="text-sm text-stone-600">
      <span className="font-semibold text-warm-600">
        Il manque {a.missingCount} ingrédient{a.missingCount > 1 ? "s" : ""}
      </span>
      {" : "}
      {names.slice(0, 3).join(", ")}{names.length > 3 ? "…" : ""}
    </p>
  );
}

export function RecipeCard({ s, compact = false }: { s: ScoredRecipe; compact?: boolean }) {
  const store = useStore();
  const toast = useToast();
  const r = s.recipe;
  const modes = recipeModes(r).filter((m) => m !== "sans-cuisson" || recipeModes(r).length === 1);
  const priorityNames = s.priorityUsed.map((id) => s.availability.lines.find((l) => l.line.ingredientId === id)?.ingredient?.name).filter(Boolean);

  function addMissing() {
    const sum = store.addRecipe(r, r.servings);
    const n = sum.added + sum.updated;
    toast(n === 0 ? "Rien à ajouter : vous avez tout" : `${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} aux courses`);
  }

  if (compact) {
    return (
      <Link href={`/recettes/${r.id}/`} className="card block w-44 shrink-0 overflow-hidden">
        <Visual id={r.id} emoji={r.emoji} className="h-24 text-5xl" />
        <div className="p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-tight">
            {store.carnetMap.get(r.id)?.verdict === "favori" && <span aria-label="Favorite">❤️ </span>}{r.title}
          </p>
          <p className="mt-1 text-xs text-stone-500">{formatMinutes(r.totalMinutes)}</p>
          <p className={`mt-1 text-xs font-semibold ${s.availability.allAvailable ? "text-brand-700" : "text-warm-600"}`}>
            {s.availability.allAvailable ? "✓ Tout est là" : `Il manque ${s.availability.missingCount}`}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <article className="card overflow-hidden">
      <Link href={`/recettes/${r.id}/`} className="flex gap-3 p-3">
        <Visual id={r.id} emoji={r.emoji} className="h-24 w-24 shrink-0 rounded-xl text-5xl" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{r.title}</h3>
          <p className="mt-1 text-sm text-stone-500">
            {formatMinutes(r.totalMinutes)} | {modes.map((m) => EQUIPMENT_LABELS[m]).join(", ")} | {r.servings} pers.
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <CarnetBadge entry={store.carnetMap.get(r.id)} />
            {s.inSeason && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">🌱 De saison</span>}
            {priorityNames.length > 0 && (
              <span className="rounded-full bg-warm-50 px-2 py-0.5 text-xs font-medium text-warm-600">⚡ {priorityNames.join(", ")}</span>
            )}
          </div>
          <div className="mt-1"><AvailabilityBadge s={s} /></div>
        </div>
      </Link>
      {!s.availability.allAvailable && (
        <button type="button" onClick={addMissing}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 border-t border-stone-100 text-sm font-semibold text-brand-700">
          <CartIcon width={18} height={18} /> Ajouter les ingrédients manquants aux courses
        </button>
      )}
    </article>
  );
}
