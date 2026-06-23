/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode is disabled here to avoid GitHub request thrash in dev: the
  // viewer fires upstream patch fetches on mount, and double-invoked effects
  // would double those requests.
  reactStrictMode: false,
  reactCompiler: true,
  devIndicators: false,
  experimental: {
    cssChunking: 'strict',
  },
};

export default nextConfig;
