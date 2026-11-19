"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import {
  resolveVoice,
  runVoice,
} from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type { PriceSeries, VoiceCall } from "../../lib/pilot-types";
import type { Profile } from "../../lib/workspace-api";
import { errorText, local } from "../../lib/workspace-copy";
import type { Lot, Offer, Order, Supply } from "../../lib/workspace-types";
import { dhakaToday, timeLabel } from "../../lib/workspace-values";
import { SpeechInput } from "./speech-input";

const commands: Record<string, [string, string]> = {
  stock: ["মজুত", "My stock"],
  prices: ["বাজার দর", "Market prices"],
  advice: ["পরামর্শ", "Hold or sell advice"],
  offers: ["অফার", "Offers"],
  orders: ["অর্ডার", "Orders"],
  accept: ["অফার গ্রহণ", "Accept offer"],
  reject: ["অফার প্রত্যাখ্যান", "Reject offer"],
  counter: ["পাল্টা অফার", "Counteroffer"],
  movement: ["ওজন সমন্বয়", "Adjust stock"],
  register: ["মজুত নিবন্ধন", "Register a lot"],
  send_offer: ["অফার পাঠান", "Send offer"],
  transport: ["পরিবহন চাই", "Request transport"],
  inspection: ["পরিদর্শন চাই", "Request inspection"],
  support: ["সহায়তা", "Request agent help"],
};

const statuses: Record<string, [string, string]> = {
  active: ["চলছে", "Active"],
  ended: ["শেষ", "Ended"],
  expired: ["মেয়াদ শেষ", "Expired"],
  answered: ["উত্তর", "Answered"],
  pending: ["নিশ্চিতকরণের অপেক্ষায়", "Awaiting confirmation"],
  committed: ["সম্পন্ন", "Completed"],
  cancelled: ["বাতিল", "Cancelled"],
  failed: ["সম্পন্ন হয়নি", "Failed"],
};

export function VoiceDesk({
  locale,
  base,
  initial,
  actor,
  lots,
  offers,
  orders,
  supply,
  series,
}: {
  locale: Locale;
  base: string;
  initial: VoiceCall;
  actor: Profile;
  lots: Lot[];
  offers: Offer[];
  orders: Order[];
  supply: Supply[];
  series: PriceSeries[];
}) {
  const [state, submit, busy] = useActionState(
    runVoice.bind(null, initial.id),
    { call: initial },
  );
  const call = state.call ?? initial;
  const [tool, setTool] = useState("prices");
  const [phrase, setPhrase] = useState(commands.prices[0]);
  const [digits, setDigits] = useState("");
  const [audio, setAudio] = useState("");
  const [checking, setChecking] = useState(false);
  const [heard, setHeard] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  // A quantity heard in the command, used to fill the matching form field.
  const [spoken, setSpoken] = useState<{
    quantity: string;
    unit: "kg" | "maund";
  } | null>(null);
  const [prefill, setPrefill] = useState(0);
  const pending = call.entries.find((entry) => entry.state === "pending");
  const active = call.status === "active";
  const buyer = actor.role === "buyer";
  const farmer = actor.role === "farmer";
  const agent = actor.role === "agent";
  const choice = [
    "prices",
    ...(!buyer ? ["stock", "advice"] : []),
    ...(!agent ? ["offers", "orders"] : []),
    ...(farmer || buyer ? ["accept", "reject", "counter", "transport"] : []),
    ...(farmer || agent ? ["movement", "inspection"] : []),
    ...(farmer ? ["register"] : []),
    ...(buyer ? ["send_offer"] : []),
    "support",
  ];
  const t = (bn: string, en: string) => local(locale, bn, en);
  const option = (key: string) => local(locale, ...commands[key]);
  const status = (key: string) =>
    local(locale, ...(statuses[key] ?? [key, key]));
  const unitLabel = (unit: "kg" | "maund") =>
    unit === "maund" ? t("মণ", "maund") : t("কেজি", "kg");
  async function understand(alternatives: string[]) {
    const first = alternatives[0]?.trim();
    if (!first) return;
    setPhrase(first);
    setHeard(null);
    setChecking(true);
    const response = await resolveVoice(alternatives);
    setChecking(false);
    if (!response.results) {
      setHeard({
        ok: false,
        text: errorText(locale, response.error ?? "voice_repeat"),
      });
      return;
    }
    const usable = response.results.find(
      (item) =>
        item.status === "resolved" && item.tool && choice.includes(item.tool),
    );
    const best = usable ?? response.results[0];
    setPhrase(best.phrase);
    if (usable?.tool) {
      const amount =
        usable.quantity && usable.unit
          ? { quantity: usable.quantity, unit: usable.unit }
          : null;
      setTool(usable.tool);
      setSpoken(amount);
      setPrefill((count) => count + 1);
      setHeard({
        ok: true,
        text: `${t("বোঝা গেছে", "Understood")}: ${option(usable.tool)}${
          amount ? ` · ${amount.quantity} ${unitLabel(amount.unit)}` : ""
        }. ${t("পাঠানোর আগে ফর্ম যাচাই করুন।", "Check the form before sending.")}`,
      });
    } else if (best.status === "resolved") {
      setHeard({
        ok: false,
        text: t(
          "এই কাজটি আপনার অ্যাকাউন্টের জন্য নয়।",
          "That command is not available for your account.",
        ),
      });
    } else {
      setHeard({
        ok: false,
        text: errorText(locale, best.error ?? "voice_repeat"),
      });
    }
  }
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };
  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setAudio(
        t(
          "বাংলা কণ্ঠ পাওয়া যাচ্ছে না।",
          "Bangla playback is unavailable on this device.",
        ),
      );
      return;
    }
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => /^bn(?:-|$)/i.test(item.lang));
    if (!voice) {
      setAudio(
        t(
          "বাংলা কণ্ঠ পাওয়া যাচ্ছে না।",
          "Bangla playback is unavailable on this device.",
        ),
      );
      return;
    }
    setAudio("");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "bn-BD";
    utterance.voice = voice;
    utterance.onerror = () =>
      setAudio(t("কণ্ঠ চালানো যায়নি।", "Playback could not start."));
    window.speechSynthesis.speak(utterance);
  }
  const offerAction = ["accept", "reject", "counter"].includes(tool);
  const terms = (
    <>
      <label>
        {t("পরিমাণ (কেজি)", "Quantity (kg)")}
        <input
          key={`kg-${prefill}`}
          name="quantity_kg"
          inputMode="decimal"
          defaultValue={spoken?.unit === "kg" ? spoken.quantity : undefined}
          required
        />
      </label>
      <label>
        {t("দর (৳/কেজি)", "Price (BDT/kg)")}
        <input name="price_bdt_kg" inputMode="decimal" required />
      </label>
    </>
  );
  const quantity = (
    <>
      <label>
        {t("পরিমাণ", "Quantity")}
        <input
          key={`quantity-${prefill}`}
          name="quantity"
          inputMode="decimal"
          defaultValue={spoken?.quantity}
          required
        />
      </label>
      <label>
        {t("একক", "Unit")}
        <select
          key={`unit-${prefill}`}
          name="unit"
          defaultValue={spoken?.unit ?? "kg"}
        >
          <option value="kg">{t("কেজি", "kg")}</option>
          <option value="maund">{t("মণ", "maund")}</option>
        </select>
      </label>
      <label>
        {t("মণ হলে প্রতি মণে কেজি", "If using maunds, kg per maund")}
        <input name="kg_per_maund" inputMode="decimal" />
      </label>
    </>
  );
  return (
    <>
      <section className="work-panel">
        <div className="work-row">
          <h2>{t("সিমুলেটেড কল", "Simulated call")}</h2>
          <span className="work-tag">{status(call.status)}</span>
        </div>
        <p>
          {t("সিমুলেটরের মেয়াদ", "Session expires")} ·{" "}
          {timeLabel(locale, call.expires_at)}
        </p>
        {active && (
          <form action={submit} onSubmit={send} className="work-form">
            <input name="mode" type="hidden" value="end" />
            <button className="pilot-secondary" type="submit" disabled={busy}>
              {t("কল শেষ করুন", "End call")}
            </button>
          </form>
        )}
        {state.error && (
          <p role="alert" className="form-error">
            {errorText(locale, state.error)}
          </p>
        )}
        {audio && <p role="status">{audio}</p>}
      </section>
      {active && !pending && (
        <section className="work-panel">
          <h2>{t("কথা লিখুন", "Enter a command")}</h2>
          <SpeechInput
            locale={locale}
            disabled={busy || checking}
            onTranscript={understand}
          />
          <form action={submit} onSubmit={send} className="work-form">
            <input name="mode" type="hidden" value="intent" />
            <div className="work-grid">
              <label>
                {t("কাজ", "Command")}
                <select
                  name="tool"
                  value={tool}
                  onChange={(event) => {
                    setTool(event.target.value);
                    setPhrase(commands[event.target.value][0]);
                    setSpoken(null);
                    setHeard(null);
                  }}
                >
                  {choice.map((key) => (
                    <option key={key} value={key}>
                      {option(key)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("বাংলা বক্তব্য", "Typed Bangla utterance")}
                <input
                  name="phrase"
                  maxLength={100}
                  value={phrase}
                  onChange={(event) => {
                    setPhrase(event.target.value);
                    setHeard(null);
                  }}
                  required
                />
              </label>
              {[
                "stock",
                "advice",
                "movement",
                "inspection",
                "support",
              ].includes(tool) &&
                !buyer && (
                  <label>
                    {t("মজুত", "Lot")}
                    <select
                      name="lot_id"
                      defaultValue=""
                      required={["advice", "movement", "inspection"].includes(
                        tool,
                      )}
                    >
                      <option value="">{t("বেছে নিন", "Select a lot")}</option>
                      {lots.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {["prices", "advice"].includes(tool) && (
                <label>
                  {t("দরের ধারা", "Market series")}
                  <select name="series" defaultValue="">
                    <option value="">{t("বেছে নিন", "Select a series")}</option>
                    {series.map((row) => (
                      <option key={row.series} value={row.series}>
                        {row.market} · {row.price_type}
                        {row.synthetic ? t(" · কাল্পনিক", " · Synthetic") : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {offerAction && (
                <label>
                  {t("অফার", "Offer")}
                  <select name="offer" defaultValue="" required>
                    <option value="">{t("বেছে নিন", "Select an offer")}</option>
                    {offers
                      .filter(
                        (row) =>
                          row.proposer_id !== actor.membership_id &&
                          ["sent", "countered"].includes(row.status),
                      )
                      .map((row) => (
                        <option
                          key={row.id}
                          value={`${row.id}/${row.lot_id}/${row.version}`}
                        >
                          {row.lot_label} · {row.buyer_name} · {row.quantity_kg}{" "}
                          kg
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {tool === "counter" && terms}
              {tool === "movement" && (
                <>
                  <label>
                    {t("পরিবর্তনের ধরন", "Movement type")}
                    <select name="event_type">
                      <option value="WEIGHED_ADJUSTMENT">
                        {t("ওজন সমন্বয় (+/−)", "Weight adjustment (+/−)")}
                      </option>
                      <option value="LOSS_REPORTED">
                        {t("ক্ষতি (ঋণাত্মক)", "Loss (negative)")}
                      </option>
                    </select>
                  </label>
                  {quantity}
                  <label>
                    {t("কারণ", "Reason")}
                    <input name="reason" maxLength={200} required />
                  </label>
                </>
              )}
              {tool === "register" && (
                <>
                  <label>
                    {t("মজুতের নাম", "Lot name")}
                    <input name="label" maxLength={100} required />
                  </label>
                  <label>
                    {t("জেলা", "District")}
                    <input
                      name="district"
                      maxLength={100}
                      defaultValue={actor.district}
                      required
                    />
                  </label>
                  <label>
                    {t("জাত", "Variety")}
                    <input name="variety" maxLength={100} required />
                  </label>
                  <label>
                    {t("সংরক্ষণের ধরন", "Storage type")}
                    <input name="storage_type" maxLength={100} required />
                  </label>
                  <label>
                    {t("ফসল তোলার দিন", "Harvest date")}
                    <input
                      type="date"
                      name="harvest_on"
                      defaultValue={dhakaToday()}
                      required
                    />
                  </label>
                  <label>
                    {t("সংরক্ষণ শুরুর দিন", "Storage date")}
                    <input
                      type="date"
                      name="stored_on"
                      defaultValue={dhakaToday()}
                      required
                    />
                  </label>
                  <label>
                    {t("গ্রেড", "Grade")}
                    <select name="grade">
                      <option value="ungraded">
                        {t("গ্রেড নেই", "Ungraded")}
                      </option>
                      <option>A</option>
                      <option>B</option>
                      <option>C</option>
                    </select>
                  </label>
                  {quantity}
                  <label className="checkbox">
                    <input name="listed" type="checkbox" />
                    {t("ক্রেতাদের জন্য তালিকাভুক্ত", "List for buyers")}
                  </label>
                </>
              )}
              {tool === "send_offer" && (
                <>
                  <label>
                    {t("তালিকাভুক্ত মজুত", "Listed lot")}
                    <select name="lot_id" defaultValue="" required>
                      <option value="">{t("বেছে নিন", "Select a lot")}</option>
                      {supply.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.variety} · {row.district} · {row.sellable_kg} kg
                        </option>
                      ))}
                    </select>
                  </label>
                  {terms}
                  <label>
                    {t("গন্তব্য জেলা", "Delivery district")}
                    <input
                      name="delivery_district"
                      maxLength={100}
                      defaultValue={actor.district}
                      required
                    />
                  </label>
                  <label>
                    {t("পরিবহনের দায়িত্ব", "Transport responsibility")}
                    <select name="transport">
                      <option value="buyer">{t("ক্রেতা", "Buyer")}</option>
                      <option value="seller">{t("বিক্রেতা", "Seller")}</option>
                    </select>
                  </label>
                </>
              )}
              {tool === "transport" && (
                <>
                  <label>
                    {t("অর্ডার", "Order")}
                    <select name="order_id" defaultValue="" required>
                      <option value="">
                        {t("বেছে নিন", "Select an order")}
                      </option>
                      {orders
                        .filter(
                          (row) =>
                            row.status === "confirmed" &&
                            row.offer.transport ===
                              (buyer ? "buyer" : "seller"),
                        )
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.offer.lot_label} · {row.offer.quantity_kg} kg
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("সংগ্রহের দিন", "Pickup date")}
                    <input
                      name="pickup_on"
                      type="date"
                      min={dhakaToday()}
                      defaultValue={dhakaToday()}
                      required
                    />
                  </label>
                  <label>
                    {t("নির্দেশনা", "Handling instructions")}
                    <input name="handling" maxLength={100} required />
                  </label>
                </>
              )}
              {["inspection", "support"].includes(tool) && (
                <label>
                  {t("অনুরোধের বিবরণ", "Request note")}
                  <input name="note" maxLength={200} required />
                </label>
              )}
            </div>
            {heard && (
              <p
                role={heard.ok ? "status" : "alert"}
                className={heard.ok ? undefined : "form-error"}
              >
                {heard.text}
              </p>
            )}
            <div className="work-row">
              <button
                className="pilot-secondary"
                type="button"
                disabled={busy || checking || !phrase.trim()}
                onClick={() => understand([phrase])}
              >
                {checking
                  ? t("যাচাই হচ্ছে…", "Checking…")
                  : t("কাজটি যাচাই করুন", "Check command")}
              </button>
              <button className="refresh" disabled={busy} type="submit">
                {busy
                  ? t("অপেক্ষা করুন…", "Please wait…")
                  : t("বক্তব্য পাঠান", "Send utterance")}
              </button>
            </div>
          </form>
        </section>
      )}
      {active && pending && (
        <section className="work-panel">
          <h2>{t("শর্ত শুনে নিশ্চিত করুন", "Confirm the read-back")}</h2>
          <p lang="bn">{pending.readback_bn}</p>
          <button
            className="pilot-secondary"
            type="button"
            onClick={() => speak(pending.readback_bn)}
          >
            {t("বাংলায় শুনুন", "Play Bangla read-back")}
          </button>
          {state.code && state.pendingId === pending.id ? (
            <form action={submit} onSubmit={send} className="work-form">
              <input type="hidden" name="mode" value="confirm" />
              <input type="hidden" name="action_id" value={pending.id} />
              <p>
                {actor.is_demo
                  ? t("ডেমো কোড", "Demo keypad code")
                  : t("কিপ্যাড কোড", "Keypad code")}{" "}
                <strong>{state.code}</strong>
              </p>
              <label>
                {t("চার অঙ্কের নিশ্চিতকরণ", "Four-digit confirmation")}
                <input
                  name="digits"
                  inputMode="numeric"
                  maxLength={4}
                  value={digits}
                  onChange={(event) => setDigits(event.target.value)}
                  required
                />
              </label>
              <div className="pilot-keypad">
                {Array.from({ length: 10 }, (_, n) => n).map((n) => (
                  <button
                    className="pilot-secondary"
                    type="button"
                    key={n}
                    onClick={() =>
                      setDigits((value) => `${value}${n}`.slice(0, 4))
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="work-row">
                <button
                  className="pilot-secondary"
                  type="button"
                  onClick={() => setDigits("")}
                >
                  {t("মুছুন", "Clear")}
                </button>
                <button
                  className="refresh"
                  type="submit"
                  disabled={busy || digits.length !== 4}
                >
                  {t("কিপ্যাডে নিশ্চিত করুন", "Confirm by keypad")}
                </button>
              </div>
            </form>
          ) : (
            <p>
              {t(
                "কোডটি একবারই দেখানো হয়। কাজটি বাতিল করে আবার পাঠান।",
                "The code is shown only once. Cancel this action and send the command again.",
              )}
            </p>
          )}
          <form action={submit} onSubmit={send} className="work-form">
            <input type="hidden" name="mode" value="cancel" />
            <input type="hidden" name="action_id" value={pending.id} />
            <button className="pilot-secondary" type="submit" disabled={busy}>
              {t("এই কাজটি বাতিল করুন", "Cancel this action")}
            </button>
          </form>
        </section>
      )}
      <section className="work-panel">
        <h2>{t("কলের কথোপকথন", "Call transcript")}</h2>
        {!call.entries.length && (
          <p>{t("এখনও কোনো বক্তব্য নেই।", "No turns yet.")}</p>
        )}
        <ul className="work-history">
          {call.entries.map((entry) => (
            <li key={entry.id}>
              <strong>
                {commands[entry.tool] ? option(entry.tool) : entry.tool} ·{" "}
                {status(entry.state)}
              </strong>
              <span lang="bn">{entry.readback_bn}</span>
              {entry.result?.error && (
                <span className="form-error">
                  {errorText(locale, entry.result.error)}
                </span>
              )}
              {entry.result?.order_id && (
                <Link
                  className="work-link"
                  href={`${base}/orders/${entry.result.order_id}`}
                >
                  {t("অর্ডার দেখুন", "View order")}
                </Link>
              )}
              <button
                type="button"
                className="pilot-secondary"
                onClick={() => speak(entry.readback_bn)}
              >
                {t("বাংলায় শুনুন", "Play Bangla read-back")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
