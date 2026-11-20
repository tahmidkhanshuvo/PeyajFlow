import type { Locale } from "./copy";
import type { Role } from "./workspace-api";

export function local(locale: Locale, bn: string, en: string) {
  return locale === "bn" ? bn : en;
}

export const roles: Record<Role, [string, string]> = {
  farmer: ["কৃষক", "Farmer"],
  buyer: ["ক্রেতা", "Buyer"],
  agent: ["সহায়তাকারী", "Agent"],
  admin: ["পরিচালক", "Operator"],
};

const errors: Record<string, [string, string]> = {
  showcase_access_invalid: [
    "ওয়ার্কস্পেসের প্রবেশ কোডটি মিলেনি।",
    "The workspace access code is incorrect.",
  ],
  verified_agent_not_found: [
    "যাচাইকৃত সহায়তাকারী পাওয়া যায়নি।",
    "This verified agent could not be found.",
  ],
  farmer_listing_required: [
    "শুধু কৃষক মজুত তালিকাভুক্ত করতে পারবেন।",
    "Only the farmer can list this lot for buyers.",
  ],
  payment_requires_delivery: [
    "পণ্য গ্রহণের পর অর্থপ্রদানের তথ্য নথিভুক্ত বা যাচাই করুন।",
    "Payment evidence can be recorded or reviewed after delivery is confirmed.",
  ],
  payment_report_exists: [
    "এই অর্ডারের একটি অর্থপ্রদানের প্রতিবেদন রয়েছে।",
    "This order already has an active payment report.",
  ],
  payment_already_reviewed: [
    "অর্থপ্রদানের প্রতিবেদনটি ইতিমধ্যে পর্যালোচনা করা হয়েছে।",
    "This payment report has already been reviewed.",
  ],
  payment_independent_evidence_required: [
    "ক্রেতার তথ্যের বাইরে যাচাইয়ের আলাদা রেফারেন্স লিখুন।",
    "Enter a separate reference for your independent review.",
  ],
  credentials_invalid: [
    "অ্যাকাউন্ট আইডি ও পাসওয়ার্ড মিলেনি।",
    "The account ID or password is incorrect.",
  ],
  rate_limited: [
    "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    "Too many requests. Wait and try again.",
  ],
  request_too_large: [
    "ফাইল বা তথ্যের আকার অনুমোদিত সীমা ছাড়িয়েছে।",
    "The request exceeds the allowed size.",
  ],
  sms_verified_phone_required: [
    "অপারেটরের যাচাই করা ফোন নম্বর দরকার।",
    "An operator-verified phone is required.",
  ],
  dispute_requires_review: [
    "আগের সরবরাহের রেকর্ড পাওয়া যায়নি।",
    "The previous fulfillment state could not be established.",
  ],
  voice_quantity_mismatch: [
    "বক্তব্যের পরিমাণ অফার বা ফর্মের পরিমাণের সঙ্গে মেলেনি।",
    "The spoken quantity does not match the offer or the quantity in the form.",
  ],
  market_csv_header: [
    "CSV-এর কলামের নাম নমুনার সঙ্গে মিলিয়ে দেখুন।",
    "Use the CSV columns shown in the import form.",
  ],
  market_csv_limit: [
    "১,০০০ সারি ও ৪০০ কেবির মধ্যে CSV দিন।",
    "Use a CSV with up to 1,000 rows and 400 KB.",
  ],
  market_csv_malformed: [
    "CSV ফাইল পড়া যায়নি।",
    "The CSV file could not be read.",
  ],
  advice_market_mismatch: [
    "মজুতের জেলা ও গ্রেডের খামারদর বেছে নিন।",
    "Choose a farmgate series for this lot’s district and grade.",
  ],
  transport_responsibility_required: [
    "যার পরিবহনের দায়িত্ব, তিনি কাজটি করতে পারবেন।",
    "Only the party responsible for transport can do this.",
  ],
  logistics_pickup_window: [
    "সংরক্ষণ ও সরবরাহের সময়ের মধ্যে সংগ্রহের দিন দিন।",
    "Choose a pickup date within the reservation and delivery window.",
  ],
  logistics_insufficient_capacity: [
    "গাড়ির ধারণক্ষমতা অর্ডারের চেয়ে কম।",
    "The quoted capacity is below the order quantity.",
  ],
  logistics_quote_expired: [
    "পরিবহনের দরটির মেয়াদ শেষ।",
    "This transport quote has expired.",
  ],
  voice_repeat: [
    "কাজটি বোঝা যায়নি। তালিকা থেকে কাজ বেছে নিয়ে আবার চেষ্টা করুন।",
    "That command was not recognized. Choose a command and try again.",
  ],
  voice_choose_lot: ["একটি মজুত বেছে নিন।", "Choose a lot."],
  photo_model_unrecognized: [
    "এই মডেলের ফল গ্রহণযোগ্য নয়। পাতাটি নতুন করে খুলুন।",
    "This model version is not accepted. Reload the page.",
  ],
  photo_quality_insufficient: [
    "ছবির মান কম, তাই মডেলের ফল রাখা হয় না। ছবিটি নিজে পর্যালোচনা করুন।",
    "The photo failed the quality checks, so model results are not kept. Review it manually.",
  ],
  voice_choose_series: [
    "একাধিক দরের ধারা আছে। একটি দরের ধারা বেছে নিন।",
    "More than one market series is available. Choose a series.",
  ],
  voice_negated: [
    "বক্তব্যে “না” আছে, তাই কিছু করা হয়নি। যা করতে চান তা সরাসরি বলুন।",
    "The command contained a negation, so nothing was staged. Say the action you want directly.",
  ],
  voice_ambiguous: [
    "একাধিক কাজ বা পরিমাণ শোনা গেছে। একটি কাজ ও একটি পরিমাণ বলুন।",
    "More than one action or quantity was heard. Say one action and one quantity.",
  ],
  voice_say_quantity: [
    "পরিমাণের ঠিক পরে কেজি বা মণ বলুন। যেমন: অফার গ্রহণ ২০০ কেজি, দুইশো কেজি বা দেড় মণ।",
    "Say the quantity followed by kg or maund, for example: accept offer 200 kg or two hundred kg.",
  ],
  voice_onion_only: [
    "এই সহকারী শুধু পেঁয়াজের কাজ করে।",
    "This assistant handles onion trade only.",
  ],
  voice_unsupported: [
    "এই কাজটি কলে করা যায় না। ওয়ার্কস্পেস থেকে করুন।",
    "That action is not available by call. Use the workspace instead.",
  ],
  voice_pin_required: [
    "পরিবর্তন নিশ্চিত করতে আগে আপনার ভয়েস পিন ঠিক করুন।",
    "Set your voice PIN before confirming changes.",
  ],
  voice_pin_locked: [
    "অনেকবার ভুল পিন দেওয়া হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।",
    "Too many wrong PINs. Try again in 15 minutes.",
  ],
  voice_pin_weak: [
    "পিনটি সহজে অনুমান করা যায়। একই অঙ্ক, পরপর অঙ্ক বা পুনরাবৃত্তি ছাড়া পিন দিন।",
    "That PIN is easy to guess. Avoid repeated, sequential or repeating-pattern digits.",
  ],
  voice_pin_invalid: [
    "পিন হবে ৪ থেকে ৬ অঙ্কের।",
    "The PIN must be 4 to 6 digits.",
  ],
  voice_pin_demo: [
    "ডেমো অ্যাকাউন্ট দেখানো কোড দিয়ে নিশ্চিত করে।",
    "Demo accounts confirm with the displayed code.",
  ],
  voice_loss_mismatch: [
    "বক্তব্যে ক্ষতির কথা আছে। পরিবর্তনের ধরন “ক্ষতি” বেছে নিন।",
    "The command describes a loss. Choose the loss movement type.",
  ],
  voice_tool_mismatch: [
    "বেছে নেওয়া কাজ আর বক্তব্যের কাজ আলাদা। একটি মিলিয়ে নিন।",
    "The selected command and the spoken command differ. Make them match.",
  ],
  voice_wrong_lot: [
    "অফারটি এই মজুতের নয়।",
    "The offer belongs to a different lot.",
  ],
  voice_call_expired: [
    "কলের সময় শেষ। নতুন কল শুরু করুন।",
    "The call expired. Start a new call.",
  ],
  voice_call_limit: [
    "কলের সীমা পূর্ণ হয়েছে। নতুন কল শুরু করুন।",
    "This call reached its turn limit. Start a new call.",
  ],
  voice_pending: [
    "আগের কাজটি নিশ্চিত বা বাতিল করুন।",
    "Confirm or cancel the pending action first.",
  ],
  voice_confirmation_expired: [
    "নিশ্চিতকরণের সময় শেষ বা বাতিল হয়েছে।",
    "The confirmation expired or was cancelled.",
  ],
  voice_wrong_digits: [
    "কোড মেলেনি। তিনবার ভুল হলে কাজটি বাতিল হবে।",
    "The keypad code did not match. Three failures cancel the action.",
  ],
  voice_wrong_digits_last: [
    "কোড মেলেনি। আর একবার ভুল হলে কাজটি বাতিল হবে।",
    "The keypad code did not match. One more failure cancels the action.",
  ],
  voice_confirmation_cancelled: [
    "তিনবার ভুল কোডের কারণে কাজটি বাতিল হয়েছে। মজুত বদলায়নি।",
    "Three wrong codes cancelled the action. Stock was not changed.",
  ],
  conversion_required: [
    "মণ হলে প্রতি মণে কেজি লিখুন।",
    "Enter kg per maund when using maunds.",
  ],
  invalid_quantity: [
    "পরিমাণটি অনুমোদিত সীমায় লিখুন।",
    "Enter a quantity within the allowed range.",
  ],
  demand_terms_mismatch: [
    "অফারের শর্ত চাহিদার সঙ্গে মেলে না।",
    "The offer terms do not match the linked demand.",
  ],
  inspection_date_invalid: [
    "পরিদর্শনের তারিখ সংরক্ষণের শুরুর পরের দিন বা সেই দিন হতে হবে।",
    "Use an inspection date within the current storage period.",
  ],
  review_locked: [
    "মানুষের পর্যালোচনা সম্পন্ন হয়েছে।",
    "A reviewer has already assessed this inspection.",
  ],
  photo_storage_unavailable: [
    "ছবির সংরক্ষণসেবা এখন পাওয়া যাচ্ছে না।",
    "Photo storage is unavailable. Try again.",
  ],
  invalid_input: [
    "তথ্য যাচাই করে আবার চেষ্টা করুন।",
    "Check the fields and try again.",
  ],
  service_unavailable: [
    "সেবা এখন পাওয়া যাচ্ছে না।",
    "The service is unavailable. Try again.",
  ],
  database_unavailable: [
    "ডেটাবেস এখন পাওয়া যাচ্ছে না।",
    "The database is unavailable.",
  ],
  sign_in_required: ["আবার সাইন ইন করুন।", "Sign in again."],
  session_expired: [
    "সেশনের মেয়াদ শেষ। আবার সাইন ইন করুন।",
    "Your session expired. Sign in again.",
  ],
  role_forbidden: [
    "এই কাজ করার অনুমতি নেই।",
    "Your role does not allow this action.",
  ],
  signup_review_access: [
    "নিবন্ধন পর্যালোচনা করতে যাচাইকৃত এজেন্ট অ্যাকাউন্ট দিয়ে সাইন ইন করুন।",
    "Sign in with a verified agent account to review registrations.",
  ],
  demo_disabled: [
    "এই পরিবেশে ডেমো সাইন-ইন বন্ধ।",
    "Demo sign-in is disabled in this environment.",
  ],
  demo_seed_required: [
    "ডেমো অ্যাকাউন্ট প্রস্তুত করা হয়নি।",
    "The demo accounts have not been seeded.",
  ],
  not_found: ["তথ্যটি পাওয়া যায়নি।", "This record was not found."],
  insufficient_stock: [
    "এই পরিমাণ মজুত খালি নেই।",
    "That quantity is no longer available.",
  ],
  invalid_transition: [
    "বর্তমান অবস্থায় কাজটি করা যাবে না।",
    "This action is unavailable in the current state. Refresh the page.",
  ],
  idempotency_conflict: [
    "তথ্য বদলেছে। পৃষ্ঠাটি রিফ্রেশ করুন।",
    "The details changed. Refresh the page and try again.",
  ],
  offer_expired: ["অফারের মেয়াদ শেষ।", "The offer has expired."],
  confirmation_required: ["চুক্তির শর্ত নিশ্চিত করুন।", "Confirm the terms first."],
  image_invalid: [
    "সঠিক JPEG, PNG বা WebP ছবি দিন।",
    "Choose a valid JPEG, PNG or WebP image.",
  ],
  image_too_large: [
    "ছবির আকার অনুমোদিত সীমা ছাড়িয়েছে।",
    "The image exceeds the allowed size.",
  ],
  photos_required: ["দুই থেকে চারটি ছবি যোগ করুন।", "Attach two to four photos."],
  username_taken: [
    "এই অ্যাকাউন্ট আইডি ইতিমধ্যে ব্যবহৃত হচ্ছে।",
    "This account ID is already in use.",
  ],
  otp_sent: [
    "নম্বরটি যাচাই করা অ্যাকাউন্টের হলে কয়েক মিনিটের মধ্যে একটি ৬ অঙ্কের কোড আসবে।",
    "If this number belongs to a verified account, a 6-digit code will arrive within a few minutes.",
  ],
  otp_invalid: [
    "কোডটি সঠিক নয় বা মেয়াদ শেষ। নতুন কোড চেয়ে আবার চেষ্টা করুন।",
    "The code is wrong or has expired. Request a new code and try again.",
  ],
  otp_unavailable: [
    "এসএমএস কোড দিয়ে প্রবেশ এখন চালু নেই। পাসফ্রেজ দিয়ে প্রবেশ করুন।",
    "SMS code sign-in is not available. Sign in with your passphrase.",
  ],
  nid_invalid: [
    "এনআইডি নম্বর ১০, ১৩ বা ১৭ অঙ্কের হয়। কার্ডে যেমন আছে তেমন লিখুন।",
    "An NID number has 10, 13 or 17 digits. Enter it as printed on the card.",
  ],
  nid_taken: [
    "এই এনআইডি নম্বর ইতিমধ্যে নিবন্ধিত।",
    "This NID number is already registered.",
  ],
  phone_taken: [
    "এই ফোন নম্বর ইতিমধ্যে নিবন্ধিত।",
    "This phone number is already registered.",
  ],
  account_not_verified: [
    "সাইন ইন করতে অ্যাকাউন্ট যাচাই করা প্রয়োজন।",
    "Your account needs verification before you can sign in.",
  ],
  already_processed: [
    "এই নিবন্ধনের বিষয়ে আগেই সিদ্ধান্ত নেওয়া হয়েছে।",
    "A decision has already been made on this registration.",
  ],
};

export function errorText(locale: Locale, code: string) {
  return local(locale, ...(errors[code] ?? errors.invalid_input));
}
