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
                "Bangla assistant: check a spoken or typed command and confirm a staged change with a keypad code or personal PIN.",
            ),
        ),
        section(
            "market-opportunity",
            "pitch",
            "Market opportunity",
            "The initial market is the Pabna-to-Dhaka onion corridor. The pilot targets growers and agents in Pabna and repeat wholesale buyers in Dhaka.",
            "Market sizing is pending validation. The sizing model starts with reachable annual tonnage, the share coordinated by participating buyers, and a tested fee per tonne or subscription price.",
        ),
        section(
            "business-model",
            "pitch",
            "Business model",
            "Test paid buyer and aggregator subscriptions for order coordination and operational reporting. Measure willingness to pay and repeat use before selecting a pricing model. PeyajFlow records settlement evidence and does not move money.",
        ),
        section(
            "traction",
            "pitch",
            "Traction",
            "PeyajFlow has a working pilot spanning lot registration, offer acceptance, delivery and settlement review. The live snapshot separates showcase activity from operational records. Commercial adoption, revenue and field impact remain unverified.",
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
            "Available capabilities are derived from the running API and provider settings. The roadmap is maintained by the team.",
            ("upcoming", "Field onboarding and independent dialect review"),
            ("planned", "Broader market coverage and forecast calibration"),
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
            "The system uses user-entered stock and transaction records, inspected photos and approved market observations. Importers submit structured CSV with the original source, publication date and market units. Automated scraping is not part of the current ingestion pipeline.",
            "Market imports retain provenance and separate synthetic data. Photos are re-encoded without metadata and served through scoped access checks. Public documentation shows aggregate counts and team contact details approved for publication.",
        ),
        section(
            "ai",
            "engineering",
            "AI and decision support",
            "The price service compares a learned candidate against historical baselines on held-out replay dates and abstains when evidence is sparse or stale. Hold/sell comparisons show their price, loss and cost assumptions.",
            "The browser CLIP model can suggest visible condition flags. Human reviewers see the suggestion and make their own assessment. The Bangla grammar runs first. When configured, a model fallback can classify an otherwise unmatched request within a fixed command list.",
            "Role, lot, market series and explicit preferences supply context. The current system uses no RAG or GraphRAG. Decisions show assumptions and read back terms before any confirmed mutation.",
        ),
        section(
            "roadmap",
            "engineering",
            "Product roadmap",
            (
                "bullet",
                "Upcoming · Run a field pilot, expand dialect review and collect independent, consented photo labels.",
            ),
            (
                "bullet",
                "Planned · Improve approved market-data coverage, validate forecast calibration and test repeat buyer onboarding.",
            ),
            (
                "bullet",
                "Long term · Evaluate adjacent perishable crops and additional corridors once fulfilment and retention are measured.",
            ),
        ),
        section(
            "scale",
            "engineering",
            "Performance and scalability",
            "The expected starting load is a corridor-scale pilot covering a limited group of agents, growers and buyers. Capacity and latency targets will be based on measured workloads.",
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
            "See the Team section in the pitch deck for approved names, roles, profile photos and email addresses.",
        ),
        section(
            "changelog",
            "engineering",
            "Changelog",
            "The documentation timeline records each published edition. Application schema and API versions are included in the live snapshot and API reference.",
        ),
    ],
}
