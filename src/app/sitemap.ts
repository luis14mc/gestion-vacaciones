import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vacaciones.cni.hn";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/login`,
      lastModified: new Date("2026-06-18"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
