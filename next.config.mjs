/** @type {import('next').NextConfig} */
const nextConfig = {
  // ============================================================
  // STANDALONE MODE (Optimización para EC2)
  // ============================================================
  // Genera un bundle autocontenido sin node_modules (~800MB → ~120MB).
  // El output se ubica en .next/standalone/server.js
  output: 'standalone',

  // Compresión gzip nativa en Next.js (reduce tráfico de red)
  compress: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // ============================================================
  // SECURITY HEADERS (OWASP / ISO 27001)
  // ============================================================
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // ============================================================
  // OPTIMIZACIÓN DE IMÁGENES
  // ============================================================
  images: {
    // Formatos modernos más ligeros
    formats: ['image/avif', 'image/webp'],
    // Limitar tamaños generados para ahorrar disco y RAM en build
    deviceSizes: [640, 750, 1080, 1920],
    imageSizes: [16, 32, 48, 64, 96],
    // Caché de imágenes optimizadas por 60 días
    minimumCacheTTL: 5184000,
  },

  // ============================================================
  // OPTIMIZACIÓN DE WEBPACK (Producción)
  // ============================================================
  webpack: (config, { isServer }) => {
    // Reducir fragmentación de chunks del cliente
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Agrupar librerías grandes en un solo chunk compartido
          vendor: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'vendor',
            chunks: 'all',
            priority: 20,
          },
          // Agrupar componentes UI (Radix, Lucide)
          ui: {
            test: /[\\/]node_modules[\\/](radix-ui|lucide-react|class-variance-authority)[\\/]/,
            name: 'ui-vendor',
            chunks: 'all',
            priority: 15,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
