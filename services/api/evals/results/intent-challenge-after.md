# Intent evaluation: challenge-after

- Resolver: `rules`
- Commit: `94554e9` (working tree may differ)
- Dataset: `evals/data/intent-challenge.jsonl`, 58 rows
- Run at: 2026-11-18T09:38:27+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.931 |
| Macro precision | 0.921 |
| Macro recall | 0.890 |
| Macro F1 | 0.899 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.914 |
| Quantity and unit exact match (8 rows) | 1.000 |
| Unit accuracy | 1.000 |
| Acted when it should abstain (18 rows) | 0.000 |
| Wrong change commands | 0 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | challenge | 58 | 0.931 |
| lang | banglish | 5 | 1.000 |
| lang | bn | 29 | 0.897 |
| lang | en | 24 | 0.958 |
| category | challenge | 58 | 0.931 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.818 | 1.000 | 0.900 | 18 |
| accept | 1.000 | 0.857 | 0.923 | 7 |
| advice | 1.000 | 1.000 | 1.000 | 3 |
| counter | 1.000 | 1.000 | 1.000 | 2 |
| inspection | 1.000 | 1.000 | 1.000 | 2 |
| movement | 1.000 | 1.000 | 1.000 | 3 |
| offers | 1.000 | 1.000 | 1.000 | 3 |
| orders | 1.000 | 1.000 | 1.000 | 2 |
| prices | 1.000 | 1.000 | 1.000 | 5 |
| register | 1.000 | 1.000 | 1.000 | 2 |
| reject | 0.000 | 0.000 | 0.000 | 2 |
| send_offer | 1.000 | 1.000 | 1.000 | 2 |
| stock | 1.000 | 1.000 | 1.000 | 3 |
| support | 1.000 | 0.500 | 0.667 | 2 |
| transport | 1.000 | 1.000 | 1.000 | 2 |

## Confusion (expected → predicted counts)

- abstain → abstain: 18
- accept → abstain: 1, accept: 6
- advice → advice: 3
- counter → counter: 2
- inspection → inspection: 2
- movement → movement: 3
- offers → offers: 3
- orders → orders: 2
- prices → prices: 5
- register → register: 2
- reject → abstain: 2
- send_offer → send_offer: 2
- stock → stock: 3
- support → abstain: 1, support: 1
- transport → transport: 2

## Failures (5)

- `challenge-018` 'হ্যাঁ ভাই, দুইশো কেজির অফারে আমি রাজি': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'number_words'}
- `challenge-024` 'এই দামে দিব না, অফারটা বাদ দিন': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
- `challenge-025` 'no thanks, reject it': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
- `challenge-039` 'আমি বুঝতে পারছি না, একজন মানুষের সাথে কথা বলতে চাই': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
- `challenge-046` 'অফারটা নেব নাকি বাদ দেব বুঝছি না': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
