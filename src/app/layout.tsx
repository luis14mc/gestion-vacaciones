import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "sileo";

export const metadata: Metadata = {
  title: "Sistema Vacaciones CNI",
  description: "Gestión de vacaciones con Next.js + Neon + Drizzle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider session={null}>
            {children}
          </AuthProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
