# Intent evaluation: fallback-both-intent-fallback

- Resolver: `rules+both:muse-spark-1.3+gemini-3.5-flash-lite`
- Commit: `100dab3` (working tree may differ)
- Dataset: `evals/data/intent-fallback.jsonl`, 20 rows
- Run at: 2026-11-20T12:26:33+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.800 |
| Macro precision | 0.764 |
| Macro recall | 0.733 |
| Macro F1 | 0.728 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.800 |
| Quantity and unit exact match (1 rows) | 0.000 |
| Unit accuracy | 0.000 |
| Acted when it should abstain (7 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | fallback | 20 | 0.800 |
| lang | banglish | 2 | 0.500 |
| lang | bn | 15 | 0.867 |
| lang | en | 3 | 0.667 |
| category | fallback | 20 | 0.800 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.636 | 1.000 | 0.778 | 7 |
| accept | 1.000 | 0.333 | 0.500 | 3 |
| inspection | 1.000 | 1.000 | 1.000 | 1 |
| movement | 0.000 | 0.000 | 0.000 | 1 |
| offers | 1.000 | 1.000 | 1.000 | 1 |
| prices | 1.000 | 1.000 | 1.000 | 3 |
| register | 1.000 | 1.000 | 1.000 | 1 |
| reject | 1.000 | 1.000 | 1.000 | 1 |
| stock | 1.000 | 1.000 | 1.000 | 1 |
| support | 0.000 | 0.000 | 0.000 | 1 |

## Confusion (expected → predicted counts)

- abstain → abstain: 7
- accept → abstain: 2, accept: 1
- inspection → inspection: 1
- movement → abstain: 1
- offers → offers: 1
- prices → prices: 3
- register → register: 1
- reject → reject: 1
- stock → stock: 1
- support → abstain: 1

## Failures (4)

- `fallback-008` 'মাচার নিচের বস্তাগুলো ফুটো হয়ে ৩০ কেজি পড়ে গেছে': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '30', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-011` 'আমি আর পারছি না, অফিসের কারো সাথে আলাপ করিয়ে দিন': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-012` 'oder dewa ta mene nilam': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-014` 'go ahead with what the trader proposed': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
