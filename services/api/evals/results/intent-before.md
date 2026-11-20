# Intent evaluation: before

- Resolver: `legacy-exact-match`
- Commit: `57b0034` (working tree may differ)
- Dataset: `evals/data/intent.jsonl`, 239 rows
- Run at: 2026-11-18T09:23:23+00:00

| Metric | Value |
| --- | --- |
| Intent accuracy | 0.360 |
| Macro precision | 0.944 |
| Macro recall | 0.245 |
| Macro F1 | 0.326 |
| Outcome accuracy (resolved / ambiguous / negated / unknown) | 0.251 |
| Quantity and unit exact match (33 rows) | 0.212 |
| Unit accuracy | 0.212 |
| Acted when it should abstain (48 rows) | 0.021 |
| Wrong change commands | 1 |

## Accuracy by group

| Group | Value | Rows | Accuracy |
| --- | --- | --- | --- |
| split | dev | 122 | 0.369 |
| split | test | 117 | 0.350 |
| lang | banglish | 46 | 0.087 |
| lang | bn | 108 | 0.454 |
| lang | en | 71 | 0.465 |
| lang | mixed | 14 | 0.000 |
| category | ambiguous | 7 | 1.000 |
| category | banglish | 42 | 0.000 |
| category | canonical | 34 | 1.000 |
| category | english | 37 | 0.000 |
| category | invalid | 22 | 0.955 |
| category | mixed | 14 | 0.000 |
| category | negation | 19 | 1.000 |
| category | negation_read | 2 | 0.000 |
| category | paraphrase | 47 | 0.000 |
| category | spelling | 15 | 0.333 |

## Per command

| Label | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| abstain | 0.236 | 0.979 | 0.381 | 48 |
| accept | 0.917 | 0.282 | 0.431 | 39 |
| advice | 1.000 | 0.200 | 0.333 | 10 |
| counter | 1.000 | 0.200 | 0.333 | 10 |
| inspection | 1.000 | 0.200 | 0.333 | 10 |
| movement | 1.000 | 0.167 | 0.286 | 12 |
| offers | 1.000 | 0.182 | 0.308 | 11 |
| orders | 1.000 | 0.200 | 0.333 | 10 |
| prices | 1.000 | 0.167 | 0.286 | 18 |
| register | 1.000 | 0.167 | 0.286 | 12 |
| reject | 1.000 | 0.200 | 0.333 | 10 |
| send_offer | 1.000 | 0.182 | 0.308 | 11 |
| stock | 1.000 | 0.188 | 0.316 | 16 |
| support | 1.000 | 0.200 | 0.333 | 10 |
| transport | 1.000 | 0.167 | 0.286 | 12 |

## Confusion (expected → predicted counts)

- abstain → abstain: 47, accept: 1
- accept → abstain: 28, accept: 11
- advice → abstain: 8, advice: 2
- counter → abstain: 8, counter: 2
- inspection → abstain: 8, inspection: 2
- movement → abstain: 10, movement: 2
- offers → abstain: 9, offers: 2
- orders → abstain: 8, orders: 2
- prices → abstain: 15, prices: 3
- register → abstain: 10, register: 2
- reject → abstain: 8, reject: 2
- send_offer → abstain: 9, send_offer: 2
- stock → abstain: 13, stock: 3
- support → abstain: 8, support: 2
- transport → abstain: 10, transport: 2

## Failures (179)

- `paraphrase-001` 'আজকের বাজার দর কত?': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-002` 'পেঁয়াজের দাম কত': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-003` 'দাম কত যাচ্ছে': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-004` 'পাবনার দর বলুন': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-005` 'বাজারদর জানতে চাই': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-006` 'আমার মজুত কত আছে': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-007` 'আমার কাছে কত কেজি পেঁয়াজ আছে': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-008` 'মজুতের অবস্থা বলুন': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-009` 'গুদামে কত মাল আছে': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-010` 'এখন বিক্রি করব নাকি রাখব': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-011` 'বিক্রি করব না অপেক্ষা করব, পরামর্শ দিন': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-012` 'কোন কোন অফার এসেছে': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-013` 'নতুন অফার আছে কি': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-014` 'অফারগুলো দেখান': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-015` 'আমার অর্ডারের খবর কী': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-016` 'অর্ডারগুলো দেখান': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-017` 'অর্ডার কোথায় আছে': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-018` 'অফারটা গ্রহণ করছি': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-019` 'অফারটি গ্রহণ করলাম': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-020` 'এই অফারে রাজি আছি': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-021` 'অফারটা নিতে চাই': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-022` '২০০ কেজির অফারটা নেব': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '200', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-023` '৫ মণের অফারটা গ্রহণ করুন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '5', 'unit': 'maund'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-024` 'অফারটি প্রত্যাখ্যান করছি': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-025` 'এই অফার নাকচ করুন': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-026` 'পাল্টা দর দিতে চাই': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-027` 'পাল্টা প্রস্তাব দিন': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-028` 'পাল্টা অফার ১৫০ কেজি': expected {'status': 'resolved', 'tool': 'counter', 'quantity': '150', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-029` 'ওজন ঠিক করতে চাই': expected {'status': 'resolved', 'tool': 'movement', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-030` 'মজুতের ওজন সমন্বয় করুন': expected {'status': 'resolved', 'tool': 'movement', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-031` '৫ কেজি পেঁয়াজ পচে গেছে': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '5', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-032` '১০ কেজি ক্ষতি হয়েছে': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '10', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-033` 'নতুন মজুত নিবন্ধন করতে চাই': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-034` 'নতুন লট যোগ করুন': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-035` '১০০০ কেজি নতুন মজুত নিবন্ধন': expected {'status': 'resolved', 'tool': 'register', 'quantity': '1000', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-036` 'অফার দিতে চাই': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-037` 'এই মজুতের জন্য অফার পাঠাতে চাই': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-038` '৩০০ কেজির অফার পাঠান': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': '300', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-039` 'ট্রাক লাগবে': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-040` 'পরিবহনের ব্যবস্থা করুন': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-041` 'মাল পাঠাতে গাড়ি দরকার': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-042` 'পরিদর্শন দরকার': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-043` 'কেউ এসে মজুত দেখে যান': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-044` 'গুদাম পরিদর্শন করাতে চাই': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-045` 'সাহায্য চাই': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-046` 'এজেন্টের সাথে কথা বলতে চাই': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `paraphrase-047` 'আমাকে সাহায্য করুন': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-001` 'bazar dor koto': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-002` 'peyajer dam koto': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-003` 'aajker dam': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-004` 'dor bolen': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-005` 'amar mojut': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-006` 'mojut koto ase': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-007` 'amar koto kg ache': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-008` 'poramorsho din': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-009` 'bikri korbo naki rakhbo': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-010` 'ekhon bechbo na rakhbo': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-011` 'offer gulo dekhao': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-012` 'notun offer ache?': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-013` 'ki offer ase': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-014` 'order er khobor': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-015` 'amar order gulo': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-016` 'offer accept korbo': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-017` 'offer ta nibo': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-018` 'offer grohon korlam': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-019` 'offer e raji': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-020` '200 kg offer accept koro': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '200', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-021` '5 mon er offer ta nibo': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '5', 'unit': 'maund'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-022` 'offer accept 2.5 mon': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '2.5', 'unit': 'maund'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-023` 'offer reject koro': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-024` 'offer ta nakoch': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-025` 'palta offer dibo': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-026` 'counter offer dite chai': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-027` 'ojon thik korbo': expected {'status': 'resolved', 'tool': 'movement', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-028` '10 kg poche geche': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '10', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-029` 'stock adjust koro': expected {'status': 'resolved', 'tool': 'movement', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-030` 'notun mojut register': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-031` 'notun lot khulbo': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-032` '500 kg notun mojut': expected {'status': 'resolved', 'tool': 'register', 'quantity': '500', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-033` 'offer pathao': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-034` 'offer dite chai': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-035` '300 kg er offer pathabo': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': '300', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-036` 'truck lagbe': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-037` 'transport chai': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-038` 'gari dorkar': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-039` 'inspection chai': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-040` 'keu ese mojut dekhe jan': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-041` 'sahajjo chai': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `banglish-042` 'agent er help lagbe': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-001` 'what is the onion price today': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-002` 'market price': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-003` 'show market prices': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-004` 'price please': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-005` 'how much stock do I have': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-006` 'show my stock': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-007` 'my inventory': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-008` 'should I sell or hold': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-009` 'give me advice': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-010` 'hold or sell advice': expected {'status': 'resolved', 'tool': 'advice', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-011` 'show offers': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-012` 'any new offers?': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-013` 'list my offers': expected {'status': 'resolved', 'tool': 'offers', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-014` 'show my orders': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-015` 'order status': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-016` 'accept the offer': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-017` 'I accept this offer': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-018` 'accept the 200 kg offer': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '200', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-019` 'accept offer for 3 maunds': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '3', 'unit': 'maund'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-020` 'yes, accept it': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-021` 'reject the offer': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-022` 'decline this offer': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-023` 'make a counter offer': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-024` 'counteroffer 150 kg': expected {'status': 'resolved', 'tool': 'counter', 'quantity': '150', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-025` 'record a weight adjustment': expected {'status': 'resolved', 'tool': 'movement', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-026` '5 kg rotted': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '5', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-027` 'record a loss of 12 kg': expected {'status': 'resolved', 'tool': 'movement', 'quantity': '12', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-028` 'register a new lot': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-029` 'add a new lot of 800 kg': expected {'status': 'resolved', 'tool': 'register', 'quantity': '800', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-030` 'make an offer': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-031` 'send an offer for 400 kg': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': '400', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-032` 'I need a truck': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-033` 'book transport': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-034` 'I need an inspection': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-035` 'please inspect my storage': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-036` 'I need help': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `english-037` 'talk to an agent': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-001` 'অফার accept করব': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-002` '২০০ kg অফার গ্রহণ': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '200', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-003` 'offer টা নিব': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-004` 'price কত': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-005` 'আমার stock কত': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-006` 'order দেখাও': expected {'status': 'resolved', 'tool': 'orders', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-007` 'counter offer দিব': expected {'status': 'resolved', 'tool': 'counter', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-008` 'truck লাগবে': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-009` 'inspection চাই': expected {'status': 'resolved', 'tool': 'inspection', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-010` 'help দরকার': expected {'status': 'resolved', 'tool': 'support', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-011` 'অফার reject করো': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-012` '৫ mon অফার accept': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '5', 'unit': 'maund'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-013` 'নতুন lot register': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `mixed-014` 'offer পাঠাও': expected {'status': 'resolved', 'tool': 'send_offer', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-001` 'অফার গ্রহন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-002` 'অফার প্রত্যাখান': expected {'status': 'resolved', 'tool': 'reject', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-003` 'আমার মজুদ': expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-004` 'মজুদ নিবন্ধন': expected {'status': 'resolved', 'tool': 'register', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-005` 'পরিবহণ চাই': expected {'status': 'resolved', 'tool': 'transport', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-006` 'অফার গ্রহণ ২০০ কেজী': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '200', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-007` 'অফার গ্রহণ ২০০ কিলো': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '200', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-008` 'অফার গ্রহণ ১,০০০ কেজি': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '1000', 'unit': 'kg'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-009` 'অফার গ্রহণ ৫ মন': expected {'status': 'resolved', 'tool': 'accept', 'quantity': '5', 'unit': 'maund'}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `spelling-012` 'অফার\u200c গ্রহণ': expected {'status': 'resolved', 'tool': 'accept', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-001` 'অফার গ্রহণ করব না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-002` 'অফারটা নেব না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-003` 'এই অফারে রাজি নই': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-004` 'অফার গ্রহণ করিনি': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-005` 'অফার প্রত্যাখ্যান করবেন না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-006` 'পরিবহন চাই না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-007` 'ট্রাক লাগবে না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-008` 'পরিদর্শন দরকার নেই': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-009` 'অফার পাঠাবেন না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-010` 'নতুন মজুত নিবন্ধন করব না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-011` 'ওজন সমন্বয় করবেন না': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-012` 'অফার গ্রহণ ২০০ কেজি না, ৩০০ কেজি': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-013` 'offer accept korbo na': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-014` 'offer ta nibo na': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-015` 'transport lagbe na': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-016` "don't accept the offer": expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-017` 'do not reject this offer': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-018` "I don't need a truck": expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation-019` 'never send an offer': expected {'status': 'negated', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation_read-001` 'দাম জানি না, দর বলুন': expected {'status': 'resolved', 'tool': 'prices', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `negation_read-002` "I don't know my stock, show my stock": expected {'status': 'resolved', 'tool': 'stock', 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-001` 'অফার গ্রহণ নাকি প্রত্যাখ্যান': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-002` 'accept or reject the offer': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-003` 'অফার পাঠাও আর ট্রাক লাগবে': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-004` 'অফার গ্রহণ ২০০ কেজি ৩০০ কেজি': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-005` 'আমার মজুতের দাম কত': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-006` 'offer accept korbo kina': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `ambiguous-007` 'show offers and orders': expected {'status': 'ambiguous', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None, 'reason': 'no_match'}
- `invalid-022` 'অফার গ্রহণ ০ কেজি': expected {'status': 'unknown', 'tool': None, 'quantity': None, 'unit': None}, got {'status': 'resolved', 'tool': 'accept', 'quantity': '0', 'unit': 'kg', 'reason': None}
