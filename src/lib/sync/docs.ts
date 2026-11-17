import { rpc } from "./client";

/**
 * Documents partagés du foyer (frigo, planning…), voir supabase/foyer.sql.
 * Chaque téléphone a une clé de membre secrète : le serveur retrouve le foyer à partir d'elle
 * et refuse tout téléphone qui n'en est pas membre.
 */
export interface SyncDoc {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
}

/** Clé de membre : 32 octets aléatoires en base64url (43 caractères). */
export function newMemberKey(random: (n: number) => Uint8Array): string {
  const bytes = random(32);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isMemberKey(key: unknown): key is string {
  return typeof key === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(key);
}

/** Crée le foyer (s'il n'existe pas) et y inscrit ce téléphone. */
export function enterHousehold(code: string, memberKey: string, name: string) {
  return rpc<null>("foyer_entrer", { p_code: code, p_membre: memberKey, p_nom: name });
}

export function leaveHousehold(memberKey: string) {
  return rpc<null>("foyer_quitter", { p_membre: memberKey });
}

export interface HouseholdMember {
  nom: string;
  rejoint_le: string;
  moi: boolean;
}

export function listMembers(memberKey: string) {
  return rpc<HouseholdMember[]>("foyer_liste_membres", { p_membre: memberKey });
}

export async function pushDocs(memberKey: string, kind: string, docs: readonly SyncDoc[]) {
  for (let i = 0; i < docs.length; i += 400) {
    await rpc("foyer_push", { p_membre: memberKey, p_kind: kind, p_docs: docs.slice(i, i + 400) });
  }
}

export async function pullDocs<T extends SyncDoc>(memberKey: string, kind: string, since: number): Promise<{ docs: T[]; seq: number }> {
  let seq = since;
  const docs: T[] = [];
  for (;;) {
    const rows = await rpc<{ data: T; seq: number }[]>("foyer_pull", { p_membre: memberKey, p_kind: kind, p_since: seq });
    for (const r of rows) {
      docs.push(r.data);
      seq = Math.max(seq, Number(r.seq));
    }
    if (rows.length < 1000) break;
  }
  return { docs, seq };
}
