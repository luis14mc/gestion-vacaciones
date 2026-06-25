import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import LoginClient from "./LoginClient";

const title = "Portal de Vacaciones CNI Honduras";
const description =
  "Accede al sistema de gestion de vacaciones, permisos y licencias para colaboradores de CNI Honduras.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vacaciones.cni.hn";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title,
    description,
    url: "/login",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function LoginPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Vacaciones CNI Honduras",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${siteUrl}/login`,
    description,
    publisher: {
      "@type": "Organization",
      name: "CNI Honduras",
      url: siteUrl,
      logo: `${siteUrl}/assets/logo/logo.png`,
    },
    inLanguage: "es-HN",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            <span className="sr-only">Cargando...</span>
          </div>
        }
      >
        <LoginClient />
      </Suspense>
    </>
  );
}
