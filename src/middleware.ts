import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { createLogger } from "@/lib/logger";
import { withBasePath } from "@/lib/base-path";

const logger = createLogger('middleware');

export async function middleware(req: NextRequest) {
    // Debug logging for middleware
    logger.debug({ method: req.method, path: req.nextUrl.pathname }, 'Processing request');

    try {
        const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: "next-auth.session-token", // Explicitly look for the standardized cookie
        });

        const isAuth = !!token;
        // 注意：req.nextUrl.pathname 已被 Next.js 剥离 basePath，
        // 因此这里的判断不需要（也不能）再拼 basePath。
        const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");
        const isAdminPage = req.nextUrl.pathname.startsWith("/admin");

        logger.debug({
            path: req.nextUrl.pathname,
            isAuth,
            isAuthPage,
            hasToken: !!token,
            cookies: req.cookies.getAll().map(c => c.name)
        }, 'Auth status');

        if (isAuthPage) {
            if (isAuth) {
                logger.debug('Redirecting authenticated user to /');
                return NextResponse.redirect(appUrl(req, "/"));
            }
            return null;
        }

        if (!isAuth) {
            // req.nextUrl.pathname 已被剥离 basePath，回跳地址需要自己补上前缀，
            // 否则 next-auth 会把用户送回域名根目录。
            let from = withBasePath(req.nextUrl.pathname);
            if (req.nextUrl.search) {
                from += req.nextUrl.search;
            }

            logger.debug({ callbackUrl: from }, 'Redirecting unauthenticated user to login');
            const loginUrl = appUrl(req, "/login");
            loginUrl.searchParams.set("callbackUrl", from);
            return NextResponse.redirect(loginUrl);
        }

        // Admin route protection: only allow users with admin role
        if (isAdminPage && token?.role !== "admin") {
            logger.warn({ userId: token?.id, path: req.nextUrl.pathname }, 'Non-admin user attempting to access admin area');
            return NextResponse.redirect(appUrl(req, "/"));
        }
    } catch (e) {
        logger.error({ error: e }, 'Error processing token');
        return NextResponse.next();
    }
}

/**
 * 构造应用的绝对地址。
 *
 * 不能直接用 req.nextUrl.clone()：Next.js 在未开启 experimental.trustHostHeader 时，
 * initURL 是用服务器自身的 hostname:port 拼的（反代场景下会变成 localhost:3000），
 * 导致重定向跳到错误域名。这里改为优先使用反代传来的真实 Host / 协议。
 *
 * @param pathname 应用内路径（不含 basePath），会由 withBasePath 补前缀
 */
function appUrl(req: NextRequest, pathname: string): URL {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const proto = forwardedProto
        ? forwardedProto.split(",")[0].trim()
        : (req.nextUrl.protocol === "https:" ? "https" : "http");

    const url = new URL(`${proto}://${host}${withBasePath(pathname)}`);
    return url;
}

export const config = {
    matcher: [
        /*
         * 第一条：应用根路径。
         * Next.js 会给每条 matcher 拼上 basePath 前缀，形如
         * /learnsmarter/:nextData(...)?/(|/?index|/?index\.json)?
         * 这条能精确匹配 basePath 根（/learnsmarter 与 /learnsmarter/），
         * 而下面那条通配规则要求 basePath 后必须跟斜杠，覆盖不到根路径。
         */
        "/",
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
