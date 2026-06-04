import type { MetadataRoute } from "next";

const baseUrl = "https://vacaciones.cni.hn";

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
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
