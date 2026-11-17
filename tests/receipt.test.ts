import { describe, expect, it } from "vitest";
import { parseReceipt, sumLines } from "../src/lib/domain/receipt";
import { INGREDIENTS } from "../src/lib/data/ingredients";

const TICKET = `
INTERMARCHE SUPER
12 RUE DU MARCHE
Le 14/11/2026 à 10:32
STEAK HACHE 5% X4        4,95 €
YAOURT NATURE X8         2,10 €
POMMES DE TERRE 2,5KG    3,49 €
  2 x 1,25               2,50 €
LESSIVE LIQ. 30 LAV.     8,90 €
REMISE IMMEDIATE        -1,50 €
COCA COLA 1,5L           2,05 €
SOUS-TOTAL              23,99 €
NB ARTICLES : 7
TOTAL TTC               21,99 €
CB SANS CONTACT         21,99 €
TVA 5,5%                 0,85 €
`;

describe("lecture d'un ticket de caisse", () => {
  const r = parseReceipt(TICKET, INGREDIENTS);

  it("trouve les articles et leurs prix, sans les totaux ni le paiement", () => {
    expect(r.lines.map((l) => l.label)).toEqual([
      "Steak hache 5% x4", "Yaourt nature x8", "Pommes de terre 2,5kg", "Lessive liq. 30 lav.", "Coca cola 1,5l",
    ]);
    expect(r.lines.map((l) => l.price)).toEqual([4.95, 2.1, 3.49, 7.4, 2.05]);
  });

  it("déduit la remise de l'article au-dessus", () => {
    expect(r.lines.find((l) => l.label.startsWith("Lessive"))?.price).toBe(7.4);
  });

  it("range les articles par rayon", () => {
    expect(r.lines.map((l) => l.aisle)).toEqual(["viandes-poissons", "frais", "fruits-legumes", "maison", "boissons"]);
  });

  it("lit le total payé et la date", () => {
    expect(r.total).toBe(21.99);
    expect(new Date(r.date!).toLocaleDateString("fr-FR")).toBe("14/11/2026");
  });

  it("additionne les articles", () => {
    expect(sumLines(r.lines)).toBe(19.99);
  });

  it("accepte un texte sans total ni date", () => {
    const s = parseReceipt("Pain 1,20\nBananes 2.30", INGREDIENTS);
    expect(s.lines).toHaveLength(2);
    expect(s.total).toBeNull();
    expect(s.date).toBeNull();
  });
});
