export type Grade = "A" | "B" | "C" | "ungraded";
export type Lot = {
  id: string;
  label: string;
  district: string;
  variety: string;
  storage_type: string;
  harvest_on: string;
  stored_on: string;
  grade: Grade;
  listed: boolean;
  initial_kg: string;
  available_kg: string;
  reserved_kg: string;
  sellable_kg: string;
  verified_kg: string | null;
  verified_at: string | null;
};
export type LotDetail = Lot & {
  events: {
    id: string;
    event_type: string;
    delta_kg: string;
    reserved_delta_kg: string;
    submitted_quantity: string | null;
    submitted_unit: string | null;
    kg_per_maund: string | null;
    reason: string;
    recorded_at: string;
  }[];
};
export type Supply = {
  id: string;
  district: string;
  variety: string;
  grade: Grade;
  sellable_kg: string;
  verification: "verified" | "self_reported";
  matched_kg?: string;
  coverage?: "full" | "partial";
  preferred_pickup?: boolean;
  estimated_landed_bdt?: string | null;
  estimated_landed_bdt_kg?: string | null;
  estimate_basis?: "buyer_assumptions" | null;
};
export type Demand = {
  id: string;
  quantity_kg: string;
  variety: string;
  minimum_grade: Grade;
  delivery_district: string;
  delivery_from: string;
  delivery_to: string;
  price_ceiling_bdt_kg: string | null;
  transport: "buyer" | "seller";
  status: "open" | "closed";
};
export type PageResult<T> = { items: T[]; next_offset: number | null };
export type Offer = {
  id: string;
  lot_id: string;
  lot_label: string;
  buyer_name: string;
  buyer_verified: boolean;
  seller_name: string;
  proposer_id: string;
  variety: string;
  grade: Grade;
  quantity_kg: string;
  price_bdt_kg: string;
  total_bdt: string;
  delivery_district: string;
  delivery_from: string | null;
  delivery_to: string | null;
  transport: "buyer" | "seller";
  status: string;
  version: number;
  expires_at: string;
};
export type OfferDetail = Offer & {
  activity: {
    action: string;
    by: string;
    recorded_at: string;
    version: number;
    quantity_kg: string | null;
    price_bdt_kg: string | null;
  }[];
};
export type Order = {
  id: string;
  offer: Offer;
  status: string;
  expires_at: string;
  created_at: string;
};
export type OrderDetail = Order & {
  activity: { action: string; recorded_at: string; by_system: boolean }[];
};
export type Payment = {
  id: string;
  status: "reported" | "verified" | "rejected";
  reference: string;
  reported_at: string;
  reviewed_at: string | null;
};
export type Settlement = {
  status: "pending" | "reported" | "verified";
  total_bdt: string;
  reports: Payment[];
};
export type Delegation = {
  membership_id: string;
  name: string;
  district: string;
};
export type PhotoPrediction = {
  flag: string;
  top_score: number;
  model: string;
  rule: string;
  created_at: string;
};
export type Inspection = {
  id: string;
  observed_on: string;
  curing: string;
  ventilation: string;
  moisture: string;
  odor: string;
  temperature_c: string | null;
  humidity_pct: string | null;
  sample_kg: string | null;
  notes: string;
  visible_flags: string[];
  effective_flags: string[];
  quality_assessment: string;
  provenance: string;
  photos: {
    id: string;
    width: number;
    height: number;
    quality_flags: string[];
    quality_version: string;
    prediction: PhotoPrediction | null;
  }[];
  review_history: {
    source: string;
    flags: string[];
    reason: string;
    created_at: string;
  }[];
};
export type Risk = {
  band: string;
  recommendation: string;
  reasons: string[];
  missing: string[];
  days_stored: number;
  observed_on: string | null;
  method: string;
  reference_url: string;
};
export type PendingSignup = {
  user_id: string;
  membership_id: string;
  name: string;
  district: string;
  role: "farmer" | "buyer";
};
export type Filters = Record<string, string | string[] | undefined>;
