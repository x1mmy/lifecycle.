/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  basePath: '/app',
  trailingSlash: false,
  // Ensure assets are served correctly from the /app path
  assetPrefix: '/app',
  // Optional: Add redirect for development consistency
  async redirects() {
    return [
      {
        source: '/',
        destination: '/app',
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default config;
