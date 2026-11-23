"""Curated original bilingual help, licensed explicitly for this knowledge base."""

import argparse

from sqlalchemy.orm import Session

from app.database import database_engine
from app.knowledge import ingest

SECTIONS = [
    (
        "units",
        "মণ ও কেজি · Maund conversion",
        "মণে কত কেজি তা মজুতের সম্মত রূপান্তরের উপর নির্ভর করে। নিবন্ধনের সময় প্রতি মণে কেজি লিখুন; কোনো স্থির মান ধরে নেওয়া হয় না। A maund uses the lot's recorded, agreed kg-per-maund conversion. Enter that conversion when registering stock; PeyajFlow never assumes a universal value.",
    ),
    (
        "accept",
        "অফার গ্রহণ · Accept an offer",
        "অফার গ্রহণ করতে অফারের পরিমাণ, প্রতি কেজির দর, মোট মূল্য, গন্তব্য ও পরিবহনের দায়িত্ব দেখুন। অ্যাপে নিশ্চিত করুন। কল বা এসএমএস সিমুলেটরে শর্ত শুনে পিন বা ডেমো কোড দিন। To accept an offer, review quantity, price, total, destination and transport responsibility. Confirm in the app. In the call or SMS simulator, listen to the read-back and enter your PIN or demo code. Only confirmed acceptance reserves stock.",
    ),
    (
        "forecast",
        "পূর্বাভাস নেই · Missing forecast",
        "পূর্বাভাস না থাকলে বাজারদরের পর্যবেক্ষণ পুরোনো বা অপর্যাপ্ত হতে পারে। সঠিক জেলা, গ্রেড ও দরধরন বেছে নিন। Forecasts abstain when approved observations are stale or insufficient. Select the correct district, grade and price type. The outlook supports 7, 14 and 28 days and includes an uncertainty range. Synthetic series are demonstration data, not field evidence.",
    ),
    (
        "inspection",
        "ছবি ও পরিদর্শন · Photo inspection",
        "ছবিতে পচা, ছত্রাক, অঙ্কুর বা ক্ষতি দেখা গেলে পর্যবেক্ষণ লিখুন এবং পরিদর্শন চান। ছবি থেকে নিশ্চিত রোগ নির্ণয় করা হয় না। Photo suggestions are experimental: visible rot, mold, sprouting or damage still need human review. Blurry or poor-light images can be refused. Private inspection photos are available only to authorized accounts. No field accuracy is claimed without labelled evidence.",
    ),
    (
        "storage",
        "সংরক্ষণের তথ্য · Storage evidence",
        "কতদিন পেঁয়াজ সংরক্ষণ করা যাবে তার নির্দিষ্ট উত্তর এই সহায়িকায় নেই। তাপমাত্রা, আর্দ্রতা, বাতাস চলাচল, পরিদর্শন ও ওজনের প্রমাণ দিন। This help does not establish a safe storage duration for onions. Record temperature, humidity, ventilation, inspections and verified weights. Storage risk is an evidence checklist; stale or missing measurements remain explicit. Ask a qualified local extension worker for lot-specific agronomy guidance.",
    ),
    (
        "hold",
        "বিক্রি না অপেক্ষা · Hold or sell",
        "এখন বিক্রি বা পরে বিক্রির একই পরিমাণ তুলনা করুন। পচনের ক্ষতি, পরিবহন, ফি, সংরক্ষণ ও অর্থায়নের খরচ লিখুন। Hold or sell compares net proceeds for the same quantity under explicit price, loss, freight, fees, storage and finance assumptions. It is a scenario, not a guaranteed price or instruction. Insufficient evidence requires manual assumptions or abstention.",
    ),
    (
        "loss",
        "ওজন ও ক্ষয় · Verified weight loss",
        "ক্ষয়ের পরীক্ষামূলক প্রবণতার জন্য আলাদা দিনে অন্তত তিনটি তুলনাযোগ্য যাচাইকৃত ওজন দরকার। Verified-weight loss estimates need at least three comparable measurements on different dates, spanning at least 14 days and the requested horizon. The latest must be within seven days. Stock additions, corrections or dispatch reset the comparison period. Otherwise the model abstains.",
    ),
    (
        "pin",
        "ভয়েস পিন · Voice PIN",
        "আসল অ্যাকাউন্টে পাসফ্রেজ আবার দিয়ে ৪ থেকে ৬ অঙ্কের ভয়েস পিন ঠিক করুন। পিন কাউকে বলবেন না। Set a personal 4–6 digit voice PIN after re-entering your passphrase. Five wrong attempts lock the PIN for 15 minutes. Demo accounts use a displayed one-time code. A pending change expires after two minutes and can be cancelled before confirmation.",
    ),
    (
        "settlement",
        "পেমেন্ট যাচাই · Settlement evidence",
        "পেঁয়াজফ্লো টাকা পাঠায় না। ক্রেতা প্ল্যাটফর্মের বাইরের পেমেন্টের রেফারেন্স দেয়; অপারেটর স্বাধীন প্রমাণ দেখে যাচাই বা প্রত্যাখ্যান করে। PeyajFlow never transfers money or provides escrow. After delivery the buyer reports an off-platform payment reference. An operator verifies or rejects independent evidence. A reported payment is not a verified payment.",
    ),
    (
        "transport",
        "পরিবহন · Transport quote",
        "অর্ডারে পরিবহনের দায়িত্বপ্রাপ্ত পক্ষ দর চাইতে পারে। অপারেটর পরিবহনকারীর দেওয়া দর লেখে; দায়িত্বপ্রাপ্ত পক্ষ তা বেছে নেয়। The party responsible for transport requests a quote from the order. An operator records a transporter-provided quote. Selecting it records a local booking; carrier confirmation and tracking remain external.",
    ),
    (
        "agent",
        "সহায়তাকারীর প্রবেশাধিকার · Agent access",
        "কৃষক যাচাইকৃত মাঠকর্মীর শেয়ার করা আইডি দিয়ে অনুমতি দিতে বা ফিরিয়ে নিতে পারেন। Farmers grant or revoke access using a verified field agent's shared ID. Authorized agents can register unlisted lots, weigh stock and inspect assigned lots. Listing and offer decisions remain with the farmer. Revoked access applies to future API reads and changes.",
    ),
    (
        "signup",
        "নিবন্ধন · Signup approval",
        "কৃষক ও ক্রেতা নিবন্ধনের পরে অনুমোদনের অপেক্ষায় থাকেন। জাতীয় পরিচয়পত্র ১০, ১৩ বা ১৭ অঙ্কের হতে হবে। Farmers and buyers register with an account ID, phone and Bangladesh NID of 10, 13 or 17 digits. Verified staff review registrations. New accounts sign in after approval. Rejection revokes active sessions; staff evidence review remains manual.",
    ),
    (
        "sms",
        "এসএমএস ও কল · Simulated channels",
        "সিমুলেটরের এসএমএস, *7392# ও 7392 কল বাস্তব ক্যারিয়ারে যায় না। SMS, USSD *7392# and calls to 7392 in the simulator use workspace data but never reach a carrier. Live SMS requires an approved provider, verified contact, consent, quiet hours and STOP handling. Questions prefixed with প্রশ্ন or ask read public help and never stage a change.",
    ),
    (
        "imports",
        "বাজারদর আমদানি · Market imports",
        "বাজারদরের CSV প্রথমে খসড়া আমদানি হিসেবে জমা হয়। অপারেটরের অনুমোদনের আগে দর প্রকাশিত হয় না। CSV market reports are staged, validated and deduplicated before operator approval. Keep the source URL, report identifier, observed date, original publication date and unit conversion. Automation may stage a report but cannot approve it. Label fictional observations synthetic.",
    ),
    (
        "tokens",
        "ইন্টিগ্রেশন টোকেন · Integration tokens",
        "প্রোফাইলে মেয়াদযুক্ত টোকেন তৈরি বা বাতিল করুন। গোপন টোকেন একবারই দেখানো হয়। Integration tokens are scoped, expiring and revocable. Read-only MCP tokens cannot create lots, accept offers, retrieve photos or change settings. Treat a token as a secret; it is displayed once. Role permissions and demo isolation still apply.",
    ),
]


def corpus():
    return [
        {
            "id": key,
            "title": heading,
            "source_url": "https://github.com/tahmidkhanshuvo/PeyajFlow/blob/main/services/api/app/knowledge_seed.py#"
            + key,
            "licence": "First-party PeyajFlow help; application retrieval permitted",
            "updated_on": "2026-11-21",
            "language": "bn-en",
            "sections": [{"heading": heading, "body": body}],
        }
        for key, heading, body in SECTIONS
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--contextual", action="store_true")
    args = parser.parse_args()
    engine = database_engine()
    if engine is None:
        raise SystemExit("DATABASE_URL is required")
    with Session(engine) as db:
        print(ingest(db, corpus(), args.contextual))
    engine.dispose()


if __name__ == "__main__":
    main()
