/**
 * `cloudflare:workers` 的最小类型声明。
 *
 * 这个虚拟模块由 Worker 运行时提供，没有随包发布的类型（项目没装
 * @cloudflare/workers-types）。db/index.ts 和 app/api/unterm/route.ts 都要用它，
 * 声明在这里，免得每处各报一个 TS2307。
 */
declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & {
    DB?: D1Database;
  };
}
