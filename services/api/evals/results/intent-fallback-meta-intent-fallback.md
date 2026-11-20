# Intent evaluation: fallback-meta-intent-fallback

- Resolver: `rules+meta:muse-spark-1.3`
- Commit: `100dab3` (working tree may differ)
- Dataset: `evals/data/intent-fallback.jsonl`, 20 rows
- Run at: 2026-11-20T12:20:02+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.900 |
| Macro precision | 0.878 |
| Macro recall | 0.867 |
| Macro F1 | 0.868 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.900 |
| Quantity and unit exact match (1 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (7 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | fallback | 20 | 0.900 |
| lang | banglish | 2 | 1.000 |
| lang | bn | 15 | 0.867 |
| lang | en | 3 | 1.000 |
| category | fallback | 20 | 0.900 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.778 | 1.000 | 0.875 | 7 |
| accept | 1.000 | 0.667 | 0.800 | 3 |
| inspection | 1.000 | 1.000 | 1.000 | 1 |
| movement | 1.000 | 1.000 | 1.000 | 1 |
| offers | 1.000 | 1.000 | 1.000 | 1 |
| prices | 1.000 | 1.000 | 1.000 | 3 |
| register | 1.000 | 1.000 | 1.000 | 1 |
| reject | 1.000 | 1.000 | 1.000 | 1 |
| stock | 1.000 | 1.000 | 1.000 | 1 |
| support | 0.000 | 0.000 | 0.000 | 1 |

## Confusion (expected → predicted counts)

- abstain → abstain: 7
- accept → abstain: 1, accept: 2
- inspection → inspection: 1
- movement → movement: 1
- offers → offers: 1
- prices → prices: 3
- register → register: 1
- reject → reject: 1
- stock → stock: 1
- support → abstain: 1

## Failures (2)

- `fallback-001` 'ওরা যা দিতে চাইল ওটাই রেখে দেন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `fallback-011` 'আমি আর পারছি না, অফিসের কারো সাথে আলাপ করিয়ে দিন': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
