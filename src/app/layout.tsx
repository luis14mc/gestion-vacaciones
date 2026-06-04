import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "sileo";

export const metadata: Metadata = {
  metadataBase: new URL("https://vacaciones.cni.hn"),
  applicationName: "Vacaciones CNI",
  title: {
    default: "Vacaciones CNI Honduras",
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
  },
  openGraph: {
    type: "website",
    locale: "es_HN",
    url: "/login",
    siteName: "Vacaciones CNI",
    title: "Vacaciones CNI Honduras",
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
    title: "Vacaciones CNI Honduras",
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
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
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
        <QueryProvider>
          <AuthProvider session={null}>{children}</AuthProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
