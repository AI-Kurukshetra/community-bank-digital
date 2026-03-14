/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === "development";
const isVercel = process.env.VERCEL === "1";
const distDir =
  process.env.NEXT_DIST_DIR ||
  (isDevelopment ? ".next-dev" : isVercel ? ".next" : ".next-build");
const imageRemotePatterns = [];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const { hostname, port, protocol } = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );

    imageRemotePatterns.push({
      hostname,
      pathname: "/storage/v1/object/**",
      ...(port ? { port } : {}),
      protocol: protocol.replace(":", "")
    });
  } catch {
    // Ignore invalid image host configuration during local setup.
  }
}

const nextConfig = {
  // Keep dev and production artifacts isolated so local dev does not
  // collide with builds or running `next start` processes. Vercel's
  // Next.js builder expects the default production output directory.
  distDir,
  images:
    imageRemotePatterns.length > 0
      ? {
          remotePatterns: imageRemotePatterns
        }
      : undefined,
  reactStrictMode: true
};

export default nextConfig;
