import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const web = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:3000";
const api = process.env.E2E_API_ORIGIN ?? "http://127.0.0.1:8000";

async function session(browser, role, locale = "en", width = 1280, timezoneId) {
  const result = await fetch(`${api}/v1/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: role }),
  });
  assert.equal(result.status, 201);
  const { token } = await result.json();
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    timezoneId,
  });
  await context.addCookies([
    {
      name: "peyajflow_session",
      value: token,
      url: web,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  return { page, context, base: `${web}/${locale}/workspace`, token };
}

async function check(page, filename) {
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((row) => ({
      id: row.id,
      targets: row.nodes.map((node) => node.target),
    })),
    [],
  );
  if (process.env.E2E_SCREENSHOT_DIR) {
    await mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.E2E_SCREENSHOT_DIR, filename),
      fullPage: true,
    });
  }
}

test(
  "sourced help, revocable integration credentials and bilingual mobile tools",
  { timeout: 180000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    });
    try {
      const { page, context, base } = await session(browser, "farmer");
      await page.goto(`${base}/help`);
      await page
        .getByLabel("Your question", { exact: true })
        .fill("How do I accept an offer?");
      await page.getByRole("button", { name: "Find a sourced answer" }).click();
      await page
        .getByText("Answer with sources", { exact: true })
        .waitFor({ timeout: 30000 });
      assert.ok(await page.locator(".knowledge-answer a").count());
      await check(page, "knowledge-desktop.png");
      await page.locator(".knowledge-answer a").first().click();
      await page
        .getByText("Source edition", { exact: false })
        .first()
        .waitFor();
      await page.goto(`${base}/profile`);
      const label = `E2E ${randomUUID()}`;
      const panel = page.locator("section").filter({
        has: page.getByRole("heading", {
          name: "Integration access",
          exact: true,
        }),
      });
      await panel.getByLabel("Label", { exact: true }).fill(label);
      await panel
        .getByRole("button", { name: "Create token", exact: true })
        .click();
      await panel
        .getByText("This token is shown once. Copy it to secure storage.", {
          exact: true,
        })
        .waitFor();
      const created = panel.locator("article").filter({ hasText: label });
      await created.getByRole("button", { name: "Revoke token" }).click();
      await created.getByText("Revoked", { exact: true }).waitFor();
      await page.goto(`${base}/prices`);
      await page.locator(".data-chart").first().waitFor();
      await check(page, "price-charts-desktop.png");
      await context.close();
      const mobile = await session(browser, "farmer", "bn", 390);
      await mobile.page.goto(`${mobile.base}/help`);
      await mobile.page
        .getByLabel("আপনার প্রশ্ন", { exact: true })
        .fill("মণে কত কেজি conversion");
      await mobile.page
        .getByRole("button", { name: "উৎসসহ উত্তর দেখুন" })
        .click();
      await mobile.page
        .getByText("উৎসসহ উত্তর", { exact: true })
        .waitFor({ timeout: 30000 });
      await check(mobile.page, "knowledge-bn-mobile.png");
      await mobile.page.goto(`${mobile.base}/insights`);
      await check(mobile.page, "tools-bn-mobile.png");
      await mobile.context.close();
    } finally {
      await browser.close();
    }
  },
);

test(
  "operator investigation interrupts for note review and automation runs through the web",
  { timeout: 180000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    });
    try {
      const { page, context, base } = await session(browser, "admin");
      await page.goto(`${base}/insights`);
      const question = `Check forecast freshness ${randomUUID()}`;
      await page
        .getByLabel("What should be checked?", { exact: true })
        .fill(question);
      await page
        .getByRole("button", { name: "Investigate", exact: true })
        .click();
      const run = page.locator("article").filter({
        has: page.getByRole("heading", { name: question, exact: true }),
      });
      await run
        .getByRole("button", { name: "Approve note", exact: true })
        .waitFor({ timeout: 80000 });
      await run
        .getByRole("button", { name: "Approve note", exact: true })
        .click();
      await run.getByText("Status: approved", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Check freshness", exact: true })
        .click();
      await page
        .getByText(/freshness · .*Notices:/)
        .first()
        .waitFor();
      await check(page, "operator-tools-desktop.png");
      await context.close();
    } finally {
      await browser.close();
    }
  },
);

test(
  "the dialer opens a real scoped session and spoken-help form stays read-only",
  { timeout: 120000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    });
    try {
      const { page, context, token } = await session(
        browser,
        "farmer",
        "en",
        1280,
        "America/New_York",
      );
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(`${web}/en/call-simulator`);
      await page
        .getByRole("button", { name: "Place Call", exact: true })
        .click();
      await page.waitForURL(/\/call-simulator\/[0-9a-f-]{36}$/);
      await page
        .getByRole("heading", { name: "Ask PeyajFlow", exact: true })
        .waitFor();
      await page
        .getByLabel("Your question", { exact: true })
        .fill("How do I accept an offer?");
      await page.getByRole("button", { name: "Find a sourced answer" }).click();
      await page.getByText("Answer with sources", { exact: true }).waitFor();
      const id = new URL(page.url()).pathname.split("/").at(-1);
      const result = await fetch(`${api}/v1/voice/calls/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(result.status, 200);
      assert.equal((await result.json()).entries.length, 0);
      assert.deepEqual(pageErrors, []);
      await check(page, "dialer-sourced-help.png");
      await fetch(`${api}/v1/voice/calls/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await context.close();
    } finally {
      await browser.close();
    }
  },
);
