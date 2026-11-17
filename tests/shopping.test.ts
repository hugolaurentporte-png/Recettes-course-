import { describe, expect, it } from "vitest";
import {
  addManualItem, addRecipeToList, deleteItem, displayAmounts, editItem, finishShopping, groupForDisplay,
  recordUsage, suggest, toggleChecked, activeItems,
} from "@/lib/domain/shopping";
import { guessAisle } from "@/lib/domain/categorize";
import { INGREDIENTS } from "@/lib/data/ingredients";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import type { ShoppingItem } from "@/lib/domain/types";
import { ctx, inv } from "./helpers";

const gratin = RECIPES_BY_ID.get("gratin-pdt-carottes")!;
const puree = RECIPES_BY_ID.get("puree-maison")!;

function byName(items: ShoppingItem[], name: string) {
  return activeItems(items).filter((i) => i.customName === name);
}

describe("ajout manuel", () => {
  it("accepte n'importe quel produit, même hors catalogue et non alimentaire", () => {
    const c = ctx();
    let { items } = addManualItem([], { name: "papier toilette" }, c);
    ({ items } = addManualItem(items, { name: "Croquettes chat" }, c));
    ({ items } = addManualItem(items, { name: "Truc introuvable" }, c));
    expect(items.map((i) => i.customName)).toEqual(["Papier toilette", "Croquettes chat", "Truc introuvable"]);
    expect(items.map((i) => i.aisle)).toEqual(["hygiene", "maison", "autres"]);
    expect(items.every((i) => i.ingredientId === null)).toBe(true);
  });

  it("relie au catalogue quand c'est possible (alias, pluriel)", () => {
    const { item } = addManualItem([], { name: "patates" }, ctx());
    expect(item.ingredientId).toBe("pomme-de-terre");
    expect(item.aisle).toBe("fruits-legumes");
  });

  it("fusionne un doublon en additionnant les quantités", () => {
    const c = ctx();
    let { items } = addManualItem([], { name: "Lait", quantity: 1, unit: "l" }, c);
    const r = addManualItem(items, { name: "lait", quantity: 500, unit: "ml" }, c);
    items = r.items;
    expect(r.merged).toBe(true);
    expect(activeItems(items)).toHaveLength(1);
    expect(displayAmounts(items[0]!)).toEqual([{ value: 1500, unit: "ml" }]);
  });

  it("ne fusionne pas avec un article déjà coché", () => {
    const c = ctx();
    let { items, item } = addManualItem([], { name: "Pain" }, c);
    items = toggleChecked(items, item.id, c);
    ({ items } = addManualItem(items, { name: "Pain" }, c));
    expect(byName(items, "Pain")).toHaveLength(2);
  });
});

describe("ajout depuis une recette", () => {
  it("exemple du cahier des charges : n'ajoute que ce qui manque", () => {
    const stock = inv([
      ["pomme-de-terre", 500, "g"], ["carotte", 300, "g"], ["lait", 1, "l"], ["ail", 2, "piece"],
      ["sel", null, null], ["poivre", null, null], ["beurre", null, null],
    ]);
    const { items, summary } = addRecipeToList([], gratin, 4, stock, ctx());
    const got = Object.fromEntries(activeItems(items).map((i) => [i.ingredientId, displayAmounts(i)]));
    expect(got).toEqual({
      "pomme-de-terre": [{ value: 300, unit: "g" }],
      creme: [{ value: 200, unit: "ml" }],
      "fromage-rape": [{ value: 100, unit: "g" }],
    });
    expect(summary.added).toBe(3);
  });

  it("quantité en stock inconnue : article marqué « à vérifier » sans quantité inventée", () => {
    const stock = inv([["pomme-de-terre", null, null]]);
    const { items } = addRecipeToList([], puree, 4, stock, ctx());
    const pdt = activeItems(items).find((i) => i.ingredientId === "pomme-de-terre")!;
    expect(pdt.toVerify).toBe(true);
    expect(displayAmounts(pdt)).toEqual([]);
  });

  it("n'écrase pas un ajout manuel et conserve sa quantité", () => {
    const c = ctx();
    let { items } = addManualItem([], { name: "Crème fraîche", quantity: 50, unit: "ml" }, c);
    ({ items } = addRecipeToList(items, gratin, 4, new Map(), c));
    const creme = activeItems(items).filter((i) => i.ingredientId === "creme");
    expect(creme).toHaveLength(1);
    expect(creme[0]!.manual).toEqual({ quantity: 50, unit: "ml" });
    expect(displayAmounts(creme[0]!)).toEqual([{ value: 250, unit: "ml" }]);
  });

  it("ajouter deux fois la même recette ne double pas les quantités", () => {
    const c = ctx();
    let { items } = addRecipeToList([], gratin, 4, new Map(), c);
    ({ items } = addRecipeToList(items, gratin, 4, new Map(), c));
    const pdt = activeItems(items).filter((i) => i.ingredientId === "pomme-de-terre");
    expect(pdt).toHaveLength(1);
    expect(displayAmounts(pdt[0]!)).toEqual([{ value: 800, unit: "g" }]);
  });

  it("plusieurs recettes : besoins cumulés, stock déduit une seule fois, sans doublon", () => {
    const c = ctx();
    const stock = inv([["pomme-de-terre", 500, "g"]]);
    let { items } = addRecipeToList([], gratin, 4, stock, c); // 800 g
    ({ items } = addRecipeToList(items, puree, 4, stock, c)); // 1000 g
    const pdt = activeItems(items).filter((i) => i.ingredientId === "pomme-de-terre");
    expect(pdt).toHaveLength(1);
    expect(displayAmounts(pdt[0]!)).toEqual([{ value: 1300, unit: "g" }]);
    expect(pdt[0]!.recipeNeeds.map((n) => n.recipeId).sort()).toEqual(["gratin-pdt-carottes", "puree-maison"]);
  });

  it("les indispensables possédés sans quantité ne sont pas ajoutés", () => {
    const stock = inv([["beurre", null, null], ["sel", null, null]]);
    const { items } = addRecipeToList([], puree, 4, stock, ctx());
    const ids = activeItems(items).map((i) => i.ingredientId);
    expect(ids).not.toContain("beurre");
    expect(ids).not.toContain("sel");
    expect(ids).toContain("lait");
  });

  it("tout est en stock : rien n'est ajouté", () => {
    const stock = inv([["pomme-de-terre", 2, "kg"], ["lait", 1, "l"], ["beurre", 250, "g"], ["sel", null, null]]);
    const { items, summary } = addRecipeToList([], puree, 4, stock, ctx());
    expect(activeItems(items)).toHaveLength(0);
    expect(summary.alreadyAvailable).toBe(4);
  });
});

describe("modifier, cocher, supprimer, terminer", () => {
  it("cocher envoie l'article en bas, décocher le remonte", () => {
    const c = ctx();
    let { items, item: a } = addManualItem([], { name: "Pommes" }, c);
    ({ items } = addManualItem(items, { name: "Bananes" }, c));
    items = toggleChecked(items, a.id, c);
    let g = groupForDisplay(items);
    expect(g.checked.map((i) => i.customName)).toEqual(["Pommes"]);
    expect(g.groups.flatMap((x) => x.items).map((i) => i.customName)).toEqual(["Bananes"]);
    items = toggleChecked(items, a.id, c);
    g = groupForDisplay(items);
    expect(g.checked).toHaveLength(0);
  });

  it("changer la catégorie la verrouille, même si on renomme ensuite", () => {
    const c = ctx();
    let { items, item } = addManualItem([], { name: "Bidule" }, c);
    items = editItem(items, item.id, { aisle: "surgeles" }, c);
    items = editItem(items, item.id, { name: "Gros bidule" }, c);
    expect(items[0]!.aisle).toBe("surgeles");
    expect(items[0]!.aisleLocked).toBe(true);
  });

  it("modifier la quantité à la main remplace le calcul de la recette", () => {
    const c = ctx();
    let { items } = addRecipeToList([], puree, 4, new Map(), c);
    const pdt = items.find((i) => i.ingredientId === "pomme-de-terre")!;
    items = editItem(items, pdt.id, { quantity: 2, unit: "kg" }, c);
    expect(displayAmounts(items.find((i) => i.id === pdt.id)!)).toEqual([{ value: 2000, unit: "g" }]);
  });

  it("la suppression est douce (prête pour la synchronisation)", () => {
    const c = ctx(5000);
    let { items, item } = addManualItem([], { name: "Œufs" }, c);
    items = deleteItem(items, item.id, c);
    expect(items).toHaveLength(1);
    expect(items[0]!.deletedAt).toBe(5000);
    expect(activeItems(items)).toHaveLength(0);
  });

  it("« Terminer mes courses » archive les cochés et garde les non achetés", () => {
    const c = ctx();
    let { items, item: a } = addManualItem([], { name: "Pommes" }, c);
    ({ items } = addManualItem(items, { name: "Lessive" }, c));
    items = toggleChecked(items, a.id, c);
    const r = finishShopping(items, c);
    expect(r.trip?.items.map((i) => i.customName)).toEqual(["Pommes"]);
    expect(activeItems(r.items).map((i) => i.customName)).toEqual(["Lessive"]);
  });

  it("« Terminer » sans article coché ne fait rien", () => {
    const { items } = addManualItem([], { name: "Pommes" }, ctx());
    expect(finishShopping(items, ctx()).trip).toBeNull();
  });
});

describe("suggestions et classement", () => {
  it("propose d'abord les articles fréquents, sauf ceux déjà dans la liste", () => {
    const c = ctx();
    let history = recordUsage([], addManualItem([], { name: "Lait" }, c).item, 1);
    history = recordUsage(history, addManualItem([], { name: "Lait" }, c).item, 2);
    history = recordUsage(history, addManualItem([], { name: "Café" }, c).item, 3);
    expect(suggest("", history, [], INGREDIENTS).map((s) => s.name)).toEqual(["Lait", "Café"]);
    const { items } = addManualItem([], { name: "Lait" }, c);
    expect(suggest("", history, items, INGREDIENTS).map((s) => s.name)).toEqual(["Café"]);
  });

  it("complète avec le catalogue quand on tape", () => {
    const s = suggest("tom", [], [], INGREDIENTS).map((x) => x.name);
    expect(s).toContain("Tomates");
    expect(s).toContain("Tomates cerises");
  });

  it("devine le rayon des produits courants", () => {
    expect(guessAisle("Liquide vaisselle", INGREDIENTS)).toBe("maison");
    expect(guessAisle("Dentifrice", INGREDIENTS)).toBe("hygiene");
    expect(guessAisle("Jus d'orange", INGREDIENTS)).toBe("boissons");
    expect(guessAisle("Petits pois surgelés", INGREDIENTS)).toBe("surgeles");
    expect(guessAisle("Yaourts aux fruits", INGREDIENTS)).toBe("frais");
    expect(guessAisle("Tomates", INGREDIENTS)).toBe("fruits-legumes");
  });
});

import { PRODUCTS, PRODUCT_NAMES } from "@/lib/data/products";

describe("produits du supermarché (non alimentaire compris)", () => {
  it("suggère des produits non alimentaires dès les premières lettres", () => {
    expect(suggest("papier", [], [], INGREDIENTS, 8, PRODUCT_NAMES).map((s) => s.name)).toContain("Papier toilette");
    expect(suggest("less", [], [], INGREDIENTS, 8, PRODUCT_NAMES).map((s) => s.name)).toContain("Lessive");
  });
  it("ne propose pas deux fois un produit déjà au catalogue d'ingrédients", () => {
    const names = suggest("pomme", [], [], INGREDIENTS, 20, PRODUCT_NAMES).map((s) => s.name.toLowerCase());
    expect(names.filter((n) => n === "pommes").length).toBeLessThanOrEqual(1);
  });
  it("range chaque produit dans son rayon", () => {
    for (const [aisle, names] of Object.entries(PRODUCTS)) {
      for (const n of names) {
        const got = guessAisle(n, []);
        expect([n, got]).toEqual([n, aisle]);
      }
    }
    expect(guessAisle("Croquettes chat", INGREDIENTS)).toBe("maison");
    expect(guessAisle("Couches", INGREDIENTS)).toBe("hygiene");
  });
  it("pas de doublon dans la liste de produits", () => {
    expect(new Set(PRODUCT_NAMES).size).toBe(PRODUCT_NAMES.length);
  });
});
