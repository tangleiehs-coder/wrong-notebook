/**
 * 部署在子路径下时（例如 https://example.com/learnsmarter），Next.js 的
 * `basePath` 会自动处理 next/link、router.push、_next 静态资源等，
 * 但以下位置不会自动带上 basePath，需要显式处理：
 *
 *  1. 代码中手写的 fetch('/api/xxx') —— 必须加前缀
 *  2. next-auth 的 NEXTAUTH_URL —— 由 next-auth 自己从环境变量推导
 *  3. middleware 中对 req.nextUrl.pathname 的判断
 *
 * 本模块提供统一的 basePath 读取与路径拼接工具。
 */

/** 部署的子路径，例如 '/learnsmarter'。根路径部署时为空字符串。 */
export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || '');

function normalizeBasePath(value: string): string {
    if (!value || value === '/') return '';
    let result = value.startsWith('/') ? value : `/${value}`;
    // 去掉结尾多余的斜杠
    result = result.replace(/\/+$/, '');
    return result;
}

/**
 * 给路径加上 basePath 前缀。
 *
 * - 已经是绝对 URL（http:// / https://）或非字符串，原样返回
 * - 已经带 basePath 前缀的，不重复添加
 * - 原本以 / 开头的路径（/api/xxx），加前缀后变成 /learnsmarter/api/xxx
 */
export function withBasePath(path: string): string {
    if (!path || !BASE_PATH) return path;
    // 绝对 URL 不处理
    if (/^https?:\/\//i.test(path)) return path;
    if (path === BASE_PATH) return path;
    if (path.startsWith(`${BASE_PATH}/`)) return path;
    if (!path.startsWith('/')) return path;
    return `${BASE_PATH}${path}`;
}

/**
 * 从 pathname 中去掉 basePath 前缀。
 * middleware 中 req.nextUrl.pathname 在部分 Next 版本下仍带 basePath，
 * 判断路径归属时需要先剥离。
 */
export function stripBasePath(pathname: string): string {
    if (!BASE_PATH) return pathname;
    if (pathname === BASE_PATH) return '/';
    if (pathname.startsWith(`${BASE_PATH}/`)) {
        return pathname.slice(BASE_PATH.length);
    }
    return pathname;
}
