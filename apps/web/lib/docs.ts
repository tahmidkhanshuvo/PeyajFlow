export type Mode = "off" | "public" | "scheduled";
export type BlockKind =
  | "paragraph"
  | "heading"
  | "bullet"
  | "quote"
  | "node"
  | "upcoming"
  | "planned";
export type Block = { kind: BlockKind; text: string };
export type Section = {
  key: string;
  group: "pitch" | "engineering";
  title: string;
  blocks: Block[];
};
export type Member = {
  name: string;
  role: string;
  email: string;
  photo: string;
};
export type Document = {
  title: string;
  summary: string;
  team_name: string;
  team: Member[];
  sections: Section[];
};
export type Edition = { version: number; note: string; published_at: string };
export type Operation = {
  path: string;
  method: string;
  summary: string;
  group: string;
};
export type Metrics = {
  verified_users: number;
  lots: number;
  orders: number;
  activity_7d: number;
};
export type Snapshot = {
  version: number;
  checked_at: string;
  closes_at: string | null;
  statistics: {
    sampled_at: string;
    cohorts: { operational: Metrics; showcase: Metrics };
  };
  features: Record<string, "available" | "configuration_required">;
  api_version: string;
  schema_revision: string;
};
export type ReaderData = Snapshot & {
  document: Document;
  operations: Operation[];
  history: Edition[];
};
export type Refresh = Snapshot &
  Partial<Pick<ReaderData, "document" | "operations" | "history">>;
export type AdminData = {
  revision: number;
  mode: Mode;
  starts_at: string;
  ends_at: string;
  public: boolean;
  version: number;
  draft: Document;
  has_draft: boolean;
  history: Edition[];
};

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));

export const featureNames: Record<string, string> = {
  stock: "Stock ledger",
  trade: "Offers, orders and delivery",
  market: "Market prices and forecasts",
  inspection: "Photo inspections",
  assistant: "Bangla assistant",
  simulator: "Basic phone simulator",
  model_fallback: "Optional voice model fallback",
  sms: "SMS sign-in",
  carrier: "Carrier voice callbacks",
};
