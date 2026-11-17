"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { useRanking } from "@/lib/useRanking";
import { EMPTY_FILTERS } from "@/lib/domain/recommend";
import { RecipeCard } from "@/components/RecipeCard";
import { Onboarding } from "@/components/Onboarding";
import { CartIcon, SearchIcon } from "@/components/Icons";
import type { ScoredRecipe } from "@/lib/domain/recommend";
import { searchIngredients, searchRecipeTitles } from "@/lib/domain/search";

const QUICK = [
  { label: "15 min", href: "/recettes/?t=15" },
  { label: "30 min", href: "/recettes/?t=30" },
  { label: "Four", href: "/recettes/?m=four" },
  { label: "Poêle", href: "/recettes/?m=poele" },
  { label: "Cocotte", href: "/recettes/?m=cocotte" },
];

function Row({ title, items, more }: { title: string; items: ScoredRecipe[]; more?: string }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="section-title">{title}</h2>
        {more && <Link href={more} className="text-sm font-semibold text-brand-700">Tout voir</Link>}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((s) => <RecipeCard key={s.recipe.id} s={s} compact />)}
      </div>
    </section>
  );
}

export default function HomePage() {
  const store = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ingSuggestions = useMemo(() => searchIngredients(q, 5), [q]);
  const recipeSuggestions = useMemo(() => searchRecipeTitles(q, 4), [q]);
  const showSuggestions = open && q.trim() !== "" && (ingSuggestions.length > 0 || recipeSuggestions.length > 0);
  const ranked = useRanking(EMPTY_FILTERS);

  const hasStock = store.inventory.length > 0;
  const ready = ranked.filter((s) => s.availability.allAvailable);
  const withWhatIHave = hasStock ? (ready.length > 0 ? ready : ranked.filter((s) => s.availability.missingCount <= 1)) : [];
  const priority = ranked.filter((s) => s.priorityUsed.length > 0);
  const seasonal = [...ranked].filter((s) => s.inSeason).sort((a, b) => b.score - a.score);
  const toBuy = store.shopping.filter((i) => i.deletedAt === null && !i.checked).length;

  function search(e: FormEvent) {
    e.preventDefault();
    goSearch(q);
  }

  function goSearch(text: string) {
    setOpen(false);
    router.push(`/recettes/?q=${encodeURIComponent(text.trim())}`);
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-[1.7rem] font-bold leading-tight">Qu&apos;est-ce qu&apos;on mange aujourd&apos;hui&nbsp;?</h1>

      {store.ready && !store.settings.onboarded && <div className="mt-4"><Onboarding /></div>}

      <form onSubmit={search} className="relative z-30 mt-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" width={20} height={20} />
            <input type="search" className="input pl-11" value={q} autoComplete="off"
              onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              placeholder="Une recette, un ingrédient…" aria-label="Rechercher une recette" enterKeyHint="search" />
          </div>
          <button type="submit" className="btn-primary shrink-0 px-4" disabled={q.trim() === ""}>Chercher</button>
        </div>
        {showSuggestions && (
          <ul className="card absolute inset-x-0 top-[56px] max-h-80 overflow-y-auto shadow-lg" role="listbox" aria-label="Suggestions">
            {ingSuggestions.map((ing) => (
              <li key={`i-${ing.id}`}>
                <button type="button" onClick={() => goSearch(ing.name)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
                  <SearchIcon className="shrink-0 text-stone-400" width={18} height={18} />
                  <span>Recettes avec <strong>{ing.name.toLowerCase()}</strong></span>
                </button>
              </li>
            ))}
            {recipeSuggestions.map((r) => (
              <li key={`r-${r.id}`}>
                <Link href={`/recettes/${r.id}/`} onClick={() => setOpen(false)}
                  className="flex min-h-[52px] w-full items-center gap-3 border-t border-stone-100 px-4 text-left">
                  <span className="w-[18px] shrink-0 text-center">{r.emoji}</span>
                  <span>{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {QUICK.map((f) => <Link key={f.href} href={f.href} className="chip">{f.label}</Link>)}
      </div>

      <Link href={hasStock ? "/recettes/?ready=1" : "/recettes/"} className="btn-primary mt-5 w-full py-4 text-lg">
        🍽️ Qu&apos;est-ce qu&apos;on mange&nbsp;?
      </Link>

      <Link href="/courses/" className="card mt-3 flex items-center gap-3 p-4">
        <CartIcon className="text-brand-700" />
        <span className="flex-1 font-medium">Ma liste de courses</span>
        <span className="text-sm text-stone-500">{toBuy === 0 ? "vide" : `${toBuy} article${toBuy > 1 ? "s" : ""}`}</span>
      </Link>

      {!hasStock && store.ready && (
        <Link href="/frigo/" className="card mt-6 block border-dashed p-5 text-center">
          <p className="text-3xl">🧊</p>
          <p className="mt-1 font-semibold">Ajoutez quelques ingrédients</p>
          <p className="text-sm text-stone-500">Les recettes réalisables avec ce que vous avez apparaîtront ici.</p>
        </Link>
      )}

      <Row title={ready.length > 0 ? "Avec ce que j'ai" : "Presque prêt (il manque 1 ingrédient)"} items={withWhatIHave.slice(0, 10)} more="/recettes/?ready=1" />
      <Row title="⚡ À cuisiner rapidement" items={priority.slice(0, 10)} />
      <Row title="🌱 De saison" items={seasonal.slice(0, 10)} />
      {!hasStock && <Row title="Idées rapides" items={ranked.filter((s) => s.recipe.totalMinutes <= 20).slice(0, 10)} more="/recettes/?t=30" />}
    </div>
  );
}
