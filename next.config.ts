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
    "/**": [
      "./node_modules/.prisma/**",
      "./node_modules/@prisma/client/**",
      // The PDF stack is externalized (see serverExternalPackages) and loads
      // from node_modules at runtime - ship every package it can require.
      "./node_modules/pdfkit/**",
      "./node_modules/@noble/ciphers/**",
      "./node_modules/@noble/hashes/**",
      "./node_modules/fflate/**",
      "./node_modules/linebreak/**",
      "./node_modules/@react-pdf/**",
      "./node_modules/fontkit/**",
      "./node_modules/@babel/runtime/**",
      "./node_modules/object-assign/**",
      "./node_modules/prop-types/**",
      "./node_modules/queue/**",
      "./node_modules/is-url/**",
      "./node_modules/emoji-regex-xs/**",
      "./node_modules/yoga-layout/**",
      "./node_modules/bidi-js/**",
      "./node_modules/unicode-properties/**",
      "./node_modules/color-string/**",
      "./node_modules/hsl-to-hex/**",
      "./node_modules/media-engine/**",
      "./node_modules/postcss-value-parser/**",
      "./node_modules/jay-peg/**",
      "./node_modules/png-js/**",
      "./node_modules/@swc/helpers/**",
      "./node_modules/brotli/**",
      "./node_modules/clone/**",
      "./node_modules/dfa/**",
      "./node_modules/fast-deep-equal/**",
      "./node_modules/restructure/**",
      "./node_modules/tiny-inflate/**",
      "./node_modules/unicode-trie/**",
    ],
  },
  // pdfkit resolves its standard fonts through package "#"-imports that
  // bundlers cannot inline; keep the PDF stack external so the real packages
  // (which we ship via outputFileTracingIncludes) resolve everything.
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/font", "pdfkit", "fontkit"],
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
