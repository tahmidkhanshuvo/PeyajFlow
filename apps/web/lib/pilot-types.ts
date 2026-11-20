import type { Grade } from "./workspace-types";

export type PriceSeries = {
  series: string;
  district: string;
  market: string;
  price_type: string;
  grade: Grade;
  synthetic: boolean;
  latest_on: string;
};
export type Observation = Omit<PriceSeries, "latest_on"> & {
  id: string;
  observed_on: string;
  published_on: string;
  unit: string;
  kg_per_maund: string | null;
  low: string;
  high: string;
  low_bdt_kg: string;
  high_bdt_kg: string;
  source_url: string;
  source_record: string;
  stale: boolean;
};
export type Forecast = {
  status: string;
  method: string | null;
  horizon_days: number;
  synthetic: boolean;
  as_of: string;
  last_observed: string | null;
  target_on: string;
  history_count: number;
  low_bdt_kg: string | null;
  middle_bdt_kg: string | null;
  high_bdt_kg: string | null;
  model_preview?: {
    method: string;
    low_bdt_kg: string;
    middle_bdt_kg: string;
    high_bdt_kg: string;
  } | null;
  backtest: {
    method: string;
    observations: number;
    mae_bdt_kg: string;
    wape_pct: string | null;
    interval_coverage_pct: string;
    pinball_bdt_kg: string;
  }[];
};
export type Batch = {
  id: string;
  label: string;
  status: string;
  synthetic: boolean;
  accepted_rows: number;
  duplicates: number;
  errors: { line: number; message: string }[];
  created_at: string;
  reviewed_at: string | null;
};
export type Advice = {
  recommendation: string;
  confidence: string;
  reasons: string[];
  risk_band: string;
  horizon_days: number;
  quantity_kg: string;
  sale_now_price: string | null;
  sale_now_source: string | null;
  future_source: string | null;
  retained_kg: string | null;
  sell_now_net_bdt: string | null;
  hold_low_bdt: string | null;
  hold_middle_bdt: string | null;
  hold_high_bdt: string | null;
  loss_pct: string;
  loss_source?: "manual" | "experimental_model";
  loss_estimate?: {
    readings: number;
    first_on: string;
    last_on: string;
    low_pct: string;
    middle_pct: string;
    high_pct: string;
  } | null;
  now_cost_bdt: string;
  later_cost_bdt: string;
  synthetic: boolean;
};
export type Logistics = {
  order_id: string;
  order_status: string;
  responsible: "buyer" | "seller";
  can_request: boolean;
  quantity_kg: string;
  goods_total_bdt: string;
  requests: {
    id: string;
    status: string;
    pickup_district: string;
    delivery_district: string;
    pickup_on: string;
    handling: string;
    booked_quote_id: string | null;
    created_at: string;
    quotes: {
      id: string;
      provider: string;
      source_ref: string;
      capacity_kg: string;
      pickup_on: string;
      freight_bdt: string;
      handling_bdt: string;
      valid_until: string;
      expired: boolean;
      freight_total_bdt: string;
      buyer_landed_bdt: string;
      buyer_landed_bdt_kg: string;
      seller_net_before_other_costs_bdt: string;
    }[];
  }[];
};
export type VoiceEntry = {
  id: string;
  tool: string;
  state: string;
  readback_bn: string;
  expires_at: string | null;
  result: Record<string, string | null> | null;
};
export type VoiceCall = {
  id: string;
  status: string;
  expires_at: string;
  entries: VoiceEntry[];
  mode: "simulation";
};
export type VoiceResolution = {
  phrase: string;
  status: "resolved" | "ambiguous" | "negated" | "unknown";
  tool: string | null;
  quantity: string | null;
  unit: "kg" | "maund" | null;
  match: "exact" | "pattern" | null;
  candidates: string[];
  error: string | null;
};
export type VoiceTask = {
  id: string;
  kind: string;
  lot_id: string | null;
  note: string;
  status: string;
  created_at: string;
  can_resolve: boolean;
};
