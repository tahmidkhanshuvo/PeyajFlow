# PeyajFlow decision-support features

Each feature below is labelled as a model or as deterministic code. Every figure was measured by a script in this repository on November 18, 2026. Commands are given so the figures can be reproduced.

| Feature | Kind | Where it runs | Output | People stay in control by |
| --- | --- | --- | --- | --- |
| Bangla call commands | Deterministic grammar (no model) | API, `app/intent.py` | One command, or an abstention with a reason | Read-back plus keypad confirmation for every change |
| Photo condition suggestion | CLIP ViT-B/32 zero-shot classifier, q8, WebAssembly | User's browser, `public/condition-model.js` | Label and five scores, or abstention | Human review records the finding; suggestions are hints |
| Price outlook | Statistical baselines and a nearest-neighbour model with a promotion gate | API, `app/forecast.py`, `app/price_model.py` | 7/14/28-day range, or abstention | Shown with backtest errors and data provenance |
| Storage-loss trend | Log-linear fit to verified weights | API, `app/loss_model.py` | Loss range, or abstention | Used in hold/sell scenarios next to manual assumptions |

## Bangla call commands

The simulator used to recognise 30 exact phrases. `app/intent.py` now resolves natural commands in Bangla, Banglish (Bengali in Latin script), English and code-switched text.

1. **Normalize.** Unicode NFC, invisible joiners removed, Bangla digits converted, thousands separators dropped, digits split from attached units (`২০০কেজি`), and common misspellings mapped (গ্রহন→গ্রহণ, মজুদ→মজুত, কেজী→কেজি).
2. **Match.** Each of the 14 commands has a small grammar of stems and phrases. A change command (accept, reject, counter, adjust stock, register, send offer, transport, inspection, support) outranks a read command (prices, stock, advice, offers, orders) in the same sentence.
3. **Decide.**

| Outcome | When | API error |
| --- | --- | --- |
| resolved, `exact` | One of the original listed phrases | — |
| resolved, `pattern` | Exactly one command matched | — |
| negated | A change command together with না, নয়, নেই, করিনি, don't, not, na… | `voice_negated` |
| ambiguous | Two or more change commands, two quantities, or a "whether" question (কিনা) | `voice_ambiguous` |
| unknown | A number without kg or maund, a number word that is not the quantity or cannot be read, or zero | `voice_say_quantity` |
| unknown | Another crop (ধান, আলু, রসুন, rice…) | `voice_onion_only` |
| unknown | Cancel, delete, payment or money transfer | `voice_unsupported` |
| unknown | Nothing matched | `voice_repeat` |

Negation and "whether" questions do not block read commands, because reading changes nothing.

**Quantities said in words.** A spoken number is read only when it comes directly before kg or maund and the whole phrase follows strict rules. The resolver understands:

- Bangla 0 to 99, each a single word (একুশ, পঁয়ত্রিশ, নিরানব্বই).
- Hundreds: দুইশো, দুশো, পনেরোশো, একশো পঞ্চাশ.
- Thousands and lakhs in descending order: দুই হাজার পাঁচশো, এক লাখ.
- Halves and quarters: দেড় (1.5), আড়াই (2.5), সাড়ে তিন (3.5), সোয়া পাঁচ (5.25), পৌনে দুই (1.75).
- English: two hundred and fifty, twenty-five, a hundred.
- Common Banglish forms: tin mon, dusho kg, sare tin mon, ek hajar kg.

The resolver abstains (`number_words`) in these cases:

- A number word is not the quantity, for example দুই নম্বর লট.
- The phrase is irregular, for example "two three kg" or "two thousand thousand".
- A fraction cannot be applied.

A number said in words next to টাকা is a price, not a quantity, the same as digits. Banglish number words that are also English words (at, sat, tin) count only when the phrase reads as a number, so "accept offer at 200 kg" is still 200 kg. নয় (nine) is also the negation "is not", so it is always treated as a negation.

4. **Check against the form.** The selected command must match the phrase (`voice_tool_mismatch`). A spoken quantity must equal the quantity in the offer or form, after converting maunds with the lot's recorded kg-per-maund (`voice_quantity_mismatch`). This applies to acceptance, counteroffers, stock losses, lot registration and buyer offers.
5. **Confirm.** A resolved change is staged with a Bangla read-back and a 4-digit code that expires after 2 minutes. The user is warned before the last of three attempts, can cancel a pending change, and inventory changes only after confirmation.

The web form calls `POST /v1/voice/resolve` after speech or **Check command** to show what was understood and fill the matching quantity field. Browser speech recognition returns up to three alternatives, and the first one the API understands is used.

### Measured results

Run from `services/api`: `uv run --locked python -m evals.intent_eval --label <name> [--dataset ...]`. Full reports, including per-command metrics, the confusion matrix and every failure, are in `services/api/evals/results/`.

| Dataset | Resolver | Accuracy | Macro F1 | Quantity and unit | Acted when it should abstain | Wrong change commands |
| --- | --- | --- | --- | --- | --- | --- |
| Main, 239 rows | Original exact match (`intent-before`) | 0.360 | 0.326 | 0.212 | 1 of 48 | 1 |
| Main, 239 rows | New resolver (`intent-after`) | 1.000 | 1.000 | 1.000 | 0 of 48 | 0 |
| Challenge, 58 rows | New resolver, first run (`intent-challenge-first-run`) | 0.603 | 0.485 | 0.500 | 2 of 18 | 2 |
| Challenge, 58 rows | New resolver after fixes (`intent-challenge-after`) | 0.931 | 0.899 | 1.000 | 0 of 18 | 0 |
| Main, 259 rows (20 number-word rows added) | With spoken numbers (`intent-number-words`) | 1.000 | 1.000 | 1.000 | 0 of 54 | 0 |
| Challenge, 58 rows | With spoken numbers (`intent-challenge-number-words`) | 0.948 | 0.906 | 1.000 | 0 of 18 | 0 |

How to read these figures:

- **The main dataset is not an independent test.** The same author wrote its 239 rows and then the grammar, so 1.000 is an upper bound.
- **The challenge set is the better estimate.** It was written after the grammar and run once before any change. That first run (0.603) is the best available estimate of accuracy on unfamiliar wording. The fixes that followed were general patterns, such as received-offer wording, number words, prices in taka and delivery questions. Expected labels were not changed.
- **The two wrong change commands on the first run** were "did any buyer send me an offer", read as sending an offer, and "অফার গ্রহণ দুইশো", accepted without a checkable quantity. Both are fixed and covered by unit tests.
- **The 5 challenge misses before spoken numbers were cautious refusals.** Examples: "no thanks, reject it" and "আমি বুঝতে পারছি না, … কথা বলতে চাই" are refused because of a negation, and "দুইশো কেজির অফারে আমি রাজি" was refused because the quantity was said in words.
- **Spoken numbers (November 20, 2026).** "দুইশো কেজির অফারে আমি রাজি" (`challenge-018`) now resolves to accept 200 kg, so intent accuracy on the challenge set rose from 0.931 to 0.948. The row is still listed as a failure, because its expected label was written without a quantity, before numbers in words were supported. Expected labels were not edited. Four refusals caused by negation remain. The 20 added main-set rows were written by the same author as the number rules, so they test the rules, not independent wording.
- **The datasets are AI-written.** They need review and additions from native Bangla speakers before any figure is quoted as field performance. Recorded speech has not been evaluated; browser speech recognition is a separate, untested step.
- **CI fails the build** if any wrong change command or false action appears, if accuracy drops below 0.95 on the main set or 0.90 on the challenge set, or if quantity accuracy drops below 0.95.

## Photo condition suggestions and human review

The worker runs `Xenova/clip-vit-base-patch32` at pinned revision `6b7c523…` with q8 weights on WebAssembly. It compares the photo with five text descriptions (rot or mold, sprouting, cuts or bruises, intact dry skin, no clear view of a bulb). It abstains unless the top score is at least 0.58 and leads the next by at least 0.16 (rule `clip-margin-v1`). One model instance serves every photo on the page.

The suggestion and human review are connected as follows:

1. The browser posts the five scores, model and rule to `POST /v1/lots/{lot}/inspection-photos/{photo}/predictions`.
2. The API rejects other models or rules, incomplete scores and photos that failed quality checks. It derives the label itself and stores it (`photo_predictions`, migration `0016_vision`).
3. Each inspection photo shows its latest saved suggestion after a reload. The review form lists suggestions as hints, but the reviewer's flags are never pre-selected.
4. **Operations → Photo model** compares each photo's latest suggestion with the latest human review of the same inspection. It shows counts, abstentions and a confusion list, plus an agreement rate once there are at least 20 comparable pairs. It also counts suggestions that existed before the review, because seeing a suggestion can influence a reviewer.

### Measured results

- **No accuracy figure exists yet.** The repository holds one real onion photo and there are no reviewed pilot pairs, so an agreement rate will appear only after real reviews accumulate.
- **One functional check passed.** On November 18, 2026 the real worker ran in Edge on `services/api/app/fixtures/onion-storage.webp`. The first run took 17 s, including the model download. The top score was 0.451, below the threshold, so the model abstained and the API stored `uncertain_or_low_quality` with the pinned model and rule.
- **The scores come from the browser.** The server checks their shape, model and rule, but it cannot prove a client ran the model honestly. The UI and Operations say that suggestions are calculated in the browser.

## Forecasts and storage loss

These are unchanged in this round. See the README sections "Market imports, forecasts, and call simulation" and "Try the pilot". Forecast evaluation replays weekly origins using only reports published by each origin. It reports MAE, WAPE, interval coverage and pinball loss, and promotes a candidate only after it beats the baselines by more than 10% MAE on at least 24 comparable replays with 70–95% coverage. Real-series field validation is still pending.

Spoken hold/sell advice now uses the verified-weight loss trend when at least three comparable verifications exist. The read-back says which basis it used: the estimated loss percentage, or zero loss because there was not enough verification.

## Known limitations

- The voice grammar covers the command set of the simulator, not open conversation. It reads numbers said in words only directly before kg or maund. It does not read English "one and a half" or ordinal numbers. Dialect coverage is limited to what the datasets contain.
- Verified farmers and buyers can use the workspace call simulator. All enabled demo and showcase roles can also use it. Live carrier calls, carrier speech recognition and OTP are not enabled.
- Photo suggestions are experimental and uncalibrated. A labelled photo dataset is needed to measure them.
- Field validation with real farmers, market series and storage measurements remains open for every feature.
