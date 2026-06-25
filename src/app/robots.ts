import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vacaciones.cni.hn";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/api/",
          "/dashboard",
          "/usuarios",
          "/departamentos",
          "/asignacion-dias",
          "/reportes",
          "/reportes-departamento",
          "/exportar",
          "/auditoria",
          "/configuracion",
          "/mi-equipo",
          "/mi-perfil",
          "/solicitudes",
          "/aprobar-solicitudes",
          "/cambiar-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
