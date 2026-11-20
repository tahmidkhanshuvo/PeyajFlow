import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

function origin(name, fallback) {
  const url = new URL(process.env[name] ?? fallback);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  assert.ok(
    (url.protocol === "https:" || (loopback && url.protocol === "http:")) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    `${name} requires an HTTPS origin or HTTP loopback.`,
  );
  return url;
}

const api = origin("SMOKE_API_ORIGIN", "http://127.0.0.1:8000");
const web = origin("SMOKE_WEB_ORIGIN", "http://127.0.0.1:3000");
const get = (host, path, init, timeout = 10_000) =>
  fetch(new URL(path, host), {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
  });

const showcase = process.env.SMOKE_SHOWCASE_ACCESS_KEY;
const demo = process.env.SMOKE_DEMO_ID;
const user = process.env.SMOKE_USERNAME;
const password = process.env.SMOKE_PASSWORD;
const production = process.env.SMOKE_EXPECT_PRODUCTION === "1";
const waitSeconds = Number(process.env.SMOKE_READY_WAIT_SECONDS ?? 0);
assert.ok(
  Number.isInteger(waitSeconds) && waitSeconds >= 0 && waitSeconds <= 180,
  "SMOKE_READY_WAIT_SECONDS must be 0–180.",
);
assert.equal(
  Boolean(user),
  Boolean(password),
  "Set both smoke account credentials.",
);
assert.ok(
  [user, demo, showcase].filter(Boolean).length <= 1,
  "Select one smoke sign-in mode.",
);
assert.ok(
  !(production && demo),
  "Use SMOKE_SHOWCASE_ACCESS_KEY for a hosted account chooser.",
);

async function waitForReadiness() {
  const deadline = Date.now() + waitSeconds * 1000;
  let last = "no response";
  do {
    try {
      const timeout = Math.min(10_000, Math.max(1, deadline - Date.now()));
      const response = await get(api, "/health/ready", {}, timeout);
      if (
        response.ok &&
        (await response.json().catch(() => null))?.database === "ready"
      )
        return;
      last = `HTTP ${response.status}`;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      last = error.name;
    }
    if (Date.now() < deadline)
      await sleep(Math.min(2000, deadline - Date.now()));
  } while (Date.now() < deadline);
  assert.fail(`API readiness timed out (${last}).`);
}

if (waitSeconds) await waitForReadiness();

const [live, ready, root, workspace] = await Promise.all([
  get(api, "/health/live"),
  get(api, "/health/ready"),
  get(web, "/"),
  get(web, "/en/workspace"),
]);
assert.equal(live.status, 200, "API liveness");
assert.equal(ready.status, 200, "API readiness");
assert.equal((await ready.json()).database, "ready");
assert.match(ready.headers.get("x-request-id") ?? "", /^[a-f0-9]{32}$/);
assert.equal(root.status, 307, "Web locale redirect");
const redirect = new URL(root.headers.get("location"), web);
assert.equal(
  redirect.origin,
  web.origin,
  "Web locale redirect stays on this origin",
);
assert.equal(redirect.pathname, "/bn");
assert.equal(workspace.status, 200, "Sign-in page");
assert.equal(workspace.headers.get("x-frame-options"), "SAMEORIGIN");
const signInPage = await workspace.text();
assert.match(signInPage, /Sign in/);
console.log(
  "API ready and workspace reachable with expected response headers.",
);

if (showcase) {
  assert.match(
    signInPage,
    /Workspace access code/,
    "Web prompts for a workspace access code",
  );
  const unkeyed = await get(api, "/v1/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "farmer" }),
  });
  assert.equal(
    unkeyed.status,
    401,
    "Hosted account chooser denies unkeyed sign-in",
  );
} else if (production) {
  assert.equal(
    (await get(api, "/v1/auth/demo")).status,
    404,
    "Production demo is disabled",
  );
}

async function signIn(route, credentials) {
  const session = await get(api, `/v1/auth/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  assert.equal(session.status, 201, "Smoke sign-in");
  const { token } = await session.json();
  return { Authorization: `Bearer ${token}` };
}

async function revoke(headers) {
  const response = await get(api, "/v1/auth/session", {
    method: "DELETE",
    headers,
  });
  assert.equal(response.status, 204, "Smoke sign-out");
}

async function checkShowcase(headers) {
  const lots = await get(api, "/v1/lots", { headers });
  assert.equal(lots.status, 200, "Seeded stock");
  const lot = (await lots.json()).find(
    (item) => item.label === "Sujanagar North Shed",
  );
  assert.ok(lot, "Expected a seeded inspection lot");
  const inspections = await get(api, `/v1/lots/${lot.id}/inspections`, {
    headers,
  });
  assert.equal(inspections.status, 200, "Seeded inspections");
  const photo = (await inspections.json()).flatMap((item) => item.photos)[0];
  assert.ok(photo, "Expected seeded inspection evidence");
  const photoPath = `/v1/lots/${lot.id}/inspection-photos/${photo.id}`;
  const media = await get(api, photoPath, { headers });
  assert.equal(media.status, 200, "Authorized photo retrieval");
  assert.match(media.headers.get("content-type") ?? "", /^image\/jpeg\b/);
  assert.match(media.headers.get("cache-control") ?? "", /\bprivate\b/);
  const bytes = new Uint8Array(await media.arrayBuffer());
  assert.ok(
    bytes.length > 2 && bytes[0] === 255 && bytes[1] === 216,
    "Sanitized JPEG bytes",
  );
  assert.equal(
    (await get(api, photoPath)).status,
    401,
    "Anonymous photo request denied",
  );
  const other = await signIn("demo", {
    identity: "farmer-two",
    access_key: showcase,
  });
  try {
    assert.equal(
      (await get(api, photoPath, { headers: other })).status,
      404,
      "Cross-account photo request denied",
    );
  } finally {
    await revoke(other);
  }
  console.log(
    "Seeded stock, inspection JPEG and cross-account photo permissions verified.",
  );
}

if (user || demo || showcase) {
  const headers = user
    ? await signIn("password", { username: user, password })
    : await signIn(
        "demo",
        showcase
          ? { identity: "farmer", access_key: showcase }
          : { identity: demo },
      );
  try {
    assert.equal(
      (await get(api, "/v1/me", { headers })).status,
      200,
      "Signed-in profile",
    );
    assert.equal(
      (await get(api, "/v1/notifications", { headers })).status,
      200,
      "Signed-in inbox",
    );
    if (showcase) await checkShowcase(headers);
  } finally {
    await revoke(headers);
  }
  assert.equal(
    (await get(api, "/v1/me", { headers })).status,
    401,
    "Revoked smoke session",
  );
  console.log("Smoke session created, checked, and revoked.");
}
