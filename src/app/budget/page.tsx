"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import {
  budgetStatus, formatEuros, monthKey, monthLabel, parseEuros, shiftMonth, spendByAisle, totalOfMonth, tripsOfMonth,
} from "@/lib/domain/budget";
import { AISLE_ICONS, AISLE_LABELS, AISLE_ORDER } from "@/lib/domain/categorize";
import type { Aisle } from "@/lib/domain/types";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { BackIcon, PlusIcon, XIcon } from "@/components/Icons";

export default function BudgetPage() {
  const store = useStore();
  const toast = useToast();
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [adding, setAdding] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);

  const spent = totalOfMonth(store.trips, month);
  const previous = totalOfMonth(store.trips, shiftMonth(month, -1));
  const trips = tripsOfMonth(store.trips, month);
  const { byAisle, undetailed } = spendByAisle(store.trips, month);
  const budget = store.settings.monthlyBudget ?? null;
  const status = budget ? budgetStatus(spent, budget, new Date(), month) : null;
  const maxBar = Math.max(1, ...byAisle.map((a) => a.amount), undetailed);

  return (
    <div className="px-4 pb-8">
      <header className="sticky top-0 z-20 -mx-4 bg-[#f7f7f5]/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link href="/courses/" aria-label="Retour aux courses" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <BackIcon />
          </Link>
          <h1 className="text-2xl font-bold">Budget courses</h1>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" className="btn-secondary h-11 min-h-0 px-4" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent">‹</button>
          <p className="font-semibold first-letter:uppercase">{monthLabel(month)}</p>
          <button type="button" className="btn-secondary h-11 min-h-0 px-4" disabled={month >= current}
            onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant">›</button>
        </div>
      </header>

      <section className="card p-5 text-center">
        <p className="text-sm text-stone-500">Dépensé</p>
        <p className="text-4xl font-bold">{formatEuros(spent)}</p>
        {budget ? (
          <>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100" role="progressbar"
              aria-valuemin={0} aria-valuemax={budget} aria-valuenow={spent} aria-label="Part du budget dépensée">
              <div className={`h-full rounded-full ${status!.over ? "bg-red-600" : status!.ahead ? "bg-warm-600" : "bg-brand-600"}`}
                style={{ width: `${Math.min(100, status!.ratio * 100)}%` }} />
            </div>
            <p className={`mt-2 text-sm ${status!.over ? "font-semibold text-red-700" : "text-stone-600"}`}>
              {status!.over
                ? `Budget dépassé de ${formatEuros(-status!.remaining)}`
                : `Reste ${formatEuros(status!.remaining)} sur ${formatEuros(budget)}`}
              {!status!.over && status!.ahead && " · vous dépensez plus vite que prévu"}
            </p>
          </>
        ) : null}
        <button type="button" className="mt-3 text-sm font-semibold text-brand-700" onClick={() => setEditingBudget(true)}>
          {budget ? "Modifier le budget du mois" : "Fixer un budget par mois"}
        </button>
        {previous > 0 && <p className="mt-2 text-xs text-stone-500">Mois précédent : {formatEuros(previous)}</p>}
      </section>

      {(byAisle.length > 0 || undetailed > 0) && (
        <section>
          <h2 className="section-title">Par rayon</h2>
          <ul className="card space-y-3 p-4">
            {byAisle.map((a) => (
              <BarRow key={a.aisle} label={`${AISLE_ICONS[a.aisle]} ${AISLE_LABELS[a.aisle]}`} amount={a.amount} max={maxBar} />
            ))}
            {undetailed > 0 && <BarRow label="🧾 Non détaillé" amount={undetailed} max={maxBar} muted />}
          </ul>
          {byAisle.length === 0 && (
            <p className="mt-2 px-1 text-xs text-stone-500">Tapez le prix des articles en terminant vos courses pour voir ce que coûte chaque rayon.</p>
          )}
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="section-title">Tickets</h2>
          <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setAdding(true)}>
            <PlusIcon width={16} height={16} className="mr-1 inline" />Ajouter une dépense
          </button>
        </div>
        {trips.length === 0 ? (
          <p className="card p-5 text-center text-sm text-stone-600">
            Aucune dépense ce mois-ci. Le montant se saisit en touchant « Terminer mes courses », ou avec « Ajouter une dépense ».
          </p>
        ) : (
          <ul className="card divide-y divide-stone-100">
            {trips.map((t) => (
              <li key={t.id} className="flex min-h-[56px] items-center gap-3 pl-4">
                <span className="flex-1">
                  <span className="block font-medium">{new Date(t.finishedAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
                  <span className="text-xs text-stone-500">
                    {t.items.length === 0 ? "Dépense ajoutée à la main" : t.items.length === 1 && t.items[0]!.customName === "Dépense"
                      ? AISLE_LABELS[t.items[0]!.aisle] : `${t.items.length} article${t.items.length > 1 ? "s" : ""}`}
                  </span>
                </span>
                <span className="font-semibold">{formatEuros(t.amount ?? 0)}</span>
                <button type="button" className="flex h-12 w-12 items-center justify-center text-stone-400" aria-label="Supprimer cette dépense"
                  onClick={() => { store.removeTrip(t.id); toast("Dépense supprimée"); }}>
                  <XIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Ajouter une dépense">
        {adding && <ExpenseForm onDone={(amount, aisle) => { store.addExpense(amount, aisle); setAdding(false); toast(`${formatEuros(amount)} ajouté`); }} />}
      </Sheet>
      <Sheet open={editingBudget} onClose={() => setEditingBudget(false)} title="Budget courses par mois">
        {editingBudget && (
          <BudgetForm initial={budget} onDone={(v) => { store.updateSettings({ monthlyBudget: v }); setEditingBudget(false); }} />
        )}
      </Sheet>
    </div>
  );
}

function BarRow({ label, amount, max, muted = false }: { label: string; amount: number; max: number; muted?: boolean }) {
  return (
    <li>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{formatEuros(amount)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${muted ? "bg-stone-300" : "bg-brand-600"}`} style={{ width: `${(amount / max) * 100}%` }} />
      </div>
    </li>
  );
}

function ExpenseForm({ onDone }: { onDone: (amount: number, aisle: Aisle | null) => void }) {
  const [value, setValue] = useState("");
  const [aisle, setAisle] = useState<Aisle | null>(null);
  const amount = parseEuros(value);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (amount) onDone(amount, aisle);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-stone-600">Pour un achat fait sans la liste (marché, boulangerie, boucherie…).</p>
      <input className="input text-lg" inputMode="decimal" placeholder="Montant en €" aria-label="Montant" value={value}
        onChange={(e) => setValue(e.target.value)} autoFocus />
      <div>
        <p className="mb-2 text-sm font-semibold">Rayon (facultatif)</p>
        <div className="flex flex-wrap gap-2">
          {AISLE_ORDER.map((a) => (
            <button key={a} type="button" aria-pressed={aisle === a} className={`chip ${aisle === a ? "chip-on" : ""}`}
              onClick={() => setAisle(aisle === a ? null : a)}>
              {AISLE_ICONS[a]} {AISLE_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={!amount}>Ajouter</button>
    </form>
  );
}

function BudgetForm({ initial, onDone }: { initial: number | null; onDone: (v: number | null) => void }) {
  const [value, setValue] = useState(initial ? String(initial).replace(".", ",") : "");
  const amount = parseEuros(value);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onDone(amount); }} className="space-y-4">
      <input className="input text-lg" inputMode="decimal" placeholder="Par exemple 450" aria-label="Budget mensuel en euros"
        value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      <div className="flex gap-2">
        {initial && <button type="button" className="btn-secondary" onClick={() => onDone(null)}>Pas de budget</button>}
        <button type="submit" className="btn-primary flex-1" disabled={!amount}>Enregistrer</button>
      </div>
    </form>
  );
}
