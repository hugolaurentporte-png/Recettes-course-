"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { COMMON_INGREDIENT_IDS, INGREDIENTS, getIngredient } from "@/lib/data/ingredients";
import { EQUIPMENT_LABELS } from "@/lib/labels";
import type { Equipment } from "@/lib/domain/types";

const EQUIP: Equipment[] = ["four", "poele", "casserole", "cocotte", "airfryer", "thermomix"];

/** Accueil du premier lancement : trois écrans, tous facultatifs. */
export function Onboarding() {
  const store = useStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [time, setTime] = useState<15 | 30 | 45 | null>(null);
  const quick = [...COMMON_INGREDIENT_IDS, ...INGREDIENTS.filter((i) => i.staple).map((i) => i.id)];

  function done(goTo?: string) {
    store.updateSettings({ onboarded: true });
    if (goTo) router.push(goTo);
  }

  return (
    // Carte intégrée à l'accueil (et non une fenêtre bloquante) : l'onglet Courses reste accessible immédiatement.
    <div className="mb-6">
      <section aria-label="Bienvenue" className="card border-brand-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Étape {step + 1} sur 3</p>

        {step === 0 && (
          <>
            <h2 className="mt-1 text-xl font-bold">Ajoutez quelques ingrédients de votre cuisine.</h2>
            <p className="mt-1 text-sm text-stone-500">Touchez ce que vous avez. Vous pourrez compléter plus tard.</p>
            <div className="mt-4 flex max-h-72 flex-wrap gap-2 overflow-y-auto">
              {quick.map((id) => {
                const on = store.inventoryMap.has(id);
                return (
                  <button key={id} type="button" aria-pressed={on} className={`chip ${on ? "chip-on" : ""}`}
                    onClick={() => (on ? store.removeFromInventory(id) : store.addToInventory(id))}>
                    {on ? "✓ " : ""}{getIngredient(id)?.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="mt-1 text-xl font-bold">Choisissez votre temps et votre mode de cuisson.</h2>
            <p className="mt-3 text-sm font-medium text-stone-600">Temps disponible aujourd&apos;hui</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([15, 30, 45, null] as const).map((t) => (
                <button key={String(t)} type="button" aria-pressed={time === t} className={`chip ${time === t ? "chip-on" : ""}`}
                  onClick={() => setTime(t)}>
                  {t === null ? "Sans limite" : `< ${t} min`}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm font-medium text-stone-600">Mon équipement</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EQUIP.map((e) => {
                const on = store.settings.ownedEquipment.includes(e);
                return (
                  <button key={e} type="button" aria-pressed={on} className={`chip ${on ? "chip-on" : ""}`}
                    onClick={() => store.updateSettings({
                      ownedEquipment: on ? store.settings.ownedEquipment.filter((x) => x !== e) : [...store.settings.ownedEquipment, e],
                    })}>
                    {on ? "✓ " : ""}{EQUIPMENT_LABELS[e]}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mt-1 text-xl font-bold">Découvrez ce que vous pouvez préparer.</h2>
            <p className="mt-1 text-sm text-stone-500">
              Les recettes réalisables avec votre stock passent en premier. La liste de courses, elle, s&apos;utilise à tout moment depuis l&apos;onglet « Courses », sans passer par les recettes.
            </p>
          </>
        )}

        <div className="mt-6 flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => done()}>Passer</button>
          {step < 2 ? (
            <button type="button" className="btn-primary flex-1" onClick={() => setStep(step + 1)}>Suivant</button>
          ) : (
            <button type="button" className="btn-primary flex-1" onClick={() => done(`/recettes/?${time ? `t=${time}` : "ready=1"}`)}>Voir les recettes</button>
          )}
        </div>
      </section>
    </div>
  );
}
