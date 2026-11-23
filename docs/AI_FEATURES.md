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

**Two quantities for one slot.** Two numbers in a row, or numbers joined by and, or, বা, অথবা, এবং, আর or ও, are refused as `multiple_quantities`. Examples: "accept offer 200 and 300 kg", "২০০ ৩০০ কেজি" and "200-300 kg". English "two hundred and fifty" is still one number.

**Spoken losses.** A stock-movement command described as a loss ("৫ কেজি পচে গেছে") is marked as a loss:
- The form preselects the loss type.
- A positive amount entered for a loss is stored as a negative change.
- The API refuses such a phrase if it is sent as a weight addition (`voice_loss_mismatch`).

**A negation in an earlier clause.** "no thanks, reject it", "এই দামে দিব না, অফারটা বাদ দিন" and "আমি বুঝতে পারছি না, একজন মানুষের সাথে কথা বলতে চাই" end with a plain command, and the negation refers to something else. When a sentence would otherwise be refused as negated, the resolver splits typed text at commas, দাঁড়ি, semicolons and full stops. It uses the last clause only if all of these hold:

- that clause holds a change command with no negation and no "whether" or "or" (কিনা, নাকি) of its own;
- no earlier clause holds a change command or a quantity.

So "অফার গ্রহণ করব, না", "don't accept, reject it" and "২০০ কেজি না, ৩০০ কেজির অফার নেব" stay negated. A transcript without punctuation, as browser speech usually returns, is never split. বাদ দিন and নাকচ করে দিন are read as rejecting, not as sending an offer.

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
5. **Confirm.** A resolved change is staged with a Bangla read-back and a confirmation step that expires after 2 minutes. The user is warned before the last of three attempts, can cancel a pending change, and inventory changes only after confirmation.
   - **Demo and showcase accounts** see a one-time 4-digit code, as before.
   - **Real accounts** confirm with a personal voice PIN (4–6 digits). The PIN is set on the assistant page after re-entering the account passphrase and is stored with scrypt, like passphrases. It is never displayed or sent to the client.
   - Trivial PINs (one repeated digit, a run such as 1234, or a repeating pattern) are refused.
   - Five wrong PINs across any actions lock the PIN for 15 minutes and cancel the pending change.
   - This is a second secret, not a second device. Carrier keypad entry of the same PIN awaits live telephony.

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
| Main, 271 rows (12 clause rows added) | With clause-scoped negation (`intent-clause-negation`) | 1.000 | 1.000 | 1.000 | 0 of 60 | 0 |
| Challenge, 58 rows | With clause-scoped negation (`intent-challenge-clause-negation`) | 1.000 | 1.000 | 1.000 | 0 of 18 | 0 |

How to read these figures:

- **The main dataset is not an independent test.** The same author wrote its 239 rows and then the grammar, so 1.000 is an upper bound.
- **The challenge set is the better estimate.** It was written after the grammar and run once before any change. That first run (0.603) is the best available estimate of accuracy on unfamiliar wording. The fixes that followed were general patterns, such as received-offer wording, number words, prices in taka and delivery questions. Expected labels were not changed.
- **The two wrong change commands on the first run** were "did any buyer send me an offer", read as sending an offer, and "অফার গ্রহণ দুইশো", accepted without a checkable quantity. Both are fixed and covered by unit tests.
- **The 5 challenge misses before spoken numbers were cautious refusals.** Examples: "no thanks, reject it" and "আমি বুঝতে পারছি না, … কথা বলতে চাই" are refused because of a negation, and "দুইশো কেজির অফারে আমি রাজি" was refused because the quantity was said in words.
- **Spoken numbers (November 20, 2026).** "দুইশো কেজির অফারে আমি রাজি" (`challenge-018`) now resolves to accept 200 kg, so intent accuracy on the challenge set rose from 0.931 to 0.948. Its expected label had been written without a quantity, although the utterance states 200 kg. It was corrected to 200 kg in a separate commit (`intent-challenge-label-fix`: accuracy 0.948, 4 failures). This is the only expected label changed, and the correction records what the speaker said, not what the resolver returns. Four refusals caused by negation remain. The 20 added main-set rows were written by the same author as the number rules, so they test the rules, not independent wording.
- **The challenge set is no longer an independent test.** Its last four misses were fixed by clause-scoped negation, and challenge-018 was relabelled, so 1.000 on it is an upper bound like the main set. The first run (0.603) remains the only estimate on unfamiliar wording. A new set, written by someone other than the rule author and run once, is needed for the next estimate.
- **The datasets are AI-written.** They need review and additions from native Bangla speakers before any figure is quoted as field performance. Recorded speech has not been evaluated; browser speech recognition is a separate, untested step.
- **CI fails the build** if any wrong change command or false action appears, if accuracy drops below 0.95 on the main set or 0.90 on the challenge set, or if quantity accuracy drops below 0.95.

## Optional model fallback for unmatched commands

`app/intent_model.py` asks a language model only when the grammar matched nothing (`no_match`). It is off unless `VOICE_MODEL_FALLBACK=true`. `VOICE_MODEL_PROVIDER` selects the model:

- `meta`: Meta Model API, `muse-spark-1.3`;
- `gemini`: Gemini API, `gemini-3.5-flash-lite`;
- `both`: the two models must agree.

Rules:

- The model returns JSON with one command from the fixed list, or none.
- Refusals are never sent to the model: negated, uncertain, ambiguous, other crop, unsupported action or unreadable quantity.
- A phrase containing a negation or "whether" is never sent.
- A quantity is used only if the grammar read the same amount from the user's words. Otherwise the result is `model_quantity`, which asks the user to say the quantity.
- Results are marked `match: "model"`. Read-back, form check and PIN or code confirmation are unchanged.
- Only the phrase is sent. Calls are limited to 30 per account per 10 minutes, and any failure leaves the grammar's result.

### Measured results (November 20, 2026)

Run with `uv run --env-file .env python -m evals.intent_eval --fallback --dataset <file> --label <name>`, with the model settings in `.env`. Results are in `evals/results/intent-fallback-<provider>-<dataset>`.

| Provider | Main, 277 rows | Challenge, 58 rows | Unmatched phrasings, 20 rows | Wrong change commands |
| --- | --- | --- | --- | --- |
| Meta `muse-spark-1.3` | 1.000 | 1.000 | **0.900** | 0 |
| Gemini `gemini-3.5-flash-lite` | 1.000 | 1.000 | 0.650 (quantity 0.000) | 0 |
| Both must agree | 1.000 | 1.000 | 0.800 | 0 |

How to read these figures:

- **Meta is the default.** It scored best on the unmatched phrasings.
- **The unmatched-phrasings set (`intent-fallback.jsonl`) is small and author-written.** It was written by the same author as the fallback rules, so it shows that the fallback helps, not field accuracy.
- **Most fallback-set rows the model got wrong are cautious abstentions.** The negation guard blocks "আমি আর পারছি না, অফিসের কারো সাথে আলাপ করিয়ে দিন" on purpose.
- **These are live model calls.** Results can vary between runs, and CI does not run them. CI gates only the deterministic grammar.

## Speech-to-text

- **Browser recognition (default).** The browser's own speech recognition (`bn-BD`, Chrome and Edge) fills an editable transcript. PeyajFlow never receives the audio.
- **Gemini fallback.** In browsers without recognition, the phone simulator records up to 12 seconds and, after explicit consent, sends the clip to `gemini-3.5-transcribe` through `POST /v1/simulator/transcribe`.
  - It is off unless `VOICE_TRANSCRIPTION=true`.
  - The audio is never stored.
  - The transcript stays editable and goes through the same grammar and confirmation.
  - Calls are limited to 20 per account per 10 minutes.
- **Measured.** A connectivity check on an English text-to-speech clip was transcribed exactly in 2.8 s. Bangla speech accuracy has not been measured; that needs recordings from native speakers.

## Photo condition suggestions and human review

The worker runs `Xenova/clip-vit-base-patch32` at pinned revision `6b7c523…` with q8 weights on WebAssembly. It compares the photo with five text descriptions (rot or mold, sprouting, cuts or bruises, intact dry skin, no clear view of a bulb). It abstains unless the top score is at least 0.58 and leads the next by at least 0.16 (rule `clip-margin-v1`). One model instance serves every photo on the page.

The transformers.js 3.8.1 library and its ONNX runtime (`ort-wasm-simd-threaded.jsep.mjs` and `.wasm`) are served from PeyajFlow's own site, not a public CDN. At `pnpm dev` and `pnpm build`, `apps/web/scripts/vendor-photo-model.mjs` downloads the npm tarball and checks it against npm's sha512 integrity and each file against a pinned SHA-384. It writes the files to the git-ignored `public/vendor/transformers-3.8.1/`. The worker's own Content-Security-Policy allows scripts only from the site plus WebAssembly compilation, and network requests only to the site and Hugging Face. The model weights still come from Hugging Face at the pinned revision.

The suggestion and human review are connected as follows:

1. The browser posts the five scores, model and rule to `POST /v1/lots/{lot}/inspection-photos/{photo}/predictions`.
2. The API rejects other models or rules, incomplete scores and photos that failed quality checks. It derives the label itself and stores it (`photo_predictions`, migration `0016_vision`).
3. Each inspection photo shows its latest saved suggestion after a reload. The review form lists suggestions as hints, but the reviewer's flags are never pre-selected.
4. **Operations → Photo model** compares each photo's latest suggestion with the latest human review of the same inspection. It shows counts, abstentions and a confusion list, plus an agreement rate once there are at least 20 comparable pairs. It also counts suggestions that existed before the review, because seeing a suggestion can influence a reviewer.

### Measured results

- **Measuring it.** `apps/web/scripts/photo-eval.mjs` runs the real browser model on a folder of photos labelled by people (`labels.csv`: file, label, lot). It reports accuracy, abstention rate, per-class precision and recall, the number of problem photos called clear, and a confusion table. It produces figures only from photos someone supplies; none have been supplied yet.
- **No accuracy figure exists yet.** The repository holds one real onion photo and there are no reviewed pilot pairs, so an agreement rate will appear only after real reviews accumulate.
- **One functional check passed.** On November 18, 2026 the real worker ran in Edge on `services/api/app/fixtures/onion-storage.webp`. The first run took 17 s, including the model download. The top score was 0.451, below the threshold, so the model abstained and the API stored `uncertain_or_low_quality` with the pinned model and rule.
- **Self-hosted runtime check.** On November 20, 2026 the production build ran in Edge, served by `next start`. The worker ran under its new policy on `onion-storage.webp`, sent with no API re-encoding. It made no CDN requests and reported no policy violations, and fetched weights from `huggingface.co` and `us.aws.cdn.hf.co`. It took 25 s with a cold cache, abstained (top score 0.399), and reported the pinned model and rule. The score differs from the earlier run, which used the API's re-encoded JPEG of the same photo.
- **The scores come from the browser.** The server checks their shape, model and rule, but it cannot prove a client ran the model honestly. The UI and Operations say that suggestions are calculated in the browser.

## Forecasts and storage loss

These are unchanged in this round. See the README sections "Market imports, forecasts, and call simulation" and "Try the pilot". Forecast evaluation replays weekly origins using only reports published by each origin. It reports MAE, WAPE, interval coverage and pinball loss, and promotes a candidate only after it beats the baselines by more than 10% MAE on at least 24 comparable replays with 70–95% coverage. Real-series field validation is still pending.

Spoken hold/sell advice now uses the verified-weight loss trend when at least three comparable verifications exist. The read-back says which basis it used: the estimated loss percentage, or zero loss because there was not enough verification.

## Known limitations

### Local feature branch update (November 22, 2026)

`codex/ai-platform-features` adds first-party cited help with full-text/pgvector retrieval, scoped read-only MCP, Ollama embeddings and guarded command previews, four n8n workflows, accessible Recharts views and a durable LangGraph operator-note review. These changes are local, not merged or hosted. Setup and saved measurements are in [INTEGRATIONS.md](INTEGRATIONS.md).

The final retrieval development run (`rag-final-hybrid.json`, November 21 UTC / November 22 Dhaka, base commit `24bf88b` with a dirty worktree) measured hybrid recall@5 1.000 and MRR 0.983 over 60 answerable questions, with all five out-of-scope questions abstaining. Questions and implementation share an author; these are not independent relevance or answer-quality results. The index contains fifteen bge-m3 vectors and three generated context prefixes.

Four crop/quantity-fragment cases were added to the resolver dataset without changing existing labels. The deterministic main set now has 283 rows; it and the 58-row previously tuned challenge set both measured 1.000 with zero wrong change commands. Broader local Qwen/Llama experiments exposed false actions; both candidates remain disabled for live fallback. The Gemma DSPy experiment scored 0/2 on its previously evaluated holdout before and after, so no prompt was promoted. Failed experiments remain in `evals/results`.

The twenty agent scenarios measure bounded orchestration and PostgreSQL checkpoint/resume behavior with controlled synthetic tool responses. They do not measure autonomous reasoning. No carrier messages, external alert delivery, field-validation result or independent challenge result is claimed.

- The voice grammar covers the command set of the simulator, not open conversation. It reads numbers said in words only directly before kg or maund. It does not read English "one and a half" or ordinal numbers. Dialect coverage is limited to what the datasets contain.
- Verified farmers and buyers can use the workspace call simulator. All enabled demo and showcase roles can also use it. Live carrier calls and carrier speech recognition are not enabled. SMS sign-in codes are built but need a configured SMS provider and operator-verified phone numbers.
- Photo suggestions are experimental and uncalibrated. A labelled photo dataset is needed to measure them.
- Field validation with real farmers, market series and storage measurements remains open for every feature.
