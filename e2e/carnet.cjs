// Test du carnet de recettes (favorite, à refaire, pas pour nous, note) partagé entre deux téléphones.
// Usage : npm run build && (servir out/ sur le port 4173) && node e2e/carnet.cjs
const { chromium, devices } = require("playwright");
const { mkdirSync } = require("node:fs");

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.env.SHOTS ?? "e2e/screens";
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const visible = (loc, timeout = 15000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

// ---- Faux Supabase : mêmes règles que les fonctions SQL (le plus récent gagne, numéro de séquence). ----
let seq = 0;
const tables = { courses: new Map(), docs: new Map(), members: new Map() };
const foyerOf = (key) => {
  const f = tables.members.get(key);
  if (!f) throw new Error("ce téléphone n'est membre d'aucun foyer");
  return f;
};
function push(table, key, data) {
  const cur = table.get(key);
  if (!cur || data.updatedAt > cur.data.updatedAt) table.set(key, { data, seq: ++seq });
}
function rpc(name, b) {
  switch (name) {
    case "courses_push": for (const it of b.p_items) push(tables.courses, `${b.p_foyer}/${it.id}`, it); return null;
    case "courses_pull": return [...tables.courses.entries()].filter(([k, v]) => k.startsWith(`${b.p_foyer}/`) && v.seq > b.p_since)
      .map(([, v]) => v).sort((x, y) => x.seq - y.seq);
    // Foyer réservé aux membres (supabase/foyer.sql) : le foyer est retrouvé à partir de la clé du téléphone.
    case "foyer_entrer": tables.members.set(b.p_membre, b.p_code); return null;
    case "foyer_quitter": tables.members.delete(b.p_membre); return null;
    case "foyer_liste_membres": return [...tables.members.entries()].filter(([, f]) => f === foyerOf(b.p_membre))
      .map(([k]) => ({ nom: "", rejoint_le: "", moi: k === b.p_membre }));
    case "foyer_push": { const f = foyerOf(b.p_membre); for (const d of b.p_docs) push(tables.docs, `${f}/${b.p_kind}/${d.id}`, d); return null; }
    case "foyer_pull": { const f = foyerOf(b.p_membre);
      return [...tables.docs.entries()].filter(([k, v]) => k.startsWith(`${f}/${b.p_kind}/`) && v.seq > b.p_since)
        .map(([, v]) => v).sort((x, y) => x.seq - y.seq); }
    default: throw new Error(name);
  }
}

async function phone(browser, name) {
  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", serviceWorkers: "block" });
  await context.route(/supabase\.co\/rest\/v1\/rpc\//, async (route) => {
    const fn = route.request().url().split("/rpc/")[1];
    try {
      const body = rpc(fn, JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({ status: 200, contentType: "application/json", body: body === null ? "" : JSON.stringify(body) });
    } catch (e) {
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: String(e.message) }) });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => check(`${name} : aucune erreur JavaScript`, false, e.message));
  return page;
}

async function skipOnboarding(page) {
  await page.goto(`${BASE}/`);
  const btn = page.getByRole("button", { name: "Passer" });
  if (await visible(btn, 3000)) await btn.click();
}


async function count(page, q = "") {
  await page.goto(`${BASE}/recettes/${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  await page.waitForTimeout(1000); // le carnet se charge depuis le téléphone juste après la page
  const t = await page.getByText(/^\d+ recettes?/).first().innerText();
  return Number(t.match(/\d+/)[0]);
}

(async () => {
  const browser = await chromium.launch();
  const a = await phone(browser, "Téléphone A");
  const b = await phone(browser, "Téléphone B");
  await skipOnboarding(a);
  await skipOnboarding(b);

  await a.goto(`${BASE}/partage/`);
  await a.getByRole("button", { name: "Créer mon foyer" }).click();
  const code = (await a.locator("code").first().innerText()).trim();
  await b.goto(`${BASE}/partage/?code=${code}`);
  await b.getByRole("button", { name: "Rejoindre le foyer" }).click();
  check("B rejoint le foyer de A", await visible(b.getByText(/Votre liste de courses.*partagé/)));

  // 1. A marque le gratin favori, à refaire, avec une note.
  await a.goto(`${BASE}/recettes/gratin-pdt-carottes/`);
  await a.getByRole("button", { name: "Favorite" }).click();
  await a.getByRole("button", { name: "À refaire" }).click();
  await a.getByLabel("Note perso").fill("Doubler le fromage, les enfants ont adoré");
  await a.getByLabel("Note perso").blur();
  check("A : bouton Favorite enfoncé", (await a.getByRole("button", { name: "Favorite" }).getAttribute("aria-pressed")) === "true");
  await a.screenshot({ path: `${SHOTS}/carnet-1-fiche.png` });

  // 2. B le retrouve dans le carnet du foyer.
  await b.waitForTimeout(6000);
  await b.goto(`${BASE}/carnet/`);
  check("B : « Notre carnet »", await visible(b.getByRole("heading", { name: /Notre carnet/ })));
  check("B : le gratin est dans ses favorites", await visible(b.getByRole("link", { name: /Gratin de pommes de terre/ }), 20000));
  check("B : la note de A est là", await visible(b.getByText(/Doubler le fromage/)));
  await b.screenshot({ path: `${SHOTS}/carnet-2-favorites-b.png` });
  await b.getByRole("tab", { name: /À refaire/ }).click();
  check("B : le gratin est aussi « à refaire »", await visible(b.getByRole("link", { name: /Gratin de pommes de terre/ })));

  // 3. B écarte le gratin de courgettes : il n'est plus proposé chez A, sauf si on le cherche.
  const before = await count(a);
  await b.goto(`${BASE}/recettes/gratin-courgettes/`);
  await b.getByRole("button", { name: "Pas pour nous" }).click();
  check("B : message « plus proposée »", await visible(b.getByText(/n.est plus proposée/)));
  await a.waitForTimeout(7000);
  const after = await count(a);
  check("A : une recette de moins dans la liste", after === before - 1, `${before} → ${after}`);
  await a.goto(`${BASE}/recettes/?q=courgette`);
  await a.waitForTimeout(1000);
  const titles = await a.locator("article h3").allInnerTexts();
  check("A : en la cherchant, on la retrouve en fin de liste", titles.at(-1) === "Gratin de courgettes", titles.join(" | "));
  await a.goto(`${BASE}/carnet/`);
  await a.getByRole("tab", { name: /Pas pour nous/ }).click();
  check("A : rubrique « Pas pour nous »", await visible(a.getByRole("link", { name: /Gratin de courgettes/ })));
  await a.screenshot({ path: `${SHOTS}/carnet-3-pas-pour-nous.png` });

  // 4. Changer d'avis : la recette revient.
  await a.goto(`${BASE}/recettes/gratin-courgettes/`);
  await a.getByRole("button", { name: "Pas pour nous" }).click();
  await a.waitForTimeout(500);
  check("A : la recette revient dans la liste", (await count(a)) === before);

  // 5. Accueil et onglet Recettes mènent au carnet.
  await a.goto(`${BASE}/`);
  check("Accueil : lien vers le carnet avec 1 favorite", await visible(a.getByRole("link", { name: /Notre carnet de recettes.*❤️ 1/ })));
  await a.screenshot({ path: `${SHOTS}/carnet-4-accueil.png`, fullPage: true });
  await a.goto(`${BASE}/recettes/`);
  check("Recettes : bouton Carnet", await visible(a.getByRole("link", { name: /Carnet · ❤️ 1/ })));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
  process.exit(failed.length ? 1 : 0);
})();
