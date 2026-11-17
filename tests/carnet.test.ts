import { describe, expect, it } from "vitest";
import { activeCarnet, carnetSections, dislikedIds, normalizeCarnet, patchEntry, withoutDisliked } from "@/lib/domain/carnet";
import { docsToPush, mergeDocs } from "@/lib/sync/engine";

describe("carnet de recettes", () => {
  it("marquer une favorite crée la fiche ; la démarquer la retire (trace pour l'autre téléphone)", () => {
    let c = patchEntry([], "gratin", { verdict: "favori" }, 100, "A");
    expect(activeCarnet(c)).toHaveLength(1);
    expect(c[0]).toMatchObject({ id: "gratin", verdict: "favori", redo: false, note: "", updatedBy: "A", deletedAt: null });
    c = patchEntry(c, "gratin", { verdict: null }, 200, "A");
    expect(activeCarnet(c)).toHaveLength(0);
    expect(c[0]!.deletedAt).toBe(200);
    expect(docsToPush(c, 150)).toHaveLength(1);
  });

  it("une note seule suffit à garder la recette dans le carnet", () => {
    const c = patchEntry([], "gratin", { note: "  moins de sel " }, 100, "A");
    expect(activeCarnet(c)).toHaveLength(1);
    expect(carnetSections(c, (id) => ({ id })).noted.map((x) => x.id)).toEqual(["gratin"]);
  });

  it("« pas pour nous » enlève « à refaire », et inversement", () => {
    let c = patchEntry([], "a", { redo: true }, 100, "A");
    c = patchEntry(c, "a", { verdict: "deteste" }, 110, "A");
    expect(c[0]).toMatchObject({ verdict: "deteste", redo: false });
    c = patchEntry(c, "a", { redo: true }, 120, "A");
    expect(c[0]).toMatchObject({ verdict: null, redo: true });
  });

  it("toujours plus récent que la version précédente, même si l'horloge de l'autre téléphone retarde", () => {
    const a = patchEntry([], "a", { verdict: "favori" }, 100, "A");
    const b = patchEntry(a, "a", { note: "top" }, 50, "B");
    expect(b[0]!.updatedAt).toBe(101);
    expect(b[0]).toMatchObject({ verdict: "favori", note: "top" });
  });

  it("partage : la fiche la plus récente gagne", () => {
    const a = patchEntry([], "a", { verdict: "favori" }, 100, "A");
    const b = patchEntry([], "a", { verdict: "deteste" }, 90, "B");
    expect(mergeDocs(b, a)![0]!.verdict).toBe("favori");
    expect(mergeDocs(a, b)).toBeNull();
  });

  it("les recettes « pas pour nous » ne sont plus proposées, sauf en fin de liste quand on les cherche", () => {
    const c = patchEntry(patchEntry([], "b", { verdict: "deteste" }, 100, "A"), "c", { verdict: "favori" }, 100, "A");
    const disliked = dislikedIds(c);
    expect([...disliked]).toEqual(["b"]);
    expect(withoutDisliked(["a", "b", "c"], disliked, (x) => x)).toEqual(["a", "c"]);
    expect(withoutDisliked(["b", "a", "c"], disliked, (x) => x, true)).toEqual(["a", "c", "b"]);
  });

  it("rubriques : une favorite à refaire est dans les deux, les recettes inconnues sont ignorées", () => {
    let c = patchEntry([], "a", { verdict: "favori", redo: true }, 100, "A");
    c = patchEntry(c, "b", { verdict: "deteste" }, 200, "A");
    c = patchEntry(c, "inconnue", { verdict: "favori" }, 300, "A");
    const s = carnetSections(c, (id) => (id === "inconnue" ? undefined : { id }));
    expect(s.favorites.map((x) => x.id)).toEqual(["a"]);
    expect(s.redo.map((x) => x.id)).toEqual(["a"]);
    expect(s.disliked.map((x) => x.id)).toEqual(["b"]);
  });

  it("données reçues abîmées : ignorées ou nettoyées", () => {
    expect(normalizeCarnet(null)).toEqual([]);
    const n = normalizeCarnet([{ id: "a", updatedAt: 1, verdict: "bizarre", note: 3 }, { id: 2 }, null]);
    expect(n).toEqual([{ id: "a", verdict: null, redo: false, note: "", updatedAt: 1, updatedBy: undefined, deletedAt: null }]);
  });
});
