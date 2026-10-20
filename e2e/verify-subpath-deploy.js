/**
 * 线上端到端验证：https://www.xn--11xzc.top/learnsmarter
 * 覆盖：未登录重定向、登录、登录后首页、API、静态资源、路由跳转、退出登录
 */
const { chromium } = require('playwright');

const BASE = 'https://www.xn--11xzc.top';
const APP = `${BASE}/learnsmarter`;
const results = [];

function record(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
    page.on('response', (r) => {
        if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    // 1. 访问根路径（未登录）应重定向到登录页
    try {
        await page.goto(APP, { waitUntil: 'networkidle', timeout: 45000 });
        record('访问应用根路径', page.url().includes('/learnsmarter'), `url=${page.url()}`);
        const needsLogin = page.url().includes('/login');
        record('未登录时跳转到登录页', needsLogin, `url=${page.url()}`);
        const cb = page.url().match(/callbackUrl=([^&]+)/);
        record('callbackUrl 带 basePath 前缀', !!cb && decodeURIComponent(cb[1]).startsWith('/learnsmarter'),
            cb ? decodeURIComponent(cb[1]) : 'none');
    } catch (e) {
        record('访问应用根路径', false, e.message);
    }

    // 2. 登录页渲染
    try {
        const title = await page.title();
        record('登录页标题', !!title, title);
        const hasEmail = await page.locator('input[type="email"], input[name="email"]').count();
        const hasPwd = await page.locator('input[type="password"]').count();
        record('登录表单渲染', hasEmail > 0 && hasPwd > 0, `email=${hasEmail} pwd=${hasPwd}`);
    } catch (e) {
        record('登录页渲染', false, e.message);
    }

    // 3. 执行登录
    try {
        await page.fill('input[type="email"], input[name="email"]', 'admin@localhost');
        await page.fill('input[type="password"]', '123456');
        await Promise.all([
            page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {}),
            page.click('button[type="submit"]'),
        ]);
        await page.waitForTimeout(2500);
        const loggedIn = !page.url().includes('/login');
        record('登录成功（跳离登录页）', loggedIn, `url=${page.url()}`);
    } catch (e) {
        record('登录成功（跳离登录页）', false, e.message);
    }

    // 4. 登录后首页功能
    try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        record('首页渲染出内容', bodyText.length > 50, `len=${bodyText.length}`);
        const hasNotebooksLink = await page.locator('a[href="/learnsmarter/notebooks"]').count();
        record('导航链接带 basePath', hasNotebooksLink > 0, `count=${hasNotebooksLink}`);
    } catch (e) {
        record('首页渲染出内容', false, e.message);
    }

    // 5. API 可用性（登录态）
    try {
        const api = await page.evaluate(async () => {
            const r = await fetch('/learnsmarter/api/notebooks');
            return { status: r.status, body: (await r.text()).slice(0, 200) };
        });
        record('API /api/notebooks 返回 200', api.status === 200, `status=${api.status} body=${api.body}`);
    } catch (e) {
        record('API /api/notebooks 返回 200', false, e.message);
    }

    // 6. 客户端路由跳转（点导航链接）
    try {
        const link = page.locator('a[href="/learnsmarter/notebooks"]').first();
        if (await link.count() > 0) {
            await link.click();
            await page.waitForTimeout(2000);
            record('客户端路由跳转到 /learnsmarter/notebooks',
                page.url().includes('/learnsmarter/notebooks'), `url=${page.url()}`);
        } else {
            record('客户端路由跳转到 /learnsmarter/notebooks', false, '未找到导航链接');
        }
    } catch (e) {
        record('客户端路由跳转到 /learnsmarter/notebooks', false, e.message);
    }

    // 7. 直接访问深层路由
    try {
        await page.goto(`${APP}/stats`, { waitUntil: 'networkidle', timeout: 30000 });
        const ok = page.url().includes('/learnsmarter/stats');
        record('直接访问 /learnsmarter/stats', ok, `url=${page.url()}`);
    } catch (e) {
        record('直接访问 /learnsmarter/stats', false, e.message);
    }

    // 8. 图标与 manifest
    try {
        const icon = await page.evaluate(async () => {
            const r = await fetch('/learnsmarter/icons/icon.png');
            return r.status;
        });
        record('图标 /learnsmarter/icons/icon.png', icon === 200, `status=${icon}`);
        const mf = await page.evaluate(async () => {
            const r = await fetch('/learnsmarter/manifest.webmanifest');
            return { status: r.status, body: (await r.text()).slice(0, 300) };
        });
        record('manifest 可访问且 start_url 带前缀',
            mf.status === 200 && mf.body.includes('/learnsmarter'), `status=${mf.status} ${mf.body.slice(0, 120)}`);
    } catch (e) {
        record('图标 /learnsmarter/icons/icon.png', false, e.message);
    }

    // 9. 退出登录
    try {
        await page.goto(APP, { waitUntil: 'networkidle', timeout: 30000 });
        const btn = page.locator('button:has-text("退出"), button:has-text("登出"), button[title*="退出"]').first();
        if (await btn.count() > 0) {
            await btn.click();
            await page.waitForTimeout(3000);
            record('退出登录回到登录页', page.url().includes('/login'), `url=${page.url()}`);
        } else {
            record('退出登录回到登录页', false, '未找到退出按钮');
        }
    } catch (e) {
        record('退出登录回到登录页', false, e.message);
    }

    // 10. 失败请求汇总
    const realFails = failedRequests.filter((f) => !f.includes('favicon'));
    record('无 4xx/5xx 请求', realFails.length === 0, realFails.slice(0, 5).join(' ; '));
    record('无控制台错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' ; '));

    await browser.close();

    const failed = results.filter((r) => !r.ok);
    console.log(`\n===== 结果：${results.length - failed.length}/${results.length} 通过 =====`);
    if (failed.length) {
        console.log('失败项：');
        failed.forEach((f) => console.log(`  - ${f.name} | ${f.detail}`));
    }
    process.exit(failed.length ? 1 : 0);
})();
