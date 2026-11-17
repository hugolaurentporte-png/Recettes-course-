"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Equipment } from "@/lib/domain/types";
import { EMPTY_FILTERS, recipeModes, type ScoredRecipe, type TimeFilter } from "@/lib/domain/recommend";
import { COURSES, COURSES_BY_ID, isCourse, matchesMeal, type Course } from "@/lib/domain/meal";
import { EQUIPMENT_LABELS } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { useRanking } from "@/lib/useRanking";
import { MealCard } from "@/components/MealCard";

const TIMES: TimeFilter[] = [15, 30, 45];
/** Ordre d'affichage du matériel. */
const MODES: Equipment[] = ["thermomix", "four", "cocotte", "poele", "casserole", "airfryer", "sans-cuisson"];
const ALL = "tout";
const PAGE = 30;

/** Lien vers une étape du parcours (?c=plat&k=gratin…). */
function stepHref(c?: Course, k?: string) {
  const p = new URLSearchParams();
  if (c) p.set("c", c);
  if (k) p.set("k", k);
  const s = p.toString();
  return s ? `/manger/?${s}` : "/manger/";
}

function Crumbs({ course, typeLabel }: { course?: Course; typeLabel?: string }) {
  return (
    <nav aria-label="Étapes" className="flex flex-wrap items-center gap-1 text-sm text-stone-500">
      {course ? <Link href={stepHref()} className="font-semibold text-brand-700">Repas</Link> : <span>Repas</span>}
      {course && (
        <>
          <span aria-hidden="true">›</span>
          {typeLabel ? (
            <Link href={stepHref(course)} className="font-semibold text-brand-700">{COURSES_BY_ID[course].label}</Link>
          ) : (
            <span>{COURSES_BY_ID[course].label}</span>
          )}
        </>
      )}
      {typeLabel && (
        <>
          <span aria-hidden="true">›</span>
          <span>{typeLabel}</span>
        </>
      )}
    </nav>
  );
}

function ChooseCourse() {
  return (
    <>
      <h1 className="mt-2 text-2xl font-bold">Qu&apos;est-ce qu&apos;on mange&nbsp;?</h1>
      <p className="mt-1 text-stone-600">Choisis le moment du repas.</p>
      <div className="mt-5 space-y-3">
        {COURSES.map((c) => (
          <Link key={c.id} href={stepHref(c.id)} className="card flex min-h-[84px] items-center gap-4 p-4 active:scale-[0.99]">
            <span className="text-4xl" aria-hidden="true">{c.emoji}</span>
            <span className="flex-1">
              <span className="block text-lg font-semibold">{c.label}</span>
              <span className="block text-sm text-stone-500">{c.hint}</span>
            </span>
            <span aria-hidden="true" className="text-2xl text-stone-300">›</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function ChooseType({ course }: { course: Course }) {
  const def = COURSES_BY_ID[course];
  const ranked = useRanking(EMPTY_FILTERS);
  const inCourse = ranked.filter((s) => matchesMeal(s.recipe, course, null));
  const counts = def.types
    .map((t) => ({ t, n: inCourse.filter((s) => matchesMeal(s.recipe, course, t.id)).length }))
    .filter((x) => x.n > 0);

  return (
    <>
      <h1 className="mt-2 text-2xl font-bold">{def.emoji} {def.label}</h1>
      <p className="mt-1 text-stone-600">Quel type de recette&nbsp;?</p>
      <Link href={stepHref(course, ALL)} className="btn-primary mt-5 w-full py-4">
        ✨ Toutes les idées <span className="font-normal opacity-80">({inCourse.length})</span>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {counts.map(({ t, n }) => (
          <Link key={t.id} href={stepHref(course, t.id)} className="card flex min-h-[88px] flex-col justify-center p-3 active:scale-[0.98]">
            <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
            <span className="mt-1 font-semibold leading-tight">{t.label}</span>
            <span className="text-xs text-stone-500">{n} recette{n > 1 ? "s" : ""}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function Results({ course, type }: { course: Course; type: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { settings, inventory } = useStore();
  const def = COURSES_BY_ID[course];
  const typeDef = type ? def.types.find((t) => t.id === type) : undefined;
  const label = typeDef?.label ?? "Toutes les idées";

  const t = Number(params.get("t"));
  const maxMinutes: TimeFilter = t === 15 || t === 30 || t === 45 ? t : null;
  const modes = useMemo(
    () => (params.get("m") ?? "").split(",").filter((m): m is Equipment => (MODES as string[]).includes(m)),
    [params],
  );

  // Le moteur applique déjà le matériel renseigné dans Mon frigo (ownedEquipment).
  const base = useRanking(EMPTY_FILTERS).filter((s) => matchesMeal(s.recipe, course, type));
  const filtered = useRanking({ ...EMPTY_FILTERS, maxMinutes, modes }).filter((s) => matchesMeal(s.recipe, course, type));

  // Matériel proposé : celui qu'on possède et qui sert vraiment pour ce type de recette.
  const owned = new Set<Equipment>([...settings.ownedEquipment, "sans-cuisson"]);
  const usedModes = new Set(base.flatMap((s) => recipeModes(s.recipe)));
  const modeChoices = MODES.filter((m) => owned.has(m) && (usedModes.has(m) || modes.includes(m)));

  function setFilter(next: { t?: TimeFilter; m?: Equipment[] }) {
    const p = new URLSearchParams(params.toString());
    const nt = "t" in next ? next.t : maxMinutes;
    const nm = next.m ?? modes;
    if (nt) p.set("t", String(nt)); else p.delete("t");
    if (nm.length > 0) p.set("m", nm.join(",")); else p.delete("m");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const hasFilters = maxMinutes !== null || modes.length > 0;
  // Le catalogue compte des centaines de plats : on affiche par paquets pour rester fluide sur téléphone.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [maxMinutes, modes]);
  const readyCount = filtered.filter((s) => s.availability.allAvailable).length;
  // Rien ne correspond : on montre les recettes les plus proches (même matériel, temps élargi).
  const nearest = filtered.length === 0 && hasFilters ? nearestRecipes(base, modes) : [];

  return (
    <>
      <header className="sticky top-0 z-20 -mx-4 bg-[#f7f7f5]/95 px-4 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link href={stepHref(course)} className="btn-secondary min-h-[40px] px-3 text-sm" aria-label={`Retour aux types de ${def.label.toLowerCase()}`}>
            ‹ {def.label}
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{typeDef?.emoji ?? "✨"} {label}</h1>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Temps maximum">
          {TIMES.map((v) => (
            <button key={v} type="button" aria-pressed={maxMinutes === v} className={`chip ${maxMinutes === v ? "chip-on" : ""}`}
              onClick={() => setFilter({ t: maxMinutes === v ? null : v })}>
              ⏱ {v} min max
            </button>
          ))}
        </div>
        {modeChoices.length > 1 && (
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Matériel">
            {modeChoices.map((m) => {
              const on = modes.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} className={`chip ${on ? "chip-on" : ""}`}
                  onClick={() => setFilter({ m: on ? modes.filter((x) => x !== m) : [...modes, m] })}>
                  {EQUIPMENT_LABELS[m]}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <p className="mb-2 mt-2 px-1 text-sm text-stone-500" aria-live="polite">
        {filtered.length} idée{filtered.length > 1 ? "s" : ""}
        {inventory.length > 0 && filtered.length > 0 && <> · {readyCount} réalisable{readyCount > 1 ? "s" : ""} avec ton frigo</>}
        {hasFilters && <> · <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setFilter({ t: null, m: [] })}>Effacer les filtres</button></>}
      </p>

      {filtered.length === 0 ? (
        <>
          <div className="card mt-2 p-5 text-center text-stone-600">
            <p className="text-3xl">🔍</p>
            <p className="mt-1 font-semibold text-stone-800">
              Aucune recette {typeDef ? `« ${typeDef.label.toLowerCase()} »` : ""} avec ces filtres
            </p>
            {maxMinutes !== null && <p className="mt-1 text-sm">Essaie avec plus de temps ou sans filtre.</p>}
            <button type="button" className="btn-secondary mt-3" onClick={() => setFilter({ t: null, m: [] })}>Enlever les filtres</button>
          </div>
          {nearest.length > 0 && (
            <>
              <h2 className="section-title">En prenant un peu plus de temps{modes.length > 0 ? ` (${modes.map((m) => EQUIPMENT_LABELS[m].toLowerCase()).join(", ")})` : ""}</h2>
              <div className="space-y-3">{nearest.map((s) => <MealCard key={s.recipe.id} s={s} />)}</div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="space-y-3">{filtered.slice(0, limit).map((s) => <MealCard key={s.recipe.id} s={s} />)}</div>
          {filtered.length > limit && (
            <button type="button" className="btn-secondary mt-4 w-full" onClick={() => setLimit(limit + PAGE)}>
              Voir plus d&apos;idées ({filtered.length - limit} autres)
            </button>
          )}
        </>
      )}
    </>
  );
}

/** Recettes du même type et du même matériel, les plus courtes d'abord (le temps est le filtre qu'on relâche). */
function nearestRecipes(base: ScoredRecipe[], modes: Equipment[]) {
  return base
    .filter((s) => modes.length === 0 || recipeModes(s.recipe).some((m) => modes.includes(m)))
    .sort((a, b) => a.recipe.totalMinutes - b.recipe.totalMinutes)
    .slice(0, 3);
}

function MangerInner() {
  const params = useSearchParams();
  const c = params.get("c");
  const k = params.get("k");
  const course = isCourse(c) ? c : undefined;
  const type = course && k && (k === ALL || COURSES_BY_ID[course].types.some((t) => t.id === k)) ? k : undefined;
  const typeLabel = type === ALL ? "Toutes les idées" : course && type ? COURSES_BY_ID[course].types.find((t) => t.id === type)?.label : undefined;

  return (
    <div className="px-4 pt-4">
      <Crumbs course={course} typeLabel={typeLabel} />
      {!course && <ChooseCourse />}
      {course && !type && <ChooseType course={course} />}
      {course && type && <Results key={`${course}-${type}`} course={course} type={type === ALL ? null : type} />}
    </div>
  );
}

export default function MangerPage() {
  return (
    <Suspense>
      <MangerInner />
    </Suspense>
  );
}
