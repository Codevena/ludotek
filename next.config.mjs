/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["ssh2", "cpu-features", "unzipper"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.igdb.com" },
      { protocol: "https", hostname: "**.steamgriddb.com" },
    ],
  },
};

export default nextConfig;
