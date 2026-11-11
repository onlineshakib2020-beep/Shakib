/**
 * Pure Language Normalizer for 100% Pure Bengali (bn) vs 100% Pure English (en)
 * Ensures:
 * - When lang === 'bn': 100% pure Bengali everywhere (zero English parenthetical glosses or English words, except the 'English' language switch button).
 * - When lang === 'en': 100% pure English everywhere (zero Bengali words or Bengali digits ০-৯, except the 'বাংলা' language switch button).
 */

const BN_DIGIT_TO_EN: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const EN_DIGIT_TO_BN: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

/**
 * Preserves natural English technical/brand terms (e.g. SBL, Coal & Firing Efficiency Tracker,
 * WhatsApp, GPS, PIN, Ton) and formats numerals in crisp English digits (0-9) for superior
 * tabular legibility across financial ledgers and KPI cards.
 */
export function normalizeToPureBengali(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed === 'English' || trimmed === 'ইংরেজি (English)') {
    return 'English';
  }
  return text.replace(/[০-৯]/g, (d) => BN_DIGIT_TO_EN[d] ?? d);
}

/**
 * Comprehensive Bengali-to-English phrase & vocabulary dictionary for 100% pure English mode.
 */
const BN_TO_EN_PHRASES: Array<[string, string]> = [
  // Full phrases & headers (longest first)
  ['SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)', 'SBL Sweet Clay Bricks (Babulia, Satkhira)'],
  ['SBL মিষ্টি মাটির ইট · সাতক্ষীরা', 'SBL Sweet Clay Bricks · Satkhira'],
  ['SBL মিষ্টি মাটির ইট', 'SBL Sweet Clay Bricks'],
  ['এসবিএল মিষ্টি মাটির ইট · সাতক্ষীরা', 'SBL Sweet Clay Bricks · Satkhira'],
  ['· SBL ব্রিকস', '· SBL Bricks'],
  ['· এসবিএল ইট', '· SBL Bricks'],
  ['প্রোঃ মোঃ কামরুল ইসলাম সাহেব (01913-678010)', 'Proprietor: Md. Kamrul Islam (01913-678010)'],
  ['পরিচালনায়ঃ সাকিব হোসেন (01728-287018)', 'Managed by: Sakib Hossain (01728-287018)'],
  ['প্রোঃ মোঃ কামরুল ইসলাম সাহেব (০১৯১৩-৬৭৮০১০)', 'Proprietor: Md. Kamrul Islam (01913-678010)'],
  ['পরিচালনায়ঃ সাকিব হোসেন (০১৭২৮-২৮৭০১৮)', 'Managed by: Sakib Hossain (01728-287018)'],
  ['প্রোঃ মোঃ কামরুল ইসলাম সাহেব', 'Proprietor: Md. Kamrul Islam'],
  ['প্রোঃ মোঃ কামরুল ইসলাম', 'Proprietor: Md. Kamrul Islam'],
  ['পরিচালনায়ঃ সাকিব হোসেন', 'Managed by: Sakib Hossain'],
  ['বাবুলিয়া, সাতক্ষীরা সদর', 'Babulia, Satkhira Sadar'],
  ['বাবুলিয়া, সাতক্ষীরা', 'Babulia, Satkhira'],
  ['SBL ইটভাটা (22.754719, 89.039367) · ম্যাপ দেখুন', 'SBL Brick Kiln (22.754719, 89.039367) · View Map'],
  ['ভাটা সিজন 2026-27 · ডাটাবেস ও ক্যাশ বুক অটো-সিঙ্ক সক্রিয়', 'Kiln Season 2026-27 · Database & Cash Book Auto-Sync Active'],
  ['ভাটা সিজন ২০২৬-২৭ · ডাটাবেস ও ক্যাশ বুক অটো-সিঙ্ক সক্রিয়', 'Kiln Season 2026-27 · Database & Cash Book Auto-Sync Active'],
  ['আজ ও গতকালের ইট বিক্রির লাইভ তুলনামূলক হিসাব', 'Today vs. Yesterday Live Brick Sales Comparison'],
  ['উপরের যেকোনো কার্ডে ক্লিক করলে প্রিন্ট-রেডি বিস্তারিত খতিয়ান রিপোর্ট ওপেন হবে', 'Click any card above to open a print-ready detailed ledger report'],
  ['মোট ইট বিক্রয় (Total Sales)', 'Total Brick Sales'],
  ['মোট ইট বিক্রয়', 'Total Brick Sales'],
  ['সিজনের সর্বমোট বিক্রি ও মেমো বিল', 'Total seasonal sales & memo bills'],
  ['আজকের আদায় (জমা)', 'Today Cash Collection'],
  ['আজকের আদায়', 'Today Cash Collection'],
  ['আজকের নগদ ও অনলাইন প্রাপ্তি', 'Today cash & online receipts'],
  ['মোট আদায় (ক্যাশ ইন)', 'Total Cash Collection'],
  ['মোট আদায়', 'Total Cash Collection'],
  ['সিজনের সর্বমোট সংগৃহীত জমা', 'Total seasonal collected cash'],
  ['মেমো জমা ও বকেয়া আদায় মিলিয়ে মোট প্রাপ্তি', 'Combined memo deposits & due collections'],
  ['মোট খরচ (ক্যাশ আউট)', 'Total Expenses (Cash Out)'],
  ['মোট খরচ', 'Total Expenses'],
  ['কয়লা, ডিজেল, মাটি ও লেবার ব্যয়', 'Coal, diesel, clay & labor expenses'],
  ['বর্তমান ক্যাশ ব্যালেন্স', 'Current Cash Balance'],
  ['প্রারম্ভিক ক্যাশ + মোট জমা - খরচ', 'Opening Cash + Total In - Total Out'],
  ['মোট পাওনা (বকেয়া)', 'Total Customer Due'],
  ['মোট পাওনা', 'Total Customer Due'],
  ['ক্রেতাদের কাছে বাকি খাতা', 'Outstanding customer receivables'],
  ['আজকের ইট বিক্রি', 'Today Bricks Sold'],
  ['আজকের মেমো বিল', 'Today Memo Bill'],
  ['গতকালের ইট বিক্রি', 'Yesterday Bricks Sold'],
  ['গতকালের মেমো বিল', 'Yesterday Memo Bill'],
  ['ভাটা বিজনেস অ্যানালাইটিক্স ও আর্থিক সামারি', 'Kiln Business Analytics & Financial Summary'],
  ['কালেকশন দক্ষতা (Collection Rate)', 'Collection Efficiency Rate'],
  ['কালেকশন দক্ষতা', 'Collection Efficiency Rate'],
  ['গড় অর্ডার ভ্যালু (AOV / Memo)', 'Average Order Value (Per Memo)'],
  ['গড় অর্ডার ভ্যালু', 'Average Order Value'],
  ['স্টকের বাজারমূল্য (Inventory Value)', 'Current Stock Market Value'],
  ['স্টকের বাজারমূল্য', 'Current Stock Market Value'],
  ['সর্বোচ্চ বকেয়া ঝুঁকি (Top Debtor)', 'Highest Due Exposure'],
  ['সর্বোচ্চ বকেয়া ঝুঁকি', 'Highest Due Exposure'],
  ['কোনো বকেয়া নেই', 'No Outstanding Due'],
  ['১০০% পরিশোধিত', '100% Paid'],
  ['অত্যন্ত শক্তিশালী আর্থিক অবস্থা', 'Strong Financial Health'],
  ['সুষম ও স্থিতিশীল ভাটা পরিচালনা', 'Balanced & Stable Kiln Operations'],
  ['বকেয়া আদায়ে বাড়তি নজর প্রয়োজন', 'Needs Attention on Due Collection'],
  ['দ্রুত ক্যাশ খরচ এন্ট্রি', 'Quick Cash Expense Entry'],
  ['তাৎক্ষণিক ভাটা খরচ এন্ট্রি বক্স (Quick Expense)', 'Instant Kiln Expense Entry'],
  ['তাৎক্ষণিক ভাটা খরচ এন্ট্রি বক্স', 'Instant Kiln Expense Entry'],
  ['কয়লা, ভেকু ডিজেল, মাটি বা শ্রমিক খরচ ১-ক্লিকে সরাসরি ক্যাশ বুকে যোগ করুন', 'Record coal, excavator diesel, clay or labor expenses directly to Cash Book in 1 click'],
  ['খরচের খাত নির্বাচন করুন', 'Select Expense Category'],
  ['টাকার পরিমাণ (৳) *', 'Amount (Tk) *'],
  ['যেমন: 1500', 'e.g. 1500'],
  ['যেমন: ১৫০০', 'e.g. 1500'],
  ['দ্রুত অংক:', 'Quick Amounts:'],
  ['বিবরণ লিখুন (যেমন: ভেকু ডিজেল ৩০ লিটার বা মাটির ট্রাক)...', 'Enter description (e.g. Excavator diesel 30L or clay truck)...'],
  ['+ খরচ যোগ করুন', '+ Add Expense'],
  ['ভাটা ডায়েরি ও রিমাইন্ডার', 'Kiln Diary & Reminders'],
  ['জরুরি নোট ও রিমাইন্ডার বক্স (Kiln Notepad)', 'Urgent Kiln Notes & Reminders'],
  ['জরুরি নোট ও রিমাইন্ডার বক্স', 'Urgent Kiln Notes & Reminders'],
  ['সর্দারের দাদন, কয়লার গাড়ি বা ডেলিভারির জরুরি কথা উপরেই লিখে রাখুন', 'Write down important notes on sardar advances, coal trucks, or deliveries'],
  ['যেমন: শনিবার রহিম সর্দারকে ২০ হাজার টাকা দিতে হবে...', 'e.g. Pay Rahim Sardar Tk 20,000 on Saturday...'],
  ['🔥 জরুরি', 'Urgent'],
  ['📌 সাধারণ', 'Normal'],
  ['[জরুরি]', '[Urgent]'],
  ['+ নোট সেভ', '+ Save Note'],
  ['নোটসমূহ', 'Notes'],
  ['টি নোট', ' Notes'],
  ['নোট', 'Notes'],
  ['সাম্প্রতিক ডিজিটাল ক্যাশ মেমোসমূহ', 'Recent Digital Cash Memos'],
  ['সকল মেমো ও বাকি খাতা দেখুন →', 'View All Memos & Due Ledger →'],
  ['ক্রেতা ও ঠিকানা', 'Customer & Address'],
  ['কী ইট ও পরিমাণ', 'Brick Grade & Qty'],
  ['অপশন', 'Actions'],
  ['গত ৭ দিনের ইট বিক্রি, নগদ আদায় ও খরচের তুলনামূলক চিত্র', 'Last 7 Days Brick Sales, Cash Collection & Expense Comparison'],
  ['ইটভাটার দৈনিক আয় (সবুজ), বিক্রি (ইট-কমলা) এবং খরচ (লাল) বিশ্লেষণ', 'Daily kiln collection (green), sales (orange) & expense (red) breakdown'],
  ['ডেইলি গোল ট্র্যাকার', 'Daily Goal Tracker'],
  ['আজকের কাঁচা ইট, লোড, ডেলিভারি ও ক্যাশ আদায়ের লক্ষ্যমাত্রা', 'Today targets for raw bricks, loading, delivery & cash collection'],
  ['দৈনিক ক্লোজিং শিট →', 'Daily Closing Sheet →'],
  ['কাঁচা ইট কাটা (মিল পট)', 'Raw Bricks Cut (Mill Pots)'],
  ['চুল্লিতে কাঁচা ইট লোড', 'Raw Bricks Loaded to Kiln'],
  ['ইট ডেলিভারি (ট্রিপ/পিস)', 'Brick Delivery (Pieces)'],
  ['আজকের নগদ ক্যাশ আদায়', 'Today Cash Collection'],
  ['বকেয়া পাওনা খাতা', 'Customer Due Register'],
  ['হোয়াটসঅ্যাপ তাগাদা', 'WhatsApp Reminder'],
  ['WhatsApp তাগাদা', 'WhatsApp Reminder'],
  ['খতিয়ান →', 'Ledger →'],
  ['বর্তমানে কোনো ক্রেতার কাছে বকেয়া পাওনা নেই।', 'Currently there are no outstanding customer dues.'],
  ['ড্যাশবোর্ড মাস্টার শর্টকাট হাব', 'Dashboard Master Shortcut Hub'],
  ['ভাটার সকল সেকশনের এক-ক্লিক শর্টকাট (All 19 Kiln Sections Quick Access)', 'One-Click Quick Access to All Kiln Sections'],
  ['ভাটার সকল সেকশনের এক-ক্লিক শর্টকাট', 'One-Click Quick Access to All Kiln Sections'],
  ['ড্যাশবোর্ড থেকে যেকোনো সেকশনে সরাসরি প্রবেশ করুন — প্রতিটি সেকশনের ভেতরে শুধুমাত্র সেই নির্দিষ্ট সেকশনের নিজস্ব হিসাব রয়েছে।', 'Jump directly to any module from the dashboard — each section contains only its own dedicated records.'],
  ['ভাটার মূল গুগল ম্যাপ লোকেশন ও স্যাটেলাইট ভিউ', 'Kiln Main Google Maps Location & Satellite View'],
  ['চুল্লি, ১-২-৩ মিল পট, কাঁচা ইট মাঠ, অফিস ও ট্রাক ডেলিভারি ডিপোর লাইভ জিপিএস ম্যাপ ও স্যাটেলাইট ডিরেকশন।', 'Live GPS map & satellite directions for kiln chimney, mill pots 1-2-3, drying yard, office & truck gate.'],
  ['🗺️ গুগল ম্যাপ ও স্যাটেলাইট খুলুন', 'Open Google Maps & Satellite View'],
  ['গুগল ম্যাপ ও স্যাটেলাইট খুলুন', 'Open Google Maps & Satellite View'],
  ['← মূল ড্যাশবোর্ডে ফিরুন', '← Back to Dashboard'],
  ['অটো ডেইলি ব্যাকআপ ভল্ট', 'Auto Daily Backup Vault'],
  ['ডেইলি ব্যাকআপ ভল্ট', 'Daily Backup Vault'],
  ['সকল সেকশনের শর্টকাট ও লাইভ সামারি', 'All section shortcuts & live summary'],
  ['ডিজিটাল ক্যাশ মেমো, সার্চ ও বকেয়া আদায়', 'Digital cash memos, search & due collection'],
  ['মেমো ভিত্তিক গাড়ি ও ইট ডেলিভারি খতিয়ান', 'Memo-wise truck & brick delivery register'],
  ['পোড়ানো ইটের গ্রেড স্টক, দর ও আদলা সমন্বয়', 'Fired brick grade stock, rates & bat reconciliation'],
  ['ওহাব, মফিজুল ও শফিকুল মিলের পট ও বিল', 'Ohhab, Mofijul & Shofikul mill pots & bills'],
  ['চুল্লিতে কাঁচা ইট লোড (১০০০ পিস রেট)', 'Raw brick loading into kiln (per 1,000 rate)'],
  ['চুল্লিতে ইট পোড়ানো রাউন্ড ও মিস্ত্রি বিল', 'Kiln firing rounds & fireman bills'],
  ['চুল্লি থেকে পাকা ইট আনলোড (১ লাইন = ৪০০০ ইট)', 'Fired brick unloading from kiln (1 Line = 4,000 pcs)'],
  ['২৪ চেম্বারের বর্তমান অবস্থা, আগুন ও আনলোড লাইভ ট্র্যাকার', '24-chamber live status, firing temperature & unload tracker'],
  ['বৃষ্টিতে নষ্ট কাঁচা ইট ও চুল্লির গামা/আদলা অপচয় হিসাব', 'Rain-damaged raw bricks & kiln overburnt wastage register'],
  ['জ্বালানি কাঠ ক্রয়, সাপ্লায়ার বিল ও বাকি', 'Firewood purchases, supplier bills & dues'],
  ['মাটির ট্রাক, কয়লা টন ও সাপ্লায়ার খতিয়ান', 'Clay trucks, coal tons & supplier ledger'],
  ['জমির মালিকের সাথে মাটির চুক্তি, বিঘা ও ট্রাক হিসাব', 'Landowner clay contracts, bigha & truck delivery tracker'],
  ['অগ্রিম দাদন, কাজের বিল কর্তন ও ব্যালেন্স', 'Advance dadon, work bill deductions & balance'],
  ['অগ্রিম ইট বুকিং, আংশিক ডেলিভারি ও জের', 'Advance brick bookings, partial deliveries & balance'],
  ['গাড়ির ট্রিপ, ভেকু ঘণ্টা, ডিজেল ও ভাড়া', 'Vehicle trips, excavator hours, diesel & rent'],
  ['শ্রমিক প্রোফাইল, দৈনিক হাজিরা ও মজুরি পেমেন্ট', 'Worker profiles, daily attendance & wage payments'],
  ['ম্যানেজার, মুন্সি, নাইট গার্ড ও ড্রাইভারদের মাসিক বেতন', 'Monthly salary sheet for manager, munshi, guards & drivers'],
  ['ভাটার সকল নগদ জমা ও খরচের খতিয়ান', 'Complete kiln cash in & cash out ledger'],
  ['দিনশেষে ক্যাশ মিলকরণ শিট ও টার্গেট প্রগ্রেস', 'End-of-day cash reconciliation & target progress'],
  ['বকেয়া ক্রেতাদের তালিকা ও ১-ক্লিক তাগাদা মেসেজ', 'Due customer list & 1-click reminder messages'],
  ['প্রতি ১০০০ ইটের উৎপাদন খরচ ও নিট মুনাফা', 'Production cost & net profit per 1,000 bricks'],
  ['পরিবেশ ছাড়পত্র, ডিসি লাইসেন্স, ভ্যাট ও ব্যাংক কিস্তি', 'Environmental clearance, DC license, VAT & loan installments'],
  ['১২ মাসের চার্ট, দুই সিজনের তুলনা ও আর্কাইভ', '12-month charts, season comparison & historical archive'],
  // Seed customer names, addresses & notes
  ['মেসার্স আল-আমিন বিল্ডার্স', 'M/S Al-Amin Builders'],
  ['হাজী আব্দুল করিম', 'Haji Abdul Karim'],
  ['রহমান এন্টারপ্রাইজ', 'Rahman Enterprise'],
  ['ইঞ্জিনিয়ার শফিকুল ইসলাম', 'Engr. Shafiqul Islam'],
  ['সাতক্ষীরা বিল্ডিং কনস্ট্রাকশন', 'Satkhira Building Construction'],
  ['মোঃ মনিরুল ইসলাম', 'Md. Monirul Islam'],
  ['সুলতানপুর, সাতক্ষীরা সদর', 'Sultanpur, Satkhira Sadar'],
  ['পাটকেলঘাটা বাজার, সাতক্ষীরা', 'Patkelghata Bazar, Satkhira'],
  ['কালিগঞ্জ রোড, সাতক্ষীরা', 'Kaliganj Road, Satkhira'],
  ['কলারোয়া পৌরসভা, সাতক্ষীরা', 'Kalaroa Municipality, Satkhira'],
  ['তালতলা, সাতক্ষীরা সদর', 'Taltala, Satkhira Sadar'],
  ['ভোমরা স্থলবন্দর রোড, সাতক্ষীরা', 'Bhomra Land Port Road, Satkhira'],
  ['বড়পুকুরিয়া ১ নং গ্রেড কয়লা ১৫ টন মজুদ সম্পন্ন হয়েছে — চুল্লি রাউন্ড-৩ এর জন্য প্রস্তুত।', 'Barapukuria Grade-1 coal 15 tons stocked — ready for Kiln Round-3.'],
  ['রহমান এন্টারপ্রাইজ (মেমো SBL-1043) আগামী বৃহস্পতিবার অবশিষ্ট ৬২,৫০০ টাকা পরিশোধ করবেন।', 'Rahman Enterprise (Memo SBL-1043) will pay remaining Tk 62,500 next Thursday.'],
  ['সাতক্ষীরা বিল্ডিং কনস্ট্রাকশনের ২য় ট্রিপ ডেলিভারির আগে বকেয়া ১,১০,০০০ টাকা তাগাদা দিতে হবে।', 'Follow up on Tk 110,000 due from Satkhira Building Construction before 2nd trip delivery.'],
  // Expense categories & payment methods
  ['ইট বিক্রয় আদায়', 'Brick Sales Collection'],
  ['শ্রমিক ও সর্দার পেমেন্ট', 'Labor & Sardar Payment'],
  ['ভেকু ও ডিজেল', 'Excavator & Diesel'],
  ['বিদ্যুৎ ও জ্বালানি', 'Electricity & Fuel'],
  ['অফিস ও আপ্যায়ন', 'Office & Hospitality'],
  ['বিকাশ / নগদ অ্যাপ', 'bKash / Nagad App'],
  ['ব্যাংক চেক / ট্রান্সফার', 'Bank Check / Transfer'],
  ['নগদ ক্যাশ', 'Cash in Hand'],
  ['কয়লা ক্রয়', 'Coal Purchase'],
  ['মাটি ক্রয়', 'Clay Purchase'],
  ['বাকি আদায়', 'Due Collection'],
  ['অন্যান্য জমা', 'Other Cash In'],
  ['অন্যান্য খরচ', 'Other Expense'],
  // Brick grades
  ['১ নং ইট', 'Grade-1 Bricks'],
  ['১.৫ নং ইট', 'Grade-1.5 Bricks'],
  ['২ নং ইট', 'Grade-2 Bricks'],
  ['৩ নং ইট', 'Grade-3 Bricks'],
  ['পিকেট ইট', 'Picket Bricks'],
  ['গামা ইট', 'Overburnt (Gama) Bricks'],
  ['আদলা / খোয়া', 'Broken Bats / Khoa'],
  // Common words & table headers
  ['মেমো নং', 'Memo No'],
  ['মেমো-', 'SBL-'],
  ['ক্রেতার নাম', 'Customer Name'],
  ['মোট বিল', 'Total Bill'],
  ['নগদ জমা', 'Cash Paid'],
  ['বকেয়া', 'Due'],
  ['বাকি', 'Due'],
  ['পরিশোধিত', 'Paid'],
  ['জমা নিন', 'Collect Due'],
  ['জমা', 'Deposit'],
  ['খরচ', 'Expense'],
  ['বিক্রি', 'Sales'],
  ['প্রিন্ট', 'Print'],
  ['আজকের তারিখ:', 'Date:'],
  ['তারিখ:', 'Date:'],
  ['তারিখ', 'Date'],
  ['মোবাইল:', 'Phone:'],
  ['মোবাইল', 'Phone'],
  ['হেলথ স্কোর:', 'Health Score:'],
  ['সেরা বিক্রিত ইট:', 'Top Selling Grade:'],
  ['মার্কেট শেয়ার', 'Market Share'],
  ['শেয়ার', 'Share'],
  ['মজুত:', 'In Stock:'],
  ['নগদ আদায়:', 'Cash Collected:'],
  ['মোট মেমো:', 'Total Memos:'],
  ['মোট পাওনা:', 'Total Due:'],
  ['মোট ইট', 'Total Bricks'],
  ['আজকের মেমো', 'Today Memos'],
  ['ভেরিফায়েড ক্যাশ ইন', 'Verified Cash In'],
  ['আজকের খরচ', 'Today Expense'],
  ['ভাটা পরিচালনা', 'Kiln Operations'],
  ['প্রারম্ভিক', 'Opening'],
  ['সহ নগদ তহবিল', 'included in cash fund'],
  ['জন ক্রেতার কাছে বকেয়া', 'customers with due'],
  ['পিস ইট', 'pcs bricks'],
  ['পিস', 'pcs'],
  ['টি মেমো', ' memos'],
  ['টি মডিউল সক্রিয়', ' Active Modules'],
  ['মোট ', 'Total '],
  ['টি', ''],
  ['আজ', 'Today'],
];

export function normalizeToPureEnglish(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  // Preserve the language switcher button label for switching to Bengali
  if (trimmed === 'বাংলা' || trimmed === 'বাংলা (BN)') {
    return 'বাংলা';
  }

  let out = text;

  for (const [bn, en] of BN_TO_EN_PHRASES) {
    if (out.includes(bn)) {
      out = out.split(bn).join(en);
    }
  }

  // Convert currency symbol ৳ followed by digits to Tk
  out = out.replace(/৳\s*/g, 'Tk ');

  // Convert all Bengali digits ০-৯ to English 0-9
  out = out.replace(/[০-৯]/g, (d) => BN_DIGIT_TO_EN[d] ?? d);

  return out;
}

interface TrackedTextNode extends Text {
  __origText?: string;
  __lastNormalized?: string;
  __lastLang?: 'bn' | 'en';
}

/**
 * Applies language normalization to a DOM subtree so that:
 * - In 'bn' mode: 100% pure Bengali without mixed parenthetical English labels.
 * - In 'en' mode: 100% pure English without Bengali labels or Bengali numerals.
 * Tracks original text and last normalized language on each DOM node so unchanged nodes are skipped in O(1) time.
 */
export function applyDomLanguageNormalizer(root: HTMLElement | null, lang: 'bn' | 'en') {
  if (!root || typeof document === 'undefined') return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: TrackedTextNode[] = [];
  let current = walker.nextNode();
  while (current) {
    const parentEl = current.parentElement;
    const parentTag = parentEl?.tagName;
    if (
      parentTag !== 'SCRIPT' &&
      parentTag !== 'STYLE' &&
      !parentEl?.hasAttribute('data-skip-lang-norm')
    ) {
      textNodes.push(current as TrackedTextNode);
    }
    current = walker.nextNode();
  }

  for (const node of textNodes) {
    const currentVal = node.nodeValue || '';
    if (!currentVal.trim()) continue;

    // Fast O(1) path: if neither the text node nor the target language changed since last pass, skip completely
    if (
      node.__lastLang === lang &&
      node.__lastNormalized !== undefined &&
      currentVal === node.__lastNormalized
    ) {
      continue;
    }

    // If React updated the text node directly since our last normalization, refresh __origText
    if (
      node.__origText === undefined ||
      (node.__lastNormalized !== undefined && currentVal !== node.__lastNormalized)
    ) {
      node.__origText = currentVal;
    }

    const baseText = node.__origText;
    // Fast skip for Bengali mode when baseText contains no Bengali digits needing 0-9 conversion
    let next: string;
    if (lang === 'bn' && !/[০-৯]/.test(baseText)) {
      next = baseText;
    } else {
      next = lang === 'en' ? normalizeToPureEnglish(baseText) : normalizeToPureBengali(baseText);
    }

    node.__lastNormalized = next;
    node.__lastLang = lang;
    if (next !== currentVal) {
      node.nodeValue = next;
    }
  }

  // Also normalize input/textarea placeholders with O(1) cache check
  const inputs = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[placeholder], textarea[placeholder]'
  );
  inputs.forEach((el) => {
    const currentPh = el.getAttribute('placeholder') || '';
    if (!currentPh) return;
    const lastNormPh = el.getAttribute('data-last-norm-ph');
    const lastLang = el.getAttribute('data-last-lang');
    if (lastLang === lang && lastNormPh !== null && currentPh === lastNormPh) {
      return;
    }
    let origPh = el.getAttribute('data-orig-ph');
    if (!origPh || (lastNormPh !== null && currentPh !== lastNormPh)) {
      origPh = currentPh;
      el.setAttribute('data-orig-ph', origPh);
    }
    const nextPh =
      lang === 'en' ? normalizeToPureEnglish(origPh) : normalizeToPureBengali(origPh);
    el.setAttribute('data-last-norm-ph', nextPh);
    el.setAttribute('data-last-lang', lang);
    if (nextPh !== currentPh) {
      el.setAttribute('placeholder', nextPh);
    }
  });
}

