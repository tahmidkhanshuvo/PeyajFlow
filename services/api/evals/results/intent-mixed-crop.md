# Intent evaluation: mixed-crop

- Resolver: `rules`
- Commit: `55b5586` (working tree may differ)
- Dataset: `evals/data/intent.jsonl`, 279 rows
- Run at: 2026-11-20T12:56:31+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 1.000 |
| Macro precision | 1.000 |
| Macro recall | 1.000 |
| Macro F1 | 1.000 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 1.000 |
| Quantity and unit exact match (49 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (67 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | dev | 141 | 1.000 |
| split | test | 138 | 1.000 |
| lang | banglish | 51 | 1.000 |
| lang | bn | 132 | 1.000 |
| lang | en | 82 | 1.000 |
| lang | mixed | 14 | 1.000 |
| category | ambiguous | 7 | 1.000 |
| category | banglish | 42 | 1.000 |
| category | canonical | 34 | 1.000 |
| category | clause_negation | 12 | 1.000 |
| category | english | 37 | 1.000 |
| category | invalid | 22 | 1.000 |
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
| abstain | 1.000 | 1.000 | 1.000 | 67 |
| accept | 1.000 | 1.000 | 1.000 | 48 |
| advice | 1.000 | 1.000 | 1.000 | 10 |
| counter | 1.000 | 1.000 | 1.000 | 11 |
| inspection | 1.000 | 1.000 | 1.000 | 10 |
| movement | 1.000 | 1.000 | 1.000 | 14 |
| offers | 1.000 | 1.000 | 1.000 | 11 |
| orders | 1.000 | 1.000 | 1.000 | 10 |
| prices | 1.000 | 1.000 | 1.000 | 18 |
| register | 1.000 | 1.000 | 1.000 | 13 |
| reject | 1.000 | 1.000 | 1.000 | 14 |
| send_offer | 1.000 | 1.000 | 1.000 | 14 |
| stock | 1.000 | 1.000 | 1.000 | 16 |
| support | 1.000 | 1.000 | 1.000 | 11 |
| transport | 1.000 | 1.000 | 1.000 | 12 |

## Confusion (expected → predicted counts)

- abstain → abstain: 67
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

## Failures (0)

None.
