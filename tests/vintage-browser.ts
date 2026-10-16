/** Local-only verification. Starts its own server; never contacts staging/production. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import lambdaChromium from "@sparticuz/chromium";
import { encode } from "next-auth/jwt";
import { DEFAULT_VINTAGE_CONTENT } from "../src/lib/vintage/content";
async function main() {
  const screenshotDir = path.resolve("test-results/vintage");
  await mkdir(screenshotDir, { recursive: true });
  const baseURL = "http://127.0.0.1:3107";
  const secret = "vintage-local-verification-secret-not-for-deployment";
  const admin = "wvanderlaan@gmail.com";
  const bannerHeight = process.env.VINTAGE_TEST_ENV === "production" ? 0 : 28;
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--port",
      "3107",
      "--hostname",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: baseURL,
        ADMIN_EMAIL: "other-admin@example.invalid",
        VERCEL_ENV: process.env.VINTAGE_TEST_ENV || "preview",
        VINTAGE_HOMEPAGE_ENABLED: "true",
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require ${path.resolve("tests/fixtures/vintage-network-stubs.cjs")}`,
        APP_ENV: process.env.VINTAGE_TEST_ENV || "preview",
        VINTAGE_DATABASE_URL: "",
        DEV_AUTH_BYPASS: "false",
        NEXT_PUBLIC_DEV_AUTH_BYPASS: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverLog = "";
  server.stdout.on("data", (d) => {
    serverLog += d;
  });
  server.stderr.on("data", (d) => {
    serverLog += d;
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch(baseURL + "/api/auth/session");
        if (r.ok) break;
      } catch {
        /* Wait for the local server. */
      }
      if (i === 89) throw new Error("Local server did not start.");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    browser =
      process.env.VINTAGE_BROWSER === "webkit"
        ? await webkit.launch(
            process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
              ? {
                  executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH,
                }
              : {},
          )
        : await chromium.launch(
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
              ? {
                  executablePath:
                    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
                  args: lambdaChromium.args,
                  headless: true,
                }
              : { headless: true },
          );
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      timezoneId: "America/Chicago",
    });
    // Keep local verification independent of external integrations.
    await context.route("**/*", (route) =>
      route.request().url().startsWith(baseURL)
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(baseURL + "/", { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("legacy-homepage").count(), 1);
    assert.equal(await page.getByTestId("vintage-homepage").count(), 0);
    assert.equal(await page.locator('[data-testid^="home-view-"]').count(), 0);
    assert.equal((await page.request.get(baseURL + "/vintage")).status(), 404);
    assert.equal(
      (await page.request.get(baseURL + "/vintage/admin")).status(),
      404,
    );
    assert.equal(
      (await page.request.get(baseURL + "/vintage/admin/preview")).status(),
      404,
    );
    assert.equal(
      (
        await page.request.get(baseURL + "/api/admin/vintage-homepage")
      ).status(),
      403,
    );
    assert.equal(
      (
        await page.request.get(baseURL + "/api/admin/vintage-homepage/media")
      ).status(),
      403,
    );
    await page.goto(baseURL + "/?view=new", { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("legacy-homepage").count(), 1);
    const ordinaryToken = await encode({
      secret,
      token: {
        email: "ordinary-user@example.invalid",
        name: "A participant",
        sub: "ordinary-user",
      },
    });
    await context.addCookies([
      { name: "next-auth.session-token", value: ordinaryToken, url: baseURL },
    ]);
    await page.goto(baseURL + "/", { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("legacy-homepage").count(), 1);
    assert.equal((await page.request.get(baseURL + "/vintage")).status(), 404);
    assert.equal(
      (
        await page.request.get(baseURL + "/api/admin/vintage-homepage")
      ).status(),
      403,
    );
    const primaryToken = await encode({
      secret,
      token: {
        email: admin,
        name: "Warren",
        sub: "local-primary-admin",
        id: "local-primary-admin",
      },
    });
    await context.addCookies([
      { name: "next-auth.session-token", value: primaryToken, url: baseURL },
    ]);
    requests.length = 0;
    await page.goto(baseURL + "/", { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("legacy-homepage").count(), 0);
    assert.equal(await page.getByTestId("vintage-homepage").count(), 1);
    assert.equal(await page.locator('[data-testid^="home-view-"]').count(), 0);
    const primaryResponse = await page.request.get(baseURL + "/");
    assert.match(primaryResponse.headers()["cache-control"] || "", /no-store/);
    assert.ok(
      (await primaryResponse.text()).includes('data-testid="vintage-homepage"'),
    );
    console.log(
      "PASS home selection: anonymous users keep the original homepage; only the authenticated primary email receives the new homepage; no toggles or query overrides",
    );
    await page.goto(baseURL + "/vintage", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByTestId("vintage-homepage").count(), 1);
    assert.equal(await page.getByTestId("vintage-promotion-1").count(), 1);
    assert.equal(await page.getByTestId("vintage-promotion-2").count(), 1);
    for (const index of [1, 2]) {
      assert.equal(
        await page.getByTestId(`vintage-download-link-${index}`).count(),
        0,
      );
      assert.ok(
        (
          await page.getByTestId(`vintage-download-${index}`).textContent()
        )?.includes("Download coming soon."),
      );
    }
    assert.equal(
      requests.some((url) => /site-config|google\.com\/spreadsheets/.test(url)),
      false,
      "Vintage must not load Sheets config",
    );
    await page.screenshot({
      path: path.join(screenshotDir, "desktop.png"),
      fullPage: true,
    });
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        `Overflow at ${width}px`,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      const nameplate = page.getByTestId("vintage-masthead");
      await page.waitForFunction(() => {
        const title = document.querySelector(".v-nameplate");
        const line = document.querySelector(".v-nameplate-line");
        if (!title || !line) return false;
        const box = title.getBoundingClientRect();
        const ink = line.getBoundingClientRect();
        return ink.width > 0 && ink.right <= box.right + 1;
      });
      const mastheadFonts = await nameplate
        .locator(".v-nameplate-line > span")
        .evaluateAll((parts) =>
          parts.map((part) => ({
            family: getComputedStyle(part).fontFamily,
            size: getComputedStyle(part).fontSize,
          })),
        );
      assert.equal(mastheadFonts.length, 2);
      assert.deepEqual(
        mastheadFonts[0],
        mastheadFonts[1],
        "Entire masthead must use one font and size",
      );
      assert.ok(mastheadFonts[0].family.includes("Alfa Slab One"));
      const letterBounds = await nameplate
        .locator(".v-nameplate-line")
        .boundingBox();
      const containerBounds = await nameplate.boundingBox();
      assert.ok(letterBounds && containerBounds && letterBounds.width > 0);
      assert.ok(
        letterBounds.x >= containerBounds.x - 1 &&
          letterBounds.x + letterBounds.width <=
            containerBounds.x + containerBounds.width + 1,
        "Visible masthead lettering must fit its container",
      );
      const heading = await nameplate.boundingBox();
      const clock = await page
        .getByTestId("vintage-countdown-section")
        .boundingBox();
      const hero = await page.locator(".v-hero").boundingBox();
      assert.ok(heading && clock && hero);
      assert.ok(
        clock.y >= heading.y + heading.height - 1 && clock.y < hero.y,
        "Countdown belongs between masthead and hero",
      );
      assert.equal(
        await page.getByTestId("vintage-toolbar").getByRole("link").count(),
        6,
      );
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForFunction(() => window.scrollY >= 650);
      const toolbar = await page.getByTestId("vintage-toolbar").boundingBox();
      const scrolledHeading = await nameplate.boundingBox();
      assert.ok(toolbar && scrolledHeading);
      if (width <= 900) {
        assert.ok(
          Math.abs(toolbar.y - bannerHeight) <= 1,
          `Mobile toolbar must stick below the environment banner at ${width}px`,
        );
        assert.ok(
          scrolledHeading.y + scrolledHeading.height < bannerHeight,
          "Mobile masthead should scroll away",
        );
        assert.ok(toolbar.height <= 52, "Mobile toolbar should stay narrow");
      } else {
        const header = await page.getByTestId("vintage-header").boundingBox();
        assert.ok(
          header && Math.abs(header.y - bannerHeight) <= 1,
          "Combined desktop header must stick",
        );
        assert.ok(
          scrolledHeading.y >= bannerHeight,
          "Desktop masthead stays with navigation",
        );
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const title = document
        .querySelector(".v-nameplate")
        ?.getBoundingClientRect();
      const line = document
        .querySelector(".v-nameplate-line")
        ?.getBoundingClientRect();
      return title && line && line.width > 0 && line.right <= title.right + 1;
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(screenshotDir, "mobile.png"),
      fullPage: true,
    });
    console.log(
      "PASS primary-admin homepage: responsive desktop/mobile, two promotions, pending workbooks, no Sheets requests",
    );
    if (process.env.VINTAGE_PUBLIC_ONLY === "true") {
      assert.equal(errors.length, 0, errors.join("\n"));
      await context.close();
      return;
    }
    const outsider = await encode({
      secret,
      token: {
        email: "other-admin@example.invalid",
        name: "wvanderlaan",
        sub: "outsider",
      },
    });
    await context.addCookies([
      { name: "next-auth.session-token", value: outsider, url: baseURL },
    ]);
    assert.equal(
      (
        await page.request.get(baseURL + "/api/admin/vintage-homepage")
      ).status(),
      403,
    );
    console.log(
      "PASS authorization: another configured administrator cannot read private homepage drafts",
    );
    assert.equal((await page.request.get(baseURL + "/vintage")).status(), 404);
    assert.equal(
      (await page.request.get(baseURL + "/vintage/admin")).status(),
      404,
    );
    assert.equal(
      (await page.request.get(baseURL + "/vintage/admin/preview")).status(),
      404,
    );
    assert.equal(
      (
        await page.request.get(baseURL + "/api/admin/vintage-homepage/media")
      ).status(),
      403,
    );
    await page.goto(baseURL + "/", { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("legacy-homepage").count(), 1);
    assert.equal(await page.getByTestId("vintage-homepage").count(), 0);
    assert.equal(await page.locator('[data-testid^="home-view-"]').count(), 0);
    console.log(
      "PASS isolation: another configured admin named wvanderlaan receives only the original homepage and cannot open vintage routes or APIs, after a primary-admin request",
    );
    requests.length = 0;
    const token = await encode({
      secret,
      token: {
        email: admin,
        name: "Local Test Admin",
        sub: "vintage-local-test",
        id: "vintage-local-test",
      },
    });
    await context.addCookies([
      { name: "next-auth.session-token", value: token, url: baseURL },
    ]);
    await page.goto(baseURL + "/vintage", { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("vintage-admin-tools").count(), 1);
    assert.equal(
      await page.getByTestId("vintage-signin").getAttribute("href"),
      "/vintage/admin",
    );
    assert.equal(
      await page.getByTestId("vintage-admin-edit").getAttribute("href"),
      "/vintage/admin",
    );
    console.log(
      "PASS homepage admin controls: visible only to signed-in administrator; account icon opens dedicated editor",
    );
    const csrfResponse = await page.request.get(baseURL + "/api/csrf-token");
    const { csrfToken } = await csrfResponse.json();
    const noCSRF = await page.request.post(
      baseURL + "/api/admin/vintage-homepage",
      {
        data: { action: "save", version: 0, content: DEFAULT_VINTAGE_CONTENT },
      },
    );
    assert.equal(noCSRF.status(), 403);
    const missingDownloads = await page.request.post(
      baseURL + "/api/admin/vintage-homepage",
      {
        headers: { "x-csrf-token": csrfToken },
        data: {
          action: "publish",
          version: 0,
          content: DEFAULT_VINTAGE_CONTENT,
        },
      },
    );
    assert.equal(missingDownloads.status(), 503);
    assert.match(
      (await missingDownloads.json()).error,
      /storage is not configured/i,
    );
    const saveWithoutStorage = await page.request.post(
      baseURL + "/api/admin/vintage-homepage",
      {
        headers: { "x-csrf-token": csrfToken },
        data: { action: "save", version: 0, content: DEFAULT_VINTAGE_CONTENT },
      },
    );
    assert.equal(saveWithoutStorage.status(), 503);
    console.log(
      "PASS API: CSRF required, pending workbooks pass publication validation, unavailable database cannot silently save",
    );
    await page.goto(baseURL + "/vintage/admin", {
      waitUntil: "networkidle",
    });
    assert.equal(
      await page.getByTestId("vintage-save-draft").isDisabled(),
      true,
    );
    console.log(
      "PASS editor: authenticated access and honest storage-unavailable state",
    );
    // UI contract tests use mocked storage; no database or remote account is touched.
    let doc = structuredClone(DEFAULT_VINTAGE_CONTENT);
    let version = 0;
    const actions: string[] = [];
    await page.route("**/api/admin/vintage-homepage", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        doc = body.content;
        actions.push(body.action);
        version++;
      }
      await route.fulfill({
        json: {
          storageReady: true,
          state: { version, draft: doc, published: doc, revisions: [] },
        },
      });
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("vintage-hero-headline").fill("A NEW FRONT PAGE.");
    await page.getByTestId("vintage-save-draft").click();
    await page.getByRole("status").waitFor();
    assert.equal(actions[0], "save");
    assert.equal(doc.hero.headline, "A NEW FRONT PAGE.");
    await page.getByTestId("vintage-tab-1").click();
    const countdownDate = page.getByLabel("Countdown date and time", {
      exact: true,
    });
    assert.equal(await countdownDate.getAttribute("type"), "datetime-local");
    await page.getByTestId("vintage-tournament-countdownEnabled").check();
    await countdownDate.fill("2027-03-18T11:00");
    await page.getByTestId("vintage-save-draft").click();
    await page.getByRole("status").waitFor();
    assert.equal(doc.tournament.countdownEnabled, true);
    assert.equal(doc.tournament.countdownAt, "2027-03-18T16:00:00.000Z");
    assert.equal(await countdownDate.inputValue(), "2027-03-18T11:00");
    assert.ok(
      (
        await page.locator("#vintage-countdown-timezone").textContent()
      )?.includes("America/Chicago"),
    );
    await page.getByTestId("vintage-publish").click();
    await page.getByRole("status").waitFor();
    assert.equal(actions.at(-1), "publish");
    assert.equal(doc.downloads[0].href, "");
    assert.equal(doc.downloads[1].href, "");
    assert.equal(doc.tournament.countdownEnabled, true);
    await page.getByTestId("vintage-tab-2").click();
    await page.getByTestId("vintage-news-add").click();
    assert.equal(
      await page.getByTestId("vintage-announcements-1-headline").count(),
      1,
    );
    await page.getByTestId("vintage-tab-4").click();
    await page
      .getByTestId("vintage-promotions-0-headline")
      .fill("A property to remember.");
    await page.getByTestId("vintage-tab-5").click();
    await page
      .getByTestId("vintage-downloads-0-href")
      .fill("https://example.invalid/picks.xlsx");
    await page
      .getByTestId("vintage-downloads-1-href")
      .fill("https://example.invalid/tracker.xlsx");
    await page.getByTestId("vintage-publish").click();
    await page.getByRole("status").waitFor();
    assert.equal(actions.at(-1), "publish");
    assert.equal(doc.promotions[0].headline, "A property to remember.");
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByTestId("vintage-tab-0").click();
    await page.screenshot({
      path: path.join(screenshotDir, "editor.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      "Editor overflow on mobile",
    );
    await page.screenshot({
      path: path.join(screenshotDir, "editor-mobile.png"),
      fullPage: true,
    });
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS editor UI: edit lead story, save draft, add dispatch, edit promotion, configure downloads, publish (mocked storage contract)",
    );
    await context.close();
  } catch (error) {
    console.error(serverLog.slice(-10000));
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
