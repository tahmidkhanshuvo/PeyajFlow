# Intent evaluation: ollama-llama-main

- Resolver: `rules+ollama:llama3.1:8b-instruct-q4_K_M`
- Commit: `24bf88b` (working tree may differ)
- Dataset: `evals/data/intent.jsonl`, 283 rows
- Run at: 2026-11-21T16:01:50+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.989 |
| Macro precision | 0.986 |
| Macro recall | 0.997 |
| Macro F1 | 0.991 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.989 |
| Quantity and unit exact match (49 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (71 rows) | 0.042 |
| Wrong change commands | 2 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | dev | 145 | 0.986 |
| split | test | 138 | 0.993 |
| lang | banglish | 51 | 1.000 |
| lang | bn | 133 | 0.985 |
| lang | en | 85 | 0.988 |
| lang | mixed | 14 | 1.000 |
| category | ambiguous | 7 | 1.000 |
| category | banglish | 42 | 1.000 |
| category | canonical | 34 | 1.000 |
| category | clause_negation | 12 | 1.000 |
| category | english | 37 | 1.000 |
| category | fragment | 4 | 1.000 |
| category | invalid | 22 | 0.864 |
| category | mixed | 14 | 1.000 |
| category | mixed_crop | 2 | 1.000 |
| category | negation | 19 | 1.000 |
| category | negation_read | 2 | 1.000 |
| category | number_words | 20 | 1.000 |
| category | paraphrase | 47 | 1.000 |
| category | quantity_joiners | 6 | 1.000 |
| category | spelling | 15 | 1.000 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 1.000 | 0.958 | 0.978 | 71 |
| accept | 1.000 | 1.000 | 1.000 | 48 |
| advice | 1.000 | 1.000 | 1.000 | 10 |
| counter | 1.000 | 1.000 | 1.000 | 11 |
| inspection | 1.000 | 1.000 | 1.000 | 10 |
| movement | 1.000 | 1.000 | 1.000 | 14 |
| offers | 1.000 | 1.000 | 1.000 | 11 |
| orders | 1.000 | 1.000 | 1.000 | 10 |
| prices | 0.947 | 1.000 | 0.973 | 18 |
| register | 1.000 | 1.000 | 1.000 | 13 |
| reject | 1.000 | 1.000 | 1.000 | 14 |
| send_offer | 1.000 | 1.000 | 1.000 | 14 |
| stock | 1.000 | 1.000 | 1.000 | 16 |
| support | 0.846 | 1.000 | 0.917 | 11 |
| transport | 1.000 | 1.000 | 1.000 | 12 |

## Confusion (expected → predicted counts)

- abstain → abstain: 68, prices: 1, support: 2
- accept → accept: 48
- advice → advice: 10
- counter → counter: 11
- inspection → inspection: 10
- movement → movement: 14
- offers → offers: 11
- orders → orders: 10
- prices → prices: 18
- register → register: 13
- reject → reject: 14
- send_offer → send_offer: 14
- stock → stock: 16
- support → support: 11
- transport → transport: 12

## Failures (3)

- `invalid-002` 'আপনি কেমন আছেন': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None, 'reason': None}
- `invalid-009` '😀👍': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None, 'reason': None}
- `invalid-021` 'হ্যাঁ': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None, 'reason': None}
