import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const origin = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:3000";
const base = `${origin}/en/workspace`;
const output = process.env.E2E_SCREENSHOT_DIR;

async function signIn(browser, identity, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByLabel("Account", { exact: true }).selectOption(identity);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
  assert.equal(
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "peyajflow_session",
    )?.httpOnly,
    true,
  );
  return page;
}

async function open(scope, text) {
  const summary = scope.locator("summary").filter({ hasText: text });
  await summary.click();
  return summary.locator("xpath=..");
}

async function checkViewport(page, filename) {
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
    result.violations.map(({ id, nodes }) => [
      id,
      nodes.map(({ target }) => target),
    ]),
    [],
  );
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, filename),
      fullPage: true,
    });
  }
}

test(
  "farmer, buyer and agent share the persisted pilot workflow",
  { timeout: 150_000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL,
    });
    try {
      const suffix = Date.now().toString(36);
      const lotName = `Pilot lot ${suffix}`;
      const variety = `Taherpuri ${suffix}`;
      const farmer = await signIn(browser, "farmer", {
        width: 390,
        height: 844,
      });
      const buyer = await signIn(browser, "buyer", {
        width: 1280,
        height: 900,
      });
      const agent = await signIn(browser, "agent", {
        width: 1280,
        height: 900,
      });

      await farmer
        .getByRole("navigation")
        .getByRole("link", { name: "My stock" })
        .click();
      const register = await open(farmer, "Register a lot");
      await register.getByLabel("Lot name").fill(lotName);
      await register.getByLabel("Variety").fill(variety);
      await register.getByLabel("Storage type").fill("Ventilated shed");
      await register.getByLabel("Grade", { exact: true }).selectOption("A");
      await register.getByLabel("List this lot for buyers").check();
      await register.getByLabel("Quantity", { exact: true }).fill("২৫");
      await register.getByLabel("Unit", { exact: true }).selectOption("maund");
      await register.getByRole("button", { name: "Save lot" }).click();
      const error = register.getByRole("alert");
      await error.waitFor();
      assert.equal(
        await error.textContent(),
        "Enter kg per maund when using maunds.",
      );
      assert.equal(await register.getByLabel("Lot name").inputValue(), lotName);
      await register.getByLabel("If using maunds, kg per maund").fill("৪০");
      await register.getByRole("button", { name: "Save lot" }).click();
      await farmer.getByRole("heading", { name: lotName }).waitFor();
      const lotPath = new URL(farmer.url()).pathname;
      assert.match(lotPath, /\/stock\/[0-9a-f-]+$/);
      await farmer.getByText("Initial quantity · 1,000 kg").waitFor();

      await agent.goto(`${origin}${lotPath}`);
      const verify = await open(agent, "Verify measured stock");
      await verify.getByLabel("Verified kg").fill("900");
      await verify.getByRole("button", { name: "Save verification" }).click();
      await agent.getByText("900 kg", { exact: true }).waitFor();

      await buyer
        .getByRole("navigation")
        .getByRole("link", { name: "Demand" })
        .click();
      const demand = await open(buyer, "Create a demand");
      await demand.getByLabel("Quantity needed (kg)").fill("200");
      await demand.getByLabel("Variety").fill(variety);
      await demand.getByLabel("Minimum grade").selectOption("B");
      const delivery = await demand
        .getByLabel("Earliest delivery date")
        .inputValue();
      await demand.getByLabel("Latest delivery date").fill(delivery);
      await demand.getByLabel("Maximum price (BDT/kg), optional").fill("50");
      await demand.getByRole("button", { name: "Save demand" }).click();
      await buyer
        .getByRole("heading", { name: `${variety} · 200 kg` })
        .waitFor();
      await buyer
        .locator("article")
        .filter({ hasText: variety })
        .getByRole("link", { name: "Find matching supply" })
        .click();
      await buyer.getByRole("heading", { name: "Browse supply" }).waitFor();
      const eligible = buyer.locator("article").filter({ hasText: variety });
      await eligible.getByText("Verified", { exact: true }).waitFor();
      const offer = await open(eligible, "Make an offer");
      assert.equal(
        await offer.getByLabel("Quantity (kg)").inputValue(),
        "200.000",
      );
      await offer.getByLabel("Price (BDT/kg)").fill("45");
      await offer.getByRole("button", { name: "Send offer" }).click();
      await buyer
        .getByRole("heading", { name: "Offers", exact: true })
        .waitFor();
      await buyer
        .locator("article")
        .filter({ hasText: lotName })
        .getByText("Sent", { exact: true })
        .waitFor();
      await buyer
        .locator("article")
        .filter({ hasText: lotName })
        .getByRole("link", { name: "Offer history" })
        .click();
      await buyer.getByRole("heading", { name: "Offer history" }).waitFor();
      await buyer.getByText("200 kg · ৳45.00/kg", { exact: true }).waitFor();

      await farmer
        .getByRole("navigation")
        .getByRole("link", { name: "Offers" })
        .click();
      const incoming = farmer.locator("article").filter({ hasText: lotName });
      const accept = await open(incoming, "Accept offer");
      await accept
        .getByLabel("I reviewed the terms and confirm the stock reservation.")
        .check();
      await accept.getByRole("button", { name: "Accept offer" }).click();
      await farmer.getByRole("heading", { name: "Order receipt" }).waitFor();
      const orderPath = new URL(farmer.url()).pathname;
      await buyer.goto(`${origin}${orderPath}`);
      await buyer.getByRole("heading", { name: "Order receipt" }).waitFor();
      assert.equal(
        await buyer.getByText("৳9,000.00", { exact: true }).count(),
        1,
      );
      await checkViewport(buyer, "pilot-order-desktop.png");
      await farmer.goto(`${origin}${lotPath}`);
      await farmer.getByText("800 kg", { exact: true }).waitFor();
      await farmer.getByText("200 kg", { exact: true }).first().waitFor();

      await farmer.getByRole("link", { name: "Storage risk" }).click();
      await farmer
        .getByRole("heading", { name: "Insufficient evidence" })
        .waitFor();
      await farmer.getByRole("link", { name: "View inspections" }).click();
      const inspection = await open(farmer, "New inspection");
      await inspection
        .getByLabel("Curing", { exact: true })
        .selectOption("cured");
      await inspection
        .getByLabel("Ventilation", { exact: true })
        .selectOption("poor");
      await inspection
        .getByLabel("Surface moisture", { exact: true })
        .selectOption("dry");
      await inspection
        .getByLabel("Odor", { exact: true })
        .selectOption("normal");
      await inspection
        .getByLabel("Uncertain evidence", { exact: true })
        .check();
      const png = await farmer.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 960;
        const context = canvas.getContext("2d");
        const pixels = context.createImageData(canvas.width, canvas.height);
        let state = 3155912;
        for (let index = 0; index < pixels.data.length; index += 1) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          pixels.data[index] = index % 4 === 3 ? 255 : (state >>> 0) % 64;
        }
        context.putImageData(pixels, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      const buffer = Buffer.from(png, "base64");
      assert.ok(
        buffer.length <= 3 * 1024 * 1024 && buffer.length * 2 > 3_000_000,
      );
      await inspection.getByLabel("2–4 photos, up to 3 MiB each").setInputFiles(
        ["overview.png", "closeup.png"].map((name) => ({
          name,
          mimeType: "image/png",
          buffer,
        })),
      );
      await inspection
        .getByLabel(
          "I consent to storing these photos for authorized inspection and review.",
        )
        .check();
      await farmer.evaluate(() => {
        const originalFetch = window.fetch;
        window.inspectionPayload = new Promise((resolve) => {
          window.fetch = function (input, init) {
            if (new Headers(init?.headers).has("next-action")) {
              window.fetch = originalFetch;
              resolve(new Request(input, init).arrayBuffer());
            }
            return originalFetch.call(window, input, init);
          };
        });
      });
      await inspection
        .getByRole("button", { name: "Submit inspection" })
        .click();
      await farmer
        .getByText("Photo quality check · Uncertain evidence")
        .waitFor();
      assert.ok(
        await farmer.evaluate(
          async () => (await window.inspectionPayload).byteLength < 3_050_000,
        ),
      );
      const image = farmer.getByRole("img", { name: "Inspection photo 1" });
      await image.waitFor();
      const photoUrl = await image.getAttribute("src");
      assert.equal(
        (await farmer.request.get(`${origin}${photoUrl}`)).status(),
        200,
      );
      assert.equal(
        (await buyer.request.get(`${origin}${photoUrl}`)).status(),
        403,
      );
      await agent.goto(`${origin}${lotPath}/inspections`);
      const review = await open(agent, "Review photos");
      await review.getByLabel("Visible rot or mold", { exact: true }).check();
      await review.getByLabel("Reason").fill("Fictional pilot review");
      await review.getByRole("button", { name: "Save review" }).click();
      await agent.getByText("Human review", { exact: true }).first().waitFor();

      await farmer.goto(`${origin}${lotPath}/risk`);
      await farmer.getByRole("heading", { name: "High concern" }).waitFor();
      await farmer.getByText("Visible rot or mold was reported.").waitFor();
      await farmer.getByRole("link", { name: "বাংলা" }).click();
      await farmer.waitForURL((url) => url.pathname.startsWith("/bn/"));
      assert.equal(await farmer.locator("html").getAttribute("lang"), "bn");
      await farmer.getByRole("heading", { name: "উচ্চ সতর্কতা" }).waitFor();
      await checkViewport(farmer, "pilot-risk-mobile.png");
      // A second inspection with clear photos reaches the photo model. A
      // fixed-result worker stands in for the downloaded CLIP model, so this
      // checks that suggestions are kept and shown to reviewers, not accuracy.
      await farmer.route("**/condition-model.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: `self.onmessage = ({ data }) => self.postMessage({
            id: data.id,
            result: "sprouting",
            scores: { rot: 0.05, sprouting: 0.8, damage: 0.05, clear: 0.05, uncertain: 0.05 },
            model: "Xenova/clip-vit-base-patch32@6b7c523703ae26e39be4b03774966f8571c7f523",
            rule: "clip-margin-v1",
          });`,
        }),
      );
      await farmer.goto(`${origin}${lotPath}/inspections`);
      const bright = await farmer.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 480;
        const context = canvas.getContext("2d");
        const pixels = context.createImageData(canvas.width, canvas.height);
        let state = 7919;
        for (let index = 0; index < pixels.data.length; index += 1) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          pixels.data[index] =
            index % 4 === 3 ? 255 : 64 + ((state >>> 0) % 128);
        }
        context.putImageData(pixels, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      const second = await open(farmer, "New inspection");
      await second.getByLabel("Curing", { exact: true }).selectOption("cured");
      await second
        .getByLabel("Ventilation", { exact: true })
        .selectOption("good");
      await second
        .getByLabel("Surface moisture", { exact: true })
        .selectOption("dry");
      await second.getByLabel("Odor", { exact: true }).selectOption("normal");
      await second.getByLabel("Uncertain evidence", { exact: true }).check();
      await second.getByLabel("2–4 photos, up to 3 MiB each").setInputFiles(
        ["shed.png", "bulbs.png"].map((name) => ({
          name,
          mimeType: "image/png",
          buffer: Buffer.from(bright, "base64"),
        })),
      );
      await second
        .getByLabel(
          "I consent to storing these photos for authorized inspection and review.",
        )
        .check();
      await second.getByRole("button", { name: "Submit inspection" }).click();
      await farmer
        .getByText("Photo quality check · Human review needed")
        .waitFor();
      await farmer
        .getByRole("button", { name: "Analyze visible condition" })
        .first()
        .click();
      await farmer
        .getByText(/Possible sprouting\. Top score 80% · Saved/)
        .waitFor();
      await farmer.reload();
      await farmer
        .getByText(/Possible sprouting\. Top score 80% · Saved/)
        .waitFor();
      await agent.goto(`${origin}${lotPath}/inspections`);
      // The newest inspection is listed first.
      const hinted = agent
        .locator("details")
        .filter({ has: agent.locator("summary", { hasText: "Review photos" }) })
        .first();
      await hinted.locator("summary").click();
      await hinted
        .getByText("Saved AI suggestions are hints only", { exact: false })
        .waitFor();
      assert.equal(
        await hinted.getByLabel("Sprouting", { exact: true }).isChecked(),
        false,
      );
      await farmer.goto(base);
      await farmer.getByRole("button", { name: "Sign out" }).click();
      await farmer
        .getByRole("heading", { name: "Sign in", exact: true })
        .waitFor();
      assert.equal(
        (await farmer.context().cookies()).some(
          (cookie) => cookie.name === "peyajflow_session",
        ),
        false,
      );
    } finally {
      await browser.close();
    }
  },
);
