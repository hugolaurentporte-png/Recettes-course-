"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { carnetSections, type CarnetEntry } from "@/lib/domain/carnet";
import type { Recipe } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { Visual } from "@/components/RecipeCard";
import { CarnetBadge } from "@/components/CarnetBlock";

type Tab = "favorites" | "redo" | "noted" | "disliked";

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "favorites", label: "❤️ Favorites", empty: "Aucune favorite pour l'instant. Sur une recette, touchez ❤️ Favorite." },
  { id: "redo", label: "🔁 À refaire", empty: "Rien à refaire pour l'instant. Sur une recette, touchez 🔁 À refaire." },
  { id: "noted", label: "📝 Notées", empty: "Les autres recettes où vous avez écrit une note apparaîtront ici." },
  { id: "disliked", label: "👎 Pas pour nous", empty: "Aucune recette écartée." },
];

function Item({ recipe, entry }: { recipe: Recipe; entry: CarnetEntry }) {
  return (
    <li>
      <Link href={`/recettes/${recipe.id}/`} className="card flex gap-3 p-3">
        <Visual id={recipe.id} emoji={recipe.emoji} className="h-16 w-16 shrink-0 rounded-xl text-3xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{recipe.title}</p>
          <p className="mt-0.5 text-sm text-stone-500">{formatMinutes(recipe.totalMinutes)} | {recipe.servings} pers.</p>
          <div className="mt-1 flex flex-wrap gap-1"><CarnetBadge entry={entry} /></div>
          {entry.note.trim() && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm italic text-stone-700">« {entry.note.trim()} »</p>}
        </div>
      </Link>
    </li>
  );
}

export default function CarnetPage() {
  const store = useStore();
  const sections = useMemo(() => carnetSections(store.carnet, (id) => RECIPES_BY_ID.get(id)), [store.carnet]);
  const [tab, setTab] = useState<Tab>("favorites");
  const list = sections[tab];
  const current = TABS.find((t) => t.id === tab)!;
  const total = sections.favorites.length + sections.redo.length + sections.noted.length + sections.disliked.length;

  return (
    <div className="px-4 pt-4">
      <h1 className="text-2xl font-bold">📒 {store.household ? "Notre carnet" : "Mon carnet"}</h1>
      <p className="mt-1 text-stone-600">
        Vos meilleures recettes, celles à refaire et vos notes.
        {store.household && " Partagé avec votre foyer."}
      </p>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Rubriques du carnet">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`chip shrink-0 ${tab === t.id ? "chip-on" : ""}`}
            onClick={() => setTab(t.id)}>
            {t.label} ({sections[t.id].length})
          </button>
        ))}
      </div>

      {store.ready && total === 0 && (
        <div className="card mt-4 p-5 text-center text-stone-600">
          <p className="text-4xl">📒</p>
          <p className="mt-2 font-semibold text-stone-800">Le carnet est vide</p>
          <p className="mt-1 text-sm">Ouvrez une recette : sous le temps de préparation, marquez-la ❤️ Favorite, 🔁 À refaire ou 👎 Pas pour nous, et ajoutez une note.</p>
          <Link href="/recettes/" className="btn-primary mt-4">Voir les recettes</Link>
        </div>
      )}

      {total > 0 && (list.length === 0 ? (
        <p className="card mt-4 p-4 text-center text-stone-600">{current.empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((x) => <Item key={x.id} recipe={x} entry={x.entry} />)}
        </ul>
      ))}

      {tab === "disliked" && list.length > 0 && (
        <p className="mt-3 px-1 text-xs text-stone-500">
          Ces recettes ne sont plus proposées dans « Qu&apos;est-ce qu&apos;on mange ? » ni au tirage au sort. Ouvrez-en une pour changer d&apos;avis.
        </p>
      )}
    </div>
  );
}
