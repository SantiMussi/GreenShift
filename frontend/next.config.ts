import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Todo se sirve local: sin fuentes ni imágenes remotas.
  images: { unoptimized: true },
};

export default nextConfig;
