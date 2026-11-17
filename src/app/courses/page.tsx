"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { displayAmounts, groupForDisplay, suggest } from "@/lib/domain/shopping";
import { AISLE_ICONS, AISLE_LABELS, AISLE_ORDER } from "@/lib/domain/categorize";
import { parseItemInput } from "@/lib/domain/parse";
import { EDITABLE_UNITS, UNITS, formatAmount } from "@/lib/domain/units";
import { INGREDIENTS } from "@/lib/data/ingredients";
import { PRODUCTS, PRODUCT_NAMES } from "@/lib/data/products";
import { itemKey } from "@/lib/domain/normalize";
import type { Aisle, ShoppingItem, Unit } from "@/lib/domain/types";
import { useToast } from "@/components/Toast";
import { Sheet } from "@/components/Sheet";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/Icons";

export default function CoursesPage() {
  const store = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { groups, checked } = useMemo(() => groupForDisplay(store.shopping), [store.shopping]);
  const toBuy = groups.reduce((n, g) => n + g.items.length, 0);
  const suggestions = useMemo(
    () => suggest(parseItemInput(text).name, store.history, store.shopping, INGREDIENTS, 8, PRODUCT_NAMES),
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

  /** Récapitulatif : les articles décochés ici n'ont pas été pris et restent dans la liste. */
  function onFinish(notBought: Set<string>) {
    setReviewing(false);
    for (const id of notBought) store.toggleItem(id);
    const r = store.finish();
    if (r) toast(
      `Courses terminées : ${r.count} article${r.count > 1 ? "s" : ""} rangé${r.count > 1 ? "s" : ""}${r.stocked > 0 ? ` (${r.stocked} nouveau${r.stocked > 1 ? "x" : ""} dans Mon frigo)` : ""}`,
      { label: "Annuler", run: r.undo },
    );
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
        {!text.trim() && (
          <button type="button" className="mt-3 text-sm font-semibold text-brand-700" onClick={() => setBrowsing(true)}>
            🛒 Parcourir les rayons du supermarché
          </button>
        )}
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
          <button type="button" className="btn-primary mt-4 w-full" onClick={() => setReviewing(true)}>
            Terminer mes courses
          </button>
          <p className="mt-2 text-center text-xs text-stone-500">Les articles cochés sont rangés dans « Mon frigo », les autres restent dans la liste.</p>
        </section>
      )}

      <EditSheet item={editing} onClose={() => setEditing(null)} />
      <Sheet open={reviewing} onClose={() => setReviewing(false)} title="Ranger mes achats">
        {reviewing && <FinishReview items={checked} onConfirm={onFinish} />}
      </Sheet>
      <Sheet open={browsing} onClose={() => setBrowsing(false)} title="Rayons du supermarché">
        {browsing && <AisleBrowser />}
      </Sheet>
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

/** Tous les rayons : un toucher ajoute le produit, un second le retire. */
function AisleBrowser() {
  const store = useStore();
  const inList = new Map(
    store.shopping.filter((i) => i.deletedAt === null && !i.checked).map((i) => [itemKey(i.customName), i.id] as const),
  );
  const aisles = AISLE_ORDER.filter((a): a is keyof typeof PRODUCTS => a in PRODUCTS);
  return (
    <div className="max-h-[65vh] overflow-y-auto pb-4">
      <p className="text-sm text-stone-600">Touchez un produit pour l&apos;ajouter, touchez-le encore pour le retirer.</p>
      {aisles.map((a) => (
        <section key={a}>
          <h3 className="section-title">{AISLE_ICONS[a]} {AISLE_LABELS[a]}</h3>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS[a].map((name) => {
              const id = inList.get(itemKey(name));
              return (
                <button key={name} type="button" aria-pressed={id !== undefined} className={`chip ${id ? "chip-on" : ""}`}
                  onClick={() => (id ? store.removeItem(id) : store.addItem(name))}>
                  {id ? "✓ " : ""}{name}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Avant de ranger : tout est coché, on décoche ce qui n'a finalement pas été pris. */
function FinishReview({ items, onConfirm }: { items: ShoppingItem[]; onConfirm: (notBought: Set<string>) => void }) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const kept = items.length - off.size;
  return (
    <div>
      <p className="text-sm text-stone-600">Ces articles vont être rangés dans « Mon frigo ». Décochez ce que vous n&apos;avez pas pris : il restera dans la liste.</p>
      <ul className="mt-3 max-h-[50vh] divide-y divide-stone-100 overflow-y-auto">
        {items.map((it) => {
          const on = !off.has(it.id);
          return (
            <li key={it.id}>
              <button type="button" role="checkbox" aria-checked={on}
                className="flex min-h-[52px] w-full items-center gap-3 px-1 text-left"
                onClick={() => setOff((prev) => { const n = new Set(prev); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>
                  {on && <CheckIcon width={16} height={16} />}
                </span>
                <span className={on ? "" : "text-stone-400 line-through"}>{it.customName}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn-primary mt-4 w-full" disabled={kept === 0} onClick={() => onConfirm(off)}>
        Ranger {kept} article{kept > 1 ? "s" : ""}
      </button>
    </div>
  );
}
