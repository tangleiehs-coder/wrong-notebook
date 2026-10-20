"use client";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionProvider } from "next-auth/react";
import { withBasePath } from "@/lib/base-path";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        // 部署在子路径下时，next-auth 客户端需要知道 API 的完整路径前缀。
        // next-auth v4 默认从 NEXTAUTH_URL 推导，但该变量不会内联到浏览器，
        // 因此这里显式传入。
        <SessionProvider basePath={withBasePath("/api/auth")}>
            <LanguageProvider>
                {children}
            </LanguageProvider>
        </SessionProvider>
    );
}
