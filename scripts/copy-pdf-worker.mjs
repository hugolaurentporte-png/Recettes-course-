// Copie le « worker » de pdf.js dans public/ pour lire les tickets PDF (hors connexion compris).
import { copyFileSync } from "node:fs";
copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
