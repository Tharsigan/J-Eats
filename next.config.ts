import type { NextConfig } from "next";

// Food photos uploaded through the Flask API are stored as "/media/menu/<file>".
// Proxy that path to Flask so <Image> can load them from this site.
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api").origin;
  } catch {
    return "http://localhost:5000";
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [{ source: "/media/:path*", destination: `${API_ORIGIN}/api/media/:path*` }];
  },
};

export default nextConfig;
