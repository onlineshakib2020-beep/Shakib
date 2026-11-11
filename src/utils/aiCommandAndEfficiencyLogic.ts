import type { BrickGrade } from '../types/kiln';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
function parseBanglaDigits(input: string): string {
  return String(input || '').replace(/[০-৯]/g, (ch) => {
    const idx = BN_DIGITS.indexOf(ch);
    return idx >= 0 ? String(idx) : ch;
  });
}

// ============================================================================
// 1. SMART AI COMMAND PARSER (Bangla + Banglish + English)
// ============================================================================

export type SmartCommandIntentType =
  | 'CREATE_MEMO'
  | 'ADD_WOOD_FUEL_KHOTIAN'
  | 'ADD_SOIL_COAL_KHOTIAN'
  | 'ADD_QUICK_EXPENSE';

export interface ParsedSmartMemoPayload {
  memoNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  gradeId: string;
  gradeNameBn: string;
  quantity: number;
  ratePerThousand: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
}

export interface ParsedWoodFuelPayload {
  supplierName: string;
  woodType: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  note: string;
}

export interface ParsedSoilCoalPayload {
  itemType: 'COAL' | 'SOIL';
  supplierName: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  note: string;
}

export interface ParsedQuickExpensePayload {
  category: string;
  amount: number;
  description: string;
}

export interface ParsedSmartCommandResult {
  intent: SmartCommandIntentType;
  confidence: 'HIGH' | 'MEDIUM';
  rawText: string;
  summaryBn: string;
  summaryEn: string;
  memoPayload?: ParsedSmartMemoPayload;
  woodFuelPayload?: ParsedWoodFuelPayload;
  soilCoalPayload?: ParsedSoilCoalPayload;
  expensePayload?: ParsedQuickExpensePayload;
}

const BANGLISH_NAME_MAP: Record<string, string> = {
  hafijul: 'হাফিজুল ইসলাম',
  hafizul: 'হাফিজুল ইসলাম',
  korim: 'আব্দুল করিম',
  karim: 'আব্দুল করিম',
  rohim: 'আব্দুর রহিম',
  rahim: 'আব্দুর রহিম',
  rofiq: 'রফিকুল ইসলাম',
  rafiq: 'রফিকুল ইসলাম',
  ohab: 'ওহাব সর্দার',
  mofijul: 'মফিজুল সর্দার',
  milon: 'মিলন গাজী',
  kamrul: 'কামরুল ইসলাম',
  sakib: 'সাকিব হোসেন',
  hasan: 'হাসান আলী',
  jamal: 'জামাল উদ্দিন',
  kamal: 'কামাল হোসেন',
  babu: 'বাবু গাজী',
  monir: 'মনিরুল ইসলাম',
  shohidul: 'শহিদুল ইসলাম',
  shahidul: 'শহিদুল ইসলাম',
  alamgir: 'আলমগীর হোসেন',
  jahangir: 'জাহাঙ্গীর আলম',
  liton: 'লিটন গাজী',
  sumon: 'সুমন আহমেদ',
};

const BANGLISH_ADDRESS_MAP: Record<string, string> = {
  satkhira: 'সাতক্ষীরা সদর',
  babulia: 'বাবুলিয়া, সাতক্ষীরা',
  kalaroa: 'কলারোয়া, সাতক্ষীরা',
  tala: 'তালা, সাতক্ষীরা',
  debhata: 'দেবহাটা, সাতক্ষীরা',
  assamuni: 'আশাশুনি, সাতক্ষীরা',
  ashashuni: 'আশাশুনি, সাতক্ষীরা',
  kaliganj: 'কালিগঞ্জ, সাতক্ষীরা',
  shyamnagar: 'শ্যামনগর, সাতক্ষীরা',
  bhomra: 'ভোমরা, সাতক্ষীরা',
  patkelghata: 'পাটকেলঘাটা, সাতক্ষীরা',
};

function normalizeDigitsAndText(input: string): string {
  return parseBanglaDigits(input || '')
    .replace(/,/g, '')
    .trim();
}

function formatNameToken(rawName: string): string {
  const clean = rawName.trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  if (BANGLISH_NAME_MAP[lower]) {
    return BANGLISH_NAME_MAP[lower];
  }
  return clean;
}

function detectBrickGrade(
  normText: string,
  grades?: BrickGrade[]
): { gradeId: string; gradeNameBn: string; defaultRate: number } {
  const lower = normText.toLowerCase();

  // Check 1.5 No Brick first before 1 No or 2 No
  if (
    /(?:1\.5|দেড়|দেড়)\s*(?:no|নং|নাম্বার|নম্বর)?\s*(?:eit|it|et|brick|ইট)?/i.test(
      lower
    )
  ) {
    const found = grades?.find((g) => g.id === 'grade-1-5');
    return {
      gradeId: 'grade-1-5',
      gradeNameBn: found?.nameBn || '১.৫ নং ইট',
      defaultRate: found?.ratePerUnit || 10500,
    };
  }

  if (
    /(?:2|two|দুই)\s*(?:no|নং|নাম্বার|নম্বর)\s*(?:eit|it|et|brick|ইট)?/i.test(
      lower
    ) ||
    /(?:2\s*no|২\s*নং)/i.test(lower)
  ) {
    const found = grades?.find((g) => g.id === 'grade-2');
    return {
      gradeId: 'grade-2',
      gradeNameBn: found?.nameBn || '২ নং ইট',
      defaultRate: found?.ratePerUnit || 9500,
    };
  }

  if (
    /(?:3|three|তিন)\s*(?:no|নং|নাম্বার|নম্বর)\s*(?:eit|it|et|brick|ইট)?/i.test(
      lower
    ) ||
    /(?:3\s*no|৩\s*নং)/i.test(lower)
  ) {
    const found = grades?.find((g) => g.id === 'grade-3');
    return {
      gradeId: 'grade-3',
      gradeNameBn: found?.nameBn || '৩ নং ইট',
      defaultRate: found?.ratePerUnit || 8500,
    };
  }

  if (/(?:picket|piket|পিকেট)/i.test(lower)) {
    const found = grades?.find((g) => g.id === 'grade-picket');
    return {
      gradeId: 'grade-picket',
      gradeNameBn: found?.nameBn || 'পিকেট ইট',
      defaultRate: found?.ratePerUnit || 11000,
    };
  }

  if (/(?:goria|goriya|গড়িয়া|গড়িয়া|ঝামা|jhama)/i.test(lower)) {
    const found = grades?.find((g) => g.id === 'grade-goria');
    return {
      gradeId: 'grade-goria',
      gradeNameBn: found?.nameBn || 'গড়িয়া ও ঝামা ইট',
      defaultRate: found?.ratePerUnit || 7500,
    };
  }

  if (/(?:adla|আদলা|ড্যামেজ|ভাঙা|খোয়া|খোয়া)/i.test(lower)) {
    const found = grades?.find((g) => g.id === 'grade-adla');
    return {
      gradeId: 'grade-adla',
      gradeNameBn: found?.nameBn || 'আদলা ও ড্যামেজ ইট',
      defaultRate: found?.ratePerUnit || 6000,
    };
  }

  const found1 = grades?.find((g) => g.id === 'grade-1');
  return {
    gradeId: 'grade-1',
    gradeNameBn: found1?.nameBn || '১ নং ইট',
    defaultRate: found1?.ratePerUnit || 11000,
  };
}

/**
 * Parses natural language Bangla, Banglish, or English commands into structured kiln actions.
 * Examples supported:
 * 1) "3302 deya akta memo koro 2 no eit 5000 rate 10000 kore hajar phone 01711223344 thikana Satkhira নাম করিম জমা 20000"
 * 2) "hafijul 50 mon kat deyase ata or khotian a add koro r tk dese 4000"
 * 3) "রফিক ২০ টন কয়লা দিয়েছে দর ১৮০০০ টাকা দিয়েছে ১০০০০০"
 */
export function parseSmartKilnCommand(
  rawInput: string,
  brickGrades?: BrickGrade[]
): ParsedSmartCommandResult {
  const norm = normalizeDigitsAndText(rawInput);
  const lower = norm.toLowerCase();

  // Check if command is about Firewood / Wood Fuel Khotian (কাঠ / জ্বালানি খতিয়ান)
  const isWoodFuelCommand =
    /(?:\bkat\b|\bkath\b|কাঠ|জ্বালানি|খড়ি|খড়ি|\bmon\b|মণ)/i.test(lower) &&
    !/(?:memo|মেমো)/i.test(lower);

  if (isWoodFuelCommand) {
    // Extract quantity before 'mon' / 'মণ' / 'ton' / 'টন'
    const qtyMatch = norm.match(
      /(\d+(?:\.\d+)?)\s*(?:mon|man|মণ|মন|ton|টন|গাড়ি|গাড়ি)/i
    );
    const quantity = qtyMatch ? Number(qtyMatch[1]) : 50;
    const unit = /ton|টন/i.test(qtyMatch?.[0] || '') ? 'টন' : 'মণ';

    // Extract rate if explicitly mentioned ("rate 200", "দর ২০০", "kore 200")
    const rateMatch = norm.match(
      /(?:rate|dor|দর|রেট|প্রতি\s*মণ|প্রতি\s*টন)\s*[:=-]?\s*(\d+)/i
    );
    const defaultWoodRate = unit === 'টন' ? 4500 : 180;
    const ratePerUnit = rateMatch ? Number(rateMatch[1]) : defaultWoodRate;

    // Extract paid amount ("tk dese 4000", "taka dese 4000", "joma 4000", "দিয়েছে ৪০০০", "জমা ৪০০০", "পেমেন্ট ৪০০০")
    const paidMatch =
      norm.match(
        /(?:tk|taka|টাকা|জমা|পেমেন্ট|দিসে|দিয়েছে|দেসে|dese|diyeche|diyeshe|paid|joma)\s*(?:dese|diyeche|diyeshe|joma|দিয়েছে|দিসে)?\s*[:=-]?\s*(\d+)/i
      ) ||
      norm.match(
        /(\d+)\s*(?:tk|taka|টাকা)\s*(?:dese|diyeche|joma|দিয়েছে|দিসে|জমা)/i
      );
    const paidAmount = paidMatch ? Number(paidMatch[1]) : 0;

    // Extract supplier name: usually the first word(s) before quantity or before 'kat'/'মণ'
    let supplierName = 'হাফিজুল ইসলাম';
    const explicitSupplierMatch = norm.match(
      /(?:নাম|name|সাপ্লায়ার|ব্যাপারী)\s*[:=-]?\s*([^\d,]+?)(?=\s+\d|\s+mon|\s+মণ|\s+kat|\s+কাঠ|$)/i
    );
    if (explicitSupplierMatch && explicitSupplierMatch[1].trim()) {
      supplierName = formatNameToken(explicitSupplierMatch[1]);
    } else if (qtyMatch && qtyMatch.index !== undefined && qtyMatch.index > 0) {
      const prefix = norm
        .slice(0, qtyMatch.index)
        .replace(/(?:ভাই|ব্যাপারী|সাপ্লায়ার|আজকে|আজ)/gi, '')
        .trim();
      const firstToken = prefix.split(/\s+/)[0] || '';
      if (firstToken) {
        supplierName = formatNameToken(firstToken);
      }
    } else {
      // Check if any known banglish name appears anywhere in the text
      for (const [key, bnName] of Object.entries(BANGLISH_NAME_MAP)) {
        if (new RegExp(`\\b${key}\\b`, 'i').test(lower)) {
          supplierName = bnName;
          break;
        }
      }
    }

    const totalBill = Math.round(quantity * ratePerUnit);
    const dueAmount = Math.max(0, totalBill - paidAmount);

    const payload: ParsedWoodFuelPayload = {
      supplierName,
      woodType: 'মিক্সড জ্বালানি কাঠ',
      quantity,
      unit,
      ratePerUnit,
      totalBill,
      paidAmount,
      dueAmount,
      note: 'এআই কমান্ড এজেন্টের মাধ্যমে খতিয়ানে যুক্ত',
    };

    return {
      intent: 'ADD_WOOD_FUEL_KHOTIAN',
      confidence: 'HIGH',
      rawText: rawInput,
      summaryBn: `জ্বালানি কাঠ খতিয়ান: ${supplierName} — ${quantity} ${unit} কাঠ (@ ৳${ratePerUnit}/${unit}, মোট বিল ৳${totalBill}), নগদ প্রদান ৳${paidAmount}, বাকি ৳${dueAmount}`,
      summaryEn: `Firewood Ledger: ${supplierName} — ${quantity} ${unit} (@ Tk ${ratePerUnit}/${unit}, Bill Tk ${totalBill}), Paid Tk ${paidAmount}, Due Tk ${dueAmount}`,
      woodFuelPayload: payload,
    };
  }

  // Check if command is about Coal / Soil Supplier Khotian (কয়লা / মাটি খতিয়ান)
  const isCoalOrSoilCommand =
    /(?:koyla|koila|coal|কয়লা|কয়লা|mati|মাটি)/i.test(lower) &&
    /(?:ton|টন|truck|ট্রাক|গাড়ি|গাড়ি|khotian|খতিয়ান|খতিয়ান|সাপ্লায়ার)/i.test(
      lower
    ) &&
    !/(?:memo|মেমো)/i.test(lower);

  if (isCoalOrSoilCommand) {
    const isCoal = /(?:koyla|koila|coal|কয়লা|কয়লা)/i.test(lower);
    const qtyMatch = norm.match(
      /(\d+(?:\.\d+)?)\s*(?:ton|টন|truck|ট্রাক|গাড়ি|গাড়ি)/i
    );
    const quantity = qtyMatch ? Number(qtyMatch[1]) : isCoal ? 10 : 20;
    const unit = isCoal ? 'টন' : 'ট্রাক';

    const rateMatch = norm.match(/(?:rate|dor|দর|রেট)\s*[:=-]?\s*(\d+)/i);
    const ratePerUnit = rateMatch
      ? Number(rateMatch[1])
      : isCoal
      ? 18500
      : 1600;

    const paidMatch =
      norm.match(
        /(?:tk|taka|টাকা|জমা|পেমেন্ট|দিসে|দিয়েছে|দেসে|dese|paid|joma)\s*(?:dese|diyeche|joma|দিয়েছে|দিসে)?\s*[:=-]?\s*(\d+)/i
      ) || norm.match(/(\d+)\s*(?:tk|taka|টাকা)\s*(?:dese|জমা|দিয়েছে)/i);
    const paidAmount = paidMatch ? Number(paidMatch[1]) : 0;

    let supplierName = isCoal ? 'কয়লা সাপ্লায়ার' : 'মাটি সাপ্লায়ার';
    if (qtyMatch && qtyMatch.index !== undefined && qtyMatch.index > 0) {
      const prefix = norm.slice(0, qtyMatch.index).trim();
      const firstToken = prefix.split(/\s+/)[0] || '';
      if (firstToken) {
        supplierName = formatNameToken(firstToken);
      }
    }

    const totalBill = Math.round(quantity * ratePerUnit);
    const dueAmount = Math.max(0, totalBill - paidAmount);

    return {
      intent: 'ADD_SOIL_COAL_KHOTIAN',
      confidence: 'HIGH',
      rawText: rawInput,
      summaryBn: `${isCoal ? 'কয়লা' : 'মাটি'} খতিয়ান: ${supplierName} — ${quantity} ${unit} (@ ৳${ratePerUnit}), মোট বিল ৳${totalBill}, জমা ৳${paidAmount}, বাকি ৳${dueAmount}`,
      summaryEn: `${isCoal ? 'Coal' : 'Soil'} Ledger: ${supplierName} — ${quantity} ${unit} (@ Tk ${ratePerUnit}), Bill Tk ${totalBill}, Paid Tk ${paidAmount}`,
      soilCoalPayload: {
        itemType: isCoal ? 'COAL' : 'SOIL',
        supplierName,
        quantity,
        unit,
        ratePerUnit,
        totalBill,
        paidAmount,
        dueAmount,
        note: 'এআই কমান্ডের মাধ্যমে সাপ্লায়ার খাতায় যুক্ত',
      },
    };
  }

  // Check if command is a Quick Expense (খরচ / ডিজেল / ভেকু) without memo/brick sales
  const isExpenseCommand =
    /(?:khoroch|expense|খরচ|ডিজেল|diesel|ভেকু|veku|বিদ্যুৎ)/i.test(lower) &&
    !/(?:memo|মেমো|eit|ইট)/i.test(lower);

  if (isExpenseCommand) {
    const amtMatch = norm.match(/(\d+)/);
    const amount = amtMatch ? Number(amtMatch[1]) : 1000;
    const category = /(?:diesel|ডিজেল|veku|ভেকু)/i.test(lower)
      ? 'ভেকু ও ডিজেল'
      : /(?:বিদ্যুৎ|জ্বালানি)/i.test(lower)
      ? 'বিদ্যুৎ ও জ্বালানি'
      : 'অন্যান্য খরচ';

    return {
      intent: 'ADD_QUICK_EXPENSE',
      confidence: 'MEDIUM',
      rawText: rawInput,
      summaryBn: `তাৎক্ষণিক ক্যাশ খরচ: ${category} খাতে ৳${amount} খরচ ক্যাশ বুকে যোগ হবে`,
      summaryEn: `Quick Expense: Tk ${amount} under ${category}`,
      expensePayload: {
        category,
        amount,
        description: norm,
      },
    };
  }

  // Default / Primary Intent: CREATE_MEMO (অটো ক্যাশ মেমো তৈরি)
  // Example: "3302 deya akta memo koro 2 no eit 5000 rate 10000 kore hajar phone num 01711223344 thikana Satkhira"
  const gradeInfo = detectBrickGrade(norm, brickGrades);

  // 1. Extract Phone Number (11 digits starting with 01)
  const phoneMatch = norm.match(/\b(01[3-9]\d{8})\b/);
  const customerPhone = phoneMatch ? phoneMatch[1] : '—';

  // Remove phone number and grade pattern from working string so numbers don't collide
  let working = norm
    .replace(/\b01[3-9]\d{8}\b/g, ' ')
    .replace(/(?:1\.5|দেড়|দেড়|1|2|3|এক|দুই|তিন)\s*(?:no|নং|নাম্বার|নম্বর)/gi, ' ');

  // 2. Extract Memo No:
  // Matches: "3302 deya akta memo", "3302 diye memo", "memo 3302", "মেমো ৩৩০২", "3302 no memo"
  const memoNoMatch =
    working.match(
      /\b(\d{2,6})\s*(?:deya|diye|diya|no|নং|নাম্বার|নম্বর|দিয়ে|দিয়ে)?\s*(?:akta|ekta|একটা|একটি)?\s*(?:memo|মেমো)/i
    ) ||
    working.match(
      /(?:memo|মেমো)\s*(?:no|নং|নাম্বার|নম্বর)?\s*[:=-]?\s*(\d{2,6})\b/i
    );
  const memoNo = memoNoMatch ? memoNoMatch[1] : '';

  if (memoNo) {
    working = working.replace(new RegExp(`\\b${memoNo}\\b`), ' ');
  }

  // 3. Extract Rate per 1,000 ("rate 10000", "দর ১০০০০", "10000 kore hajar", "রেট ১০০০০")
  const rateMatch =
    working.match(/(?:rate|dor|দর|রেট)\s*[:=-]?\s*(\d{3,6})\b/i) ||
    working.match(/\b(\d{4,5})\s*(?:kore|করে|টাকা)?\s*(?:hajar|হাজার)/i);
  const ratePerThousand = rateMatch
    ? Number(rateMatch[1])
    : gradeInfo.defaultRate;

  if (rateMatch) {
    working = working.replace(rateMatch[0], ' ');
  }

  // 4. Extract Paid Amount ("joma 20000", "জমা ২০০০০", "tk dese 20000", "paid 20000", "নগদ ২০০০০")
  const paidMatch =
    working.match(
      /(?:joma|জমা|paid|নগদ|tk\s*dese|taka\s*dese|টাকা\s*দিয়েছে|দিয়েছে|দিসে)\s*[:=-]?\s*(\d+)\b/i
    ) ||
    working.match(/\b(\d+)\s*(?:tk|taka|টাকা)\s*(?:joma|জমা|dese|দিয়েছে)/i);

  if (paidMatch) {
    working = working.replace(paidMatch[0], ' ');
  }

  // 5. Extract Brick Quantity ("eit 5000", "5000 eit", "5000 pcs", "৫০০০ পিস", or remaining large number)
  const qtyExplicitMatch =
    working.match(/(?:eit|it|et|brick|ইট)\s*[:=-]?\s*(\d{2,7})\b/i) ||
    working.match(/\b(\d{2,7})\s*(?:পিস|টি|খানা|pcs|eit|it|brick|ইট)/i);

  let quantity = 1000;
  if (qtyExplicitMatch) {
    quantity = Number(qtyExplicitMatch[1]);
  } else {
    // Any remaining number >= 100 in working string
    const remNums = Array.from(working.matchAll(/\b(\d{3,6})\b/g)).map((m) =>
      Number(m[1])
    );
    if (remNums.length > 0) {
      quantity = remNums[0];
    }
  }

  const totalAmount = Math.round((quantity / 1000) * ratePerThousand);
  const paidAmount = paidMatch
    ? Math.min(totalAmount, Number(paidMatch[1]))
    : totalAmount;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // 6. Extract Address ("thikana ...", "ঠিকানা ...")
  let customerAddress = 'বাবুলিয়া, সাতক্ষীরা';
  const addrMatch = norm.match(
    /(?:thikana|ঠিকানা|address|গ্রাম)\s*[:=-]?\s*([a-zA-Z\u0980-\u09FF\s]+?)(?=\s+(?:name|nam|নাম|phone|ফোন|মোবাইল|joma|জমা|rate|রেট|\d)|$)/i
  );
  if (addrMatch && addrMatch[1].trim()) {
    const rawAddr = addrMatch[1].trim();
    const lowerAddr = rawAddr.toLowerCase();
    customerAddress = BANGLISH_ADDRESS_MAP[lowerAddr] || rawAddr;
  } else {
    for (const [k, bnAddr] of Object.entries(BANGLISH_ADDRESS_MAP)) {
      if (new RegExp(`\\b${k}\\b`, 'i').test(lower)) {
        customerAddress = bnAddr;
        break;
      }
    }
  }

  // 7. Extract Customer Name ("nam ...", "নাম ...", "name ...", "ক্রেতা ...")
  let customerName = 'সম্মানিত ক্রেতা';
  const nameMatch = norm.match(
    /(?:nam|name|নাম|ক্রেতা|পার্টি)\s*[:=-]?\s*([a-zA-Z\u0980-\u09FF\s]+?)(?=\s+(?:thikana|ঠিকানা|phone|ফোন|মোবাইল|joma|জমা|rate|রেট|eit|ইট|\d)|$)/i
  );
  if (nameMatch && nameMatch[1].trim()) {
    customerName = formatNameToken(nameMatch[1].trim());
  } else {
    for (const [k, bnName] of Object.entries(BANGLISH_NAME_MAP)) {
      if (new RegExp(`\\b${k}\\b`, 'i').test(lower)) {
        customerName = bnName;
        break;
      }
    }
  }

  const memoPayload: ParsedSmartMemoPayload = {
    memoNo,
    customerName,
    customerPhone,
    customerAddress,
    gradeId: gradeInfo.gradeId,
    gradeNameBn: gradeInfo.gradeNameBn,
    quantity,
    ratePerThousand,
    totalAmount,
    paidAmount,
    dueAmount,
  };

  return {
    intent: 'CREATE_MEMO',
    confidence: 'HIGH',
    rawText: rawInput,
    summaryBn: `অটো ক্যাশ মেমো ${memoNo ? `#${memoNo}` : '(অটো নম্বর)'}: ${customerName} · ${quantity} পিস ${gradeInfo.gradeNameBn} (@ ৳${ratePerThousand}/হাজার) · মোট বিল ৳${totalAmount} · জমা ৳${paidAmount} · বাকি ৳${dueAmount}`,
    summaryEn: `Auto Cash Memo ${memoNo ? `#${memoNo}` : '(Auto)'}: ${customerName} · ${quantity} pcs ${gradeInfo.gradeNameBn} (@ Tk ${ratePerThousand}/1,000) · Total Tk ${totalAmount}`,
    memoPayload,
  };
}

// ============================================================================
// 2. KILN ROUND COAL & FIRING EFFICIENCY TRACKER (চুল্লির রাউন্ড ও জ্বালানি দক্ষতা বিশ্লেষণ)
// ============================================================================

export interface FiringRoundEfficiencyInput {
  roundNo: number;
  roundNameBn?: string;
  bricksFired: number;
  coalUsedTons: number;
  coalRatePerTon: number;
  woodUsedMaunds: number;
  woodRatePerMaund: number;
  lakriUsedMaunds?: number;
  lakriRatePerMaund?: number;
  targetCoalTonsPerLakh?: number;
}

export type FuelEfficiencyRating = 'OPTIMAL' | 'NORMAL' | 'EXCESSIVE';

export interface FiringRoundEfficiencyResult {
  roundNo: number;
  bricksFired: number;
  bricksInLakhs: number;
  coalUsedTons: number;
  woodUsedMaunds: number;
  lakriUsedMaunds: number;
  coalTonsPerLakhBricks: number;
  coalKgPerThousandBricks: number;
  woodMaundsPerLakhBricks: number;
  lakriMaundsPerLakhBricks: number;
  totalCoalCost: number;
  totalWoodCost: number;
  totalLakriCost: number;
  totalFuelCost: number;
  fuelCostPerThousandBricks: number;
  rating: FuelEfficiencyRating;
  ratingLabelBn: string;
  ratingLabelEn: string;
  varianceTonsFromTargetPerLakh: number;
}

/**
 * Standard Brick Kiln Fuel Benchmark in Bangladesh:
 * - Optimal: <= 17.5 Tons of coal per 1,00,000 (1 Lakh) fired bricks (i.e. <= 175 kg per 1,000 bricks)
 * - Normal: 17.51 to 20.0 Tons per 1 Lakh bricks
 * - Excessive: > 20.0 Tons per 1 Lakh bricks
 */
export function calculateFiringEfficiency(
  input: FiringRoundEfficiencyInput
): FiringRoundEfficiencyResult {
  const bricksFired = Math.max(1000, Number(input.bricksFired) || 0);
  const coalUsedTons = Math.max(0, Number(input.coalUsedTons) || 0);
  const coalRatePerTon = Math.max(0, Number(input.coalRatePerTon) || 0);
  const woodUsedMaunds = Math.max(0, Number(input.woodUsedMaunds) || 0);
  const woodRatePerMaund = Math.max(0, Number(input.woodRatePerMaund) || 0);
  const lakriUsedMaunds = Math.max(0, Number(input.lakriUsedMaunds) || 0);
  const lakriRatePerMaund = Math.max(0, Number(input.lakriRatePerMaund) || 0);
  const targetPerLakh =
    Number(input.targetCoalTonsPerLakh) > 0
      ? Number(input.targetCoalTonsPerLakh)
      : 17.0;

  const bricksInLakhs = Number((bricksFired / 100000).toFixed(2));
  const thousands = bricksFired / 1000;

  const coalTonsPerLakhBricks = Number(
    ((coalUsedTons / bricksFired) * 100000).toFixed(2)
  );
  const coalKgPerThousandBricks = Math.round(
    (coalUsedTons * 1000) / thousands
  );
  const woodMaundsPerLakhBricks = Number(
    ((woodUsedMaunds / bricksFired) * 100000).toFixed(1)
  );
  const lakriMaundsPerLakhBricks = Number(
    ((lakriUsedMaunds / bricksFired) * 100000).toFixed(1)
  );

  const totalCoalCost = Math.round(coalUsedTons * coalRatePerTon);
  const totalWoodCost = Math.round(woodUsedMaunds * woodRatePerMaund);
  const totalLakriCost = Math.round(lakriUsedMaunds * lakriRatePerMaund);
  const totalFuelCost = totalCoalCost + totalWoodCost + totalLakriCost;
  const fuelCostPerThousandBricks = Math.round(totalFuelCost / thousands);

  const varianceTonsFromTargetPerLakh = Number(
    (coalTonsPerLakhBricks - targetPerLakh).toFixed(2)
  );

  let rating: FuelEfficiencyRating = 'OPTIMAL';
  let ratingLabelBn = 'উত্তম সাশ্রয়ী ফায়ারিং (Optimal Efficiency)';
  let ratingLabelEn = 'Optimal Fuel Efficiency';

  if (coalTonsPerLakhBricks > 20) {
    rating = 'EXCESSIVE';
    ratingLabelBn = 'অতিরিক্ত জ্বালানি ব্যয় সতর্কতা (High Fuel Usage)';
    ratingLabelEn = 'Excessive Fuel Consumption';
  } else if (coalTonsPerLakhBricks > 17.5) {
    rating = 'NORMAL';
    ratingLabelBn = 'স্বাভাবিক জ্বালানি ব্যয় (Standard Efficiency)';
    ratingLabelEn = 'Standard Fuel Consumption';
  }

  return {
    roundNo: input.roundNo,
    bricksFired,
    bricksInLakhs,
    coalUsedTons,
    woodUsedMaunds,
    lakriUsedMaunds,
    coalTonsPerLakhBricks,
    coalKgPerThousandBricks,
    woodMaundsPerLakhBricks,
    lakriMaundsPerLakhBricks,
    totalCoalCost,
    totalWoodCost,
    totalLakriCost,
    totalFuelCost,
    fuelCostPerThousandBricks,
    rating,
    ratingLabelBn,
    ratingLabelEn,
    varianceTonsFromTargetPerLakh,
  };
}

