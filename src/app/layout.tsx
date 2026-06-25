import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import QueryProvider from "@/providers/QueryProvider";
import MaintenanceGate from "@/components/MaintenanceGate";
import PasswordChangeGate from "@/components/PasswordChangeGate";
import { Toaster } from "sileo";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vacaciones.cni.hn"
  ),
  applicationName: "Vacaciones CNI",
  title: {
    default: "Vacaciones CNI Honduras | Gestion de Vacaciones",
    template: "%s | Vacaciones CNI",
  },
  description:
    "Sistema de gestion de vacaciones, permisos y licencias para colaboradores de CNI Honduras.",
  keywords: [
    "Vacaciones CNI",
    "CNI Honduras",
    "gestion de vacaciones",
    "solicitudes de vacaciones",
    "permisos laborales",
    "recursos humanos",
  ],
  authors: [{ name: "CNI Honduras" }],
  creator: "CNI Honduras",
  publisher: "CNI Honduras",
  alternates: {
    canonical: "/login",
    languages: {
      "es-HN": "/login",
    },
  },
  openGraph: {
    type: "website",
    locale: "es_HN",
    url: "/login",
    siteName: "Vacaciones CNI",
    title: "Vacaciones CNI Honduras | Gestion de Vacaciones",
    description:
      "Portal interno para gestionar vacaciones, permisos y licencias de colaboradores de CNI Honduras.",
    images: [
      {
        url: "/assets/logo/logo.png",
        width: 1200,
        height: 630,
        alt: "Vacaciones CNI Honduras",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Vacaciones CNI Honduras | Gestion de Vacaciones",
    description:
      "Portal interno para gestionar vacaciones, permisos y licencias de CNI Honduras.",
    images: ["/assets/logo/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/assets/logo/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/assets/logo/logo.png",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": 160,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": 160,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-HN">
      <body className="antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
        >
          Saltar al contenido principal
        </a>
        <QueryProvider>
          <AuthProvider session={null}>
            <MaintenanceGate>
              <PasswordChangeGate>{children}</PasswordChangeGate>
            </MaintenanceGate>
          </AuthProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
