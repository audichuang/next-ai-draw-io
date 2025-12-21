import type { NextConfig } from "next"
import packageJson from "./package.json"

const nextConfig: NextConfig = {
    /* config options here */
    output: "standalone",
    env: {
        APP_VERSION: packageJson.version,
    },
    // Allow embedding in iframes for embed mode (e.g., from Docmost)
    async headers() {
        return [
            {
                // Apply to all routes when accessed with ?embed=true
                source: "/:path*",
                headers: [
                    // X-Frame-Options removed to allow cross-origin iframe embedding
                    // CSP frame-ancestors below handles iframe security instead
                    {
                        // Use Content-Security-Policy frame-ancestors for better control
                        // In production, restrict to specific origins
                        key: "Content-Security-Policy",
                        value: process.env.ALLOWED_ORIGINS
                            ? `frame-ancestors 'self' ${process.env.ALLOWED_ORIGINS}`
                            : "frame-ancestors *",
                    },
                ],
            },
        ]
    },
}

export default nextConfig
