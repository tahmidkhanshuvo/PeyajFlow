# Intent evaluation: fallback-gemini-intent-fallback

- Resolver: `rules+gemini:gemini-3.5-flash-lite`
- Commit: `100dab3` (working tree may differ)
- Dataset: `evals/data/intent-fallback.jsonl`, 20 rows
- Run at: 2026-11-20T12:23:12+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.650 |
| Macro precision | 0.550 |
| Macro recall | 0.500 |
| Macro F1 | 0.497 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.650 |
| Quantity and unit exact match (1 rows) | 0.000 |
| Unit accuracy | 0.000 |
| Acted when it should abstain (7 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | fallback | 20 | 0.650 |
| lang | banglish | 2 | 0.500 |
| lang | bn | 15 | 0.600 |
| lang | en | 3 | 1.000 |
| category | fallback | 20 | 0.650 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.500 | 1.000 | 0.667 | 7 |
| accept | 1.000 | 0.333 | 0.500 | 3 |
| inspection | 1.000 | 1.000 | 1.000 | 1 |
| movement | 0.000 | 0.000 | 0.000 | 1 |
| offers | 0.000 | 0.000 | 0.000 | 1 |
| prices | 1.000 | 0.667 | 0.800 | 3 |
| register | 0.000 | 0.000 | 0.000 | 1 |
| reject | 1.000 | 1.000 | 1.000 | 1 |
| stock | 1.000 | 1.000 | 1.000 | 1 |
| support | 0.000 | 0.000 | 0.000 | 1 |

## Confusion (expected → predicted counts)

- abstain → abstain: 7
- accept → abstain: 2, accept: 1
- inspection → inspection: 1
- movement → abstain: 1
- offers → abstain: 1
- prices → abstain: 1, prices: 2
- register → abstain: 1
- reject → reject: 1
- stock → stock: 1
- support → abstain: 1

## Failures (7)

- `fallback-001` 'ওরা যা দিতে চাইল ওটাই রেখে দেন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-003` 'আজকে পাবনার হাটে পেঁয়াজ কেমন যাচ্ছে': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-005` 'কেউ কি কিছু কিনতে খবর দিয়েছে': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-008` 'মাচার নিচের বস্তাগুলো ফুটো হয়ে ৩০ কেজি পড়ে গেছে': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '30', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-009` 'নতুন তোলা পেঁয়াজগুলো খাতায় তুলে রাখেন': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-011` 'আমি আর পারছি না, অফিসের কারো সাথে আলাপ করিয়ে দিন': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-012` 'oder dewa ta mene nilam': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
