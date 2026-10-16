import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prisma picks its query-engine binary at RUNTIME based on the host OS.
  // Trace-based bundling only captures the build-host engine, so explicitly
  // include every engine (needed when building on GitHub Actions Ubuntu and
  // running on Hostinger CloudLinux).
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/**", "./node_modules/@prisma/client/**"],
  },
  reactStrictMode: false,
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // NOTE: X-Frame-Options must NOT be set here - the sandbox preview
          // panel embeds this app in an iframe on a different origin.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Generated images are served from the same origin only
        source: "/generated/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
