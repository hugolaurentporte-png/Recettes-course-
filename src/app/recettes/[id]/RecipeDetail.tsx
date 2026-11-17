"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { getIngredient } from "@/lib/data/ingredients";
import { recipeAvailability, type LineStatus } from "@/lib/domain/availability";
import { seasonLevel } from "@/lib/data/seasonality";
import { formatAmount } from "@/lib/domain/units";
import { cookedIngredientsInStock } from "@/lib/domain/stock";
import { EQUIPMENT_LABELS, formatMinutes } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { Visual } from "@/components/RecipeCard";
import { BackIcon, CalendarIcon, CartIcon, MinusIcon, PlusIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { MEALS, MEAL_LABELS, dayLabel, nextDay, plannedAt, toDateKey, weekDays, type Meal } from "@/lib/domain/plan";

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
  const [together, setTogether] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [finished, setFinished] = useState<Set<string>>(new Set());
  /** Empêche un double appui de déduire deux fois : une seule validation par ouverture du panneau. */
  const cookSubmitted = useRef(false);
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

  const inStock = useMemo(() => cookedIngredientsInStock(recipe, store.inventoryMap), [recipe, store.inventoryMap]);

  function openCooked() {
    if (inStock.length === 0) {
      toast("Aucun ingrédient de cette recette n'était dans Mon frigo");
      return;
    }
    cookSubmitted.current = false;
    setFinished(new Set());
    setCooking(true);
  }

  function validateCooked(done: ReadonlySet<string>) {
    if (cookSubmitted.current) return;
    cookSubmitted.current = true;
    setCooking(false);
    const r = store.cookRecipe(recipe, servings, done);
    const parts: string[] = [];
    if (r.removed) parts.push(`${r.removed} produit${r.removed > 1 ? "s" : ""} retiré${r.removed > 1 ? "s" : ""}`);
    if (r.updated) parts.push(`${r.updated} quantité${r.updated > 1 ? "s" : ""} estimée${r.updated > 1 ? "s" : ""}`);
    toast(parts.length ? `Frigo mis à jour : ${parts.join(", ")}` : "Frigo à jour", { label: "Annuler", run: r.undo }, 8000);
  }

  function toggleFinished(ingredientId: string) {
    const next = new Set(finished);
    if (next.has(ingredientId)) next.delete(ingredientId);
    else next.add(ingredientId);
    setFinished(next);
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

        <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setTogether(true)}>
          👥 Prévoir ce plat à deux
        </button>

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

        <button type="button" className="btn-primary mb-8 w-full" onClick={openCooked}>
          🍳 J&apos;ai cuisiné
        </button>
      </div>

      <Sheet open={together} onClose={() => setTogether(false)} title="Prévoir ce plat à deux">
        {together && (
          <TogetherPicker recipeId={recipe.id} title={recipe.title} servings={servings} onDone={(when) => {
            setTogether(false);
            toast(`${recipe.title} prévu ${when}, ${servings} pers.`, { label: "Voir", run: () => router.push("/") });
          }} />
        )}
      </Sheet>

      <Sheet open={cooking} onClose={() => setCooking(false)} title="Tu as fini quelque chose ?">
        <p className="text-sm text-stone-600">Coche les produits que tu as entièrement terminés. Pour le reste, on estime ce qu&apos;il reste.</p>
        <ul className="mt-3 divide-y divide-stone-100">
          {inStock.map((item) => {
            const name = getIngredient(item.ingredientId)?.name ?? item.customName ?? item.ingredientId;
            const checked = finished.has(item.ingredientId);
            return (
              <li key={item.ingredientId}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={checked}
                    onChange={() => toggleFinished(item.ingredientId)} />
                  <span className="flex-1">{name}</span>
                  <span className="text-sm text-stone-500">
                    {item.quantity !== null && item.unit ? formatAmount({ value: item.quantity, unit: item.unit }) : "quantité inconnue"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          {finished.size > 0 && (
            <button type="button" className="btn-primary w-full" onClick={() => validateCooked(finished)}>
              Retirer les produits terminés ({finished.size})
            </button>
          )}
          <button type="button" className={`${finished.size > 0 ? "btn-secondary" : "btn-primary"} w-full`}
            onClick={() => validateCooked(new Set())}>
            Rien de terminé
          </button>
        </div>
      </Sheet>

      <Sheet open={planning} onClose={() => setPlanning(false)} title="Quand ?">
        {planning && (
          <PlanPicker recipeId={recipe.id} title={recipe.title} onPick={(date, meal) => {
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

/** Choix du jour et du repas sur les 10 prochains jours ; demande avant de remplacer un plat déjà prévu. */
function PlanPicker({ recipeId, title, onPick }: { recipeId: string; title: string; onPick: (date: string, meal: Meal) => void }) {
  const { plan } = useStore();
  const today = toDateKey(new Date());
  const days = [...weekDays(new Date()), ...weekDays(new Date(), 1)].filter((d) => d >= today).slice(0, 10);
  const [confirm, setConfirm] = useState<{ date: string; meal: Meal } | null>(null);
  const titleAt = (d: string, m: Meal) => {
    const e = plannedAt(plan, d, m);
    return e && e.recipeId !== recipeId ? RECIPES_BY_ID.get(e.recipeId)?.title ?? "un autre plat" : null;
  };

  if (confirm) {
    const current = titleAt(confirm.date, confirm.meal) ?? "un autre plat";
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-warm-50 p-4">
          {dayLabel(confirm.date, today)}, {MEAL_LABELS[confirm.meal].toLowerCase()} : <strong>{current}</strong> est déjà prévu.
        </p>
        <p className="font-semibold">Remplacer le plat prévu ?</p>
        <button type="button" className="btn-primary w-full" onClick={() => onPick(confirm.date, confirm.meal)}>
          Remplacer par {title}
        </button>
        <button type="button" className="btn-secondary w-full" onClick={() => setConfirm(null)}>Garder {current}</button>
      </div>
    );
  }

  return (
    <ul className="max-h-[60vh] divide-y divide-stone-100 overflow-y-auto">
      {days.map((d) => (
        <li key={d} className="flex items-center gap-2 py-2">
          <span className="flex-1 text-sm font-medium">{dayLabel(d, today)}</span>
          {MEALS.map((m) => {
            const taken = titleAt(d, m);
            return (
              <button key={m} type="button" className="chip" onClick={() => (taken ? setConfirm({ date: d, meal: m }) : onPick(d, m))}
                aria-label={`${dayLabel(d, today)}, ${MEAL_LABELS[m]}${taken ? ` (déjà prévu : ${taken})` : ""}`}>
                {MEAL_LABELS[m]}{taken ? " •" : ""}
              </button>
            );
          })}
        </li>
      ))}
    </ul>
  );
}

/** « Ce soir » ou « Demain » : le plat apparaît sur l'accueil des deux membres du foyer. */
function TogetherPicker({ recipeId, title, servings, onDone }: {
  recipeId: string; title: string; servings: number; onDone: (when: string) => void;
}) {
  const store = useStore();
  const today = toDateKey(new Date());
  const slots = [
    { label: "Ce soir", when: "ce soir", date: today },
    { label: "Demain", when: "demain soir", date: nextDay(today) },
  ];
  const [confirm, setConfirm] = useState<(typeof slots)[number] | null>(null);

  function pick(s: (typeof slots)[number], force = false) {
    const current = plannedAt(store.plan, s.date, "soir");
    if (current && current.recipeId !== recipeId && !force) {
      setConfirm(s);
      return;
    }
    store.planRecipe(recipeId, s.date, "soir", servings);
    onDone(s.when);
  }

  if (confirm) {
    const current = plannedAt(store.plan, confirm.date, "soir");
    const currentTitle = current ? RECIPES_BY_ID.get(current.recipeId)?.title ?? "un autre plat" : "un autre plat";
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-warm-50 p-4">
          {confirm.label}, <strong>{currentTitle}</strong> est déjà prévu.
        </p>
        <p className="font-semibold">Remplacer le plat prévu ?</p>
        <button type="button" className="btn-primary w-full" onClick={() => pick(confirm, true)}>
          Remplacer par {title}
        </button>
        <button type="button" className="btn-secondary w-full" onClick={() => setConfirm(null)}>Garder {currentTitle}</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        {servings} pers. Le plat apparaîtra sur l&apos;accueil de chacun, avec la recette et ce qui manque pour les courses.
      </p>
      {slots.map((s) => {
        const current = plannedAt(store.plan, s.date, "soir");
        const currentTitle = current && current.recipeId !== recipeId ? RECIPES_BY_ID.get(current.recipeId)?.title : null;
        return (
          <button key={s.label} type="button" className="btn-primary w-full flex-col py-3" onClick={() => pick(s)}>
            <span>{s.label}</span>
            {currentTitle && <span className="text-xs font-normal opacity-90">Déjà prévu : {currentTitle}</span>}
          </button>
        );
      })}
      {!store.household && (
        <p className="px-1 text-xs text-stone-500">
          Pour que votre partenaire le voie aussi, <Link href="/partage/" className="font-semibold text-brand-700">partagez votre liste</Link> avec son téléphone.
        </p>
      )}
    </div>
  );
}
