import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.ts": {
        condition: { path: /mcp-server\/src\/tools\/[^/]+\.ts$/ },
        loaders: ["./src/lib/mcp/local-imports.cjs"],
        as: "*.ts",
      },
    },
  },
};

export default nextConfig;
