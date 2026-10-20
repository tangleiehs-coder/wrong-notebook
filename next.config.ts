import type { NextConfig } from "next";

/**
 * 子路径部署支持（如 https://example.com/learnsmatter）。
 *
 * basePath 由 NEXT_PUBLIC_BASE_PATH 环境变量决定，部署在根路径时留空即可。
 * Next.js 会自动处理 next/link、router.push、_next 静态资源与 API 路由前缀；
 * 代码中手写的 fetch('/api/xxx') 需要用 @/lib/base-path 的 withBasePath() 处理。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: basePath || undefined,
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;
