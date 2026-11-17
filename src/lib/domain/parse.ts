import type { Unit } from "./types";

const UNIT_WORDS: Record<string, Unit> = {
  g: "g", gr: "g", gramme: "g", grammes: "g",
  kg: "kg", kilo: "kg", kilos: "kg",
  ml: "ml", cl: "cl", l: "l", litre: "l", litres: "l",
  x: "piece", pc: "piece", pcs: "piece", piece: "piece", pieces: "piece", "pièce": "piece", "pièces": "piece",
};

export interface ParsedInput {
  name: string;
  quantity: number | null;
  unit: Unit | null;
}

function toNumber(s: string): number {
  return Number(s.replace(",", "."));
}

/**
 * Saisie rapide : « 2 kg pommes de terre », « lait 1l », « 6 œufs », « 3x yaourts ».
 * Sans nombre, renvoie le texte tel quel sans quantité.
 */
export function parseItemInput(raw: string): ParsedInput {
  const text = raw.trim().replace(/\s+/g, " ");
  const unitAlt = Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length).join("|");

  // Quantité en tête : « 2 kg pommes », « 500g farine », « 3x yaourts », « 6 œufs »
  const head = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${unitAlt})?\\.?\\s+(?:de |d')?(.+)$`, "i").exec(text);
  if (head?.[1] && head[3]) {
    const unit = head[2] ? UNIT_WORDS[head[2].toLowerCase()] ?? "piece" : "piece";
    return { name: head[3], quantity: toNumber(head[1]), unit };
  }
  // Quantité en fin : « lait 1l », « farine 500 g », « œufs x6 »
  const tail = new RegExp(`^(.+?)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(${unitAlt})?$`, "i").exec(text);
  if (tail?.[1] && tail[2]) {
    const unit = tail[3] ? UNIT_WORDS[tail[3].toLowerCase()] ?? "piece" : "piece";
    return { name: tail[1], quantity: toNumber(tail[2]), unit };
  }
  return { name: text, quantity: null, unit: null };
}
