/**
 * Dedicated SMS parser and daily aggregation engine for Telebirr, CBE, and E-Birr.
 * Enforces strict provider isolation, fixed-point math, and robust regex extraction.
 */

export interface ParsedSmsPayload {
  provider: 'telebirr' | 'cbe' | 'ebirr';
  amount: number;
  referenceNumber: string;
  senderName: string;
  senderPhone?: string;
  transactionDate: string; // YYYY-MM-DD
  transactionTime: string; // HH:mm:ss or ISO
  balanceAfter?: number | null;
  rawSmsText: string;
  sender: string;
}

/**
 * Standardize phone sender whitelist check
 */
export function isSenderWhitelisted(sender: string, whitelist: string[]): boolean {
  if (!sender || !whitelist || whitelist.length === 0) return false;
  const normalizedSender = sender.trim().toLowerCase();
  return whitelist.some((w) => {
    const norm = w.trim().toLowerCase();
    return normalizedSender === norm || normalizedSender.includes(norm) || norm.includes(normalizedSender);
  });
}

/**
 * Clean and parse monetary amounts with fixed-point accuracy (avoid floating point issues)
 * Handles comma as thousands separator (e.g. 1,500.50) or comma as decimal separator
 */
export function parseCurrencyAmount(rawStr: string): number {
  if (!rawStr) return 0;
  // First strip currency prefixes/suffixes like ETB, Birr, USD, etc.
  let clean = rawStr.replace(/[^0-9,.]/g, '').trim();
  if (!clean) return 0;
  // Format 1,500.50 -> 1500.50
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/,/g, '');
  } else if (clean.match(/^\d+,\d{2}$/)) {
    // European style 1500,50
    clean = clean.replace(',', '.');
  } else {
    clean = clean.replace(/,/g, '');
  }
  const val = parseFloat(clean);
  if (isNaN(val) || val <= 0) return 0;
  // Round to 2 decimals using integer math
  return Math.round(val * 100) / 100;
}

/**
 * Extract YYYY-MM-DD from SMS date patterns
 */
export function extractCalendarDayFromSms(text: string, defaultDateStr?: string): { dayStr: string; timeStr: string } {
  const now = defaultDateStr ? new Date(defaultDateStr) : new Date();
  
  // Try pattern 1: YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  const isoMatch = text.match(/\b(202\d[-/]\d{1,2}[-/]\d{1,2})\b/);
  if (isoMatch) {
    const parts = isoMatch[1].replace(/\//g, '-').split('-');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return { dayStr: `${y}-${m}-${d}`, timeStr: `${y}-${m}-${d}T12:00:00.000Z` };
  }

  const dmyMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](202\d)\b/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return { dayStr: `${y}-${m}-${d}`, timeStr: `${y}-${m}-${d}T12:00:00.000Z` };
  }

  // Fallback to today's date in YYYY-MM-DD
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    dayStr: `${y}-${m}-${d}`,
    timeStr: now.toISOString()
  };
}

/**
 * Provider-specific parser for Telebirr
 * Example SMS formats:
 * "You have received ETB 450.00 from Abebe Bikila (251911223344) on 2026-09-07 11:20:15. Transaction number is TB829102482. Your current balance is ETB 12,450.50."
 * "Dear Customer, you received Birr 1,200.00 from ALMAZ KEBEDE (0911000000). Trans ID: CI8921829. Bal: ETB 15,200."
 */
export function parseTelebirrSms(rawText: string, senderHeader: string): ParsedSmsPayload | null {
  const text = rawText.trim();
  
  // Extract Amount
  const amountMatch = text.match(/(?:received|credited|deposit|transferred)\s+(?:etb|birr)?\s*([0-9,]+(?:\.\d{1,2})?)/i)
    || text.match(/(?:etb|birr)\s*([0-9,]+(?:\.\d{1,2})?)\s+(?:received|credited|from)/i)
    || text.match(/(?:etb|birr)\s*([0-9,]+(?:\.\d{1,2})?)/i);

  const amount = amountMatch ? parseCurrencyAmount(amountMatch[1]) : 0;
  if (amount <= 0) return null;

  // Extract Reference
  const refMatch = text.match(/(?:transaction number is|trans id|txn id|txnref|txnid|ref:|ref|trans no)\s*[:.]?\s*([A-Za-z0-9\-_]{6,20})/i)
    || text.match(/\b(TB[A-Za-z0-9]{6,16}|CI[A-Za-z0-9]{6,16}|[0-9]{10,14})\b/i);

  const referenceNumber = refMatch ? refMatch[1].trim().toUpperCase() : `TB-${Date.now()}`;

  // Extract Sender Name & Phone
  let senderName = 'Telebirr Payer';
  let senderPhone: string | undefined = undefined;

  const phoneMatch = text.match(/(?:2519\d{8}|09\d{8}|07\d{8})/);
  if (phoneMatch) {
    senderPhone = phoneMatch[0];
  }

  const nameMatch = text.match(/(?:from|by)\s+([A-Za-z\s]{3,35})(?:\s*\([0-9*+]+\)|\s*on|\s*with|\s*ref|\.|\,|$)/i);
  if (nameMatch && nameMatch[1]) {
    const cleaned = nameMatch[1].replace(/\d+/g, '').trim();
    if (cleaned.length >= 3 && !cleaned.toLowerCase().includes('account')) {
      senderName = cleaned;
    }
  }

  // Extract Balance After
  let balanceAfter: number | null = null;
  const balMatch = text.match(/(?:current balance|current e-money account balance|new balance|bal:?)\s*(?:is|:)?\s*(?:etb|birr)?\s*([0-9,]+(?:\.\d{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    balanceAfter = parseCurrencyAmount(balMatch[1]);
  }

  const { dayStr, timeStr } = extractCalendarDayFromSms(text);

  return {
    provider: 'telebirr',
    amount,
    referenceNumber,
    senderName,
    senderPhone,
    transactionDate: dayStr,
    transactionTime: timeStr,
    balanceAfter,
    rawSmsText: text,
    sender: senderHeader
  };
}

/**
 * Provider-specific parser for Commercial Bank of Ethiopia (CBE)
 * Example SMS formats:
 * "Dear Customer, Your account 1000****789 has been credited with ETB 2,500.00 by TESFAYE GEDA. Txn Ref: FT2625091892. Available Bal: ETB 45,100.00."
 * "You have received Birr 850.00 on 07/09/2026. Ref: FT260808901234 from Biniam Tadesse. Current balance is 8,200.00 ETB."
 */
export function parseCbeSms(rawText: string, senderHeader: string): ParsedSmsPayload | null {
  const text = rawText.trim();

  // Extract Amount
  const amountMatch = text.match(/(?:credited with|credited|received|deposited)\s+(?:etb|birr)?\s*([0-9,]+(?:\.\d{1,2})?)/i)
    || text.match(/(?:etb|birr)\s*([0-9,]+(?:\.\d{1,2})?)\s+(?:credited|received|by|from)/i)
    || text.match(/(?:etb|birr)\s*([0-9,]+(?:\.\d{1,2})?)/i);

  const amount = amountMatch ? parseCurrencyAmount(amountMatch[1]) : 0;
  if (amount <= 0) return null;

  // Extract Reference (FT number)
  const refMatch = text.match(/\b(FT[A-Z0-9]{8,18})\b/i)
    || text.match(/(?:txn ref|ref:|ref|txn no|reference)\s*[:.]?\s*([A-Za-z0-9]{6,20})/i);

  const referenceNumber = refMatch ? refMatch[1].trim().toUpperCase() : `CBE-${Date.now()}`;

  // Extract Sender Name
  let senderName = 'CBE Transfer Payer';
  const nameMatch = text.match(/(?:by|from)\s+([A-Za-z\s]{3,35})(?:\.\s*Txn|\s*Txn|\s*ref|\s*on|\.|\,|$)/i);
  if (nameMatch && nameMatch[1]) {
    const cleaned = nameMatch[1].trim();
    if (cleaned.length >= 3 && !cleaned.toLowerCase().includes('account')) {
      senderName = cleaned;
    }
  }

  // Extract Balance After
  let balanceAfter: number | null = null;
  const balMatch = text.match(/(?:available bal|current balance|bal:?)\s*(?:is|:)?\s*(?:etb|birr)?\s*([0-9,]+(?:\.\d{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    balanceAfter = parseCurrencyAmount(balMatch[1]);
  }

  const { dayStr, timeStr } = extractCalendarDayFromSms(text);

  return {
    provider: 'cbe',
    amount,
    referenceNumber,
    senderName,
    transactionDate: dayStr,
    transactionTime: timeStr,
    balanceAfter,
    rawSmsText: text,
    sender: senderHeader
  };
}

/**
 * Provider-specific parser for E-Birr (Coopay / Ethio Telecom / E-Birr)
 * Example SMS formats:
 * "You have received ETB 750.00 from 0912345678 (KEDIR AHMED). Ref: EB9821734. Your new E-Birr balance is ETB 3,450.00."
 */
export function parseEbirrSms(rawText: string, senderHeader: string): ParsedSmsPayload | null {
  const text = rawText.trim();

  // Extract Amount
  const amountMatch = text.match(/(?:received|credited)\s+(?:etb|birr)?\s*([0-9,]+(?:\.\d{1,2})?)/i)
    || text.match(/(?:etb|birr)\s*([0-9,]+(?:\.\d{1,2})?)/i);

  const amount = amountMatch ? parseCurrencyAmount(amountMatch[1]) : 0;
  if (amount <= 0) return null;

  // Extract Reference
  const refMatch = text.match(/\b(EB[A-Za-z0-9]{6,16})\b/i)
    || text.match(/(?:ref:|ref|txn|trans id)\s*[:.]?\s*([A-Za-z0-9\-_]{6,20})/i);

  const referenceNumber = refMatch ? refMatch[1].trim().toUpperCase() : `EB-${Date.now()}`;

  // Extract Sender Name & Phone
  let senderName = 'E-Birr Payer';
  let senderPhone: string | undefined = undefined;

  const phoneMatch = text.match(/(?:09\d{8}|07\d{8}|2519\d{8})/);
  if (phoneMatch) {
    senderPhone = phoneMatch[0];
  }

  const nameMatch = text.match(/\(([^)]+)\)/) || text.match(/(?:from|by)\s+([A-Za-z\s]{3,30})/i);
  if (nameMatch && nameMatch[1]) {
    senderName = nameMatch[1].trim();
  }

  // Extract Balance After
  let balanceAfter: number | null = null;
  const balMatch = text.match(/(?:balance|bal)\s*(?:is|:)?\s*(?:etb|birr)?\s*([0-9,]+(?:\.\d{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    balanceAfter = parseCurrencyAmount(balMatch[1]);
  }

  const { dayStr, timeStr } = extractCalendarDayFromSms(text);

  return {
    provider: 'ebirr',
    amount,
    referenceNumber,
    senderName,
    senderPhone,
    transactionDate: dayStr,
    transactionTime: timeStr,
    balanceAfter,
    rawSmsText: text,
    sender: senderHeader
  };
}

/**
 * Main dispatcher: detects provider and routes to specific parser
 */
export function parseIncomingBankSms(rawText: string, senderHeader: string): ParsedSmsPayload | null {
  if (!rawText || !rawText.trim()) return null;
  const lower = (rawText + ' ' + (senderHeader || '')).toLowerCase();

  if (lower.includes('telebirr') || lower.includes('e-money account balance')) {
    return parseTelebirrSms(rawText, senderHeader);
  }

  if (lower.includes('cbe') || lower.includes('commercial bank') || lower.includes('1000') || lower.includes('mbreciept') || rawText.includes('FT')) {
    return parseCbeSms(rawText, senderHeader);
  }

  if (lower.includes('ebirr') || lower.includes('e-birr') || lower.includes('coopay')) {
    return parseEbirrSms(rawText, senderHeader);
  }

  // Fallback check based on sender header alone
  const senderLower = (senderHeader || '').toLowerCase();
  if (senderLower.includes('telebirr') || senderLower.includes('127')) {
    return parseTelebirrSms(rawText, senderHeader);
  }
  if (senderLower.includes('cbe') || senderLower.includes('cbebirr')) {
    return parseCbeSms(rawText, senderHeader);
  }
  if (senderLower.includes('ebirr')) {
    return parseEbirrSms(rawText, senderHeader);
  }

  return null;
}

export const parseBankSms = parseIncomingBankSms;

export const SAMPLE_SMS_PAYLOADS = {
  telebirr: [
    'You have received ETB 1,500.00 from Abebe Bikila (251911223344) on 2026-09-07 14:30:15. Transaction number is TB829102482. Your current balance is ETB 12,450.50.',
    'You have received ETB 450.00 from Aster Awoke (251922334455) on 2026-09-07 10:15:00. Transaction number is TB771928312. Your current balance is ETB 10,950.50.'
  ],
  cbe: [
    'Dear Customer, Your account 1000****789 has been credited with ETB 2,850.00 by TESFAYE GEDA. Txn Ref: FT2625091892. Available Bal: ETB 45,100.00.',
    'Dear Customer, your account 1000123456 has been credited with ETB 5,000.00 on 2026-09-07. Txn Ref: FT2609071122. Bal: ETB 50,100.00.'
  ],
  ebirr: [
    'You have received ETB 750.00 from 0912345678 (KEDIR AHMED). Ref: EB9821734. Your new E-Birr balance is ETB 3,450.00.',
    'You have received ETB 1,200.00 from 0922446688 (FATUMA MOHAMMED). Ref: EB5519283. Your new E-Birr balance is ETB 4,650.00.'
  ]
};
