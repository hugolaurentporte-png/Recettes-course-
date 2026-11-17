import { notFound } from "next/navigation";
import { RECIPES, RECIPES_BY_ID } from "@/lib/data/recipes";
import { RecipeDetail } from "./RecipeDetail";

export function generateStaticParams() {
  return RECIPES.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: RECIPES_BY_ID.get(id)?.title ?? "Recette" };
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!RECIPES_BY_ID.has(id)) notFound();
  return <RecipeDetail id={id} />;
}
