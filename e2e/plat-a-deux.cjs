// Test « Prévoir un plat à deux » avec deux téléphones (Playwright) et un faux serveur de partage en mémoire.
// Usage : npm run build && (servir out/ sur le port 4173) && node e2e/plat-a-deux.cjs
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

async function stockFrigo(page, items) {
  await page.goto(`${BASE}/frigo/`);
  for (const [name, qty, unit] of items) {
    await page.getByLabel("Ajouter un ingrédient").fill(name);
    await page.keyboard.press("Enter");
    if (qty === undefined) continue;
    await page.getByRole("button", { name: new RegExp(`^${unit.label}`) }).first().click();
    await page.getByLabel("Quantité").fill(String(qty));
    await page.getByLabel("Unité").selectOption(unit.value);
    await page.getByRole("button", { name: "Enregistrer" }).click();
  }
}

async function cremeRows(page) {
  await page.goto(`${BASE}/courses/`);
  await page.waitForTimeout(500);
  return page.getByRole("button", { name: /^Crème fraîche/ }).count();
}

(async () => {
  const browser = await chromium.launch();
  const a = await phone(browser, "Téléphone A");
  const b = await phone(browser, "Téléphone B");
  await skipOnboarding(a);
  await skipOnboarding(b);

  // A partage la liste, B la rejoint : même foyer.
  await a.goto(`${BASE}/partage/`);
  await a.getByRole("button", { name: "Créer mon foyer" }).click();
  const code = (await a.locator("code").first().innerText()).trim();
  await b.goto(`${BASE}/partage/?code=${code}`);
  await b.getByRole("button", { name: "Rejoindre le foyer" }).click();
  check("B rejoint le foyer de A", await visible(b.getByText(/Votre liste de courses.*partagé/)));

  // Chez B, il ne manque que la crème pour le gratin.
  await stockFrigo(b, [
    ["pomme de terre", 1, { label: "Pommes de terre", value: "kg" }],
    ["carotte", 500, { label: "Carottes", value: "g" }],
    ["lait", 1, { label: "Lait", value: "l" }],
    ["fromage rape", 200, { label: "Fromage râpé", value: "g" }],
    ["ail", 3, { label: "Ail", value: "piece" }],
    ["beurre"], ["sel"], ["poivre"],
  ]);

  // 1. A prévoit le gratin pour ce soir, pour 3.
  await a.goto(`${BASE}/recettes/gratin-pdt-carottes/`);
  await a.getByRole("button", { name: "Plus de portions" }).click();
  await a.getByRole("button", { name: "Moins de portions" }).click();
  await a.getByRole("button", { name: "Moins de portions" }).click();
  await a.getByRole("button", { name: "Prévoir ce plat à deux" }).click();
  await a.screenshot({ path: `${SHOTS}/deux-1-choix.png` });
  await a.getByRole("button", { name: /^Ce soir/ }).click();
  await a.goto(`${BASE}/`);
  check("A : le gratin apparaît sur son accueil", await visible(a.getByRole("article", { name: /Ce soir : Gratin de pommes de terre/ })));

  // 2. B le retrouve sur son accueil, avec les portions choisies par A.
  await b.goto(`${BASE}/`);
  const cardB = b.getByRole("article", { name: /Ce soir : Gratin de pommes de terre/ });
  check("B : le gratin apparaît sur son accueil", await visible(cardB, 20000));
  check("B : 3 portions, comme choisi par A", await visible(cardB.getByText(/3 pers\./)));
  check("B : il ne manque qu'un ingrédient (la crème)", await visible(cardB.getByText(/il manque 1 ingrédient$/)));
  check("B : accès direct à la recette", await cardB.getByRole("link", { name: "Voir la recette" }).getAttribute("href") === "/recettes/gratin-pdt-carottes/");
  await b.screenshot({ path: `${SHOTS}/deux-2-accueil-b.png` });

  // 3. B ajoute la crème ; A appuie aussi : une seule ligne dans la liste commune.
  await cardB.getByRole("button", { name: /Ajouter ce qui manque aux courses/ }).click();
  check("B : crème ajoutée", await visible(b.getByText(/dans la liste commune/)));
  await a.goto(`${BASE}/`);
  await a.getByRole("article", { name: /Ce soir : Gratin/ }).getByRole("button", { name: /Ajouter ce qui manque aux courses/ }).click();
  await a.waitForTimeout(7000);
  const rowsB = await cremeRows(b);
  const rowsA = await cremeRows(a);
  check("liste commune : une seule ligne « Crème fraîche » chez B", rowsB === 1, `${rowsB} ligne(s)`);
  check("liste commune : une seule ligne « Crème fraîche » chez A", rowsA === 1, `${rowsA} ligne(s)`);
  check("quantité pour 3 personnes (150 ml)", await visible(b.getByRole("button", { name: /^Crème fraîche · 150 ml/ })));
  await b.screenshot({ path: `${SHOTS}/deux-3-courses-b.png` });

  // 3 bis. Les deux appuient exactement en même temps (avant que les téléphones se parlent).
  for (const p of [a, b]) {
    await p.goto(`${BASE}/courses/`);
    const btn = p.getByRole("button", { name: /^Crème fraîche/ }).first();
    await btn.click();
    const del = p.getByRole("button", { name: /Supprimer/ });
    if (await visible(del, 2000)) { await del.click(); break; }
  }
  await a.waitForTimeout(6500);
  await a.goto(`${BASE}/`);
  await b.goto(`${BASE}/`);
  await Promise.all([a, b].map((p) => p.getByRole("article", { name: /Ce soir : Gratin/ }).getByRole("button", { name: /Ajouter ce qui manque aux courses/ }).click()));
  await a.waitForTimeout(12000);
  const simA = await cremeRows(a);
  const simB = await cremeRows(b);
  check("appui simultané : une seule ligne à la fin, sur les deux téléphones", simA === 1 && simB === 1, `A=${simA} B=${simB}`);

  // 4. Un plat est déjà prévu ce soir : A choisit autre chose, l'appli demande avant de remplacer.
  await a.goto(`${BASE}/recettes/gratin-courgettes/`);
  await a.getByRole("button", { name: "Prévoir ce plat à deux" }).click();
  await a.getByRole("button", { name: /^Ce soir/ }).click();
  check("remplacement : le plat prévu est nommé", await visible(a.getByText(/Gratin de pommes de terre et carottes.*est déjà prévu/)));
  check("remplacement : « Remplacer le plat prévu ? »", await visible(a.getByText("Remplacer le plat prévu ?")));
  await a.screenshot({ path: `${SHOTS}/deux-4-remplacer.png` });
  await a.getByRole("button", { name: /^Garder/ }).click();
  await a.getByRole("button", { name: /^Ce soir/ }).click();
  await a.getByRole("button", { name: /^Remplacer par Gratin de courgettes/ }).click();
  await b.goto(`${BASE}/`);
  check("B : le nouveau plat remplace l'ancien", await visible(b.getByRole("article", { name: /Ce soir : Gratin de courgettes/ }), 20000));
  check("B : l'ancien plat a disparu", await b.getByRole("article", { name: /Ce soir : Gratin de pommes de terre/ }).count() === 0);

  // 4 bis. « Demain » fonctionne aussi.
  await a.goto(`${BASE}/recettes/gratin-pdt-carottes/`);
  await a.getByRole("button", { name: "Prévoir ce plat à deux" }).click();
  await a.getByRole("button", { name: /^Demain/ }).click();
  check("B : plat prévu demain soir", await visible(b.getByRole("article", { name: /Demain soir : Gratin de pommes de terre/ }), 20000));

  // 5. B retire le plat de ce soir : il disparaît aussi chez A.
  await b.getByRole("button", { name: "Retirer Gratin de courgettes du planning" }).click();
  await a.goto(`${BASE}/`);
  await a.waitForTimeout(500);
  const gone = await a.getByRole("article", { name: /Ce soir : Gratin de courgettes/ }).waitFor({ state: "detached", timeout: 20000 }).then(() => true, () => false);
  check("A : le plat retiré par B a disparu", gone);
  check("A : le plat de demain est toujours là", await visible(a.getByRole("article", { name: /Demain soir : Gratin de pommes de terre/ })));
  await a.goto(`${BASE}/planning/`);
  check("planning de A : à jour aussi", await visible(a.getByRole("link", { name: /Gratin de pommes de terre et carottes/ })));
  await a.goto(`${BASE}/`);
  await a.screenshot({ path: `${SHOTS}/deux-5-accueil-a.png` });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
  process.exit(failed.length ? 1 : 0);
})();
