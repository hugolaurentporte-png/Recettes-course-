import type { Equipment, Recipe, RecipeIngredient, Unit } from "../domain/types";

/**
 * Catalogue de recettes V1 : recettes classiques du quotidien, quantités usuelles pour le nombre de portions indiqué.
 * Toute recette ajoutée doit passer `npm run validate:recipes` (ingrédients connus, temps cohérents, étapes présentes).
 * Visuels : emoji (visuel original) en attendant des photos sous licence.
 */

/** Ligne d'ingrédient : quantité null = « selon le goût ». */
function i(ingredientId: string, quantity: number | null = null, unit: Unit | null = null, optional = false): RecipeIngredient {
  return optional ? { ingredientId, quantity, unit, optional } : { ingredientId, quantity, unit };
}

interface Def {
  id: string;
  title: string;
  description: string;
  emoji: string;
  prep: number;
  cook: number;
  /** Temps total si différent de prep + cook (repos, marinade…). */
  total?: number;
  servings: number;
  eq: Equipment[];
  /** Équipement facultatif (ex. mixeur, four pour gratiner). */
  eqOptional?: Equipment[];
  tags: string[];
  ing: RecipeIngredient[];
  steps: string[];
}

function r(d: Def): Recipe {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    emoji: d.emoji,
    prepMinutes: d.prep,
    cookMinutes: d.cook,
    totalMinutes: d.total ?? d.prep + d.cook,
    servings: d.servings,
    ingredients: d.ing,
    equipment: [
      ...d.eq.map((type) => ({ type, required: true })),
      ...(d.eqOptional ?? []).map((type) => ({ type, required: false })),
    ],
    instructions: d.steps,
    tags: d.tags,
    published: true,
  };
}

export const RECIPES: Recipe[] = [
  r({
    id: "poelee-pdt-lardons", title: "Poêlée de pommes de terre aux lardons", emoji: "🥓",
    description: "Pommes de terre dorées, lardons et oignon : un classique rapide.",
    prep: 10, cook: 15, servings: 4, eq: ["poele"], tags: ["rapide", "familial", "poêle"],
    ing: [i("pomme-de-terre", 800, "g"), i("lardon", 200, "g"), i("oignon", 1, "piece"), i("huile-neutre", 1, "cs"), i("sel"), i("poivre"), i("persil", 1, "piece", true)],
    steps: [
      "Épluchez les pommes de terre et coupez-les en dés d'environ 1,5 cm.",
      "Faites chauffer l'huile dans une grande poêle et ajoutez les pommes de terre. Couvrez et laissez cuire 8 minutes à feu moyen en remuant de temps en temps.",
      "Ajoutez l'oignon émincé et les lardons. Poursuivez la cuisson à découvert 7 minutes jusqu'à ce que tout soit bien doré.",
      "Vérifiez la cuisson avec la pointe d'un couteau, salez peu (les lardons sont salés), poivrez, parsemez de persil et servez.",
    ],
  }),
  r({
    id: "gratin-pdt-carottes", title: "Gratin de pommes de terre et carottes", emoji: "🥕",
    description: "Un gratin fondant et doux, parfait en accompagnement ou en plat.",
    prep: 15, cook: 45, servings: 4, eq: ["four"], tags: ["gratin", "végétarien", "familial", "four"],
    ing: [i("pomme-de-terre", 800, "g"), i("carotte", 300, "g"), i("creme", 200, "ml"), i("lait", 200, "ml"), i("fromage-rape", 100, "g"), i("ail", 1, "piece"), i("muscade", null, null, true), i("sel"), i("poivre"), i("beurre", 10, "g")],
    steps: [
      "Préchauffez le four à 190 °C. Frottez un plat à gratin avec la gousse d'ail coupée, puis beurrez-le.",
      "Épluchez et coupez les pommes de terre et les carottes en fines rondelles (3 mm).",
      "Mélangez la crème et le lait, salez, poivrez, ajoutez un peu de muscade.",
      "Alternez les couches de légumes dans le plat, versez le mélange crème-lait et parsemez de fromage râpé.",
      "Enfournez 45 minutes : le dessus doit être doré et les légumes tendres sous la pointe d'un couteau.",
    ],
  }),
  r({
    id: "omelette-champignons", title: "Omelette aux champignons", emoji: "🍳",
    description: "Prête en dix minutes, idéale pour finir les champignons.",
    prep: 5, cook: 8, servings: 2, eq: ["poele"], tags: ["rapide", "végétarien", "œufs"],
    ing: [i("oeuf", 4, "piece"), i("champignon", 150, "g"), i("beurre", 15, "g"), i("ciboulette", 1, "piece", true), i("sel"), i("poivre")],
    steps: [
      "Nettoyez et émincez les champignons.",
      "Faites-les revenir 4 minutes dans la moitié du beurre jusqu'à ce que leur eau soit évaporée. Réservez.",
      "Battez les œufs avec le sel et le poivre.",
      "Faites fondre le reste du beurre, versez les œufs, ajoutez les champignons. Laissez prendre 3 minutes puis pliez l'omelette. Les œufs doivent être pris.",
    ],
  }),
  r({
    id: "pates-carbonara", title: "Pâtes à la carbonara", emoji: "🍝",
    description: "La version simple aux lardons et au parmesan, sans crème.",
    prep: 5, cook: 12, servings: 4, eq: ["casserole", "poele"], tags: ["rapide", "pâtes", "familial"],
    ing: [i("pates", 400, "g"), i("lardon", 200, "g"), i("oeuf", 3, "piece"), i("parmesan", 60, "g"), i("poivre"), i("sel")],
    steps: [
      "Faites cuire les pâtes dans une grande casserole d'eau bouillante salée selon le temps indiqué.",
      "Pendant ce temps, faites dorer les lardons à sec dans une poêle.",
      "Battez les œufs avec le parmesan râpé et beaucoup de poivre.",
      "Égouttez les pâtes en gardant une louche d'eau de cuisson. Hors du feu, mélangez pâtes, lardons et œufs, en ajoutant un peu d'eau de cuisson pour obtenir une sauce crémeuse. Servez aussitôt.",
    ],
  }),
  r({
    id: "soupe-legumes", title: "Soupe de légumes maison", emoji: "🥣",
    description: "Poireaux, carottes et pommes de terre mixés : la soupe de tous les jours.",
    prep: 15, cook: 30, servings: 4, eq: ["casserole"], tags: ["soupe", "végétarien", "hiver"],
    ing: [i("poireau", 2, "piece"), i("carotte", 300, "g"), i("pomme-de-terre", 400, "g"), i("oignon", 1, "piece"), i("bouillon", 1, "piece"), i("beurre", 15, "g"), i("creme", 50, "ml", true), i("sel"), i("poivre")],
    steps: [
      "Lavez et coupez les poireaux en rondelles. Épluchez et coupez les carottes, les pommes de terre et l'oignon.",
      "Faites fondre le beurre dans une grande casserole et faites suer l'oignon et les poireaux 5 minutes.",
      "Ajoutez les autres légumes, couvrez d'1,2 l d'eau et ajoutez le cube de bouillon.",
      "Laissez cuire 30 minutes à frémissement jusqu'à ce que les légumes soient très tendres.",
      "Mixez, rectifiez l'assaisonnement et ajoutez la crème si vous le souhaitez.",
    ],
  }),
  r({
    id: "veloute-potiron", title: "Velouté de potiron", emoji: "🎃",
    description: "Doux et onctueux, le velouté d'automne par excellence.",
    prep: 15, cook: 25, servings: 4, eq: ["casserole"], tags: ["soupe", "végétarien", "automne"],
    ing: [i("potiron", 1000, "g"), i("pomme-de-terre", 200, "g"), i("oignon", 1, "piece"), i("bouillon", 1, "piece"), i("creme", 100, "ml"), i("muscade", null, null, true), i("sel"), i("poivre"), i("beurre", 15, "g")],
    steps: [
      "Épluchez le potiron, retirez les graines et coupez la chair en cubes. Épluchez la pomme de terre et l'oignon.",
      "Faites revenir l'oignon émincé dans le beurre 3 minutes.",
      "Ajoutez le potiron et la pomme de terre, couvrez d'1 l d'eau, ajoutez le bouillon.",
      "Laissez cuire 25 minutes, puis mixez avec la crème. Salez, poivrez, ajoutez une pointe de muscade.",
    ],
  }),
  r({
    id: "quiche-lorraine", title: "Quiche lorraine", emoji: "🥧",
    description: "La quiche traditionnelle aux lardons, crème et œufs.",
    prep: 15, cook: 35, servings: 6, eq: ["four"], tags: ["four", "familial", "tarte"],
    ing: [i("pate-brisee", 1, "piece"), i("lardon", 200, "g"), i("oeuf", 3, "piece"), i("creme", 200, "ml"), i("lait", 200, "ml"), i("muscade", null, null, true), i("sel"), i("poivre")],
    steps: [
      "Préchauffez le four à 200 °C. Étalez la pâte dans un moule et piquez le fond à la fourchette.",
      "Faites revenir les lardons à sec 3 minutes et égouttez-les.",
      "Battez les œufs avec la crème et le lait, poivrez, salez légèrement et ajoutez la muscade.",
      "Répartissez les lardons sur la pâte, versez l'appareil.",
      "Enfournez 35 minutes : la quiche doit être dorée et l'appareil pris au centre.",
    ],
  }),
  r({
    id: "hachis-parmentier", title: "Hachis parmentier", emoji: "🥔",
    description: "Purée maison et bœuf haché : le plat familial réconfortant.",
    prep: 25, cook: 40, servings: 4, eq: ["casserole", "poele", "four"], tags: ["four", "familial", "gratin"],
    ing: [i("pomme-de-terre", 1000, "g"), i("boeuf-hache", 500, "g"), i("oignon", 1, "piece"), i("ail", 1, "piece"), i("lait", 200, "ml"), i("beurre", 40, "g"), i("fromage-rape", 60, "g"), i("concentre-tomate", 1, "cs", true), i("sel"), i("poivre")],
    steps: [
      "Épluchez les pommes de terre, coupez-les en morceaux et faites-les cuire 20 minutes dans l'eau salée.",
      "Pendant ce temps, faites revenir l'oignon et l'ail hachés, ajoutez le bœuf et faites-le cuire 8 minutes jusqu'à ce qu'il ne soit plus rosé. Ajoutez le concentré, salez, poivrez.",
      "Écrasez les pommes de terre avec le beurre et le lait chaud pour obtenir une purée.",
      "Préchauffez le four à 200 °C. Étalez la viande dans un plat, recouvrez de purée et de fromage râpé.",
      "Enfournez 20 minutes jusqu'à ce que le dessus soit gratiné.",
    ],
  }),
  r({
    id: "poulet-curry-coco", title: "Poulet curry et lait de coco", emoji: "🍛",
    description: "Un curry doux et parfumé, prêt en moins de 30 minutes.",
    prep: 10, cook: 20, servings: 4, eq: ["poele"], tags: ["rapide", "poêle", "épicé"],
    ing: [i("poulet", 600, "g"), i("lait-coco", 400, "ml"), i("oignon", 1, "piece"), i("ail", 2, "piece"), i("curry", 2, "cc"), i("huile-neutre", 1, "cs"), i("riz", 300, "g"), i("coriandre", 1, "piece", true), i("sel")],
    steps: [
      "Lancez la cuisson du riz selon le paquet.",
      "Coupez le poulet en morceaux. Émincez l'oignon et l'ail.",
      "Faites revenir l'oignon dans l'huile 3 minutes, ajoutez l'ail et le curry, mélangez 1 minute.",
      "Ajoutez le poulet et faites-le dorer 5 minutes, puis versez le lait de coco. Laissez mijoter 10 minutes : le poulet doit être bien cuit à cœur.",
      "Salez, parsemez de coriandre et servez avec le riz.",
    ],
  }),
  r({
    id: "risotto-champignons", title: "Risotto aux champignons", emoji: "🍄",
    description: "Crémeux, au parmesan, pour les champignons de saison.",
    prep: 10, cook: 25, servings: 4, eq: ["casserole"], tags: ["végétarien", "automne", "riz"],
    ing: [i("riz-arborio", 300, "g"), i("champignon", 300, "g"), i("echalote", 2, "piece"), i("bouillon", 2, "piece"), i("parmesan", 60, "g"), i("beurre", 30, "g"), i("vin-blanc", 100, "ml", true), i("huile-olive", 1, "cs"), i("sel"), i("poivre")],
    steps: [
      "Préparez 1 l de bouillon chaud avec les cubes.",
      "Faites revenir les échalotes hachées dans l'huile, ajoutez les champignons émincés 5 minutes.",
      "Ajoutez le riz et remuez 2 minutes jusqu'à ce qu'il devienne translucide. Versez le vin blanc et laissez-le s'évaporer.",
      "Versez le bouillon louche par louche en remuant, en attendant qu'il soit absorbé avant d'en rajouter (environ 18 minutes).",
      "Hors du feu, ajoutez le beurre et le parmesan, couvrez 2 minutes puis servez.",
    ],
  }),
  r({
    id: "ratatouille", title: "Ratatouille", emoji: "🍆",
    description: "Le mijoté de légumes du soleil, encore meilleur réchauffé.",
    prep: 20, cook: 45, servings: 4, eq: ["cocotte"], tags: ["végétarien", "été", "cocotte"],
    ing: [i("courgette", 2, "piece"), i("aubergine", 1, "piece"), i("poivron", 2, "piece"), i("tomate", 4, "piece"), i("oignon", 1, "piece"), i("ail", 2, "piece"), i("huile-olive", 4, "cs"), i("herbes-provence", 1, "cc"), i("sel"), i("poivre")],
    steps: [
      "Coupez tous les légumes en dés d'environ 2 cm. Émincez l'oignon et l'ail.",
      "Dans une cocotte, faites revenir l'oignon dans l'huile, puis ajoutez poivrons et aubergine 10 minutes.",
      "Ajoutez les courgettes, les tomates, l'ail et les herbes. Salez, poivrez.",
      "Couvrez et laissez mijoter 35 minutes à feu doux en remuant de temps en temps.",
    ],
  }),
  r({
    id: "salade-nicoise", title: "Salade niçoise", emoji: "🥗",
    description: "Fraîche et complète, sans cuisson hormis les œufs.",
    prep: 15, cook: 10, servings: 4, eq: ["casserole"], tags: ["été", "salade", "rapide"],
    ing: [i("tomate", 4, "piece"), i("oeuf", 4, "piece"), i("thon-boite", 280, "g"), i("salade", 1, "piece"), i("olive", 80, "g"), i("oignon-rouge", 1, "piece", true), i("huile-olive", 4, "cs"), i("vinaigre", 1, "cs"), i("sel"), i("poivre")],
    steps: [
      "Faites cuire les œufs 10 minutes dans l'eau bouillante, refroidissez-les et écalez-les.",
      "Lavez la salade, coupez les tomates en quartiers et l'oignon en fines lamelles.",
      "Préparez la vinaigrette avec l'huile, le vinaigre, le sel et le poivre.",
      "Disposez salade, tomates, thon émietté, olives et œufs en quartiers. Arrosez de vinaigrette.",
    ],
  }),
  r({
    id: "croque-monsieur", title: "Croque-monsieur", emoji: "🥪",
    description: "Jambon, fromage, pain de mie doré au four.",
    prep: 10, cook: 10, servings: 4, eq: ["four"], tags: ["rapide", "four", "enfants"],
    ing: [i("pain-mie", 8, "piece"), i("jambon", 4, "piece"), i("fromage-rape", 120, "g"), i("beurre", 30, "g"), i("creme", 50, "ml", true)],
    steps: [
      "Préchauffez le four à 220 °C (position grill si possible).",
      "Beurrez légèrement les tranches de pain de mie sur une face.",
      "Garnissez 4 tranches (côté non beurré) de jambon et de fromage, refermez avec les 4 autres, côté beurré à l'extérieur.",
      "Ajoutez un peu de crème et de fromage sur le dessus et enfournez 10 minutes jusqu'à ce que ce soit doré.",
    ],
  }),
  r({
    id: "bolognaise", title: "Spaghetti bolognaise", emoji: "🍝",
    description: "Une sauce tomate à la viande qui mijote doucement.",
    prep: 15, cook: 35, servings: 4, eq: ["casserole", "cocotte"], tags: ["pâtes", "familial"],
    ing: [i("pates", 400, "g"), i("boeuf-hache", 400, "g"), i("tomate-concassee", 400, "g"), i("oignon", 1, "piece"), i("carotte", 1, "piece"), i("ail", 2, "piece"), i("huile-olive", 2, "cs"), i("herbes-provence", 1, "cc"), i("parmesan", 40, "g", true), i("sel"), i("poivre")],
    steps: [
      "Hachez finement l'oignon, la carotte et l'ail. Faites-les revenir 5 minutes dans l'huile dans une cocotte.",
      "Ajoutez la viande et faites-la cuire 5 minutes en l'émiettant.",
      "Versez les tomates, ajoutez les herbes, salez, poivrez. Laissez mijoter 25 minutes à couvert.",
      "Faites cuire les pâtes dans l'eau bouillante salée, égouttez et servez avec la sauce et le parmesan.",
    ],
  }),
  r({
    id: "saumon-four-legumes", title: "Saumon au four et légumes", emoji: "🐟",
    description: "Pavés de saumon et courgettes rôtis sur la même plaque.",
    prep: 10, cook: 20, servings: 4, eq: ["four"], tags: ["poisson", "four", "léger"],
    ing: [i("saumon", 4, "piece"), i("courgette", 2, "piece"), i("tomate-cerise", 250, "g"), i("citron", 1, "piece"), i("huile-olive", 3, "cs"), i("herbes-provence", 1, "cc"), i("sel"), i("poivre")],
    steps: [
      "Préchauffez le four à 200 °C.",
      "Coupez les courgettes en demi-rondelles, mélangez-les avec les tomates cerises, l'huile, les herbes, le sel et le poivre sur une plaque.",
      "Enfournez 10 minutes, puis ajoutez les pavés de saumon assaisonnés et des rondelles de citron.",
      "Poursuivez 10 à 12 minutes : le saumon doit se détacher en lamelles.",
    ],
  }),
  r({
    id: "dahl-lentilles", title: "Dahl de lentilles corail", emoji: "🫘",
    description: "Lentilles corail au lait de coco et aux épices, végétarien et économique.",
    prep: 10, cook: 25, servings: 4, eq: ["casserole"], tags: ["végétarien", "épicé", "économique"],
    ing: [i("lentille-corail", 250, "g"), i("lait-coco", 400, "ml"), i("tomate-concassee", 400, "g"), i("oignon", 1, "piece"), i("ail", 2, "piece"), i("gingembre", 10, "g", true), i("curry", 2, "cc"), i("cumin", 1, "cc"), i("huile-neutre", 1, "cs"), i("riz", 250, "g", true), i("sel")],
    steps: [
      "Rincez les lentilles. Émincez l'oignon, l'ail et le gingembre.",
      "Faites revenir l'oignon dans l'huile 3 minutes, ajoutez ail, gingembre et épices 1 minute.",
      "Ajoutez les lentilles, les tomates, le lait de coco et 300 ml d'eau.",
      "Laissez cuire 20 minutes à feu doux en remuant : les lentilles doivent être fondantes. Salez et servez avec du riz.",
    ],
  }),
  r({
    id: "chili-con-carne", title: "Chili con carne", emoji: "🌶️",
    description: "Bœuf, haricots rouges et épices, mijoté en cocotte.",
    prep: 15, cook: 45, servings: 4, eq: ["cocotte"], tags: ["épicé", "cocotte", "familial"],
    ing: [i("boeuf-hache", 500, "g"), i("haricot-rouge", 400, "g"), i("tomate-concassee", 400, "g"), i("oignon", 1, "piece"), i("poivron", 1, "piece"), i("ail", 2, "piece"), i("cumin", 2, "cc"), i("paprika", 1, "cc"), i("huile-neutre", 1, "cs"), i("riz", 300, "g", true), i("sel")],
    steps: [
      "Émincez l'oignon, le poivron et l'ail.",
      "Faites-les revenir dans l'huile 5 minutes, ajoutez le bœuf et faites-le dorer 5 minutes.",
      "Ajoutez les épices, les tomates et 150 ml d'eau. Laissez mijoter 30 minutes à couvert.",
      "Ajoutez les haricots rouges égouttés, poursuivez 5 minutes. Salez et servez avec du riz.",
    ],
  }),
  r({
    id: "boeuf-bourguignon", title: "Bœuf bourguignon", emoji: "🍷",
    description: "Le grand classique mijoté au vin rouge, pour le week-end.",
    prep: 30, cook: 180, servings: 6, eq: ["cocotte"], tags: ["cocotte", "familial", "hiver", "mijoté"],
    ing: [i("boeuf-braiser", 1200, "g"), i("vin-rouge", 750, "ml"), i("lardon", 150, "g"), i("champignon", 250, "g"), i("carotte", 3, "piece"), i("oignon", 2, "piece"), i("ail", 2, "piece"), i("farine", 30, "g"), i("bouillon", 1, "piece"), i("thym"), i("laurier", 1, "piece"), i("huile-neutre", 2, "cs"), i("sel"), i("poivre")],
    steps: [
      "Coupez la viande en gros cubes. Émincez oignons et carottes.",
      "Faites dorer la viande en plusieurs fois dans l'huile, réservez. Faites revenir lardons et oignons.",
      "Remettez la viande, saupoudrez de farine et mélangez 2 minutes.",
      "Versez le vin, ajoutez 300 ml d'eau, le bouillon, les carottes, l'ail, le thym et le laurier. Couvrez et laissez mijoter 2 h 30 à feu très doux.",
      "Ajoutez les champignons et poursuivez 30 minutes : la viande doit être fondante. Rectifiez l'assaisonnement.",
    ],
  }),
  r({
    id: "tartiflette", title: "Tartiflette", emoji: "🧀",
    description: "Pommes de terre, lardons, oignons et reblochon gratinés.",
    prep: 20, cook: 45, servings: 4, eq: ["casserole", "poele", "four"], tags: ["four", "hiver", "gratin", "familial"],
    ing: [i("pomme-de-terre", 1000, "g"), i("reblochon", 1, "piece"), i("lardon", 200, "g"), i("oignon", 2, "piece"), i("creme", 100, "ml", true), i("vin-blanc", 50, "ml", true), i("poivre")],
    steps: [
      "Faites cuire les pommes de terre entières dans l'eau 20 minutes, puis épluchez-les et coupez-les en rondelles.",
      "Faites revenir les lardons et les oignons émincés 8 minutes, déglacez au vin blanc.",
      "Préchauffez le four à 210 °C. Dans un plat, alternez pommes de terre et lardons-oignons, ajoutez la crème et poivrez.",
      "Coupez le reblochon en deux dans l'épaisseur et posez-le croûte vers le haut. Enfournez 25 minutes jusqu'à ce qu'il soit fondu et doré.",
    ],
  }),
  r({
    id: "gratin-courgettes", title: "Gratin de courgettes", emoji: "🥒",
    description: "Léger et fondant, idéal en été.",
    prep: 15, cook: 35, servings: 4, eq: ["poele", "four"], tags: ["végétarien", "été", "gratin", "four"],
    ing: [i("courgette", 4, "piece"), i("oeuf", 2, "piece"), i("creme", 150, "ml"), i("fromage-rape", 80, "g"), i("ail", 1, "piece"), i("huile-olive", 1, "cs"), i("sel"), i("poivre")],
    steps: [
      "Préchauffez le four à 190 °C. Coupez les courgettes en rondelles.",
      "Faites-les revenir 8 minutes à la poêle avec l'huile et l'ail pour qu'elles rendent leur eau.",
      "Battez les œufs avec la crème, salez, poivrez.",
      "Mettez les courgettes dans un plat, versez l'appareil, parsemez de fromage et enfournez 25 minutes.",
    ],
  }),
  r({
    id: "lasagnes", title: "Lasagnes à la bolognaise", emoji: "🍽️",
    description: "Le plat du dimanche, à préparer à l'avance.",
    prep: 30, cook: 75, servings: 6, eq: ["cocotte", "casserole", "four"], tags: ["four", "familial", "pâtes"],
    ing: [i("lasagne", 300, "g"), i("boeuf-hache", 500, "g"), i("tomate-concassee", 800, "g"), i("oignon", 1, "piece"), i("ail", 2, "piece"), i("lait", 750, "ml"), i("beurre", 50, "g"), i("farine", 50, "g"), i("fromage-rape", 100, "g"), i("muscade", null, null, true), i("huile-olive", 1, "cs"), i("sel"), i("poivre")],
    steps: [
      "Sauce : faites revenir oignon et ail dans l'huile, ajoutez la viande 5 minutes puis les tomates. Laissez mijoter 25 minutes.",
      "Béchamel : faites fondre le beurre, ajoutez la farine en remuant 1 minute, puis le lait petit à petit en fouettant jusqu'à épaississement. Salez, poivrez, muscade.",
      "Préchauffez le four à 180 °C. Dans un plat, alternez sauce, feuilles de lasagne et béchamel, en terminant par la béchamel.",
      "Parsemez de fromage et enfournez 40 minutes. Laissez reposer 5 minutes avant de servir.",
    ],
  }),
  r({
    id: "crepes", title: "Crêpes", emoji: "🥞",
    description: "La pâte à crêpes de base, sucrée ou salée.",
    prep: 10, cook: 30, total: 70, servings: 4, eq: ["poele"], tags: ["dessert", "enfants", "végétarien"],
    ing: [i("farine", 250, "g"), i("oeuf", 4, "piece"), i("lait", 500, "ml"), i("beurre", 50, "g"), i("sucre", 30, "g", true), i("sel")],
    steps: [
      "Mettez la farine et une pincée de sel dans un saladier, creusez un puits et ajoutez les œufs.",
      "Mélangez en versant le lait petit à petit pour éviter les grumeaux, puis ajoutez le beurre fondu (et le sucre pour des crêpes sucrées).",
      "Laissez reposer la pâte 30 minutes.",
      "Faites cuire les crêpes une à une dans une poêle chaude légèrement beurrée, environ 1 minute de chaque côté.",
    ],
  }),
  r({
    id: "salade-lentilles", title: "Salade de lentilles tiède", emoji: "🥗",
    description: "Lentilles vertes, échalote et vinaigrette moutardée.",
    prep: 10, cook: 25, servings: 4, eq: ["casserole"], tags: ["végétarien", "salade", "économique"],
    ing: [i("lentille", 250, "g"), i("echalote", 1, "piece"), i("carotte", 1, "piece"), i("lardon", 100, "g", true), i("moutarde", 1, "cs"), i("vinaigre", 2, "cs"), i("huile-olive", 3, "cs"), i("persil", 1, "piece", true), i("laurier", 1, "piece", true), i("sel"), i("poivre")],
    steps: [
      "Rincez les lentilles et mettez-les dans une casserole d'eau froide avec la carotte en dés et le laurier. Portez à ébullition et laissez cuire 20 à 25 minutes. Salez en fin de cuisson.",
      "Préparez la vinaigrette : moutarde, vinaigre, huile, sel, poivre, échalote hachée.",
      "Égouttez les lentilles encore tièdes et mélangez-les à la vinaigrette. Ajoutez les lardons dorés et le persil si vous le souhaitez.",
    ],
  }),
  r({
    id: "pates-pesto-courgettes", title: "Pâtes au pesto et courgettes", emoji: "🌿",
    description: "Une assiette verte et rapide pour les soirs pressés.",
    prep: 5, cook: 12, servings: 4, eq: ["casserole", "poele"], tags: ["rapide", "végétarien", "pâtes", "été"],
    ing: [i("pates", 400, "g"), i("courgette", 2, "piece"), i("pesto", 4, "cs"), i("parmesan", 40, "g", true), i("pignon", 30, "g", true), i("huile-olive", 1, "cs"), i("sel")],
    steps: [
      "Faites cuire les pâtes dans l'eau bouillante salée.",
      "Pendant ce temps, coupez les courgettes en dés et faites-les dorer 6 minutes dans l'huile.",
      "Égouttez les pâtes, mélangez-les avec les courgettes et le pesto. Parsemez de parmesan et de pignons grillés.",
    ],
  }),
  r({
    id: "poulet-roti-pdt", title: "Poulet rôti et pommes de terre", emoji: "🍗",
    description: "Cuisses de poulet et pommes de terre rôties ensemble au four.",
    prep: 10, cook: 50, servings: 4, eq: ["four"], tags: ["four", "familial"],
    ing: [i("cuisse-poulet", 4, "piece"), i("pomme-de-terre", 800, "g"), i("ail", 4, "piece"), i("huile-olive", 3, "cs"), i("thym"), i("sel"), i("poivre")],
    steps: [
      "Préchauffez le four à 200 °C.",
      "Coupez les pommes de terre en quartiers, mélangez-les avec l'huile, le thym, le sel, le poivre et l'ail en chemise dans un grand plat.",
      "Posez les cuisses de poulet assaisonnées par-dessus, peau vers le haut.",
      "Enfournez 50 minutes en arrosant à mi-cuisson. Le jus doit être clair quand on pique la viande près de l'os.",
    ],
  }),
  r({
    id: "airfryer-pdt", title: "Pommes de terre rôties à l'air fryer", emoji: "🍟",
    description: "Croustillantes avec très peu d'huile.",
    prep: 5, cook: 20, servings: 2, eq: ["airfryer"], tags: ["rapide", "végétarien", "accompagnement"],
    ing: [i("pomme-de-terre", 500, "g"), i("huile-olive", 1, "cs"), i("paprika", 1, "cc", true), i("sel"), i("herbes-provence", 1, "cc", true)],
    steps: [
      "Coupez les pommes de terre en quartiers sans les éplucher (lavez-les bien).",
      "Mélangez-les avec l'huile, le sel et les épices.",
      "Faites-les cuire 20 minutes à 200 °C dans l'air fryer en secouant le panier à mi-cuisson. Elles doivent être dorées et tendres à cœur.",
    ],
  }),
  r({
    id: "airfryer-poulet", title: "Blancs de poulet croustillants à l'air fryer", emoji: "🍗",
    description: "Panés à la chapelure, sans friture.",
    prep: 10, cook: 15, servings: 4, eq: ["airfryer"], tags: ["rapide", "enfants"],
    ing: [i("poulet", 600, "g"), i("oeuf", 1, "piece"), i("chapelure", 80, "g"), i("paprika", 1, "cc", true), i("huile-neutre", 1, "cs"), i("sel"), i("poivre")],
    steps: [
      "Coupez le poulet en lanières. Battez l'œuf avec le sel et le poivre.",
      "Trempez les lanières dans l'œuf puis dans la chapelure mélangée au paprika.",
      "Badigeonnez légèrement d'huile et faites cuire 12 à 15 minutes à 190 °C en retournant à mi-cuisson. La viande doit être blanche à cœur.",
    ],
  }),
  r({
    id: "taboule", title: "Taboulé", emoji: "🥙",
    description: "Semoule, tomates, concombre et menthe-persil, sans cuisson.",
    prep: 20, cook: 0, total: 50, servings: 4, eq: ["sans-cuisson"], tags: ["sans cuisson", "été", "végétarien", "salade"],
    ing: [i("semoule", 200, "g"), i("tomate", 3, "piece"), i("concombre", 1, "piece"), i("persil", 1, "piece"), i("citron", 1, "piece"), i("huile-olive", 4, "cs"), i("oignon-rouge", 1, "piece", true), i("sel"), i("poivre")],
    steps: [
      "Mettez la semoule crue dans un saladier avec le jus de citron, l'huile et 150 ml d'eau froide salée. Mélangez.",
      "Coupez les tomates et le concombre en petits dés, ciselez le persil (et l'oignon si vous l'utilisez).",
      "Mélangez le tout avec la semoule, poivrez et laissez reposer 30 minutes au frais pour que la semoule gonfle.",
    ],
  }),
  r({
    id: "salade-tomate-mozza", title: "Tomates mozzarella", emoji: "🍅",
    description: "Le plus simple des plats d'été, sans cuisson.",
    prep: 10, cook: 0, servings: 2, eq: ["sans-cuisson"], tags: ["sans cuisson", "été", "végétarien", "rapide"],
    ing: [i("tomate", 3, "piece"), i("mozzarella", 1, "piece"), i("basilic", 1, "piece"), i("huile-olive", 2, "cs"), i("vinaigre", 1, "cs", true), i("sel"), i("poivre")],
    steps: [
      "Coupez les tomates et la mozzarella en tranches.",
      "Alternez-les dans un plat avec les feuilles de basilic.",
      "Arrosez d'huile d'olive (et d'un peu de vinaigre balsamique), salez, poivrez et servez.",
    ],
  }),
  r({
    id: "wraps-poulet", title: "Wraps poulet crudités", emoji: "🌯",
    description: "À assembler en quelques minutes, parfait pour un repas sur le pouce.",
    prep: 15, cook: 8, servings: 4, eq: ["poele"], tags: ["rapide", "enfants"],
    ing: [i("tortilla", 4, "piece"), i("poulet", 400, "g"), i("salade", 1, "piece"), i("tomate", 2, "piece"), i("fromage-rape", 60, "g", true), i("yaourt", 1, "piece"), i("citron", 1, "piece", true), i("paprika", 1, "cc", true), i("huile-neutre", 1, "cs"), i("sel")],
    steps: [
      "Coupez le poulet en lanières et faites-le cuire 7 à 8 minutes à la poêle avec l'huile et le paprika jusqu'à ce qu'il soit cuit à cœur. Salez.",
      "Mélangez le yaourt avec un filet de citron et une pincée de sel pour la sauce.",
      "Garnissez les tortillas de salade, de tomates en dés, de poulet, de sauce et de fromage, puis roulez-les.",
    ],
  }),
  r({
    id: "soupe-poireaux-pdt", title: "Soupe poireaux pommes de terre", emoji: "🥬",
    description: "Simple, douce, prête en une demi-heure.",
    prep: 10, cook: 25, servings: 4, eq: ["casserole"], tags: ["soupe", "végétarien", "hiver", "économique"],
    ing: [i("poireau", 3, "piece"), i("pomme-de-terre", 500, "g"), i("bouillon", 1, "piece"), i("beurre", 20, "g"), i("creme", 50, "ml", true), i("sel"), i("poivre")],
    steps: [
      "Lavez soigneusement les poireaux et émincez-les. Épluchez et coupez les pommes de terre.",
      "Faites fondre les poireaux dans le beurre 5 minutes.",
      "Ajoutez les pommes de terre, 1 l d'eau et le bouillon. Laissez cuire 20 minutes.",
      "Mixez, ajoutez la crème, salez, poivrez.",
    ],
  }),
  r({
    id: "endives-jambon", title: "Endives au jambon", emoji: "🥬",
    description: "Endives braisées roulées dans le jambon, nappées de béchamel.",
    prep: 20, cook: 45, servings: 4, eq: ["casserole", "four"], tags: ["four", "hiver", "gratin", "familial"],
    ing: [i("endive", 8, "piece"), i("jambon", 8, "piece"), i("lait", 500, "ml"), i("beurre", 40, "g"), i("farine", 40, "g"), i("fromage-rape", 80, "g"), i("muscade", null, null, true), i("sel"), i("poivre")],
    steps: [
      "Retirez le cône amer à la base des endives et faites-les cuire 20 minutes dans l'eau bouillante salée. Égouttez-les bien en les pressant.",
      "Préparez une béchamel : beurre fondu, farine, puis lait en fouettant jusqu'à épaississement. Salez, poivrez, muscade.",
      "Préchauffez le four à 200 °C. Roulez chaque endive dans une tranche de jambon et placez-les dans un plat.",
      "Nappez de béchamel, parsemez de fromage et enfournez 25 minutes.",
    ],
  }),
  r({
    id: "cabillaud-poele-citron", title: "Cabillaud poêlé au citron", emoji: "🍋",
    description: "Poisson nacré, beurre citronné, prêt en quinze minutes.",
    prep: 5, cook: 10, servings: 4, eq: ["poele"], tags: ["rapide", "poisson", "léger"],
    ing: [i("cabillaud", 600, "g"), i("citron", 1, "piece"), i("beurre", 30, "g"), i("persil", 1, "piece", true), i("farine", 20, "g", true), i("sel"), i("poivre")],
    steps: [
      "Séchez le poisson avec du papier absorbant, salez, poivrez et farinez légèrement.",
      "Faites fondre le beurre dans une poêle et faites cuire le poisson 3 à 4 minutes de chaque côté selon l'épaisseur. Il doit être opaque et se détacher en lamelles.",
      "Arrosez de jus de citron, parsemez de persil et servez.",
    ],
  }),
  r({
    id: "pates-thon-tomate", title: "Pâtes thon et tomate", emoji: "🍝",
    description: "Le dépannage du placard, prêt en un quart d'heure.",
    prep: 5, cook: 12, servings: 4, eq: ["casserole"], tags: ["rapide", "économique", "pâtes", "placard"],
    ing: [i("pates", 400, "g"), i("thon-boite", 280, "g"), i("coulis-tomate", 400, "ml"), i("oignon", 1, "piece"), i("huile-olive", 2, "cs"), i("herbes-provence", 1, "cc", true), i("sel"), i("poivre")],
    steps: [
      "Faites cuire les pâtes dans l'eau bouillante salée.",
      "Dans une autre casserole, faites revenir l'oignon haché dans l'huile 3 minutes, ajoutez le coulis et les herbes, laissez frémir 8 minutes.",
      "Ajoutez le thon émietté, réchauffez 2 minutes, salez, poivrez et mélangez aux pâtes égouttées.",
    ],
  }),
  r({
    id: "chou-fleur-gratin", title: "Gratin de chou-fleur", emoji: "🥦",
    description: "Chou-fleur sous une béchamel dorée.",
    prep: 15, cook: 40, servings: 4, eq: ["casserole", "four"], tags: ["végétarien", "hiver", "gratin", "four"],
    ing: [i("chou-fleur", 1, "piece"), i("lait", 500, "ml"), i("beurre", 40, "g"), i("farine", 40, "g"), i("fromage-rape", 100, "g"), i("muscade", null, null, true), i("sel"), i("poivre")],
    steps: [
      "Détaillez le chou-fleur en bouquets et faites-les cuire 10 minutes dans l'eau bouillante salée. Égouttez.",
      "Préparez une béchamel avec le beurre, la farine et le lait. Salez, poivrez, muscade.",
      "Préchauffez le four à 200 °C. Mettez le chou-fleur dans un plat, nappez de béchamel et de fromage.",
      "Enfournez 25 minutes jusqu'à ce que le dessus soit doré.",
    ],
  }),
  r({
    id: "shakshuka", title: "Œufs pochés à la tomate (shakshuka)", emoji: "🍳",
    description: "Œufs cuits dans une sauce tomate-poivron épicée.",
    prep: 10, cook: 20, servings: 2, eq: ["poele"], tags: ["végétarien", "œufs", "épicé"],
    ing: [i("oeuf", 4, "piece"), i("tomate-concassee", 400, "g"), i("poivron", 1, "piece"), i("oignon", 1, "piece"), i("ail", 1, "piece"), i("cumin", 1, "cc"), i("paprika", 1, "cc"), i("huile-olive", 2, "cs"), i("coriandre", 1, "piece", true), i("pain", 1, "piece", true), i("sel")],
    steps: [
      "Faites revenir l'oignon et le poivron émincés dans l'huile 6 minutes. Ajoutez l'ail et les épices 1 minute.",
      "Ajoutez les tomates, salez, laissez mijoter 8 minutes.",
      "Creusez 4 puits et cassez-y les œufs. Couvrez et laissez cuire 5 à 6 minutes, jusqu'à ce que les blancs soient bien pris.",
      "Parsemez de coriandre et servez avec du pain.",
    ],
  }),
  r({
    id: "puree-maison", title: "Purée maison", emoji: "🥔",
    description: "La vraie purée au beurre et au lait.",
    prep: 10, cook: 20, servings: 4, eq: ["casserole"], tags: ["accompagnement", "végétarien", "enfants"],
    ing: [i("pomme-de-terre", 1000, "g"), i("lait", 250, "ml"), i("beurre", 50, "g"), i("muscade", null, null, true), i("sel")],
    steps: [
      "Épluchez les pommes de terre, coupez-les en morceaux et faites-les cuire 20 minutes dans l'eau salée : la lame d'un couteau doit s'enfoncer sans résistance.",
      "Égouttez, écrasez au presse-purée avec le beurre.",
      "Ajoutez le lait chaud progressivement jusqu'à la texture souhaitée. Salez, ajoutez la muscade.",
    ],
  }),
  r({
    id: "riz-cantonais", title: "Riz sauté aux œufs et petits pois", emoji: "🍚",
    description: "Idéal pour utiliser un reste de riz cuit.",
    prep: 10, cook: 10, servings: 4, eq: ["poele"], tags: ["rapide", "restes", "riz"],
    ing: [i("riz", 300, "g"), i("oeuf", 3, "piece"), i("petit-pois-surgele", 150, "g"), i("jambon", 2, "piece"), i("oignon", 1, "piece"), i("sauce-soja", 2, "cs"), i("huile-neutre", 2, "cs")],
    steps: [
      "Utilisez du riz cuit et refroidi (cuit la veille, gardé au réfrigérateur), ou faites-le cuire et laissez-le refroidir.",
      "Faites revenir l'oignon haché dans l'huile 2 minutes, ajoutez les petits pois 3 minutes.",
      "Poussez sur le côté, versez les œufs battus et brouillez-les.",
      "Ajoutez le riz et le jambon en dés, faites sauter 4 minutes à feu vif, assaisonnez de sauce soja.",
    ],
  }),
  r({
    id: "tarte-chevre-tomates", title: "Tarte fine tomates et chèvre", emoji: "🍅",
    description: "Pâte feuilletée, moutarde, tomates et chèvre.",
    prep: 10, cook: 25, servings: 4, eq: ["four"], tags: ["four", "été", "végétarien", "tarte"],
    ing: [i("pate-feuilletee", 1, "piece"), i("tomate", 4, "piece"), i("chevre", 150, "g"), i("moutarde", 2, "cs"), i("huile-olive", 1, "cs"), i("herbes-provence", 1, "cc"), i("sel"), i("poivre")],
    steps: [
      "Préchauffez le four à 200 °C. Déroulez la pâte sur une plaque et piquez-la.",
      "Étalez la moutarde sur la pâte, puis disposez les tomates en rondelles et le chèvre en tranches.",
      "Arrosez d'huile, parsemez d'herbes, salez, poivrez.",
      "Enfournez 25 minutes jusqu'à ce que la pâte soit dorée.",
    ],
  }),
  r({
    id: "papillote-poisson", title: "Papillotes de cabillaud aux légumes", emoji: "🐟",
    description: "Poisson et légumes cuits à la vapeur dans leur papillote.",
    prep: 15, cook: 20, servings: 4, eq: ["four"], tags: ["poisson", "léger", "four"],
    ing: [i("cabillaud", 600, "g"), i("carotte", 2, "piece"), i("courgette", 1, "piece"), i("citron", 1, "piece"), i("huile-olive", 2, "cs"), i("sel"), i("poivre")],
    steps: [
      "Préchauffez le four à 200 °C. Coupez les légumes en fines julienne ou rondelles.",
      "Sur 4 feuilles de papier cuisson, répartissez les légumes, posez le poisson, ajoutez une rondelle de citron, un filet d'huile, sel et poivre.",
      "Fermez hermétiquement les papillotes et enfournez 20 minutes. Le poisson doit être opaque à cœur.",
    ],
  }),
  r({
    id: "couscous-legumes", title: "Couscous aux légumes et pois chiches", emoji: "🍲",
    description: "Bouillon parfumé, légumes fondants et semoule.",
    prep: 20, cook: 40, servings: 4, eq: ["cocotte"], tags: ["végétarien", "cocotte", "épicé"],
    ing: [i("semoule", 300, "g"), i("carotte", 3, "piece"), i("courgette", 2, "piece"), i("navet", 200, "g"), i("pois-chiche", 400, "g"), i("tomate-concassee", 400, "g"), i("oignon", 1, "piece"), i("ras-el-hanout", 2, "cc"), i("bouillon", 1, "piece"), i("huile-olive", 2, "cs"), i("beurre", 20, "g", true), i("sel")],
    steps: [
      "Faites revenir l'oignon dans l'huile au fond d'une cocotte, ajoutez le ras el hanout.",
      "Ajoutez carottes et navets en morceaux, les tomates, le bouillon et 1 l d'eau. Laissez cuire 25 minutes.",
      "Ajoutez les courgettes et les pois chiches égouttés, poursuivez 15 minutes.",
      "Préparez la semoule : versez dessus le même volume d'eau bouillante salée, couvrez 5 minutes, puis égrenez avec le beurre. Servez avec les légumes et le bouillon.",
    ],
  }),
  r({
    id: "compote-pommes", title: "Compote de pommes", emoji: "🍎",
    description: "Pour finir les pommes un peu fatiguées.",
    prep: 10, cook: 20, servings: 4, eq: ["casserole"], tags: ["dessert", "enfants", "automne", "économique"],
    ing: [i("pomme", 6, "piece"), i("sucre", 30, "g"), i("sucre-vanille", 1, "piece", true), i("citron", 1, "piece", true)],
    steps: [
      "Épluchez les pommes, retirez le cœur et coupez-les en morceaux.",
      "Mettez-les dans une casserole avec 5 cl d'eau, le sucre et le sucre vanillé.",
      "Couvrez et laissez cuire 20 minutes à feu doux en remuant de temps en temps. Écrasez à la fourchette ou mixez.",
    ],
  }),
  r({
    id: "gateau-chocolat", title: "Gâteau au chocolat", emoji: "🍫",
    description: "Le moelleux familial, simple et inratable.",
    prep: 15, cook: 25, servings: 6, eq: ["four"], tags: ["dessert", "enfants", "four"],
    ing: [i("chocolat", 200, "g"), i("beurre", 125, "g"), i("sucre", 120, "g"), i("oeuf", 4, "piece"), i("farine", 60, "g")],
    steps: [
      "Préchauffez le four à 180 °C. Beurrez un moule.",
      "Faites fondre le chocolat et le beurre ensemble à feu très doux (ou au micro-ondes).",
      "Fouettez les œufs avec le sucre, ajoutez le chocolat fondu puis la farine.",
      "Versez dans le moule et enfournez 22 à 25 minutes : le centre doit rester légèrement fondant.",
    ],
  }),
  r({
    id: "crumble-pommes", title: "Crumble aux pommes", emoji: "🥧",
    description: "Pommes fondantes sous une pâte sablée croustillante.",
    prep: 15, cook: 35, servings: 6, eq: ["four"], tags: ["dessert", "automne", "four"],
    ing: [i("pomme", 6, "piece"), i("farine", 150, "g"), i("beurre", 100, "g"), i("sucre", 100, "g"), i("sucre-vanille", 1, "piece", true)],
    steps: [
      "Préchauffez le four à 180 °C. Épluchez les pommes et coupez-les en dés dans un plat.",
      "Mélangez du bout des doigts la farine, le sucre et le beurre froid en morceaux jusqu'à obtenir un sable grossier.",
      "Répartissez sur les pommes et enfournez 35 minutes jusqu'à ce que le dessus soit doré.",
    ],
  }),
  r({
    id: "porc-moutarde", title: "Filet mignon à la moutarde", emoji: "🥩",
    description: "Sauce crème-moutarde, tendre et rapide.",
    prep: 10, cook: 20, servings: 4, eq: ["poele"], tags: ["poêle", "familial"],
    ing: [i("porc-filet", 600, "g"), i("creme", 200, "ml"), i("moutarde", 2, "cs"), i("echalote", 1, "piece"), i("huile-neutre", 1, "cs"), i("sel"), i("poivre")],
    steps: [
      "Coupez le filet mignon en médaillons de 2 cm.",
      "Faites-les dorer 3 minutes de chaque côté dans l'huile, réservez.",
      "Faites revenir l'échalote hachée, ajoutez la crème et la moutarde, mélangez.",
      "Remettez la viande et laissez mijoter 8 minutes à feu doux : elle doit être juste rosée pâle à cœur. Salez, poivrez.",
    ],
  }),
  r({
    id: "soupe-lentilles-corail", title: "Soupe de lentilles corail et carottes", emoji: "🥕",
    description: "Une soupe complète et rassasiante.",
    prep: 10, cook: 25, servings: 4, eq: ["casserole"], tags: ["soupe", "végétarien", "économique", "hiver"],
    ing: [i("lentille-corail", 150, "g"), i("carotte", 400, "g"), i("oignon", 1, "piece"), i("bouillon", 1, "piece"), i("cumin", 1, "cc"), i("lait-coco", 200, "ml", true), i("huile-olive", 1, "cs"), i("sel")],
    steps: [
      "Faites revenir l'oignon dans l'huile 3 minutes, ajoutez le cumin.",
      "Ajoutez les carottes en rondelles, les lentilles rincées, 1 l d'eau et le bouillon.",
      "Laissez cuire 25 minutes, puis mixez avec le lait de coco. Salez.",
    ],
  }),
  r({
    id: "gnocchis-poele-epinards", title: "Gnocchis poêlés aux épinards", emoji: "🥬",
    description: "Gnocchis dorés, épinards et parmesan en quinze minutes.",
    prep: 5, cook: 10, servings: 2, eq: ["poele"], tags: ["rapide", "végétarien"],
    ing: [i("gnocchi", 400, "g"), i("epinard", 150, "g"), i("ail", 1, "piece"), i("creme", 100, "ml"), i("parmesan", 30, "g"), i("beurre", 15, "g"), i("sel"), i("poivre")],
    steps: [
      "Faites dorer les gnocchis 5 minutes dans le beurre à la poêle.",
      "Ajoutez l'ail haché puis les épinards et laissez-les tomber 2 minutes.",
      "Versez la crème, ajoutez le parmesan, mélangez 2 minutes. Salez, poivrez.",
    ],
  }),
  // ——— Recettes au Thermomix (robot cuiseur) ———
  r({
    id: "tm-risotto-champignons", title: "Risotto aux champignons au Thermomix", emoji: "🍄",
    description: "Un risotto crémeux sans rester devant la casserole : le robot remue pour vous.",
    prep: 10, cook: 22, servings: 4, eq: ["thermomix"], tags: ["thermomix", "végétarien", "italien"],
    ing: [i("riz-arborio", 300, "g"), i("champignon", 250, "g"), i("oignon", 1, "piece"), i("parmesan", 50, "g"), i("vin-blanc", 100, "ml", true), i("bouillon", 1, "piece"), i("huile-olive", 2, "cs"), i("beurre", 20, "g"), i("sel"), i("poivre")],
    steps: [
      "Mettez le parmesan en morceaux dans le bol, mixez 10 s vitesse 10 et réservez.",
      "Mettez l'oignon coupé en deux dans le bol, mixez 5 s vitesse 5, raclez les parois. Ajoutez l'huile et faites revenir 3 min à 120 °C vitesse 1.",
      "Ajoutez le riz et les champignons émincés, puis faites nacrer 3 min à 120 °C en sens inverse, vitesse 1, sans le gobelet.",
      "Versez le vin blanc, puis 850 ml d'eau et le cube de bouillon. Faites cuire 16 min à 100 °C en sens inverse, vitesse 1, avec le panier posé sur le couvercle à la place du gobelet.",
      "Versez dans un plat, ajoutez le beurre et le parmesan, mélangez doucement, poivrez et laissez reposer 2 minutes avant de servir.",
    ],
  }),
  r({
    id: "tm-veloute-potiron", title: "Velouté de potiron au Thermomix", emoji: "🎃",
    description: "Un velouté doux et onctueux, prêt en une demi-heure.",
    prep: 10, cook: 25, servings: 4, eq: ["thermomix"], tags: ["thermomix", "soupe", "végétarien", "automne"],
    ing: [i("potiron", 800, "g"), i("pomme-de-terre", 200, "g"), i("oignon", 1, "piece"), i("bouillon", 1, "piece"), i("huile-olive", 1, "cs"), i("creme", 100, "ml", true), i("muscade", null, null, true), i("sel"), i("poivre")],
    steps: [
      "Mettez l'oignon coupé en deux dans le bol et mixez 5 s vitesse 5. Ajoutez l'huile et faites revenir 3 min à 120 °C vitesse 1.",
      "Ajoutez le potiron épluché et la pomme de terre, coupés en morceaux, puis mixez 5 s vitesse 5.",
      "Versez 600 ml d'eau et le cube de bouillon. Faites cuire 22 min à 100 °C vitesse 1.",
      "Ajoutez la crème si vous le souhaitez, puis mixez 1 min en augmentant progressivement jusqu'à la vitesse 10. Salez, poivrez, ajoutez un peu de muscade et servez chaud.",
    ],
  }),
  r({
    id: "tm-soupe-poireaux", title: "Soupe poireaux pommes de terre au Thermomix", emoji: "🥣",
    description: "La soupe de tous les jours, simple et réconfortante.",
    prep: 10, cook: 25, servings: 4, eq: ["thermomix"], tags: ["thermomix", "soupe", "végétarien", "hiver"],
    ing: [i("poireau", 2, "piece"), i("pomme-de-terre", 400, "g"), i("oignon", 1, "piece"), i("beurre", 20, "g"), i("bouillon", 1, "piece"), i("creme", 50, "ml", true), i("sel"), i("poivre")],
    steps: [
      "Mettez l'oignon dans le bol, mixez 5 s vitesse 5, ajoutez le beurre et faites revenir 3 min à 120 °C vitesse 1.",
      "Ajoutez les poireaux lavés et coupés en tronçons et les pommes de terre en morceaux. Mixez 5 s vitesse 5.",
      "Versez 800 ml d'eau et le cube de bouillon, puis faites cuire 22 min à 100 °C vitesse 1.",
      "Mixez 1 min en augmentant progressivement jusqu'à la vitesse 10, ajoutez la crème si vous le souhaitez, rectifiez l'assaisonnement et servez.",
    ],
  }),
  r({
    id: "tm-puree", title: "Purée de pommes de terre au Thermomix", emoji: "🥔",
    description: "Une purée maison légère, sans grumeaux et sans surveiller la casserole.",
    prep: 10, cook: 25, servings: 4, eq: ["thermomix"], tags: ["thermomix", "accompagnement", "végétarien", "familial"],
    ing: [i("pomme-de-terre", 800, "g"), i("lait", 300, "ml"), i("beurre", 40, "g"), i("muscade", null, null, true), i("sel"), i("poivre")],
    steps: [
      "Épluchez les pommes de terre et coupez-les en morceaux de taille égale.",
      "Mettez le fouet sur les lames. Ajoutez les pommes de terre, le lait, 150 ml d'eau et une pincée de sel. Faites cuire 25 min à 98 °C vitesse 1.",
      "Vérifiez la cuisson avec la pointe d'un couteau, ajoutez le beurre, puis mélangez 20 s vitesse 3 avec le fouet (pas plus, sinon la purée devient élastique).",
      "Poivrez, ajoutez un peu de muscade si vous aimez et servez aussitôt.",
    ],
  }),
  r({
    id: "tm-bolognaise", title: "Pâtes à la bolognaise au Thermomix", emoji: "🍝",
    description: "Une sauce mijotée riche en légumes, pendant que les pâtes cuisent à côté.",
    prep: 10, cook: 30, servings: 4, eq: ["thermomix", "casserole"], tags: ["thermomix", "pâtes", "familial", "italien"],
    ing: [i("boeuf-hache", 400, "g"), i("tomate-concassee", 400, "g"), i("concentre-tomate", 1, "cs"), i("carotte", 1, "piece"), i("oignon", 1, "piece"), i("ail", 1, "piece"), i("huile-olive", 2, "cs"), i("herbes-provence", 1, "cc"), i("pates", 400, "g"), i("parmesan", 40, "g", true), i("sel"), i("poivre")],
    steps: [
      "Mettez l'oignon, l'ail et la carotte en morceaux dans le bol, mixez 5 s vitesse 5 et raclez les parois. Ajoutez l'huile et faites revenir 5 min à 120 °C vitesse 1.",
      "Ajoutez la viande hachée et faites cuire 5 min à 120 °C en sens inverse, vitesse 1, en émiettant si besoin avec la spatule.",
      "Ajoutez les tomates concassées, le concentré, les herbes, du sel et du poivre. Faites mijoter 20 min à 100 °C en sens inverse, vitesse 1, avec le panier posé sur le couvercle.",
      "Pendant ce temps, faites cuire les pâtes dans une grande casserole d'eau bouillante salée, puis égouttez-les.",
      "Servez les pâtes nappées de sauce, avec du parmesan râpé si vous le souhaitez.",
    ],
  }),
  r({
    id: "tm-dahl-lentilles", title: "Dahl de lentilles corail au Thermomix", emoji: "🍛",
    description: "Lentilles corail fondantes au lait de coco et aux épices douces.",
    prep: 10, cook: 25, servings: 4, eq: ["thermomix"], tags: ["thermomix", "végétarien", "épicé", "indien"],
    ing: [i("lentille-corail", 250, "g"), i("lait-coco", 400, "ml"), i("tomate-concassee", 400, "g"), i("oignon", 1, "piece"), i("ail", 2, "piece"), i("gingembre", 10, "g", true), i("curry", 2, "cc"), i("huile-neutre", 1, "cs"), i("coriandre", 1, "piece", true), i("sel")],
    steps: [
      "Mettez l'oignon, l'ail et le gingembre épluchés dans le bol, mixez 5 s vitesse 5. Ajoutez l'huile et le curry, puis faites revenir 3 min à 120 °C vitesse 1.",
      "Rincez les lentilles. Ajoutez-les dans le bol avec les tomates concassées, le lait de coco, 300 ml d'eau et du sel.",
      "Faites cuire 22 min à 100 °C en sens inverse, vitesse 1, avec le panier posé sur le couvercle pour éviter les projections.",
      "Goûtez, rectifiez le sel, parsemez de coriandre ciselée et servez avec du riz ou du pain.",
    ],
  }),
  r({
    id: "tm-houmous", title: "Houmous au Thermomix", emoji: "🧆",
    description: "Une crème de pois chiches citronnée, pour l'apéritif ou un repas léger.",
    prep: 10, cook: 0, servings: 4, eq: ["thermomix"], tags: ["thermomix", "apéritif", "végétarien", "rapide", "sans cuisson"],
    ing: [i("pois-chiche", 400, "g"), i("citron", 1, "piece"), i("ail", 1, "piece"), i("huile-olive", 3, "cs"), i("cumin", 1, "cc"), i("paprika", null, null, true), i("sel")],
    steps: [
      "Égouttez les pois chiches en gardant un peu de leur jus, et pressez le citron.",
      "Mettez l'ail dans le bol et mixez 3 s vitesse 7. Ajoutez les pois chiches, le jus de citron, l'huile, le cumin, du sel et 3 cuillères à soupe du jus des pois chiches.",
      "Mixez 1 min vitesse 6, raclez les parois, puis mixez encore 30 s vitesse 8. Ajoutez un peu de jus si le houmous est trop épais.",
      "Versez dans un bol, arrosez d'un filet d'huile, saupoudrez de paprika et servez avec du pain ou des légumes crus.",
    ],
  }),
  r({
    id: "tm-compote-pommes", title: "Compote de pommes au Thermomix", emoji: "🍏",
    description: "Une compote maison peu sucrée, à servir tiède ou froide.",
    prep: 10, cook: 15, servings: 4, eq: ["thermomix"], tags: ["thermomix", "dessert", "végétarien", "enfants"],
    ing: [i("pomme", 1000, "g"), i("citron", 1, "piece", true), i("sucre", 30, "g"), i("sucre-vanille", 1, "piece", true)],
    steps: [
      "Épluchez les pommes, retirez le cœur et coupez-les en quartiers.",
      "Mettez-les dans le bol avec 50 ml d'eau, quelques gouttes de jus de citron et le sucre. Faites cuire 15 min à 100 °C vitesse 1.",
      "Pour une compote lisse, mixez 20 s vitesse 6. Pour une compote avec des morceaux, mixez 5 s vitesse 4.",
      "Laissez tiédir avant de servir, ou conservez 3 jours au réfrigérateur dans un récipient fermé.",
    ],
  }),
];

export const RECIPES_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((rec) => [rec.id, rec]));
