import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* WhatsApp y Facebook necesitan la imagen de vista previa con URL completa.
   Se toma de SITE_URL (si la defines) o del dominio de producción que Vercel
   entrega al compilar. Si no hay ninguno, esas etiquetas se omiten. */
function siteMeta() {
  const site = (
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "")
  ).replace(/\/+$/, "");
  return {
    name: "site-meta",
    transformIndexHtml(html) {
      if (!site) return html.replace(/\s*<meta[^>]*__SITE_URL__[^>]*>/g, "");
      return html.replaceAll("__SITE_URL__", site);
    },
  };
}

export default defineConfig({
  plugins: [react(), siteMeta()],
});
