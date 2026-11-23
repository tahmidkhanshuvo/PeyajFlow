import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const web = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:3000";
const api = process.env.E2E_API_ORIGIN ?? "http://127.0.0.1:8000";
const base = `${web}/en/workspace`;

test("Bangla signup shows confirmation and gates password sign-in", async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  try {
    const page = await browser.newPage({
      colorScheme: "light",
      viewport: { width: 390, height: 850 },
    });
    const username = `signup-${randomUUID()}`;
    const password = "  browser fixture passphrase  ";
    const suffix = BigInt(`0x${randomUUID().replaceAll("-", "")}`)
      .toString()
      .slice(-12);
    const bangla = (value) =>
      value.replace(/[0-9]/g, (digit) => "০১২৩৪৫৬৭৮৯"[digit]);
    await page.goto(`${web}/bn/workspace?mode=signup`);
    const signup = page
      .locator("form")
      .filter({ has: page.locator("input[name=nid]") });
    await signup.getByLabel("পুরো নাম").fill("Signup browser fixture");
    await signup.getByLabel("জেলা").fill("পাবনা");
    await signup.getByLabel("ভূমিকা").selectOption("farmer");
    const account = signup.getByLabel("অ্যাকাউন্ট আইডি");
    await account.fill("invalid account");
    assert.equal(
      await account.evaluate((input) => input.validity.patternMismatch),
      true,
    );
    await account.fill(username);
    await signup.getByLabel("পাসওয়ার্ড").fill(password);
    await signup.getByLabel("ফোন নম্বর (E.164)").fill(bangla(`+999${suffix}`));
    await signup.getByLabel("এনআইডি নম্বর").fill(bangla(`9${suffix}`));
    await signup.getByRole("button", { name: "নিবন্ধন করুন" }).click();
    await page.getByText("নিবন্ধন সফল।", { exact: false }).waitFor();
    await page.getByRole("link", { name: "English" }).click();
    await page
      .getByText("Registration successful.", { exact: false })
      .waitFor();
    const signIn = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Password sign-in" }),
    });
    await signIn.getByLabel("Account ID").fill(username);
    await signIn.getByLabel("Password", { exact: true }).fill(password);
    await signIn.getByRole("button", { name: "Sign in with password" }).click();
    await page
      .getByRole("alert")
      .filter({
        hasText: "Your account needs verification before you can sign in.",
      })
      .waitFor();
    await page.getByLabel("Account", { exact: true }).waitFor();
  } finally {
    await browser.close();
  }
});

async function post(route, data, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${api}/v1/${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  assert.ok(response.ok, `${route}: ${response.status}`);
  return response.json();
}

const reviewer = process.env.E2E_AGENT_USERNAME;
const reviewerPassword = process.env.E2E_AGENT_PASSWORD;

test(
  "verified agent approves and rejects registrations in the workspace",
  { skip: !reviewer || !reviewerPassword },
  async () => {
    const password = "new account browser fixture passphrase";
    const register = async (role) => {
      const id = randomUUID();
      const suffix = BigInt(`0x${id.replaceAll("-", "")}`)
        .toString()
        .slice(-12);
      const name = `Browser ${role} ${id}`;
      const username = `review-${id}`;
      await post("auth/signup", {
        name,
        username,
        password,
        district: "Pabna",
        phone: `+999${suffix}`,
        nid: `9${suffix}`,
        role,
      });
      return { name, username };
    };
    const farmer = await register("farmer");
    const buyer = await register("buyer");
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    });
    try {
      const demo = await signIn(browser, "agent", 390);
      assert.equal(
        await demo.getByRole("link", { name: "Signup verification" }).count(),
        0,
      );
      await demo.goto(`${base}/verifications`);
      await demo
        .getByRole("alert")
        .filter({
          hasText:
            "Sign in with a verified agent account to review registrations.",
        })
        .waitFor();
      await demo.getByRole("button", { name: "Sign out" }).waitFor();

      const page = await browser.newPage();
      await page.goto(`${base}/verifications`);
      assert.equal(
        await page.getByLabel("Account", { exact: true }).count(),
        0,
      );
      const signInForm = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Password sign-in" }),
      });
      await signInForm.getByLabel("Account ID").fill(reviewer);
      await signInForm
        .getByLabel("Password", { exact: true })
        .fill(reviewerPassword);
      await signInForm
        .getByRole("button", { name: "Sign in with password" })
        .click();
      await page.getByRole("link", { name: "Signup verification" }).waitFor();
      assert.equal(page.url(), `${base}/verifications`);
      await page
        .getByRole("heading", { name: "Signup verification" })
        .waitFor();
      await page.goto(`${base}/`);
      await page
        .getByRole("link", { name: "Review pending registrations" })
        .click();
      await page.waitForURL(`${base}/verifications`);
      await page.getByRole("link", { name: "বাংলা" }).click();
      await page.getByRole("link", { name: "নিবন্ধন যাচাই" }).click();
      await page.getByRole("heading", { name: "নিবন্ধন যাচাই" }).waitFor();
      const approved = page
        .getByRole("listitem")
        .filter({ hasText: farmer.name });
      await approved.getByText("নিবন্ধন পর্যালোচনা করুন", { exact: true }).click();
      await approved
        .getByLabel("সিদ্ধান্ত", { exact: true })
        .selectOption("true");
      await approved.getByRole("checkbox").check();
      await approved
        .getByRole("button", { name: "সিদ্ধান্ত সংরক্ষণ করুন" })
        .click();
      await page.waitForURL(`${web}/bn/workspace/verifications?saved=1`);
      await approved.waitFor({ state: "detached" });

      await page.getByRole("link", { name: "English" }).click();
      await page.goto(`${base}/verifications?offset=10001`);
      const rejected = page
        .getByRole("listitem")
        .filter({ hasText: buyer.name });
      await rejected.getByText("Review registration", { exact: true }).click();
      await rejected
        .getByLabel("Decision", { exact: true })
        .selectOption("false");
      await rejected
        .getByLabel("Reason (optional)")
        .fill("Browser rejection fixture");
      await rejected.getByRole("checkbox").check();
      await rejected.getByRole("button", { name: "Save decision" }).click();
      await page.waitForURL(`${base}/verifications?saved=1`);
      await rejected.waitFor({ state: "detached" });

      const farmerPage = await browser.newPage({
        colorScheme: "light",
        viewport: { width: 390, height: 844 },
      });
      await farmerPage.goto(`${web}/bn/workspace`);
      const farmerSignIn = farmerPage.locator("form").filter({
        has: farmerPage.locator('input[autocomplete="current-password"]'),
      });
      await farmerSignIn.getByLabel("অ্যাকাউন্ট আইডি").fill(farmer.username);
      await farmerSignIn.getByLabel("পাসওয়ার্ড", { exact: true }).fill(password);
      await farmerSignIn
        .getByRole("button", { name: "পাসওয়ার্ড দিয়ে সাইন ইন" })
        .click();
      await farmerPage.locator(".work-shell-signed").waitFor();
      await farmerPage
        .getByRole("button", { name: "সহকারী চ্যাটবট", exact: true })
        .click();
      const assistant = farmerPage.getByRole("button", {
        name: "ভয়েস কল শুরু করুন",
        exact: true,
      });
      await assistant.click();
      await farmerPage
        .getByRole("button", { name: "কল শুরু করুন", exact: true })
        .click();
      await farmerPage
        .getByRole("button", { name: "কল শেষ করুন", exact: true })
        .click();
      const blocked = await fetch(`${api}/v1/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: buyer.username, password }),
      });
      assert.equal(blocked.status, 403);
      assert.deepEqual(await blocked.json(), {
        detail: "account_not_verified",
      });
    } finally {
      await browser.close();
    }
  },
);

async function signIn(browser, identity, width) {
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width, height: 850 },
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByLabel("Account", { exact: true }).selectOption(identity);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.locator(".work-shell-signed").waitFor();
  return page;
}

async function checkScreen(page, file) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => [
      id,
      nodes.map(({ target }) => target),
    ]),
    [],
  );
  const output = process.env.RELEASE_SCREENSHOT_DIR;
  if (output && file) {
    await mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, file),
      fullPage: file === "completion-settlement-360.png",
    });
  }
}

test(
  "alerts, operations and offline states work across locales and viewport sizes",
  { timeout: 120_000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL,
    });
    try {
      const farmer = await signIn(browser, "farmer", 360);
      const admin = await signIn(browser, "admin", 1440);
      const buyer = await signIn(browser, "buyer", 1280);
      const { token: farmerToken } = await post("auth/demo", {
        identity: "farmer",
      });
      const { token: buyerToken } = await post("auth/demo", {
        identity: "buyer",
      });
      const day = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Dhaka",
      }).format(new Date());
      const label = `Release lot ${randomUUID().slice(0, 8)}`;
      const lot = await post(
        "lots",
        {
          label,
          district: "Pabna",
          variety: "Taherpuri",
          storage_type: "Ventilated shed",
          harvest_on: day,
          stored_on: day,
          grade: "A",
          listed: true,
          quantity: "1000",
          unit: "kg",
          request_key: randomUUID(),
        },
        farmerToken,
      );
      const offer = await post(
        "offers",
        {
          lot_id: lot.id,
          quantity_kg: "200",
          price_bdt_kg: "45.55",
          delivery_district: "Dhaka",
          transport: "buyer",
          request_key: randomUUID(),
        },
        buyerToken,
      );
      await farmer.goto(`${base}/alerts`);
      await farmer.getByRole("heading", { name: "Alerts" }).waitFor();
      const alert = farmer
        .locator("li")
        .filter({ has: farmer.locator(`a[href$="/offers/${offer.id}"]`) });
      await alert.getByRole("link", { name: "New offer received" }).waitFor();
      await checkScreen(farmer, "release-alerts-360.png");
      await alert
        .getByRole("button", { name: "Mark read", exact: true })
        .click();
      await alert.getByText("Read", { exact: true }).waitFor();
      await farmer.context().setOffline(true);
      const offline = farmer
        .getByRole("status")
        .filter({ hasText: "You are offline." });
      await offline.waitFor();
      await farmer.context().setOffline(false);
      await offline.waitFor({ state: "hidden" });
      await farmer.goto(`${base}/operations`);
      await farmer.waitForURL(base);
      assert.equal(
        await farmer
          .getByRole("navigation", { name: "Operations sections" })
          .count(),
        0,
      );

      const { order_id: order } = await post(
        `offers/${offer.id}/respond`,
        {
          version: offer.version,
          action: "accept",
          confirm: true,
          request_key: randomUUID(),
        },
        farmerToken,
      );
      for (const [action, token] of [
        ["dispatch", farmerToken],
        ["dispute", buyerToken],
      ]) {
        await post(
          `orders/${order}/transition`,
          { action, confirm: true, request_key: randomUUID() },
          token,
        );
      }

      await admin.goto(`${base}/operations`);
      await admin
        .getByRole("navigation", { name: "Operations sections" })
        .waitFor();
      await admin
        .getByRole("navigation", { name: "Operations sections" })
        .getByRole("link", { name: "Verifications" })
        .waitFor();
      await checkScreen(admin, "release-operations-1440.png");
      const sections = admin.getByRole("navigation", {
        name: "Operations sections",
      });
      await sections.getByRole("link", { name: "Photo model" }).click();
      await admin
        .getByRole("heading", { name: "Photo model and human review" })
        .waitFor();
      await admin.getByText("Comparable pairs", { exact: true }).waitFor();
      await checkScreen(admin);
      await sections.getByRole("link", { name: "Disputes" }).click();
      const dispute = admin
        .locator("li")
        .filter({ has: admin.locator(`a[href$="/orders/${order}"]`) });
      await dispute
        .locator("summary")
        .filter({ hasText: "Resolve dispute" })
        .click();
      await dispute
        .getByLabel("Operator note")
        .fill("Fictional release test resolution");
      await dispute.getByRole("checkbox").check();
      await dispute.getByRole("button", { name: "Save resolution" }).click();
      await dispute.waitFor({ state: "hidden" });
      await sections.getByRole("link", { name: "Audit" }).click();
      await admin.getByLabel("Event prefix").fill("order.");
      await admin.getByLabel("Record ID").fill(order);
      await admin.getByRole("button", { name: "Search events" }).click();
      await admin
        .getByText("order.dispute_resolved", { exact: true })
        .waitFor();
      assert.equal(
        await admin.getByText("Fictional release test resolution").count(),
        0,
      );
      await admin.setViewportSize({ width: 768, height: 950 });
      await admin.getByRole("link", { name: "বাংলা" }).click();
      await admin.getByRole("heading", { name: "নিরীক্ষার ইতিহাস" }).waitFor();
      assert.equal(await admin.locator("html").getAttribute("lang"), "bn");
      assert.equal(new URL(admin.url()).searchParams.get("resource_id"), order);
      await checkScreen(admin, "release-audit-bn-768.png");

      await buyer.goto(`${base}/orders/${order}`);
      await buyer
        .getByRole("button", { name: "Confirm receipt", exact: true })
        .click();
      const receive = buyer.getByRole("dialog");
      await receive.getByRole("checkbox").check();
      await receive.getByRole("button", { name: "Confirm receipt" }).click();
      const report = buyer
        .locator("details")
        .filter({ hasText: "Report off-platform payment" });
      await report.locator("summary").click();
      const reference = `FIXTURE-${randomUUID().slice(0, 8)}`;
      await report.getByLabel("Transaction reference").fill(reference);
      await report.getByRole("checkbox").check();
      await report
        .getByRole("button", { name: "Submit payment report" })
        .click();
      await buyer.getByText("Payment reported", { exact: true }).waitFor();
      await admin.goto(`${base}/operations?view=settlements`);
      await admin
        .getByRole("heading", { name: "Review payment reports" })
        .waitFor();
      const entry = admin.locator("li").filter({ hasText: reference });
      await entry.locator("summary").click();
      await entry.getByLabel("Review decision").selectOption("verified");
      await entry
        .getByLabel("Independent evidence reference")
        .fill("FIXTURE-INDEPENDENT-CHECK");
      await entry.getByRole("checkbox").check();
      await entry.getByRole("button", { name: "Save payment review" }).click();
      await entry.waitFor({ state: "hidden" });
      await farmer.goto(`${base}/orders/${order}`);
      await farmer
        .locator(".settlement-status-wrap:visible")
        .getByText("Payment verified", { exact: true })
        .waitFor();
      await checkScreen(farmer, "completion-settlement-360.png");

      const agent = await signIn(browser, "agent", 768);
      await agent.goto(`${base}/profile`);
      const accessId = await agent.locator(".profile-agent-code").textContent();
      const secondFarmer = await signIn(browser, "farmer-two", 390);
      await secondFarmer.goto(`${base}/agents`);
      await secondFarmer.getByLabel("Agent access ID").fill(accessId);
      await secondFarmer
        .getByLabel("I authorize this agent to access and assist with my lots.")
        .check();
      await secondFarmer.getByRole("button", { name: "Grant access" }).click();
      await secondFarmer.getByText(/Jalil/).waitFor();
      await agent.goto(`${base}/stock`);
      await agent
        .getByRole("button", { name: "Register a lot", exact: true })
        .click();
      const registration = agent.getByRole("dialog");
      await registration.getByLabel("Farmer who owns this lot").selectOption({
        label: await registration
          .getByRole("option", { name: /Salma/ })
          .textContent(),
      });
      const newLabel = `Delegated ${randomUUID().slice(0, 8)}`;
      await registration.getByLabel("Lot name").fill(newLabel);
      await registration.getByLabel("Variety").fill("Taherpuri");
      await registration.getByLabel("Storage type").fill("Ventilated shed");
      await registration.getByLabel("Quantity", { exact: true }).fill("100");
      await registration.getByRole("button", { name: "Save lot" }).click();
      await agent
        .getByRole("heading", { name: newLabel, includeHidden: true })
        .waitFor({ state: "attached" });
      const delegatedLot = new URL(agent.url()).pathname;
      await secondFarmer.goto(`${web}${delegatedLot}`);
      await secondFarmer
        .getByRole("heading", { name: newLabel, includeHidden: true })
        .waitFor({ state: "attached" });
      await secondFarmer.goto(`${web}${delegatedLot}/inspections`);
      const help = secondFarmer
        .locator("details")
        .filter({ hasText: "Request inspection help" });
      await help.locator("summary").click();
      const note = `Please inspect ${newLabel}`;
      await help.getByLabel("What help do you need?").fill(note);
      await help.getByRole("button", { name: "Send request" }).click();
      await secondFarmer.waitForURL(`${base}/help?saved=1`);
      // The final help screen presents the request form. Verify the retained
      // agent queue and resolution through its authorized API contract.
      const { token: agentToken } = await post("auth/demo", {
        identity: "agent",
      });
      const taskResponse = await fetch(`${api}/v1/voice/tasks`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      assert.equal(taskResponse.status, 200);
      const task = (await taskResponse.json()).find(
        (item) => item.note === note,
      );
      assert.ok(task?.can_resolve);
      assert.equal(
        (await post(`voice/tasks/${task.id}/resolve`, undefined, agentToken))
          .status,
        "resolved",
      );
      await secondFarmer.goto(`${base}/agents`);
      const revoke = secondFarmer
        .locator("details")
        .filter({ hasText: "Revoke access" });
      await revoke.locator("summary").click();
      await revoke.getByRole("checkbox").check();
      await revoke.getByRole("button", { name: "Confirm revocation" }).click();
      await secondFarmer.getByText("No active grants on this page.").waitFor();
      await agent.goto(`${web}${delegatedLot}`);
      await agent.getByText("This record was not found.").waitFor();
    } finally {
      await browser.close();
    }
  },
);
