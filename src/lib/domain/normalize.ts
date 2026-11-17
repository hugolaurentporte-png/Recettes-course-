/** Minuscule, sans accents, sans ponctuation, espaces simples. "Œufs" -> "oeufs". */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Forme singulière approximative pour regrouper « tomates » et « tomate ».
 * Volontairement prudente : seuls les pluriels réguliers en -s / -x sont retirés.
 */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("aux") && word.length > 4) return word.slice(0, -3) + "al";
  if (word.endsWith("eaux")) return word.slice(0, -1);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  if (word.endsWith("x") && (word.endsWith("eux") || word.endsWith("oux"))) return word.slice(0, -1);
  return word;
}

/** Clé de regroupement d'un nom libre. */
export function itemKey(name: string): string {
  return normalizeText(name).split(" ").map(singularize).join(" ");
}

/** Met la première lettre en majuscule (affichage). */
export function capitalize(s: string): string {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
