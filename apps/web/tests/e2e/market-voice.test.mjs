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
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByLabel("Account", { exact: true }).selectOption(identity);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
  return page;
}

async function open(scope, title) {
  const summary = scope.locator("summary").filter({ hasText: title });
  await summary.click();
  return summary.locator("xpath=..");
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
      await buyer
        .locator(".workspace-nav, nav")
        .getByRole("link", { name: "Bangla assistant" })
        .click();
      await buyer.getByRole("button", { name: "Start simulated call" }).click();
      await buyer.getByRole("heading", { name: "Enter a command" }).waitFor();
      await buyer.getByRole("button", { name: "End call" }).click();
      await admin
        .locator(".workspace-nav, nav")
        .getByRole("link", { name: "Bangla assistant" })
        .click();
      await admin.getByRole("button", { name: "Start simulated call" }).click();
      await admin.getByRole("heading", { name: "Enter a command" }).waitFor();
      await admin.getByRole("button", { name: "End call" }).click();
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

      await admin
        .getByRole("navigation")
        .getByRole("link", { name: "Market imports" })
        .click();
      const upload = await open(admin, "Upload CSV");
      await upload.getByLabel("Import label").fill(market);
      await upload.getByLabel("CSV file").setInputFiles({
        name: "synthetic.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(marketCsv(market)),
      });
      await upload.getByLabel("Synthetic sample").check();
      await upload.getByRole("button", { name: "Submit for review" }).click();
      await admin.getByRole("heading", { name: market }).waitFor();
      await admin.getByRole("button", { name: "Approve observations" }).click();
      await admin
        .getByText("approved · 80 rows · 0 duplicates", { exact: true })
        .waitFor();
      const series = (
        await request("/v1/market/series", undefined, farmerLogin.token)
      ).find((row) => row.market === market);
      assert.ok(series?.synthetic);
      await buyer.goto(`${base}/prices?series=${series.series}&horizon=14`);
      await buyer.getByRole("heading", { name: "Price outlook" }).waitFor();
      await buyer
        .getByRole("heading", { name: "Price model preview" })
        .waitFor();
      await open(buyer, "Historical backtest");
      await buyer.getByText("WAPE", { exact: true }).waitFor();
      await buyer.getByRole("cell", { name: "Price pattern model" }).waitFor();
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
      await farmer.goto(`${base}/voice`);
      await farmer
        .getByRole("button", { name: "Start simulated call" })
        .click();
      await farmer.getByRole("heading", { name: "Enter a command" }).waitFor();
      await farmer
        .getByLabel("Typed Bangla utterance")
        .fill("offer accept korbo na");
      await farmer.getByRole("button", { name: "Check command" }).click();
      await farmer
        .getByText("The command contained a negation, so nothing was staged.", {
          exact: false,
        })
        .waitFor();
      await farmer.getByRole("button", { name: "Speak Bangla" }).click();
      await farmer.getByText("Review the transcript before sending.").waitFor();
      await farmer.getByText("Understood: Accept offer · 200 kg.").waitFor();
      assert.equal(
        await farmer.getByLabel("Typed Bangla utterance").inputValue(),
        "অফার গ্রহণ ২০০ কেজি",
      );
      assert.equal(
        await farmer.locator("select[name=tool]").inputValue(),
        "accept",
      );
      const offered = farmer
        .locator("select[name=offer] option")
        .filter({ hasText: lotName });
      await farmer
        .locator("select[name=offer]")
        .selectOption(await offered.getAttribute("value"));
      await farmer.getByRole("button", { name: "Send utterance" }).click();
      await farmer
        .getByRole("heading", { name: "Confirm the read-back" })
        .waitFor();
      await farmer.getByRole("button", { name: "Cancel this action" }).click();
      await farmer.getByRole("heading", { name: "Enter a command" }).waitFor();
      assert.equal(
        (await request(`/v1/lots/${lot.id}`, undefined, farmerLogin.token))
          .reserved_kg,
        "0.000",
      );
      await farmer
        .getByLabel("Typed Bangla utterance")
        .fill("200 kg offer accept koro");
      await farmer.getByRole("button", { name: "Check command" }).click();
      await farmer.getByText("Understood: Accept offer · 200 kg.").waitFor();
      await farmer
        .locator("select[name=offer]")
        .selectOption(await offered.getAttribute("value"));
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
      await buyer.getByRole("heading", { name: "Order receipt" }).waitFor();
      await buyer.getByRole("link", { name: "Transport and quotes" }).click();
      const transport = await open(buyer, "Request transport quotes");
      await transport.getByLabel("Handling instructions").fill("Bagged onions");
      await transport
        .getByRole("button", { name: "Submit quote request" })
        .click();
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
