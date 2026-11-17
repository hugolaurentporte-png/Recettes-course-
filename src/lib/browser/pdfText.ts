/**
 * Extrait le texte d'un PDF dans le navigateur (aucun envoi sur internet).
 * Les morceaux de texte sont regroupés par ligne selon leur hauteur sur la page,
 * pour retrouver « libellé … prix » comme sur le ticket.
 */
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3);
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      out.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join(" "));
    }
  }
  await task.destroy();
  return out.join("\n");
}
