import type { ShoppingItem } from "../domain/types";
import { SYNC_KEY, SYNC_URL } from "./config";

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${SYNC_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SYNC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${name} : ${res.status} ${await res.text().catch(() => "")}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function pushItems(code: string, items: readonly ShoppingItem[]) {
  for (let i = 0; i < items.length; i += 400) {
    await rpc("courses_push", { p_foyer: code, p_items: items.slice(i, i + 400) });
  }
}

export async function pullItems(code: string, since: number): Promise<{ items: ShoppingItem[]; seq: number }> {
  let seq = since;
  const items: ShoppingItem[] = [];
  for (;;) {
    const rows = await rpc<{ data: ShoppingItem; seq: number }[]>("courses_pull", { p_foyer: code, p_since: seq });
    for (const r of rows) {
      items.push(r.data);
      seq = Math.max(seq, Number(r.seq));
    }
    if (rows.length < 1000) break;
  }
  return { items, seq };
}
