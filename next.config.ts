import type { NextConfig } from "next";

/**
 * 两个构建目标：
 *
 * - 默认（npm run build）：Cloudflare Worker。云端演示版，SSR + API routes，
 *   数据走内存 mock，发链接给人看。
 * - npm run build:static：静态预渲染。产物是 dist/client 下的一堆文件，
 *   可以由 unterm 直接托管（它已经有 /static/ 的资源托管机制）。同源之后
 *   浏览器直接调 unterm 的 /api/*，不需要本仓库的 API routes 中转，也不用
 *   再传 auth token。
 *
 * 静态版仍然是预渲染的完整首屏，不是白屏 SPA。
 */
const isStaticTarget = process.env.UNZOO_ONE_TARGET === "static";

/**
 * 不设 basePath：vinext 的预渲染在 basePath 下只导出得到 404。导出的 HTML
 * 因此用绝对路径引资源（/assets/…），由 unterm 那边兜住 —— 它的设置页走
 * /static/，两边不撞。
 */
const nextConfig: NextConfig = {
  ...(isStaticTarget ? { output: "export" as const } : {}),
};

export default nextConfig;
