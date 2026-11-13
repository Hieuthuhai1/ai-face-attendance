import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Giữ RSC payload đã prefetch trong client cache. Mặc định dynamic = 0s
    // khiến mỗi lần click/prefetch lại phải round-trip server (đo được ~20
    // request _rsc mỗi lần vào trang).
    staleTimes: {
      dynamic: 15,
      static: 300,
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Local face matcher đọc model từ filesystem trong serverless function.
  outputFileTracingIncludes: {
    "/**": ["./public/models/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
