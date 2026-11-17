"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Recipe } from "@/lib/domain/types";
import { findTimers, formatClock, formatDuration, scaleStep, type StepPart } from "@/lib/domain/cooking";
import { useWakeLock } from "@/lib/useWakeLock";
import { XIcon } from "./Icons";

export interface CookingIngredient {
  id: string;
  name: string;
  amount: string | null;
  optional: boolean;
}

interface Timer {
  id: number;
  step: number;
  label: string;
  seconds: number;
  endsAt: number;
  /** Déjà sonné : reste affiché jusqu'à ce qu'on l'arrête. */
  rang: boolean;
}

/** Les quantités recalculées pour les portions choisies apparaissent en gras. */
export function StepText({ parts }: { parts: StepPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.scaled ? (
          <strong key={i} className="font-bold text-brand-700" title={`Recette d'origine : ${p.scaled.original}`}>{p.text}</strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Sonnerie courte jouée par le téléphone (le son est autorisé car l'AudioContext a été ouvert d'un appui). */
function ring(ctx: AudioContext | null) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([400, 200, 400, 200, 400]);
  if (!ctx) return;
  void ctx.resume();
  const t0 = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = i % 2 ? 660 : 880;
    const t = t0 + i * 0.35;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }
}

/**
 * Plein écran pour cuisiner : une étape à la fois en grand, l'écran reste allumé,
 * et un minuteur se lance d'un appui quand l'étape donne une durée.
 */
export function CookingMode({ recipe, servings, ingredients, onClose, onFinish }: {
  recipe: Recipe;
  servings: number;
  ingredients: CookingIngredient[];
  onClose: () => void;
  onFinish: () => void;
}) {
  const steps = recipe.instructions;
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [confirmQuit, setConfirmQuit] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const nextId = useRef(1);
  const touchX = useRef<number | null>(null);
  const wake = useWakeLock(true);

  const parts = useMemo(() => steps.map((s) => scaleStep(s, recipe.servings, servings)), [steps, recipe.servings, servings]);
  const stepTimers = useMemo(() => findTimers(steps[step] ?? ""), [steps, step]);
  const last = step === steps.length - 1;

  // Pas de défilement de la fiche derrière le mode cuisine.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Horloge : une fois par seconde tant qu'un minuteur tourne.
  const running = timers.some((t) => !t.rang);
  useEffect(() => {
    if (!running) return;
    const h = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(h);
  }, [running]);

  // Sonnerie à l'échéance (aussi au retour dans l'appli si elle était en arrière-plan).
  useEffect(() => {
    const due = timers.filter((t) => !t.rang && t.endsAt <= now);
    if (due.length === 0) return;
    ring(audio.current);
    setTimers((ts) => ts.map((t) => (due.some((d) => d.id === t.id) ? { ...t, rang: true } : t)));
  }, [now, timers]);

  // Une sonnerie qu'on n'a pas arrêtée reprend toutes les 10 secondes.
  const ringing = timers.some((t) => t.rang);
  useEffect(() => {
    if (!ringing) return;
    const h = window.setInterval(() => ring(audio.current), 10000);
    return () => window.clearInterval(h);
  }, [ringing]);

  const startTimer = useCallback((label: string, seconds: number) => {
    if (!audio.current && typeof window !== "undefined") {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audio.current = new Ctx();
    }
    void audio.current?.resume();
    const t = Date.now();
    setNow(t);
    setTimers((ts) => [...ts, { id: nextId.current++, step, label, seconds, endsAt: t + seconds * 1000, rang: false }]);
  }, [step]);

  const stopTimer = (id: number) => setTimers((ts) => ts.filter((t) => t.id !== id));
  const addMinute = (id: number) => {
    const t = Date.now();
    setNow(t);
    setTimers((ts) => ts.map((x) => (x.id === id ? { ...x, endsAt: Math.max(x.endsAt, t) + 60000, rang: false } : x)));
  };

  useEffect(() => () => void audio.current?.close(), []);

  const go = (d: number) => setStep((s) => Math.min(steps.length - 1, Math.max(0, s + d)));

  function quit() {
    if (timers.length > 0 && !confirmQuit) {
      setConfirmQuit(true);
      return;
    }
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={`Mode cuisine : ${recipe.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-white"
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        const x1 = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (x0 === null || x1 === undefined || showIngredients) return;
        if (x1 - x0 < -60) go(1);
        else if (x1 - x0 > 60) go(-1);
      }}>
      <header className="flex items-center gap-2 border-b border-stone-100 px-3 pb-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={quit} aria-label="Quitter le mode cuisine"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100"><XIcon /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{recipe.title}</p>
          <p className="text-xs text-stone-500">
            {servings} pers. · {wake === "on" ? "💡 L'écran reste allumé" : wake === "unsupported" ? "Écran : réglez la mise en veille de votre téléphone" : "…"}
          </p>
        </div>
        <button type="button" className={`chip ${showIngredients ? "chip-on" : ""}`} onClick={() => setShowIngredients((v) => !v)}
          aria-pressed={showIngredients}>
          Ingrédients
        </button>
      </header>

      <div className="h-1.5 bg-stone-100" aria-hidden>
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      {confirmQuit && (
        <div className="m-3 rounded-2xl bg-warm-50 p-4">
          <p className="font-semibold">Un minuteur tourne encore. Quitter le mode cuisine ?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={onClose}>Quitter</button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmQuit(false)}>Rester</button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-5 py-6">
        {showIngredients ? (
          <section aria-label="Ingrédients">
            <h2 className="text-xl font-bold">Ingrédients pour {servings} pers.</h2>
            <p className="mt-1 text-sm text-stone-500">Touchez un ingrédient quand il est prêt.</p>
            <ul className="mt-4 divide-y divide-stone-100">
              {ingredients.map((ing) => {
                const done = ready.has(ing.id);
                return (
                  <li key={ing.id}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2 text-lg">
                      <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={done}
                        onChange={() => setReady((r) => {
                          const n = new Set(r);
                          if (n.has(ing.id)) n.delete(ing.id);
                          else n.add(ing.id);
                          return n;
                        })} />
                      <span className={`flex-1 ${done ? "text-stone-400 line-through" : ""}`}>
                        {ing.amount && <strong className="font-semibold">{ing.amount} </strong>}
                        {ing.name}
                        {!ing.amount && <span className="text-stone-500"> (selon le goût)</span>}
                        {ing.optional && <span className="text-stone-500"> — facultatif</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setShowIngredients(false)}>
              Revenir à l&apos;étape {step + 1}
            </button>
          </section>
        ) : (
          <section aria-live="polite">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Étape {step + 1} sur {steps.length}</p>
            <p className="mt-3 text-2xl leading-relaxed text-stone-900 sm:text-3xl">
              <StepText parts={parts[step] ?? []} />
            </p>
            {stepTimers.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {stepTimers.map((t) => (
                  <button key={t.label} type="button" onClick={() => startTimer(t.label, t.seconds)}
                    className="btn-secondary border-brand-600 text-brand-700">
                    ⏱ Minuteur {formatDuration(t.seconds)}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {timers.length > 0 && (
        <ul className="space-y-2 border-t border-stone-100 px-3 py-2" aria-label="Minuteurs">
          {timers.map((t) => {
            const left = (t.endsAt - now) / 1000;
            return (
              <li key={t.id} className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${t.rang ? "animate-pulse bg-warm-600 text-white" : "bg-brand-50"}`}>
                <span className="text-2xl font-bold tabular-nums" aria-live={t.rang ? "assertive" : "off"}>
                  {t.rang ? "⏰ C'est l'heure" : formatClock(left)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">Étape {t.step + 1} · {formatDuration(t.seconds)}</span>
                <button type="button" className={`chip ${t.rang ? "border-white/60 bg-white/20 text-white" : ""}`} onClick={() => addMinute(t.id)}>+1 min</button>
                <button type="button" className={`chip ${t.rang ? "border-white bg-white text-warm-600" : ""}`} onClick={() => stopTimer(t.id)}
                  aria-label={`Arrêter le minuteur de l'étape ${t.step + 1}`}>{t.rang ? "OK" : "Arrêter"}</button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="safe-bottom flex gap-3 border-t border-stone-100 p-3">
        <button type="button" className="btn-secondary flex-1" disabled={step === 0 || showIngredients} onClick={() => go(-1)}>
          ← Précédente
        </button>
        {last ? (
          <button type="button" className="btn-primary flex-1" disabled={showIngredients} onClick={onFinish}>C&apos;est prêt 🎉</button>
        ) : (
          <button type="button" className="btn-primary flex-1" disabled={showIngredients} onClick={() => go(1)}>Suivante →</button>
        )}
      </footer>
    </div>
  );
}
