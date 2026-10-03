/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Same-origin proxy: the browser calls /api/* on whatever host served the
  // page, Next.js forwards it server-side to the api container over the
  // compose network. Keeps the app CORS-free and tunnel-friendly; a single
  // public URL (ngrok, etc.) covers both the UI and the API.
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://api:7860/api/:path*" }];
  },
};

export default nextConfig;
