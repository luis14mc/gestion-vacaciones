import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vacaciones CNI Honduras",
    short_name: "Vacaciones CNI",
    description:
      "Sistema de gestion de vacaciones, permisos y licencias para colaboradores de CNI Honduras.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#182243",
    lang: "es-HN",
    icons: [
      {
        src: "/assets/logo/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/logo/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
