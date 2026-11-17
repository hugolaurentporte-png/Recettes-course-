import { describe, expect, it } from "vitest";
import { applyRemote, firstMerge, localChanges, removedDoc, stockDoc, type StockDoc } from "../src/lib/sync/fridge";
import { isMemberKey, newMemberKey } from "../src/lib/sync/docs";
import type { InventoryItem } from "../src/lib/domain/types";

const inv = (ingredientId: string, updatedAt: number, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id: `id-${ingredientId}-${updatedAt}`, ingredientId, quantity: null, unit: null, priority: false, updatedAt, ...extra,
});
let n = 0;
const newId = () => `new-${++n}`;

describe("frigo partagé : clés de membre", () => {
  it("crée des clés longues, différentes à chaque fois", () => {
    const rnd = (k: number) => crypto.getRandomValues(new Uint8Array(k));
    const a = newMemberKey(rnd);
    expect(isMemberKey(a)).toBe(true);
    expect(a).not.toBe(newMemberKey(rnd));
    expect(isMemberKey("court")).toBe(false);
  });
});

describe("frigo partagé : premier partage", () => {
  it("garde les produits des deux téléphones", () => {
    const local = [inv("oeuf", 10, { quantity: 6, unit: "piece" })];
    const remote = [stockDoc(inv("lait", 5, { quantity: 1, unit: "l" }))];
    const m = firstMerge(local, remote, 1000, newId);
    expect(m.inventory.map((i) => i.ingredientId).sort()).toEqual(["lait", "oeuf"]);
    expect(m.toPush.map((d) => d.id)).toEqual(["oeuf"]);
    expect(m.conflicts).toBe(0);
  });

  it("signale les quantités contradictoires « à vérifier » et l'envoie à l'autre", () => {
    const local = [inv("oeuf", 10, { quantity: 4, unit: "piece" })];
    const remote = [stockDoc(inv("oeuf", 5, { quantity: 6, unit: "piece" }))];
    const m = firstMerge(local, remote, 1000, newId);
    expect(m.conflicts).toBe(1);
    expect(m.inventory).toHaveLength(1);
    expect(m.inventory[0]!.quantityCheck).toEqual([{ quantity: 6, unit: "piece" }, { quantity: 4, unit: "piece" }]);
    expect(m.toPush[0]!.item!.quantityCheck).toHaveLength(2);
    expect(m.toPush[0]!.updatedAt).toBe(1000);
  });

  it("des quantités égales dans des unités différentes ne sont pas une contradiction", () => {
    const local = [inv("lait", 10, { quantity: 100, unit: "cl" })];
    const remote = [stockDoc(inv("lait", 5, { quantity: 1, unit: "l" }))];
    const m = firstMerge(local, remote, 1000, newId);
    expect(m.conflicts).toBe(0);
    expect(m.toPush).toHaveLength(0);
  });

  it("une quantité connue d'un seul côté est reprise, sans alerte", () => {
    const local = [inv("beurre", 10, { quantity: 250, unit: "g" })];
    const remote = [stockDoc(inv("beurre", 5))];
    const m = firstMerge(local, remote, 1000, newId);
    expect(m.conflicts).toBe(0);
    expect(m.inventory[0]).toMatchObject({ quantity: 250, unit: "g" });
    expect(m.toPush).toHaveLength(1);
  });

  it("un produit saisi ici est conservé même s'il avait été retiré du foyer", () => {
    const m = firstMerge([inv("ail", 10)], [removedDoc("ail", 2000)], 1000, newId);
    expect(m.inventory.map((i) => i.ingredientId)).toEqual(["ail"]);
    expect(m.toPush[0]!.updatedAt).toBe(2001);
  });
});

describe("frigo partagé : modifications", () => {
  it("envoie un produit retiré comme une suppression", () => {
    const prev = [inv("pomme-de-terre", 10), inv("oeuf", 10)];
    const c = localChanges(prev, [prev[1]!], 500);
    expect(c.docs).toEqual([{ id: "pomme-de-terre", updatedAt: 500, deletedAt: 500, item: null }]);
  });

  it("une modification passe toujours après la version précédente (horloge en retard)", () => {
    const prev = [inv("oeuf", 900)];
    const c = localChanges(prev, [{ ...prev[0]!, quantity: 2, updatedAt: 800 }], 800);
    expect(c.docs[0]!.updatedAt).toBe(901);
    expect(c.inventory[0]!.updatedAt).toBe(901);
  });

  it("un produit remis (Annuler) est daté de maintenant", () => {
    const c = localChanges([], [inv("pomme-de-terre", 10)], 5000);
    expect(c.docs[0]!.updatedAt).toBe(5000);
  });
});

describe("frigo partagé : scénario deux téléphones", () => {
  it("l'un cuisine les dernières pommes de terre, l'autre ajoute des œufs hors ligne", () => {
    // État commun de départ.
    const start = [inv("pomme-de-terre", 100, { quantity: 2, unit: "piece" })];
    let server: StockDoc[] = start.map((i) => stockDoc(i));
    const push = (docs: StockDoc[]) => {
      for (const d of docs) {
        const i = server.findIndex((s) => s.id === d.id);
        if (i < 0) server.push(d);
        else if (d.updatedAt > server[i]!.updatedAt) server[i] = d;
      }
    };

    // Téléphone A (en ligne) : « J'ai cuisiné » retire les pommes de terre.
    const a1 = localChanges(start, [], 200);
    push(a1.docs);
    let a: InventoryItem[] = a1.inventory;

    // Téléphone B (hors ligne) : ajoute des œufs ; sa file d'envoi ne contient que les œufs.
    const b1 = localChanges(start, [...start, inv("oeuf", 150, { quantity: 6, unit: "piece" })], 150);
    let b = b1.inventory;
    const outboxB = new Map(b1.docs.map((d) => [d.id, d]));
    expect([...outboxB.keys()]).toEqual(["oeuf"]);

    // Reconnexion de B : envoi, puis réception.
    push([...outboxB.values()]);
    outboxB.clear();
    b = applyRemote(b, server, outboxB, newId) ?? b;
    a = applyRemote(a, server, new Map(), newId) ?? a;

    for (const phone of [a, b]) {
      expect(phone.map((i) => i.ingredientId)).toEqual(["oeuf"]);
    }
  });

  it("ne remplace pas une modification locale pas encore envoyée", () => {
    const local = [inv("oeuf", 300, { quantity: 3, unit: "piece" })];
    const pending = new Map([["oeuf", stockDoc(local[0]!)]]);
    expect(applyRemote(local, [stockDoc(inv("oeuf", 250, { quantity: 6, unit: "piece" }))], pending, newId)).toBeNull();
  });

  it("garde l'identifiant local du produit et ne change rien en recevant sa propre version", () => {
    const local = [inv("oeuf", 300)];
    expect(applyRemote(local, [stockDoc({ ...local[0]!, id: "autre" })], new Map(), newId)).toBeNull();
    const r = applyRemote(local, [stockDoc({ ...local[0]!, id: "autre", quantity: 1, unit: "piece", updatedAt: 301 })], new Map(), newId)!;
    expect(r[0]!.id).toBe(local[0]!.id);
    expect(r[0]!.quantity).toBe(1);
  });

  it("ignore les documents invalides", () => {
    const bad = [{ id: "x", updatedAt: 1, deletedAt: null, item: null }, { id: "y" }] as unknown as StockDoc[];
    expect(applyRemote([], bad, new Map(), newId)).toBeNull();
  });
});
