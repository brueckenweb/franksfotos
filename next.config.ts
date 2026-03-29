import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Uploads bis 500 MB erlauben (Fotos: 50 MB, Videos: 500 MB)
      bodySizeLimit: "500mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // pics.frank-sellke.de als externe Bildquelle erlauben
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pics.frank-sellke.de",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      // Locale-Redirects abfangen (vom Browser oder anderen Projekten gecacht)
      {
        source: "/de",
        destination: "/",
        permanent: false,
      },
      {
        source: "/de/:path*",
        destination: "/:path*",
        permanent: false,
      },
      {
        source: "/en",
        destination: "/",
        permanent: false,
      },
      {
        source: "/en/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
