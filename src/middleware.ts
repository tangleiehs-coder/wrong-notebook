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
                return NextResponse.redirect(rootUrl(req));
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
            // 部署在子路径下时，重定向地址必须带上 basePath，
            // 否则会跳到域名根目录去。用 req.nextUrl.clone() 让 Next 自动补前缀。
            const loginUrl = req.nextUrl.clone();
            loginUrl.pathname = "/login";
            loginUrl.search = "";
            loginUrl.searchParams.set("callbackUrl", from);
            return NextResponse.redirect(loginUrl);
        }

        // Admin route protection: only allow users with admin role
        if (isAdminPage && token?.role !== "admin") {
            logger.warn({ userId: token?.id, path: req.nextUrl.pathname }, 'Non-admin user attempting to access admin area');
            return NextResponse.redirect(rootUrl(req));
        }
    } catch (e) {
        logger.error({ error: e }, 'Error processing token');
        return NextResponse.next();
    }
}

/** 构造应用根路径的绝对地址（自动带 basePath 前缀） */
function rootUrl(req: NextRequest): URL {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return url;
}

export const config = {
    matcher: [
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
