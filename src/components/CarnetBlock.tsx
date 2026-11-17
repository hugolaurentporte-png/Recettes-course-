"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NOTE_MAX, type CarnetEntry } from "@/lib/domain/carnet";
import { useStore } from "@/lib/store";
import { useToast } from "./Toast";

/** Petit repère sur les cartes de recette. */
export function CarnetBadge({ entry }: { entry?: CarnetEntry }) {
  if (!entry) return null;
  const marks = [
    entry.verdict === "favori" ? "❤️ Favorite" : null,
    entry.redo ? "🔁 À refaire" : null,
    entry.verdict === "deteste" ? "👎 Pas pour nous" : null,
    entry.note.trim() ? "📝 Note" : null,
  ].filter(Boolean);
  if (marks.length === 0) return null;
  return (
    <>
      {marks.map((m) => (
        <span key={m} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{m}</span>
      ))}
    </>
  );
}

/** Sur la fiche recette : favorite, à refaire, pas pour nous, et une note perso. */
export function CarnetBlock({ recipeId }: { recipeId: string }) {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const entry = store.carnetMap.get(recipeId);
  const verdict = entry?.verdict ?? null;
  const redo = entry?.redo ?? false;
  const saved = entry?.note ?? "";
  const [note, setNote] = useState(saved);
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Note modifiée sur l'autre téléphone : on l'affiche, sauf si on est en train d'écrire.
  useEffect(() => {
    if (!editing.current) setNote(saved);
  }, [saved]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function saveNote(text: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (text !== saved) store.updateCarnet(recipeId, { note: text });
  }

  function onType(text: string) {
    setNote(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveNote(text), 800);
  }

  function setVerdict(v: "favori" | "deteste") {
    const next = verdict === v ? null : v;
    store.updateCarnet(recipeId, { verdict: next });
    if (next === "favori") toast("Ajoutée à vos favorites ❤️", { label: "Voir le carnet", run: () => router.push("/carnet/") });
    if (next === "deteste") toast("Elle ne sera plus proposée");
  }

  const btn = (on: boolean) =>
    `flex min-h-[64px] flex-col items-center justify-center rounded-2xl border px-1 py-2 text-center text-sm font-semibold leading-tight active:scale-[0.98] ${
      on ? "border-rose-300 bg-rose-50 text-rose-800" : "border-stone-200 bg-white text-stone-700"
    }`;

  return (
    <section className="card mt-4 p-4" aria-label="Mon carnet">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">📒 {store.household ? "Notre carnet" : "Mon carnet"}</h2>
        <Link href="/carnet/" className="text-sm font-semibold text-brand-700">Tout le carnet</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" aria-pressed={verdict === "favori"} className={btn(verdict === "favori")} onClick={() => setVerdict("favori")}>
          <span className="text-xl" aria-hidden="true">❤️</span>Favorite
        </button>
        <button type="button" aria-pressed={redo} className={btn(redo)} onClick={() => store.updateCarnet(recipeId, { redo: !redo })}>
          <span className="text-xl" aria-hidden="true">🔁</span>À refaire
        </button>
        <button type="button" aria-pressed={verdict === "deteste"} className={btn(verdict === "deteste")} onClick={() => setVerdict("deteste")}>
          <span className="text-xl" aria-hidden="true">👎</span>Pas pour nous
        </button>
      </div>
      {verdict === "deteste" && (
        <p className="mt-2 text-xs text-stone-500">Cette recette n&apos;est plus proposée dans « Qu&apos;est-ce qu&apos;on mange ? » ni au tirage au sort.</p>
      )}
      <label className="mt-3 block">
        <span className="text-sm font-semibold">Note perso</span>
        <textarea className="input mt-1 min-h-[72px] text-base" value={note} maxLength={NOTE_MAX}
          placeholder="Ex. : un peu moins de sel, doubler la sauce, les enfants ont adoré…"
          onFocus={() => { editing.current = true; }}
          onBlur={() => { editing.current = false; saveNote(note); }}
          onChange={(e) => onType(e.target.value)} />
      </label>
      {store.household && <p className="mt-1 text-xs text-stone-500">Partagé avec votre foyer.</p>}
    </section>
  );
}

