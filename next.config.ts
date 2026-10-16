import type { NextConfig } from "next";
import { securityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    const env = process.env.NODE_ENV === "production" ? "production" : "development";
    const all = securityHeaders(env);
    const isCsp = (h: { key: string }) => h.key === "Content-Security-Policy";
    return [
      // Every route: the fixed headers.
      { source: "/(.*)", headers: all.filter((h) => !isCsp(h)) },
      // API routes: the static strict CSP. Pages get a nonce CSP from middleware.ts.
      { source: "/api/:path*", headers: all.filter(isCsp) },
    ];
  },
};

export default nextConfig;
