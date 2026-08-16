import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mandiri (server.js) untuk dijalankan sebagai satu service di
  // Docker/Cloud Run — melayani UI + API sekaligus.
  output: "standalone",
};

export default nextConfig;

