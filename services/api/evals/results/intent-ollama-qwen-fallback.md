# Intent evaluation: ollama-qwen-fallback

- Resolver: `rules+ollama:qwen2.5:7b-instruct-q4_K_M`
- Commit: `24bf88b` (working tree may differ)
- Dataset: `evals/data/intent-fallback.jsonl`, 20 rows
- Run at: 2026-11-21T15:50:50+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.800 |
| Macro precision | 0.791 |
| Macro recall | 0.727 |
| Macro F1 | 0.739 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.850 |
| Quantity and unit exact match (1 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (7 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | fallback | 20 | 0.800 |
| lang | banglish | 2 | 0.000 |
| lang | bn | 15 | 0.867 |
| lang | en | 3 | 1.000 |
| category | fallback | 20 | 0.800 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.700 | 1.000 | 0.824 | 7 |
| accept | 1.000 | 0.333 | 0.500 | 3 |
| inspection | 1.000 | 1.000 | 1.000 | 1 |
| movement | 1.000 | 1.000 | 1.000 | 1 |
| offers | 1.000 | 1.000 | 1.000 | 1 |
| orders | 0.000 | 0.000 | 0.000 | 0 |
| prices | 1.000 | 0.667 | 0.800 | 3 |
| register | 1.000 | 1.000 | 1.000 | 1 |
| reject | 1.000 | 1.000 | 1.000 | 1 |
| stock | 1.000 | 1.000 | 1.000 | 1 |
| support | 0.000 | 0.000 | 0.000 | 1 |

## Confusion (expected → predicted counts)

- abstain → abstain: 7
- accept → abstain: 1, accept: 1, orders: 1
- inspection → inspection: 1
- movement → movement: 1
- offers → offers: 1
- prices → abstain: 1, prices: 2
- register → register: 1
- reject → reject: 1
- stock → stock: 1
- support → abstain: 1

## Failures (4)

- `fallback-001` 'ওরা যা দিতে চাইল ওটাই রেখে দেন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-011` 'আমি আর পারছি না, অফিসের কারো সাথে আলাপ করিয়ে দিন': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-012` 'oder dewa ta mene nilam': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None, 'reason': None}
- `fallback-013` 'haat e aj ki rokom jacche': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
