# Intent evaluation: challenge-first-run

- Resolver: `rules`
- Commit: `57b0034` (working tree may differ)
- Dataset: `evals/data/intent-challenge.jsonl`, 58 rows
- Run at: 2026-11-18T09:27:07+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.603 |
| Macro precision | 0.600 |
| Macro recall | 0.454 |
| Macro F1 | 0.485 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.638 |
| Quantity and unit exact match (8 rows) | 0.500 |
| Unit accuracy | 0.500 |
| Acted when it should abstain (18 rows) | 0.111 |
| Wrong change commands | 2 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | challenge | 58 | 0.603 |
| lang | banglish | 5 | 0.600 |
| lang | bn | 29 | 0.621 |
| lang | en | 24 | 0.583 |
| category | challenge | 58 | 0.603 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.471 | 0.889 | 0.615 | 18 |
| accept | 0.857 | 0.857 | 0.857 | 7 |
| advice | 1.000 | 0.333 | 0.500 | 3 |
| counter | 1.000 | 0.500 | 0.667 | 2 |
| inspection | 0.000 | 0.000 | 0.000 | 2 |
| movement | 1.000 | 0.333 | 0.500 | 3 |
| offers | 0.500 | 0.333 | 0.400 | 3 |
| orders | 0.000 | 0.000 | 0.000 | 2 |
| prices | 1.000 | 0.400 | 0.571 | 5 |
| register | 1.000 | 1.000 | 1.000 | 2 |
| reject | 0.000 | 0.000 | 0.000 | 2 |
| send_offer | 0.500 | 0.500 | 0.500 | 2 |
| stock | 0.667 | 0.667 | 0.667 | 3 |
| support | 0.000 | 0.000 | 0.000 | 2 |
| transport | 1.000 | 1.000 | 1.000 | 2 |

## Confusion (expected → predicted counts)

- abstain → abstain: 16, accept: 1, orders: 1
- accept → accept: 6, offers: 1
- advice → abstain: 2, advice: 1
- counter → abstain: 1, counter: 1
- inspection → abstain: 1, stock: 1
- movement → abstain: 2, movement: 1
- offers → abstain: 1, offers: 1, send_offer: 1
- orders → abstain: 2
- prices → abstain: 3, prices: 2
- register → register: 2
- reject → abstain: 2
- send_offer → abstain: 1, send_offer: 1
- stock → abstain: 1, stock: 2
- support → abstain: 2
- transport → transport: 2

## Failures (24)

- `challenge-001` 'ভাই আজকে পাবনায় পেঁয়াজ কত টাকা কেজি যাচ্ছে': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-003` 'vai ajke peyaj koto taka kg': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-004` 'how much is onion selling for': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-008` 'what do I have left in storage': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-009` 'এখন বেচে দেওয়া ভালো নাকি আরও কিছুদিন রেখে দেব': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-011` 'ekhon bikri korle labh hobe naki pore': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-012` 'কেউ কি আমার পেঁয়াজ কিনতে চেয়েছে': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-013` 'did any buyer send me an offer': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None, 'reason': None}
- `challenge-015` 'আমার মাল কবে পৌঁছাবে': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-016` 'where is my delivery': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-022` '৪ মণের অফারটা নিয়ে নিন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '4', 'unit': 'maund'}, got {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None, 'reason': None}
- `challenge-024` 'এই দামে দিব না, অফারটা বাদ দিন': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
- `challenge-025` 'no thanks, reject it': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
- `challenge-027` 'counter at 40 taka per kg': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-028` 'গতকাল ওজন করে দেখি ২০ কেজি কম': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '20', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-030` 'about 3 kg went bad this week': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '3', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-034` 'I want to buy 500 kg from that lot': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': '500', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-037` 'আমার গুদামের পেঁয়াজ একবার কেউ এসে চেক করুক': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None, 'reason': None}
- `challenge-038` 'can someone check my onions for rot': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-039` 'আমি বুঝতে পারছি না, একজন মানুষের সাথে কথা বলতে চাই': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-040` 'connect me to a person': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `challenge-046` 'অফারটা নেব নাকি বাদ দেব বুঝছি না': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'negated'}
- `challenge-053` 'আমার অর্ডারটা ক্যানসেল করুন': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None, 'reason': None}
- `challenge-055` 'অফার গ্রহণ দুইশো': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None, 'reason': None}
