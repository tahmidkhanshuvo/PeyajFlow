"""Starter editorial content for the live documentation workspace."""


def section(key, group, title, *lines):
    return {
        "key": key,
        "group": group,
        "title": title,
        "blocks": [
            {"kind": line[0], "text": line[1]}
            if isinstance(line, tuple)
            else {"kind": "paragraph", "text": line}
            for line in lines
        ],
    }


STARTER = {
    "title": "From onion stock to a confirmed sale.",
    "summary": "PeyajFlow connects Bangladesh’s onion growers, buyers and field agents around shared stock, market evidence and accountable trade.",
    "team_name": "PeyajFlow",
    "team": [],
    "sections": [
        section(
            "problem",
            "pitch",
            "The problem",
            "Farmers must decide whether to sell or keep storing onions while prices and storage losses change. Buyers negotiate against quantities and quality they cannot always verify. Paper records and calls leave the parties with different versions of the same deal.",
        ),
        section(
            "solution",
            "pitch",
            "The solution",
            "A Bangla-first workspace turns stock measurements, inspection records and market observations into an offer both sides can act on. Confirmed orders carry the agreed terms through dispatch, receipt and independent settlement review.",
        ),
        section(
            "why-now",
            "pitch",
            "Why now",
            "Market bulletins and phone-based coordination already exist. The opportunity is to connect them to the stock, price and delivery decisions farmers and buyers make each week. Browser-based voice and photo assistance make that workflow easier to try without separate hardware.",
        ),
        section(
            "product-demo",
            "pitch",
            "Product demo",
            (
                "bullet",
                "Farmer: register a lot, record a stock movement and add a private condition photo.",
            ),
            (
                "bullet",
                "Buyer: post a requirement, compare eligible supply and send an offer.",
            ),
            (
                "bullet",
                "Both sides: confirm terms, follow delivery and submit payment evidence for review.",
            ),
            (
                "bullet",
                "Bangla assistant: use Bangla, Banglish or English. In the basic-phone demo, reply by simulated SMS, open the USSD menu or place a simulated call. Review the terms and confirm through a keypad code or personal PIN.",
            ),
        ),
        section(
            "market-opportunity",
            "pitch",
            "Market opportunity",
            "The initial market is the Pabna-to-Dhaka onion corridor. The pilot targets growers and agents in Pabna and repeat wholesale buyers in Dhaka.",
            "The addressable corridor can be sized from annual onion volume, the share coordinated by participating buyers and the value buyers place on repeat order coordination.",
        ),
        section(
            "business-model",
            "pitch",
            "Business model",
            "The proposed revenue model is a subscription for buyers and aggregators who coordinate repeat orders and need operational reporting. Growers and agents contribute verified supply and fulfilment records. PeyajFlow records settlement evidence without handling funds.",
        ),
        section(
            "traction",
            "pitch",
            "Traction",
            "The working pilot covers lot registration, offer acceptance, delivery and settlement review. The live snapshot reports operational and showcase activity separately, including verified users, lots, orders and seven-day audit activity.",
        ),
        section(
            "competition",
            "pitch",
            "Competition",
            "The existing alternatives are broker phone calls, spreadsheets, messaging and price listing sites. Evaluate them against time to confirm a sale, shared visibility of terms and the effort required to resolve a disagreement.",
        ),
        section(
            "advantage",
            "pitch",
            "Unique advantage",
            "The same lot ledger supports the stock screen, the counteroffer and the Bangla assistant. Decisions carry their evidence through the trade instead of depending on an isolated price listing or chat thread.",
        ),
        section(
            "go-to-market",
            "pitch",
            "Go-to-market",
            "Recruit field agents and a small group of repeat buyers in one corridor. Onboard growers with agent support and follow real transactions through delivery. Expand once repeat buyer use, fulfilment reliability and verified inventory justify it.",
        ),
        section(
            "team", "pitch", "Team", "Meet the people building and operating PeyajFlow."
        ),
        section(
            "vision",
            "pitch",
            "Vision",
            "Make perishable crop trades easier to plan and verify, starting with onions. Build a record of stock, quality, price and fulfilment that works for the smallest participant in the chain.",
        ),
        section(
            "overview",
            "engineering",
            "Product overview",
            (
                "bullet",
                "Farmers maintain lots, storage records, measurements and sale offers.",
            ),
            (
                "bullet",
                "Buyers compare supply, negotiate terms and coordinate receipt.",
            ),
            (
                "bullet",
                "Field agents support farmers with explicit delegations. Operators verify accounts and market imports, review disputes and compare model suggestions with human reviews.",
            ),
        ),
        section(
            "features",
            "engineering",
            "Feature matrix",
            "The feature matrix reflects the running API and provider configuration. Simulated SMS, USSD and calls use the same trading services and confirmation rules as the web workspace.",
        ),
        section(
            "architecture",
            "engineering",
            "System architecture",
            ("node", "Next.js UI"),
            ("node", "FastAPI"),
            ("node", "Domain services"),
            ("node", "PostgreSQL"),
            "Next.js server actions forward the session to FastAPI. Domain modules implement the stock ledger, trading, inspections, market data, logistics and voice. PostgreSQL commits workflow updates and audit records together. Images are stored separately in private local or S3-compatible storage.",
        ),
        section(
            "data-flow",
            "engineering",
            "Data flow",
            ("node", "User input"),
            ("node", "Validate & scope"),
            ("node", "Decision support"),
            ("node", "Review & confirm"),
            ("node", "Ledger & feedback"),
            "Users enter structured data and optionally add speech or a photo. The API checks scope and provenance before decision support returns a suggestion. The user reviews and confirms changes, while the resulting record becomes evidence for later reviews.",
        ),
        section(
            "stack",
            "engineering",
            "Technology stack",
            (
                "bullet",
                "Frontend: Next.js App Router, React, TypeScript and server actions.",
            ),
            ("bullet", "Backend: FastAPI, Pydantic, SQLAlchemy Core and Alembic."),
            (
                "bullet",
                "Storage: PostgreSQL and private local or S3-compatible photo storage.",
            ),
            (
                "bullet",
                "Decision support: deterministic Bangla grammar, statistical price and loss estimates, and browser CLIP inference.",
            ),
            (
                "bullet",
                "Infrastructure: Docker Compose for development and CI. The hosted setup uses Vercel and Render.",
            ),
        ),
        section(
            "api",
            "engineering",
            "API reference",
            "Outbound integrations include private S3-compatible object storage, signed Twilio callbacks and optional intent-model providers. The browser fetches pinned public CLIP model files from Hugging Face.",
            "The inventory below reflects the running API’s OpenAPI contract. Endpoint details include path and query parameters, request and response schemas, and documented status codes.",
            "The browser normally calls same-origin Next.js actions. Those actions attach a server-side bearer session to the FastAPI request. Routine domain errors use a short detail code. Most mutations require the privileges of the current membership and retry-sensitive changes use request keys.",
        ),
        section(
            "data",
            "engineering",
            "Data layer",
            "The system uses user-entered stock and transaction records, inspected photos and approved market observations. Operators review structured CSV imports with the original source, publication date and market units before records feed the forecast.",
            "Market imports retain provenance and separate synthetic data. Photos are re-encoded without metadata and served through scoped access checks. Public documentation shows aggregate counts and team contact details approved for publication.",
        ),
        section(
            "ai",
            "engineering",
            "AI and decision support",
            "The price service compares a learned candidate against historical baselines on held-out replay dates and abstains when evidence is sparse or stale. Hold/sell comparisons show their price, loss and cost assumptions.",
            "The browser CLIP model can suggest visible condition flags. Human reviewers see the suggestion and make their own assessment.",
            "Role-scoped PostgreSQL queries supply the selected lot, market series and user preferences. The deterministic resolver handles explicit quantities and units. An optional model classifier handles unmatched commands within a fixed allowlist, and a model cannot confirm a trade.",
            ("heading", "How we measure quality"),
            "The voice evaluation tracks intent accuracy, macro F1, quantity accuracy and wrong change commands. The vision evaluator tracks per-class precision, recall and abstention. Forecast replays use only price observations that were available at each replay date and report error and interval coverage.",
        ),
        section(
            "roadmap",
            "engineering",
            "Product roadmap",
            (
                "bullet",
                "Near term · Measure repeat buyer use, verified stock coverage and time to a confirmed offer in the Pabna-to-Dhaka corridor.",
            ),
            (
                "bullet",
                "Mid term · Measure market-data coverage, forecast calibration and on-time delivery across participating markets.",
            ),
            (
                "bullet",
                "Long term · Use fulfilment and retention evidence to decide which crops and trade corridors to serve next.",
            ),
        ),
        section(
            "scale",
            "engineering",
            "Performance and scalability",
            "The system is designed for a corridor-scale pilot. Capacity planning follows API latency, database query cost, upload sizes and the volume of concurrent trade operations."
            "The application limits and paginates queries, uses PostgreSQL indexes and connection pooling, stores photos outside the main database and runs photo inference in the browser. Documentation caches aggregate reads briefly while checking access on every request.",
        ),
        section(
            "security",
            "engineering",
            "Security",
            "The API checks role, account verification, organization cohort and delegated access. Browser sessions use HTTP-only cookies. Server-to-server calls carry bearer tokens and the API stores fingerprints of session tokens.",
            "Photo access is scoped and non-cacheable. Retry-sensitive changes have idempotency keys, and voice changes require read-back and confirmation. Documentation publishing is restricted to verified non-demo administrators and recorded in the audit log.",
        ),
        section(
            "analytics",
            "engineering",
            "Analytics and KPIs",
            "The live snapshot reports verified users, lots, confirmed orders and audited activity in the last seven days. Demo activity is shown separately.",
            "Pilot success measures are repeat buyer use, verified stock coverage, time to confirmed offer and on-time delivery. Public activity counts do not establish revenue, impact or retention.",
        ),
        section(
            "contributors",
            "engineering",
            "Team and contributors",
            "See the pitch deck for the PeyajFlow team.",
        ),
        section(
            "changelog",
            "engineering",
            "Changelog",
            "The documentation timeline records each published edition. Application schema and API versions are included in the live snapshot and API reference.",
        ),
    ],
}
