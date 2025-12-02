export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/solicitudes/:path*",
    "/api/:path*"
  ]
};
