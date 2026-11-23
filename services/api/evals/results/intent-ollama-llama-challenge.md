# Intent evaluation: ollama-llama-challenge

- Resolver: `rules+ollama:llama3.1:8b-instruct-q4_K_M`
- Commit: `24bf88b` (working tree may differ)
- Dataset: `evals/data/intent-challenge.jsonl`, 58 rows
- Run at: 2026-11-21T16:02:09+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.983 |
| Macro precision | 0.978 |
| Macro recall | 0.996 |
| Macro F1 | 0.985 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.983 |
| Quantity and unit exact match (9 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (18 rows) | 0.056 |
| Wrong change commands | 1 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | challenge | 58 | 0.983 |
| lang | banglish | 5 | 1.000 |
| lang | bn | 29 | 1.000 |
| lang | en | 24 | 0.958 |
| category | challenge | 58 | 0.983 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 1.000 | 0.944 | 0.971 | 18 |
| accept | 1.000 | 1.000 | 1.000 | 7 |
| advice | 1.000 | 1.000 | 1.000 | 3 |
| counter | 1.000 | 1.000 | 1.000 | 2 |
| inspection | 1.000 | 1.000 | 1.000 | 2 |
| movement | 1.000 | 1.000 | 1.000 | 3 |
| offers | 1.000 | 1.000 | 1.000 | 3 |
| orders | 1.000 | 1.000 | 1.000 | 2 |
| prices | 1.000 | 1.000 | 1.000 | 5 |
| register | 1.000 | 1.000 | 1.000 | 2 |
| reject | 1.000 | 1.000 | 1.000 | 2 |
| send_offer | 1.000 | 1.000 | 1.000 | 2 |
| stock | 1.000 | 1.000 | 1.000 | 3 |
| support | 0.667 | 1.000 | 0.800 | 2 |
| transport | 1.000 | 1.000 | 1.000 | 2 |

## Confusion (expected → predicted counts)

- abstain → abstain: 17, support: 1
- accept → accept: 7
- advice → advice: 3
- counter → counter: 2
- inspection → inspection: 2
- movement → movement: 3
- offers → offers: 3
- orders → orders: 2
- prices → prices: 5
- register → register: 2
- reject → reject: 2
- send_offer → send_offer: 2
- stock → stock: 3
- support → support: 2
- transport → transport: 2

## Failures (1)

- `challenge-050` 'hello is anyone there': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None, 'reason': None}
