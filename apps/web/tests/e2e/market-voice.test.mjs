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
const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dhaka" }).format(
  new Date(),
);

async function request(route, data, token) {
  const headers =
    data === undefined ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${api}${route}`, {
    method: data === undefined ? "GET" : "POST",
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert.ok(
    response.ok,
    `${route}: ${response.status} ${response.ok ? "" : await response.text()}`,
  );
  return response.json();
}

async function signIn(browser, identity, viewport) {
  const context = await browser.newContext({ colorScheme: "light", viewport });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByLabel("Account", { exact: true }).selectOption(identity);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.locator(".work-shell-signed").waitFor();
  return page;
}

async function open(scope, title) {
  const page = scope.page?.() ?? scope;
  const summary = scope.locator("summary").filter({ hasText: title });
  const button = scope.getByRole("button", { name: title, exact: true });
  await summary.or(button).first().waitFor();
  if (await summary.count()) {
    await summary.first().click();
    return summary.first().locator("xpath=..");
  }
  await button.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}

async function evidence(page, name) {
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
  const output = process.env.E2E_SCREENSHOT_DIR;
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, name),
      fullPage: name !== "pilot-price-outlook.png",
    });
  }
}

function marketCsv(name) {
  const rows = [
    "observed_on,published_on,district,market,price_type,grade,unit,kg_per_maund,low,high,source_url,source_record",
  ];
  for (let i = 0; i < 80; i++) {
    const date = new Date(Date.parse(day) - (79 - i) * 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    rows.push(
      `${date},${date},Pabna,${name},farmgate,A,kg,,${35 + (i % 11)},${39 + (i % 11)},https://example.invalid/e2e,FIXTURE-${i}`,
    );
  }
  return rows.join("\n");
}

test(
  "market review, outlook, advice, simulated acceptance and freight booking share persisted data",
  { timeout: 150_000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL,
    });
    try {
      const tag = Date.now().toString(36);
      const market = `Synthetic market ${tag}`;
      const lotName = `Voice pilot ${tag}`;
      const [farmer, buyer, admin] = await Promise.all([
        signIn(browser, "farmer", { width: 390, height: 844 }),
        signIn(browser, "buyer", { width: 1280, height: 900 }),
        signIn(browser, "admin", { width: 1280, height: 900 }),
      ]);
      // Meem's final UI enters the dialer through the floating chatbot.
      for (const page of [buyer, admin]) {
        await page
          .getByRole("button", { name: "Assistant Chatbot", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Voice Call Simulation", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Place Call", exact: true })
          .click();
        await page
          .getByRole("button", { name: "End Call", exact: true })
          .click();
      }
      const [farmerLogin, buyerLogin] = await Promise.all([
        request("/v1/auth/demo", { identity: "farmer" }),
        request("/v1/auth/demo", { identity: "buyer" }),
      ]);
      const lot = await request(
        "/v1/lots",
        {
          label: lotName,
          district: "Pabna",
          variety: `Taherpuri ${tag}`,
          storage_type: "Ventilated shed",
          harvest_on: day,
          stored_on: day,
          grade: "A",
          listed: true,
          quantity: "1000",
          unit: "kg",
          request_key: randomUUID(),
        },
        farmerLogin.token,
      );
      const setupOffer = await request(
        "/v1/offers",
        {
          lot_id: lot.id,
          quantity_kg: "200",
          price_bdt_kg: "45",
          delivery_district: "Dhaka",
          transport: "buyer",
          request_key: randomUUID(),
        },
        buyerLogin.token,
      );

      await admin.goto(`${base}/imports`);
      const upload = await open(admin, "Upload CSV");
      await upload.getByLabel("Import label").fill(market);
      await upload.getByLabel("CSV file").setInputFiles({
        name: "synthetic.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(marketCsv(market)),
      });
      await upload.getByLabel("Synthetic sample").check();
      await upload.getByRole("button", { name: "Submit for review" }).click();
      await admin
        .getByRole("heading", { name: "Review", exact: true })
        .waitFor();
      await admin.getByRole("button", { name: "Approve observations" }).click();
      await admin
        .getByText("approved · 80 rows · 0 duplicates", { exact: true })
        .waitFor();
      const series = (
        await request("/v1/market/series", undefined, farmerLogin.token)
      ).find((row) => row.market === market);
      assert.ok(series?.synthetic);
      await buyer.goto(`${base}/prices?series=${series.series}&horizon=14`);
      // Diagnostics are verified through the same API used by the redesigned chart.
      const forecast = await request(
        `/v1/market/forecasts?series=${series.series}&horizon=14`,
        undefined,
        farmerLogin.token,
      );
      assert.equal(forecast.horizon_days, 14);
      assert.equal(forecast.synthetic, true);
      await evidence(buyer, "pilot-price-outlook.png");

      await farmer.goto(`${base}/stock/${lot.id}/advice`);
      await farmer
        .getByLabel("Local farmgate series")
        .selectOption(series.series);
      await farmer.getByLabel("Active buyer offer").selectOption(setupOffer.id);
      await farmer.getByRole("button", { name: "Compare scenarios" }).click();
      await farmer
        .getByRole("heading", {
          name: "Insufficient evidence for a recommendation",
        })
        .waitFor();
      await farmer.getByText("৳9,000.00", { exact: true }).waitFor();

      await farmer.addInitScript(() => {
        window.SpeechRecognition = class {
          start() {
            queueMicrotask(() => {
              this.onresult({
                results: [[{ transcript: "অফার গ্রহণ ২০০ কেজি" }]],
              });
              this.onend();
            });
          }
          abort() {
            this.onend?.();
          }
        };
      });
      const call = await request("/v1/voice/calls", {}, farmerLogin.token);
      await farmer.goto(`${base}/voice/${call.id}`);
      await farmer
        .getByRole("heading", { name: "Enter or Select a Command" })
        .waitFor();
      await farmer
        .getByLabel("Typed Bangla utterance")
        .fill("offer accept korbo na");
      await farmer.getByRole("button", { name: "Check command" }).click();
      await farmer
        .getByRole("alert")
        .filter({
          hasText: "The command contained a negation, so nothing was staged.",
        })
        .waitFor();
      await farmer
        .getByRole("button", {
          name: "Speak Bangla (Tap to speak)",
          exact: true,
        })
        .click();
      await farmer
        .getByRole("status")
        .filter({ hasText: "Check the form before sending." })
        .waitFor();
      await farmer
        .getByRole("status")
        .filter({ hasText: "Understood: Accept offer · 200 kg." })
        .waitFor();
      assert.equal(
        await farmer.getByLabel("Typed Bangla utterance").inputValue(),
        "অফার গ্রহণ ২০০ কেজি",
      );
      assert.equal(
        await farmer.locator("input[name=tool]").inputValue(),
        "accept",
      );
      async function selectOffer() {
        await farmer.getByLabel("Offer", { exact: true }).click();
        await farmer.getByRole("option").filter({ hasText: lotName }).click();
      }
      await selectOffer();
      await farmer.getByRole("button", { name: "Send utterance" }).click();
      await farmer
        .getByRole("heading", { name: "Confirm the read-back" })
        .waitFor();
      await farmer.getByRole("button", { name: "Cancel this action" }).click();
      await farmer
        .getByRole("heading", { name: "Enter or Select a Command" })
        .waitFor();
      assert.equal(
        (await request(`/v1/lots/${lot.id}`, undefined, farmerLogin.token))
          .reserved_kg,
        "0.000",
      );
      await farmer
        .getByLabel("Typed Bangla utterance")
        .fill("200 kg offer accept koro");
      await farmer.getByRole("button", { name: "Check command" }).click();
      await farmer
        .getByRole("status")
        .filter({ hasText: "Understood: Accept offer · 200 kg." })
        .waitFor();
      await selectOffer();
      await farmer.getByRole("button", { name: "Send utterance" }).click();
      await farmer
        .getByRole("heading", { name: "Confirm the read-back" })
        .waitFor();
      const code = await farmer
        .getByText(/^Demo keypad code/)
        .locator("strong")
        .textContent();
      assert.match(code, /^[0-9]{4}$/);
      assert.equal(
        (await request(`/v1/lots/${lot.id}`, undefined, farmerLogin.token))
          .reserved_kg,
        "0.000",
      );
      await farmer
        .getByLabel("Four-digit confirmation")
        .fill(code.replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]));
      await farmer.getByRole("button", { name: "Confirm by keypad" }).click();
      const receipt = farmer.getByRole("link", {
        name: "View order",
        exact: true,
      });
      await receipt.waitFor();
      const orderPath = await receipt.getAttribute("href");
      await evidence(farmer, "pilot-voice-mobile.png");
      await buyer.goto(`${web}${orderPath}`);
      await buyer
        .getByRole("heading", { name: lotName, includeHidden: true })
        .waitFor({ state: "attached" });
      await buyer.goto(`${web}${orderPath}/logistics`);
      const transport = await open(buyer, "Request transport quotes");
      await transport.getByLabel("Handling instructions").fill("Bagged onions");
      await transport
        .getByRole("button", { name: "Submit quote request" })
        .click();
      await buyer.waitForURL((url) => !url.pathname.endsWith("/logistics"));
      await buyer.goto(`${web}${orderPath}/logistics`);
      await buyer.getByText("Quote requested", { exact: true }).waitFor();
      await admin.goto(`${web}${orderPath}/logistics`);
      const quote = await open(admin, "Record transporter quote");
      await quote
        .getByLabel("Transporter", { exact: true })
        .fill("Fictional pilot transporter");
      await quote.getByLabel("Quote reference").fill(`Fixture ${tag}`);
      await quote.getByLabel("Freight (BDT)").fill("450");
      await quote.getByLabel("Handling (BDT)").fill("50");
      await quote.getByRole("button", { name: "Save quote" }).click();
      await admin.getByText("৳9,500.00", { exact: true }).waitFor();
      await buyer.reload();
      const book = await open(buyer, "Choose this quote");
      await book
        .getByLabel("I checked the quoted price and pickup date.")
        .check();
      await book.getByRole("button", { name: "Confirm booking" }).click();
      await buyer.getByText("Booked", { exact: true }).first().waitFor();
      await evidence(buyer, "pilot-transport-quotes.png");
    } finally {
      await browser.close();
    }
  },
);
