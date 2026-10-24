import { TransactionType } from '../types';

export interface ParsedBankMessage {
  refCode: string;
  amount: number;
  type: TransactionType;
  senderOrCounterparty: string;
  targetAccount?: string;
  standingBalance?: number;
  provider: 'CBE' | 'TELEBIRR' | 'EBIRR' | 'AWASH' | 'DASHEN' | 'BOA' | 'OTHER';
  suggestedCategory: string;
  dateStr?: string;
  timeStr?: string;
  rawText: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Normalizes text by removing non-printable characters, standardizing spaces,
 * and harmonizing punctuation across English and Ethiopic punctuation marks.
 */
export function normalizeSmsText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[፡፤]/g, ':') // Ethiopic colon / semicolon
    .replace(/[።]/g, '.') // Ethiopic full stop
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect the financial institution / wallet provider from SMS content.
 */
export function detectProvider(text: string): ParsedBankMessage['provider'] {
  const lower = text.toLowerCase();
  
  if (
    lower.includes('cbe') ||
    lower.includes('commercial bank') ||
    lower.includes('ንግድ ባንክ') ||
    lower.includes('ኢትዮጵያ ንግድ ባንክ') ||
    lower.includes('cbe birr') ||
    lower.includes('cbebirr') ||
    lower.includes('mbreciept.cbe') ||
    /\bft\d{8,14}\b/i.test(text) ||
    lower.includes('1000751694559') ||
    /account\s+1000\d{9}/i.test(text) ||
    /የሂሳብ ቁጥር(?:ዎ)?\s*1000/i.test(text)
  ) {
    return 'CBE';
  }

  if (
    lower.includes('telebirr') ||
    lower.includes('ቴሌብር') ||
    lower.includes('e-money') ||
    lower.includes('ethio telecom') ||
    lower.includes('ኢትዮ ቴሌኮም') ||
    lower.includes('0989367877') ||
    lower.includes('251989367877')
  ) {
    return 'TELEBIRR';
  }

  if (
    lower.includes('ebirr') ||
    lower.includes('ኢ-ብር') ||
    lower.includes('coopay') ||
    lower.includes('cooperative bank')
  ) {
    return 'EBIRR';
  }

  if (lower.includes('awash') || lower.includes('አዋሽ')) {
    return 'AWASH';
  }

  if (lower.includes('dashen') || lower.includes('ዳሽን') || lower.includes('amole') || lower.includes('አሞሌ')) {
    return 'DASHEN';
  }

  if (lower.includes('abyssinia') || lower.includes('አቢሲኒያ') || lower.includes('boa')) {
    return 'BOA';
  }

  return 'OTHER';
}

/**
 * Detect if the transaction is Money In (Credit/Income) or Money Out (Debit/Expense).
 */
export function detectTransactionType(text: string): TransactionType {
  const lower = text.toLowerCase();

  // Negative / Outflow indicators
  const debitPatterns = [
    /\bdebited\b/i,
    /\bdebit\b/i,
    /\bpaid\b/i,
    /\bpayment to\b/i,
    /\btransferred to\b/i,
    /\btransfer to\b/i,
    /\bsent to\b/i,
    /\bcash-out\b/i,
    /\bwithdrawn\b/i,
    /\bwithdrawal\b/i,
    /\bpurchase\b/i,
    /ወጪ\s*ተደርጓል/,
    /ወጪ\s*ተደርጎል/,
    /ተላልፏል/,
    /ተከፍሏል/,
    /የተከፈለ/,
    /ወጪ/
  ];

  // Positive / Inflow indicators
  const creditPatterns = [
    /\bcredited\b/i,
    /\bcredited with\b/i,
    /\bcredit\b/i,
    /\breceived\b/i,
    /\breceived from\b/i,
    /\bdeposited\b/i,
    /\bdeposit\b/i,
    /\bcash-in\b/i,
    /\btop-up\b/i,
    /\btransferred from\b/i,
    /ገቢ\s*ተደርጓል/,
    /ገቢ\s*ተደርጎል/,
    /ገቢ\s*ተደርጎልዎታል/,
    /ተቀብለዋል/,
    /የተቀበሉት/,
    /ገቢ/
  ];

  for (const pattern of debitPatterns) {
    if (pattern.test(text)) return 'EXPENSE';
  }

  for (const pattern of creditPatterns) {
    if (pattern.test(text)) return 'INCOME';
  }

  // Fallback heuristic: check if '+' or '-' exists
  if (/\+\s*[\d,]+/.test(text)) return 'INCOME';
  if (/-\s*[\d,]+/.test(text)) return 'EXPENSE';

  return 'INCOME';
}

/**
 * Extracts the primary transaction amount accurately.
 * Handles English (ETB, Birr) and Amharic (ብር, በ...ብር) scripts.
 * Filters out standing balance values so they aren't confused with transaction amounts.
 */
export function extractAmount(text: string): number | null {
  const normalized = normalizeSmsText(text);

  // 1. Contextual extraction around transaction action verbs
  // Example: "credited with ETB 190.00", "debited with ETB 500.00", "received ETB 1,035.00", "transferred ETB 200.00"
  const verbMatch = normalized.match(
    /(?:credited\s+with|debited\s+with|received|paid|transferred|sent|deposited|amount\s+is|amount\s*:)\s+(?:etb|birr)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
  );
  if (verbMatch && verbMatch[1]) {
    const val = parseFloat(verbMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Amharic verb and particle patterns:
  // Example: "በ 190.00 ብር ገቢ ተደርጓል", "በ 500.00 ብር ወጪ", "1,035.00 ብር ገቢ", "የ 200.00 ብር"
  const amharicVerbMatch = normalized.match(
    /(?:በ|የ)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*ብር\s*(?:ገቢ|ወጪ|ተላልፏል|ተከፍሏል|ተቀብለዋል)/
  );
  if (amharicVerbMatch && amharicVerbMatch[1]) {
    const val = parseFloat(amharicVerbMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Telebirr Amharic pattern: "ከ 0911****** 1,035.00 ብር ገቢ ተደርጎልዎታል።"
  const amharicIncomeMatch = normalized.match(
    /(?:ከ|to|from)\s+[0-9*A-Za-z\s]+\s+([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*ብር/
  );
  if (amharicIncomeMatch && amharicIncomeMatch[1]) {
    const val = parseFloat(amharicIncomeMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Currency prefix: ETB 1,035.00 or Birr 500
  // Note: Ignore if immediately preceded by balance keywords
  const prefixRegex = /(?<!balance\s*(?:is|:)?\s*)(?:etb|birr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixRegex.exec(normalized)) !== null) {
    const fullMatchIndex = match.index;
    const precedingSlice = normalized.slice(Math.max(0, fullMatchIndex - 30), fullMatchIndex).toLowerCase();
    if (!precedingSlice.includes('balance') && !precedingSlice.includes('bal') && !precedingSlice.includes('ቀሪ')) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // 5. Currency suffix: 1,035.00 ETB or 1,035.00 ብር
  const suffixRegex = /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:etb|birr|ብር)/gi;
  while ((match = suffixRegex.exec(normalized)) !== null) {
    const fullMatchIndex = match.index;
    const precedingSlice = normalized.slice(Math.max(0, fullMatchIndex - 30), fullMatchIndex).toLowerCase();
    if (!precedingSlice.includes('balance') && !precedingSlice.includes('bal') && !precedingSlice.includes('ቀሪ')) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // 6. Generic leading/standalone number with plus/minus: "+1,035" or "+190"
  const signMatch = normalized.match(/[+\-]\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
  if (signMatch && signMatch[1]) {
    const val = parseFloat(signMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Extracts Transaction Reference Code / ID (e.g. FT26..., DB98..., 1000289..., EB908...).
 */
export function extractReferenceCode(text: string, provider: ParsedBankMessage['provider']): string {
  const normalized = normalizeSmsText(text);

  // 1. Explicit keyword extraction
  const keywordMatch = normalized.match(
    /(?:transaction\s+id|transaction\s+number\s+is|txn\s+id|txnref|txn\s+no|ref\s*no|reference\s*no|ref|reference|receipt\s*no|መለያ\s*ቁጥር|የመለያ\s*ቁጥር|ሪፈረንስ)\s*[:：]?\s*([a-z0-9\-_]{6,24})/i
  );
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1].trim().toUpperCase();
  }

  // 2. CBE FT code pattern: FT followed by digits/letters (e.g., FT2629239821, FT2608054412)
  const ftMatch = normalized.match(/\b(FT[0-9A-Z]{8,16})\b/i);
  if (ftMatch && ftMatch[1]) {
    return ftMatch[1].trim().toUpperCase();
  }

  // 3. CBE Amharic pattern: "በ FT2629239821 በ 190.00 ብር"
  const ftAmharic = normalized.match(/በ\s+(FT[0-9A-Z]{8,16})/i);
  if (ftAmharic && ftAmharic[1]) {
    return ftAmharic[1].trim().toUpperCase();
  }

  // 4. CBE receipt URL: cbe.com.et/FT... or mbreciept.cbe.com.et/...
  const urlMatch = normalized.match(/cbe\.com\.et\/(?:receipt\/)?([A-Za-z0-9\-_]{8,20})/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].trim().toUpperCase();
  }

  // 5. Telebirr alphanumeric patterns: DB..., 8A..., CI..., or 10-14 digit numeric sequence
  if (provider === 'TELEBIRR') {
    const tbAlphaMatch = normalized.match(/\b([A-Z0-9]{10,14})\b/);
    if (tbAlphaMatch && tbAlphaMatch[1] && !/^\d{4}-\d{2}-\d{2}$/.test(tbAlphaMatch[1])) {
      return tbAlphaMatch[1].toUpperCase();
    }
  }

  // 6. eBirr pattern: EB...
  const ebMatch = normalized.match(/\b(EB[0-9A-Z]{6,12})\b/i);
  if (ebMatch && ebMatch[1]) {
    return ebMatch[1].trim().toUpperCase();
  }

  // Fallback: Generate auto identifier
  return `TXN-${Date.now().toString().slice(-6)}`;
}

/**
 * Extracts Standing / Available Balance after the transaction has settled.
 */
export function extractStandingBalance(text: string): number | undefined {
  const normalized = normalizeSmsText(text);

  // English balance patterns
  const engBalMatch =
    normalized.match(
      /(?:current\s+balance|available\s+balance|e-money\s+account\s+balance|new\s+a\/c\s+balance|new\s+balance|total\s+balance|bal|balance)\s*(?:is|:)?\s*(?:etb|birr)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
    ) ||
    normalized.match(
      /(?:etb|birr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:available|current\s+balance|available\s+balance)/i
    );

  if (engBalMatch && engBalMatch[1]) {
    const val = parseFloat(engBalMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) return val;
  }

  // Amharic balance patterns:
  // "የአሁን ቀሪ ሂሳብዎ 4,520.00 ብር ነው", "ቀሪ ሂሳብዎ 8,450.25 ብር ነው", "ቀሪ ሂሳብ: 1,500.00"
  const amhBalMatch =
    normalized.match(
      /(?:የአሁን\s+ቀሪ\s+ሂሳብዎ|ቀሪ\s+ሂሳብዎ|የአሁኑ\s+ቀሪ\s+ሂሳብ|ቀሪ\s+ሂሳብ)\s*(?:is|:|ነው)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:ብር|etb|birr)?/i
    ) ||
    normalized.match(
      /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*ብር\s*(?:የአሁን\s+ቀሪ\s+ሂሳብ|ቀሪ\s+ሂሳብ)/i
    );

  if (amhBalMatch && amhBalMatch[1]) {
    const val = parseFloat(amhBalMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) return val;
  }

  return undefined;
}

/**
 * Extracts sender, counterparty, payer, or merchant from the SMS body.
 */
export function extractCounterparty(
  text: string,
  type: TransactionType,
  provider: ParsedBankMessage['provider']
): string {
  const normalized = normalizeSmsText(text);

  // 1. English patterns: "from ABEBE KEBEDE (251989367877)", "by BIRHANU WORKU", "to MERCHANTPAY"
  if (type === 'INCOME') {
    const fromMatch =
      normalized.match(/(?:from|by)\s+([A-Za-z0-9\s*()+.-]+?)(?=\s+on|\s+ref|\s+to|\s+date|\.|,|$)/i) ||
      normalized.match(/ከ\s+([A-Za-z0-9\u1200-\u137F\s*()+.-]+?)(?=\s+[0-9]+|\s*ብር|\s+on|\.|,|$)/);

    if (fromMatch && fromMatch[1].trim()) {
      return fromMatch[1].trim();
    }
  } else {
    const toMatch =
      normalized.match(/(?:paid\s+to|transferred\s+to|to|sent\s+to)\s+([A-Za-z0-9\s*()+.-]+?)(?=\s+on|\s+ref|\s+fee|\s+date|\.|,|$)/i) ||
      normalized.match(/ወደ\s+([A-Za-z0-9\u1200-\u137F\s*()+.-]+?)(?=\s+[0-9]+|\s*ብር|\s+on|\.|,|$)/);

    if (toMatch && toMatch[1].trim()) {
      return toMatch[1].trim();
    }
  }

  // Fallback defaults
  if (provider === 'TELEBIRR') {
    return type === 'INCOME' ? 'Telebirr Customer' : 'Telebirr Payment';
  }
  if (provider === 'CBE') {
    return type === 'INCOME' ? 'CBE Customer' : 'CBE Transfer';
  }
  if (provider === 'EBIRR') {
    return type === 'INCOME' ? 'eBirr Customer' : 'eBirr Merchant';
  }

  return 'Unknown Party';
}

/**
 * Extracts target account number or suffix (e.g. 1000751694559 or 1000****123).
 */
export function extractTargetAccount(text: string): string | undefined {
  const normalized = normalizeSmsText(text);

  const accMatch =
    normalized.match(/(?:account|a\/c|acc|የሂሳብ\s*ቁጥር(?:ዎ)?)\s*(?:is|:)?\s*([0-9*]{4,16})/i) ||
    normalized.match(/\b(1000[0-9*]{6,12})\b/);

  return accMatch ? accMatch[1] : undefined;
}

/**
 * Extracts date and timestamp from SMS if explicitly mentioned.
 */
export function extractDateTime(text: string): { dateStr?: string; timeStr?: string } {
  const normalized = normalizeSmsText(text);

  // Pattern 1: ISO date like 2026-10-18 or 2026-08-05
  const isoMatch = normalized.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?))?/);
  if (isoMatch) {
    return { dateStr: isoMatch[1], timeStr: isoMatch[2] };
  }

  // Pattern 2: DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = normalized.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?))?/);
  if (slashMatch) {
    const parts = slashMatch[1].split(/[\/\-]/);
    // Assuming DD/MM/YYYY
    const formatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return { dateStr: formatted, timeStr: slashMatch[2] };
  }

  // Pattern 3: 05-AUG-2026
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const textDateMatch = normalized.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0');
    const month = monthNames[textDateMatch[2].toLowerCase()] || '01';
    const year = textDateMatch[3];
    return { dateStr: `${year}-${month}-${day}` };
  }

  return {};
}

/**
 * Main bank SMS alert parser.
 * Works seamlessly with Telebirr, CBE Bank, eBirr, Awash, and Dashen alerts.
 */
export function parseBankMessage(rawText: string): ParsedBankMessage | null {
  if (!rawText || !rawText.trim()) return null;

  const normalized = normalizeSmsText(rawText);
  const provider = detectProvider(normalized);
  const type = detectTransactionType(normalized);
  const amount = extractAmount(normalized);
  const refCode = extractReferenceCode(normalized, provider);
  const standingBalance = extractStandingBalance(normalized);
  const senderOrCounterparty = extractCounterparty(normalized, type, provider);
  const targetAccount = extractTargetAccount(normalized);
  const { dateStr, timeStr } = extractDateTime(normalized);

  // Auto-category suggestion
  let suggestedCategory = type === 'INCOME' ? 'Daily Sales collection' : 'Operational Expense';
  const lower = normalized.toLowerCase();
  if (lower.includes('merchant') || lower.includes('store') || lower.includes('shop') || lower.includes('pos')) {
    suggestedCategory = type === 'EXPENSE' ? 'Supplies' : 'Daily Sales collection';
  } else if (lower.includes('water') || lower.includes('electric') || lower.includes('utility') || lower.includes('bill')) {
    suggestedCategory = 'Utilities/Electricity';
  } else if (lower.includes('ekub') || lower.includes('equb')) {
    suggestedCategory = 'Ekub contribution';
  } else if (lower.includes('receivable') || lower.includes('repayment') || lower.includes('loan')) {
    suggestedCategory = 'Repayment on receivable';
  } else if (lower.includes('transport') || lower.includes('taxi')) {
    suggestedCategory = 'Transportation';
  } else if (lower.includes('food') || lower.includes('lunch') || lower.includes('drinks') || lower.includes('refreshment') || lower.includes('buna')) {
    suggestedCategory = 'Food & Refreshments';
  } else if (lower.includes('home expense') || lower.includes('zeyt')) {
    suggestedCategory = 'Home expense';
  }

  // Confidence estimation
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (amount && amount > 0 && refCode && !refCode.startsWith('TXN-')) {
    confidence = 'HIGH';
  } else if (amount && amount > 0) {
    confidence = 'MEDIUM';
  }

  return {
    refCode,
    amount: amount || 0,
    type,
    senderOrCounterparty,
    targetAccount,
    standingBalance,
    provider,
    suggestedCategory,
    dateStr: dateStr || new Date().toISOString().split('T')[0],
    timeStr,
    rawText: rawText.trim(),
    confidence
  };
}

/**
 * Pre-defined real-world sample SMS messages for testing and instant user feedback.
 */
export const MULTILINGUAL_SMS_SAMPLES = {
  TELEBIRR: [
    {
      label: 'Telebirr Income (English)',
      category: 'Daily Sales collection',
      text: 'You have received ETB 1,035.00 from 251911****** John Doe on 18/10/2026 10:36:12. Your current balance is ETB 4,520.00. Transaction ID: 100028919283.'
    },
    {
      label: 'Telebirr ገቢ (አማርኛ)',
      category: 'Daily Sales collection',
      text: 'ከ 251911****** 1,035.00 ብር ገቢ ተደርጎልዎታል። የአሁን ቀሪ ሂሳብዎ 4,520.00 ብር ነው። የመለያ ቁጥር: 100028919283.'
    },
    {
      label: 'Telebirr Payment (Expense)',
      category: 'Operational Expense',
      text: 'You have transferred ETB 200.00 to 251922****** Jane Doe. Fee is ETB 0.00. Current balance: ETB 4,320.00. Txn ID: DB98219482.'
    }
  ],
  CBE: [
    {
      label: 'CBE Credit (English)',
      category: 'Daily Sales collection',
      text: 'Dear Customer, your CBE account 1000****123 has been credited with ETB 190.00 on 18/10/2026 10:36 PM by Mobile Banking. Ref: FT2629239821. Available Balance: ETB 8,450.25.'
    },
    {
      label: 'CBE ገቢ Credit (አማርኛ)',
      category: 'Daily Sales collection',
      text: 'ውድ ደንበኛ፣ የሂሳብ ቁጥርዎ 1000****123 በ FT2629239821 በ 190.00 ብር ገቢ ተደርጓል። ቀሪ ሂሳብዎ 8,450.25 ብር ነው።'
    },
    {
      label: 'CBE Debit (Expense)',
      category: 'Utilities/Electricity',
      text: 'Dear Customer, your account 1000751694559 has been debited with ETB 400.00 to WATER UTILITY on 18/10/2026. Ref: FT2608054412. Available balance ETB 7,950.25.'
    }
  ],
  EBIRR: [
    {
      label: 'eBirr Received (English)',
      category: 'Daily Sales collection',
      text: 'You have received 75.00 ETB from Abebe. Ref No: EB8492048. Balance: 2,100.00 ETB. eBirr Mobile Money.'
    },
    {
      label: 'eBirr ገቢ (አማርኛ)',
      category: 'Daily Sales collection',
      text: 'ከ 0922334455 75.00 ብር ገቢ ተደርጓል። የመለያ ቁጥር: EB8492048። ቀሪ ሂሳብ: 2,100.00 ብር።'
    }
  ]
};
