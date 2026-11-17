import type { Aisle } from "../domain/types";

/**
 * Produits courants du supermarché hors catalogue de recettes (non alimentaire compris).
 * Servent aux suggestions pendant la saisie, au rangement par rayon et à « Parcourir les rayons ».
 */
export const PRODUCTS: Record<Exclude<Aisle, "autres">, string[]> = {
  "fruits-legumes": [
    "Pommes", "Bananes", "Oranges", "Clémentines", "Kiwis", "Raisin", "Poires", "Citrons", "Avocats", "Tomates",
    "Carottes", "Pommes de terre", "Oignons", "Salade", "Concombre", "Courgettes", "Champignons", "Herbes fraîches",
  ],
  "viandes-poissons": [
    "Blancs de poulet", "Steaks hachés", "Jambon", "Lardons", "Saucisses", "Rôti de porc", "Escalopes de dinde",
    "Saumon", "Filets de cabillaud", "Crevettes", "Poisson pané",
  ],
  frais: [
    "Lait", "Œufs", "Beurre", "Yaourts", "Yaourts aux fruits", "Fromage râpé", "Crème fraîche", "Camembert", "Emmental",
    "Comté", "Mozzarella", "Skyr", "Petits suisses", "Crèmes dessert", "Compotes", "Pâte feuilletée", "Pâte brisée",
    "Pâte à pizza", "Pâtes fraîches", "Houmous", "Surimi", "Jus d'orange frais",
  ],
  epicerie: [
    "Pain", "Pain de mie", "Biscottes", "Brioche", "Céréales", "Muesli", "Flocons d'avoine", "Confiture", "Pâte à tartiner",
    "Miel", "Pâtes", "Riz", "Semoule", "Lentilles", "Farine", "Sucre", "Sel", "Poivre", "Huile d'olive", "Huile de tournesol",
    "Vinaigre", "Moutarde", "Mayonnaise", "Ketchup", "Sauce tomate", "Thon en boîte", "Maïs en boîte", "Haricots verts en boîte",
    "Petits pois en boîte", "Soupe", "Bouillon cube", "Épices", "Biscuits", "Gâteaux apéritif", "Chips", "Chocolat",
    "Bonbons", "Compotes en gourde", "Café", "Café en dosettes", "Thé", "Tisane", "Chocolat en poudre", "Lait en poudre",
  ],
  surgeles: [
    "Frites surgelées", "Pizza surgelée", "Légumes surgelés", "Épinards surgelés", "Poêlée surgelée", "Poisson surgelé",
    "Glaces", "Bâtonnets glacés", "Glaçons",
  ],
  boissons: [
    "Eau plate", "Eau gazeuse", "Jus de fruits", "Sirop", "Soda", "Limonade", "Thé glacé", "Bière", "Vin rouge", "Vin blanc",
    "Lait végétal",
  ],
  hygiene: [
    "Papier toilette", "Mouchoirs", "Dentifrice", "Brosses à dents", "Fil dentaire", "Bain de bouche", "Shampoing",
    "Après-shampoing", "Gel douche", "Savon", "Déodorant", "Crème hydratante", "Crème solaire", "Coton", "Cotons-tiges",
    "Rasoirs", "Mousse à raser", "Serviettes hygiéniques", "Tampons", "Protège-slips", "Démaquillant", "Pansements",
    "Paracétamol", "Sérum physiologique",
    "Couches", "Lingettes bébé", "Lait infantile", "Petits pots bébé", "Liniment",
  ],
  maison: [
    "Liquide vaisselle", "Pastilles lave-vaisselle", "Sel lave-vaisselle", "Liquide de rinçage", "Lessive", "Adoucissant",
    "Détachant", "Éponges", "Essuie-tout", "Sacs poubelle", "Nettoyant multi-usage", "Nettoyant WC", "Javel",
    "Vinaigre ménager", "Lingettes ménagères", "Produit vitres", "Papier aluminium", "Film alimentaire", "Papier cuisson",
    "Sacs congélation", "Boîtes de conservation", "Allumettes", "Bougies", "Piles", "Ampoules", "Gants de ménage",
    "Croquettes chat", "Croquettes chien", "Pâtée chat", "Pâtée chien", "Litière",
  ],
};

export const PRODUCT_AISLE: ReadonlyMap<string, Aisle> = new Map(
  (Object.entries(PRODUCTS) as [Aisle, string[]][]).flatMap(([aisle, names]) => names.map((n) => [n, aisle] as const)),
);

export const PRODUCT_NAMES: string[] = [...PRODUCT_AISLE.keys()];
