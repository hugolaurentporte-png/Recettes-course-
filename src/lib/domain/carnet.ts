/**
 * Carnet de recettes : ce que le foyer pense d'une recette (favorite, « pas pour nous », à refaire) et une note perso.
 * Une fiche par recette (l'identifiant est celui de la recette), partagée dans le foyer : la plus récente gagne.
 * Fonctions pures, testées.
 */

/** Avis sur la recette : on l'adore, ou on n'en veut plus. */
export type Verdict = "favori" | "deteste";

export interface CarnetEntry {
  /** Identifiant de la recette. */
  id: string;
  verdict: Verdict | null;
  /** À refaire bientôt (indépendant de l'avis, sauf « pas pour nous »). */
  redo: boolean;
  note: string;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number | null;
}

export const NOTE_MAX = 1000;

export type CarnetPatch = Partial<Pick<CarnetEntry, "verdict" | "redo" | "note">>;

/** Fiche vide (rien de noté) : elle ne sert plus à rien, on la marque supprimée pour l'autre téléphone. */
export function isEmpty(e: Pick<CarnetEntry, "verdict" | "redo" | "note">): boolean {
  return e.verdict === null && !e.redo && e.note.trim() === "";
}

/** Modifie la fiche d'une recette (la crée au besoin). Renvoie le carnet entier mis à jour. */
export function patchEntry(
  entries: readonly CarnetEntry[],
  recipeId: string,
  patch: CarnetPatch,
  now: number,
  deviceId: string,
): CarnetEntry[] {
  const prev = entries.find((e) => e.id === recipeId);
  const base = prev && !prev.deletedAt ? prev : { verdict: null, redo: false, note: "" };
  const next = { verdict: base.verdict, redo: base.redo, note: base.note, ...patch };
  if (patch.note !== undefined) next.note = patch.note.slice(0, NOTE_MAX);
  // Une recette qu'on n'aime pas n'est pas « à refaire » ; la remettre à refaire lève le « pas pour nous ».
  if (patch.verdict === "deteste") next.redo = false;
  if (patch.redo === true && next.verdict === "deteste") next.verdict = null;
  const entry: CarnetEntry = {
    id: recipeId,
    ...next,
    updatedBy: deviceId,
    // Toujours plus récent que la version précédente, même si l'horloge de l'autre téléphone avance.
    updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
    deletedAt: isEmpty(next) ? now : null,
  };
  return prev ? entries.map((e) => (e.id === recipeId ? entry : e)) : [...entries, entry];
}

/** Fiches réellement remplies. */
export function activeCarnet(entries: readonly CarnetEntry[]): CarnetEntry[] {
  return entries.filter((e) => !e.deletedAt && !isEmpty(e));
}

/** Données venues d'ailleurs (stockage local, serveur) : on ne garde que des fiches bien formées. */
export function normalizeCarnet(raw: unknown): CarnetEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CarnetEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const e = r as Partial<CarnetEntry>;
    if (typeof e.id !== "string" || typeof e.updatedAt !== "number") continue;
    out.push({
      id: e.id,
      verdict: e.verdict === "favori" || e.verdict === "deteste" ? e.verdict : null,
      redo: e.redo === true,
      note: typeof e.note === "string" ? e.note.slice(0, NOTE_MAX) : "",
      updatedAt: e.updatedAt,
      updatedBy: typeof e.updatedBy === "string" ? e.updatedBy : undefined,
      deletedAt: typeof e.deletedAt === "number" ? e.deletedAt : null,
    });
  }
  return out;
}

/** Recettes que le foyer ne veut plus voir proposées. */
export function dislikedIds(entries: readonly CarnetEntry[]): Set<string> {
  return new Set(activeCarnet(entries).filter((e) => e.verdict === "deteste").map((e) => e.id));
}

/**
 * Écarte les recettes « pas pour nous » d'une liste de suggestions.
 * Si on cherche une recette par son nom (`keepAtEnd`), on la laisse quand même, en fin de liste.
 */
export function withoutDisliked<T>(list: readonly T[], disliked: ReadonlySet<string>, idOf: (x: T) => string, keepAtEnd = false): T[] {
  if (disliked.size === 0) return [...list];
  const kept = list.filter((x) => !disliked.has(idOf(x)));
  return keepAtEnd ? [...kept, ...list.filter((x) => disliked.has(idOf(x)))] : kept;
}

export interface CarnetSections<T> {
  favorites: T[];
  redo: T[];
  noted: T[];
  disliked: T[];
}

/**
 * Le carnet rangé pour l'affichage : favorites, à refaire, autres recettes annotées, puis « pas pour nous ».
 * Une favorite à refaire apparaît dans les deux premières. Les plus récemment touchées d'abord.
 */
export function carnetSections<T>(entries: readonly CarnetEntry[], resolve: (id: string) => T | undefined): CarnetSections<T & { entry: CarnetEntry }> {
  const list = activeCarnet(entries)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .flatMap((entry) => {
      const r = resolve(entry.id);
      return r ? [{ ...r, entry }] : [];
    });
  return {
    favorites: list.filter((x) => x.entry.verdict === "favori"),
    redo: list.filter((x) => x.entry.redo),
    noted: list.filter((x) => x.entry.verdict === null && !x.entry.redo && x.entry.note.trim() !== ""),
    disliked: list.filter((x) => x.entry.verdict === "deteste"),
  };
}
