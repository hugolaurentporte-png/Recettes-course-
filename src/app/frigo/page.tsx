"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ALL_EQUIPMENT, useStore } from "@/lib/store";
import { CATEGORY_LABELS, CATEGORY_ORDER, COMMON_INGREDIENT_IDS, INGREDIENTS, getIngredient } from "@/lib/data/ingredients";
import { searchIngredients } from "@/lib/domain/search";
import { EDITABLE_UNITS, UNITS, formatAmount } from "@/lib/domain/units";
import type { Ingredient, InventoryItem, Unit } from "@/lib/domain/types";
import { EQUIPMENT_LABELS } from "@/lib/labels";
import { Sheet } from "@/components/Sheet";
import { BoltIcon, PlusIcon, XIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";

export default function FrigoPage() {
  const store = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const results = useMemo(() => searchIngredients(q), [q]);
  const owned = store.inventoryMap;
  const staples = INGREDIENTS.filter((i) => i.staple);
  const nonStaple = store.inventory.filter((i) => !getIngredient(i.ingredientId)?.staple);
  const priority = nonStaple.filter((i) => i.priority);
  const common = COMMON_INGREDIENT_IDS.filter((id) => !owned.has(id)).map((id) => getIngredient(id)).filter(Boolean) as Ingredient[];

  const byCategory = CATEGORY_ORDER.map((c) => ({
    c,
    items: nonStaple
      .filter((i) => !i.priority && getIngredient(i.ingredientId)?.category === c)
      .sort((a, b) => (getIngredient(a.ingredientId)?.name ?? "").localeCompare(getIngredient(b.ingredientId)?.name ?? "", "fr")),
  })).filter((g) => g.items.length > 0);

  function add(ing: Ingredient) {
    store.addToInventory(ing.id);
    setQ("");
    toast(`${ing.name} ajouté au frigo`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const first = results[0];
    if (first) add(first);
  }

  return (
    <div className="px-4">
      <header className="sticky top-0 z-20 -mx-4 bg-[#f7f7f5]/95 px-4 pb-3 pt-4 backdrop-blur">
        <h1 className="mb-3 text-2xl font-bold">Mon frigo</h1>
        <form onSubmit={onSubmit} className="relative">
          <label htmlFor="ing-search" className="sr-only">Ajouter un ingrédient</label>
          <div className="flex gap-2">
            <input id="ing-search" className="input text-lg" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Tapez un ingrédient…" autoComplete="off" enterKeyHint="done" />
            <button type="submit" className="btn-primary shrink-0 px-4" disabled={results.length === 0}>Ajouter</button>
          </div>
          {results.length > 0 && (
            <ul className="card absolute inset-x-0 top-[52px] z-30 max-h-80 overflow-y-auto shadow-lg" role="listbox">
              {results.map((ing) => {
                const has = owned.has(ing.id);
                return (
                  <li key={ing.id}>
                    <button type="button" disabled={has} onClick={() => add(ing)}
                      className="flex min-h-[52px] w-full items-center justify-between px-4 text-left disabled:text-stone-400">
                      <span>{ing.name} <span className="text-xs text-stone-400">{CATEGORY_LABELS[ing.category]}</span></span>
                      {has ? <span className="text-xs">Déjà là</span> : <PlusIcon className="text-brand-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {q.trim() && results.length === 0 && (
            <p className="mt-2 text-sm text-stone-500">Aucun ingrédient trouvé pour « {q} ».</p>
          )}
        </form>
      </header>

      {common.length > 0 && (
        <>
          <h2 className="section-title">Ajout rapide</h2>
          <div className="flex flex-wrap gap-2">
            {common.map((ing) => (
              <button key={ing.id} type="button" className="chip" onClick={() => add(ing)}>
                <PlusIcon width={16} height={16} /> {ing.name}
              </button>
            ))}
          </div>
        </>
      )}

      {priority.length > 0 && (
        <section>
          <h2 className="section-title text-warm-600">⚡ À utiliser rapidement</h2>
          <p className="mb-2 px-1 text-xs text-stone-500">
            Ces aliments sont mis en avant dans les recettes. En cas de doute sur leur fraîcheur (odeur, aspect, date dépassée), ne les consommez pas.
          </p>
          <ul className="card divide-y divide-stone-100 border-warm-100">
            {priority.map((item) => (
              <InventoryRow key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </ul>
        </section>
      )}

      {nonStaple.length === 0 && store.ready && (
        <div className="card mt-6 p-6 text-center text-stone-600">
          <p className="text-4xl">🧊</p>
          <p className="mt-2 font-semibold text-stone-800">Votre frigo est vide</p>
          <p className="mt-1 text-sm">Ajoutez quelques ingrédients : les recettes s&apos;adapteront à ce que vous avez.</p>
        </div>
      )}

      {byCategory.map((g) => (
        <section key={g.c}>
          <h2 className="section-title">{CATEGORY_LABELS[g.c]}</h2>
          <ul className="card divide-y divide-stone-100">
            {g.items.map((item) => (
              <InventoryRow key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="section-title">Mes indispensables</h2>
        <p className="mb-2 px-1 text-xs text-stone-500">Cochez ceux que vous avez habituellement. Ils ne sont pas considérés comme disponibles par défaut.</p>
        <div className="flex flex-wrap gap-2">
          {staples.map((s) => {
            const on = owned.has(s.id);
            return (
              <button key={s.id} type="button" aria-pressed={on} className={`chip ${on ? "chip-on" : ""}`}
                onClick={() => (on ? store.removeFromInventory(s.id) : store.addToInventory(s.id))}>
                {on ? "✓ " : ""}{s.name}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">Mon équipement</h2>
        <p className="mb-2 px-1 text-xs text-stone-500">Les recettes demandant un équipement que vous n&apos;avez pas sont masquées.</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {ALL_EQUIPMENT.filter((e) => e !== "sans-cuisson").map((e) => {
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
      </section>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={getIngredient(editing?.ingredientId ?? "")?.name ?? ""}>
        {editing && <QuantityForm key={editing.id} item={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function InventoryRow({ item, onEdit }: { item: InventoryItem; onEdit: () => void }) {
  const store = useStore();
  const ing = getIngredient(item.ingredientId);
  if (!ing) return null;
  return (
    <li className="flex min-h-[56px] items-center gap-1 pl-4">
      <button type="button" onClick={onEdit} className="flex min-h-[56px] flex-1 flex-col justify-center text-left">
        <span className="font-medium">{ing.name}</span>
        <span className="text-xs text-stone-500">
          {item.quantity !== null && item.unit ? formatAmount({ value: item.quantity, unit: item.unit }) : "Quantité non précisée"}
        </span>
      </button>
      <button type="button" aria-pressed={item.priority}
        onClick={() => store.updateInventory(item.ingredientId, { priority: !item.priority })}
        className={`flex h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold ${item.priority ? "bg-warm-100 text-warm-600" : "text-stone-400"}`}
        aria-label={item.priority ? `Retirer la priorité de ${ing.name}` : `Marquer ${ing.name} à utiliser rapidement`}>
        <BoltIcon width={18} height={18} /> {item.priority ? "À utiliser vite" : ""}
      </button>
      <button type="button" onClick={() => store.removeFromInventory(item.ingredientId)}
        className="flex h-14 w-12 items-center justify-center text-stone-400" aria-label={`Retirer ${ing.name}`}>
        <XIcon width={20} height={20} />
      </button>
    </li>
  );
}

function QuantityForm({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const store = useStore();
  const ing = getIngredient(item.ingredientId);
  const [qty, setQty] = useState(item.quantity !== null ? String(item.quantity).replace(".", ",") : "");
  const [unit, setUnit] = useState<Unit>(item.unit ?? ing?.defaultUnit ?? "piece");

  function save(e: FormEvent) {
    e.preventDefault();
    const q = qty.trim() === "" ? null : Number(qty.replace(",", "."));
    store.updateInventory(item.ingredientId, q === null || !Number.isFinite(q) || q <= 0 ? { quantity: null, unit: null } : { quantity: q, unit });
    onClose();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-stone-600">La quantité est facultative. Elle permet de calculer précisément ce qui manque.</p>
      <div className="flex gap-2">
        <input className="input w-28" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="—" aria-label="Quantité" autoFocus />
        <select className="input flex-1" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unité">
          {EDITABLE_UNITS.map((u) => <option key={u} value={u}>{UNITS[u].plural}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => { setQty(""); }}>Effacer</button>
        <button type="submit" className="btn-primary flex-1">Enregistrer</button>
      </div>
    </form>
  );
}
