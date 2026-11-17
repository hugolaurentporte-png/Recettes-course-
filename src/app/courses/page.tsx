"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { displayAmounts, groupForDisplay, suggest } from "@/lib/domain/shopping";
import { AISLE_ICONS, AISLE_LABELS, AISLE_ORDER } from "@/lib/domain/categorize";
import { parseItemInput } from "@/lib/domain/parse";
import { EDITABLE_UNITS, UNITS, formatAmount } from "@/lib/domain/units";
import { INGREDIENTS } from "@/lib/data/ingredients";
import type { Aisle, ShoppingItem, Unit } from "@/lib/domain/types";
import { useToast } from "@/components/Toast";
import { Sheet } from "@/components/Sheet";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/Icons";

export default function CoursesPage() {
  const store = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { groups, checked } = useMemo(() => groupForDisplay(store.shopping), [store.shopping]);
  const toBuy = groups.reduce((n, g) => n + g.items.length, 0);
  const suggestions = useMemo(
    () => suggest(parseItemInput(text).name, store.history, store.shopping, INGREDIENTS, 8),
    [text, store.history, store.shopping],
  );

  function add(raw: string) {
    const parsed = parseItemInput(raw);
    if (!parsed.name.trim()) return;
    const r = store.addItem(parsed.name, parsed.quantity, parsed.unit);
    setText("");
    inputRef.current?.focus();
    if (r) toast(r.merged ? `${r.item.customName} : quantité mise à jour` : `${r.item.customName} ajouté`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add(text);
  }

  function onFinish() {
    const r = store.finish();
    if (r) toast(`Courses terminées : ${r.count} article${r.count > 1 ? "s" : ""} archivé${r.count > 1 ? "s" : ""}`, { label: "Annuler", run: r.undo });
  }

  return (
    <div className="px-4">
      <header className="sticky top-0 z-20 -mx-4 bg-[#f7f7f5]/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Mes courses</h1>
          <span className="text-sm text-stone-500">
            {toBuy === 0 ? "Rien à acheter" : `${toBuy} à acheter`}
          </span>
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor="add-item" className="sr-only">Ajouter un article</label>
          <input id="add-item" ref={inputRef} className="input text-lg" value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un article… (ex. 2 kg pommes)"
            autoComplete="off" enterKeyHint="done" />
          <button type="submit" className="btn-primary aspect-square px-0" aria-label="Ajouter" disabled={!text.trim()}>
            <PlusIcon width={28} height={28} />
          </button>
        </form>
        {suggestions.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" aria-label="Suggestions">
            {suggestions.map((s) => (
              <button key={s.key} type="button" className="chip" onClick={() => add(s.name)}>
                <PlusIcon width={16} height={16} /> {s.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {store.ready && toBuy === 0 && checked.length === 0 && (
        <div className="card mt-6 p-6 text-center text-stone-600">
          <p className="text-4xl">🛒</p>
          <p className="mt-2 font-semibold text-stone-800">Votre liste est vide</p>
          <p className="mt-1 text-sm">Tapez un produit ci-dessus, alimentaire ou non. Les recettes peuvent aussi y ajouter ce qui vous manque.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.aisle} aria-label={AISLE_LABELS[g.aisle]}>
          <h2 className="section-title">{AISLE_ICONS[g.aisle]} {AISLE_LABELS[g.aisle]}</h2>
          <ul className="card divide-y divide-stone-100 overflow-hidden">
            {g.items.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={() => store.toggleItem(item.id)} onEdit={() => setEditing(item)} />
            ))}
          </ul>
        </section>
      ))}

      {checked.length > 0 && (
        <section aria-label="Dans le panier">
          <h2 className="section-title">✓ Dans le panier ({checked.length})</h2>
          <ul className="card divide-y divide-stone-100 overflow-hidden opacity-70">
            {checked.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={() => store.toggleItem(item.id)} onEdit={() => setEditing(item)} />
            ))}
          </ul>
          <button type="button" className="btn-primary mt-4 w-full" onClick={onFinish}>
            Terminer mes courses
          </button>
          <p className="mt-2 text-center text-xs text-stone-500">Les articles cochés sont archivés, les autres restent dans la liste.</p>
        </section>
      )}

      <EditSheet item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ItemRow({ item, onToggle, onEdit }: { item: ShoppingItem; onToggle: () => void; onEdit: () => void }) {
  const amounts = displayAmounts(item);
  const sources = [...new Set(item.recipeNeeds.map((n) => n.recipeTitle))];
  return (
    <li className="flex min-h-[60px] items-center">
      <button type="button" onClick={onToggle} role="checkbox" aria-checked={item.checked}
        aria-label={`${item.checked ? "Décocher" : "Cocher"} ${item.customName}`}
        className="flex h-[60px] w-14 shrink-0 items-center justify-center">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${item.checked ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>
          {item.checked && <CheckIcon width={18} height={18} strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={onEdit} className="flex min-h-[60px] flex-1 flex-col justify-center py-2 pr-4 text-left">
        <span className={`text-base ${item.checked ? "text-stone-400 line-through" : "font-medium"}`}>
          {item.customName}
          {amounts.length > 0 && <span className="font-normal text-stone-500"> · {amounts.map(formatAmount).join(" + ")}</span>}
        </span>
        {(item.toVerify || sources.length > 0 || item.note) && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-500">
            {item.toVerify && <span className="font-semibold text-warm-600">Quantité à vérifier</span>}
            {sources.length > 0 && <span>Pour : {sources.join(", ")}</span>}
            {item.note && <span>{item.note}</span>}
          </span>
        )}
      </button>
    </li>
  );
}

function EditSheet({ item, onClose }: { item: ShoppingItem | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onClose={onClose} title="Modifier l'article">
      {item && <EditForm key={item.id} item={item} onClose={onClose} />}
    </Sheet>
  );
}

function EditForm({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const current = displayAmounts(item)[0];
  const [name, setName] = useState(item.customName);
  const [qty, setQty] = useState(current ? String(current.value).replace(".", ",") : "");
  const [unit, setUnit] = useState<Unit>(current?.unit ?? item.manual?.unit ?? "piece");
  const [aisle, setAisle] = useState<Aisle>(item.aisle);
  const [note, setNote] = useState(item.note);

  function save(e: FormEvent) {
    e.preventDefault();
    const q = qty.trim() === "" ? null : Number(qty.replace(",", "."));
    const qtyChanged = q !== (current?.value ?? null) || (q !== null && unit !== current?.unit);
    store.updateItem(item.id, {
      name,
      aisle,
      note,
      ...(qtyChanged && (q === null || (Number.isFinite(q) && q > 0)) ? { quantity: q, unit } : {}),
    });
    onClose();
  }

  function remove() {
    const undo = store.removeItem(item.id);
    toast(`${item.customName} supprimé`, { label: "Annuler", run: undo });
    onClose();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-600">Nom</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div>
        <span className="mb-1 block text-sm font-medium text-stone-600">Quantité (facultative)</span>
        <div className="flex gap-2">
          <input className="input w-28" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="—" aria-label="Quantité" />
          <select className="input flex-1" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unité">
            {EDITABLE_UNITS.map((u) => <option key={u} value={u}>{UNITS[u].plural}</option>)}
          </select>
        </div>
        {item.recipeNeeds.length > 0 && (
          <p className="mt-1 text-xs text-stone-500">Changer la quantité remplace le calcul fait à partir des recettes.</p>
        )}
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium text-stone-600">Rayon</span>
        <div className="flex flex-wrap gap-2">
          {AISLE_ORDER.map((a) => (
            <button key={a} type="button" onClick={() => setAisle(a)} className={`chip ${aisle === a ? "chip-on" : ""}`} aria-pressed={aisle === a}>
              {AISLE_ICONS[a]} {AISLE_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-600">Note</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Marque, format…" />
      </label>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={remove} className="btn-secondary text-red-700" aria-label="Supprimer l'article">
          <TrashIcon /> Supprimer
        </button>
        <button type="submit" className="btn-primary flex-1">Enregistrer</button>
      </div>
    </form>
  );
}
