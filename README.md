# Qu'est-ce qu'on mange ?

Application web installable sur smartphone (PWA) qui répond à « qu'est-ce que je peux cuisiner avec ce que j'ai ? » et tient une **liste de courses autonome**, utilisable tous les jours sans passer par les recettes.

Tout fonctionne **sans compte et hors connexion** : les données restent dans le téléphone (IndexedDB).

## Lancer l'application

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install          # une seule fois
npm run dev          # mode développement : http://localhost:3000
```

Version finale (celle qui fonctionne hors connexion) :

```bash
npm run build        # génère le dossier out/ (site statique + service worker)
npm start            # sert out/ sur http://localhost:3000
```

Pour l'essayer sur le téléphone, il faut une adresse en HTTPS (hébergement Vercel, Netlify…). **Rien n'est déployé pour l'instant.**

## Tests

```bash
npm test             # 421 tests : calculs métier, catalogue, stockage local
npm run typecheck    # TypeScript strict
npm run validate:recipes   # contrôle du catalogue de recettes uniquement
npm run test:e2e     # parcours complet sur iPhone émulé (nécessite Playwright et `npm start` sur le port 4173 : BASE_URL=http://localhost:3000 npm run test:e2e)
```

## Ce qui est fait (V1)

**Courses (prioritaire)**
- Onglet direct dans la barre du bas, avec le nombre d'articles à acheter.
- Saisie libre de n'importe quel produit, alimentaire ou non, avec quantité tapée en une fois (« 2 kg pommes », « lait 1l », « 6 œufs »).
- Suggestions des produits les plus souvent ajoutés, puis du catalogue quand on tape.
- Classement automatique par rayon (catalogue + mots-clés : hygiène, entretien, boissons…), rayon modifiable et alors verrouillé.
- Cocher / décocher, modifier (nom, quantité, unité, rayon, note), supprimer avec « Annuler ».
- Articles cochés regroupés en bas « Dans le panier ».
- « Terminer mes courses » archive les cochés et garde le reste (avec « Annuler »).
- Fusion des doublons : « lait 1 l » + « lait 50 cl » → « Lait · 1,5 l ».
- Ajout depuis une recette sans écraser les ajouts manuels ; ajouter deux fois la même recette ne double pas ; plusieurs recettes : besoins cumulés puis stock déduit **une seule fois**.
- Stock connu sans quantité → « Quantité à vérifier » plutôt qu'une quantité inventée.

**Mon frigo** : recherche avec autocomplétion (noms, pluriels, alias : « patates »), ajout rapide en un geste, quantités facultatives, marquage « À utiliser rapidement » (avec rappel de prudence sur la fraîcheur), « Mes indispensables » non cochés par défaut, équipement possédé.

**Recettes** : 90 recettes classiques, recherche par nom ou ingrédient, filtres combinables (temps, mode de cuisson, réalisable maintenant), fiche avec portions ajustables (quantités recalculées), disponible / manquant / à vérifier ligne par ligne, matériel, étapes numérotées.

**Moteur de recommandation** (déterministe, sans IA) : filtres stricts (temps, équipement), puis classement par niveau de disponibilité (réalisable, il manque 1, 2, 3+) et score : disponibilité 45 %, prioritaires 25 %, saison 15 %, temps 10 %, cuisson 5 % (réglable dans `src/lib/domain/recommend.ts`). Saisonnalité France métropolitaine.

**Accueil** : « Qu'est-ce qu'on mange aujourd'hui ? », recherche, filtres rapides, sections « Avec ce que j'ai », « À cuisiner rapidement », « De saison », premier lancement en 3 étapes non bloquant.

## Organisation du code

```
src/lib/domain/     calculs purs et testés (unités, manques, courses, classement, saisie)
src/lib/data/       catalogue d'ingrédients, recettes, saisonnalité
src/lib/storage/    IndexedDB
src/lib/store.tsx   état de l'application + enregistrement automatique
src/app/            écrans (Accueil, frigo, recettes, courses)
supabase/schema.sql schéma prévu pour la synchronisation (NON appliqué)
tests/              tests unitaires et d'intégration
e2e/                parcours utilisateur sur téléphone émulé
```

## Préparé pour la synchronisation familiale

Chaque article de courses a un identifiant unique créé sur l'appareil, une liste (`listId`), une date de modification, l'appareil auteur et une suppression « douce » (`deletedAt`). Ces champs permettent de fusionner plusieurs téléphones article par article. Le fichier `supabase/schema.sql` décrit les tables, index et règles de sécurité (RLS) par foyer : **il n'a été appliqué à aucune base**.

## Limites connues

- 90 recettes au lieu des 150 visées (les 45 du lot 2 sont à relire) : l'outil de validation est prêt, mais chaque nouvelle recette doit être relue par une personne.
- Pas de photos : un visuel original (emoji sur fond coloré) les remplace en attendant des photos sous licence.
- Pas de compte ni de synchronisation pour l'instant (modèle et schéma prêts).
- Pas de conversion pièces ↔ grammes (aucune équivalence documentée saisie) : ces cas sont marqués « à vérifier ».
- Thème clair uniquement.

## Import de recettes en brouillon

`npm run import:recipes` lit `data/import/recettes_1000_import.json` et écrit :

- `src/lib/data/drafts/recettes-import.json` : recettes au format de l'appli, **non publiées** (`published: false`, statut de relecture « brouillon ») ;
- `data/import/rapport-import.json` : acceptées, rejetées (doublons), variantes très proches, alertes.

L'import est idempotent (mêmes fichiers à chaque lancement, statuts « valide » / « refuse » conservés).
Les brouillons ne sont pas chargés par l'appli : la publication se fera après relecture humaine.

### Thermomix

`npm run import:thermomix` importe `data/import/recettes_thermomix_300_complet.json` (ou le fichier de 220
recettes supplémentaires si les 80 premières sont déjà importées, jamais les deux) en brouillon dans
`src/lib/data/drafts/thermomix-import.json`, avec le rapport `data/import/rapport-thermomix.json`.
