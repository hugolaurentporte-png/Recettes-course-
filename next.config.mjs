/** @type {import('next').NextConfig} */
// BASE_PATH sert à publier l'appli dans un sous-dossier (GitHub Pages : /recettes-course-).
const basePath = process.env.BASE_PATH || "";

const nextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
