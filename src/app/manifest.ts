import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plataforma Makários",
    short_name: "Makários",
    description:
      "Ambiente digital de apoio ao ensino e à gestão acadêmica da Escola Makários, Igreja Emaús.",
    start_url: "/",
    display: "standalone",
    background_color: "#2e7fbf",
    theme_color: "#2e7fbf",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
