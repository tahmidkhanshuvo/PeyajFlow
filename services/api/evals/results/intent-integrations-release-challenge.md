# Intent evaluation: integrations-release-challenge

- Resolver: `rules`
- Commit: `24bf88b` (working tree may differ)
- Dataset: `evals/data/intent-challenge.jsonl`, 58 rows
- Run at: 2026-11-21T22:12:53+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 1.000 |
| Macro precision | 1.000 |
| Macro recall | 1.000 |
| Macro F1 | 1.000 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 1.000 |
| Quantity and unit exact match (9 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (18 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | challenge | 58 | 1.000 |
| lang | banglish | 5 | 1.000 |
| lang | bn | 29 | 1.000 |
| lang | en | 24 | 1.000 |
| category | challenge | 58 | 1.000 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 1.000 | 1.000 | 1.000 | 18 |
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
| support | 1.000 | 1.000 | 1.000 | 2 |
| transport | 1.000 | 1.000 | 1.000 | 2 |

## Confusion (expected → predicted counts)

- abstain → abstain: 18
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

## Failures (0)

None.
