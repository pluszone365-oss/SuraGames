/**
 * Ethiopian Calendar Converter & 13th Month (Pagumē) Exemption Engine
 * Supports standard Ethiopian Calendar (E.C.) conversions, Ge'ez / Amharic month formatting,
 * Ethiopian Calendar date calculations (calculating next due dates first in EC then converting to Gregorian),
 * and automated 13th Month (Pagumē) Exemption Rules for Rent, Equb, Loans & Recurring Fees.
 */

export interface EthiopianDate {
  year: number;
  month: number; // 1 to 13
  day: number; // 1 to 30 for months 1-12, 1-5 (or 6 in leap year) for month 13
  monthNameEn: string;
  monthNameAm: string;
  isPagume: boolean; // True if Month 13 (Pagumē / ጳጉሜ)
}

export const ETHIOPIAN_MONTHS = [
  { id: 1, en: 'Meskerem', am: 'መስከረም' },
  { id: 2, en: 'Tikimt', am: 'ጥቅምት' },
  { id: 3, en: 'Hidar', am: 'ህዳር' },
  { id: 4, en: 'Tahsas', am: 'ታህሳስ' },
  { id: 5, en: 'Tir', am: 'ጥር' },
  { id: 6, en: 'Yekatit', am: 'የካቲት' },
  { id: 7, en: 'Megabit', am: 'መጋቢት' },
  { id: 8, en: 'Miazia', am: 'ሚያዝያ' },
  { id: 9, en: 'Ginbot', am: 'ግንቦት' },
  { id: 10, en: 'Sene', am: 'ሰኔ' },
  { id: 11, en: 'Hamle', am: 'ሐምሌ' },
  { id: 12, en: 'Nehase', am: 'ነሐሴ' },
  { id: 13, en: 'Pagumē', am: 'ጳጉሜ' }
];

/**
 * Converts a Gregorian Date object to an Ethiopian Date
 */
export function toEthiopianDate(gregorianDate: Date): EthiopianDate {
  const date = new Date(gregorianDate);
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1; // 1-12
  const gd = date.getDate();

  // Reference offset algorithm for Ethiopian Calendar conversion
  let ey = gy - 8;
  if (gm < 9 || (gm === 9 && gd < 11)) {
    ey = gy - 8;
  } else {
    ey = gy - 7;
  }

  // Calculate day of Ethiopian year
  const newYearDay = ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) ? 12 : 11;
  
  let em = 1;
  let ed = 1;

  // Day-in-year mapping
  const startOfEthYear = new Date(gy, 8, newYearDay); // Sep 11 or 12
  let diffDays = Math.floor((date.getTime() - startOfEthYear.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Falls in previous Ethiopian year
    const prevNewYearDay = (((gy - 1) % 4 === 0 && (gy - 1) % 100 !== 0) || (gy - 1) % 400 === 0) ? 12 : 11;
    const prevStart = new Date(gy - 1, 8, prevNewYearDay);
    diffDays = Math.floor((date.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  em = Math.floor(diffDays / 30) + 1;
  ed = (diffDays % 30) + 1;

  if (em > 13) {
    em = 13;
  }

  // Month metadata
  const mMeta = ETHIOPIAN_MONTHS[em - 1] || ETHIOPIAN_MONTHS[0];

  return {
    year: ey,
    month: em,
    day: ed,
    monthNameEn: mMeta.en,
    monthNameAm: mMeta.am,
    isPagume: em === 13
  };
}

/**
 * Converts an Ethiopian Date (year, month 1-13, day 1-30) to a Gregorian Date
 */
export function toGregorianDate(ey: number, em: number, ed: number): Date {
  const gy = ey + 7;
  // Meskerem 1 is Sep 12 if ey is leap year + 1 (i.e. ey % 4 === 0), otherwise Sep 11
  const newYearDay = (ey % 4 === 0) ? 12 : 11;
  const startOfEthYear = new Date(gy, 8, newYearDay); // September (0-indexed month 8)

  const daysFromNewYear = (em - 1) * 30 + (ed - 1);
  return new Date(startOfEthYear.getTime() + daysFromNewYear * 86400000);
}

/**
 * Calculates the next due date for financial obligations (Equb, Loan, Rent, Electricity, Subscriptions)
 * FIRST in the Ethiopian Calendar system (advancing EC month/day), then converting the resulting EC date
 * back to a Gregorian Date.
 */
export function calculateNextEthiopianDueDate(
  startDate: Date | string,
  frequency: string
): Date {
  const d = typeof startDate === 'string' ? new Date(startDate) : startDate;
  if (isNaN(d.getTime())) return new Date();

  const eth = toEthiopianDate(d);

  let targetYear = eth.year;
  let targetMonth = eth.month;
  let targetDay = eth.day;

  const freq = (frequency || '').toUpperCase();

  if (freq === 'ONE_TIME') {
    return d;
  }

  if (freq === 'DAILY') {
    targetDay += 1;
  } else if (freq === 'WEEKLY') {
    targetDay += 7;
  } else if (freq === 'BIWEEKLY') {
    targetDay += 14;
  } else if (freq === 'EVERY_3_WEEKS') {
    targetDay += 21;
  } else if (freq === 'EVERY_4_WEEKS') {
    targetDay += 28;
  } else if (freq === 'EVERY_10_DAYS') {
    targetDay += 10;
  } else if (freq === 'MONTHLY') {
    targetMonth += 1;
  } else if (freq === 'EVERY_2_MONTHS') {
    targetMonth += 2;
  } else if (freq === 'QUARTERLY' || freq === 'EVERY_3_MONTHS') {
    targetMonth += 3;
  } else if (freq === 'YEARLY') {
    targetYear += 1;
  } else {
    targetMonth += 1;
  }

  // Normalize Ethiopian months
  while (targetMonth > 13) {
    targetMonth -= 13;
    targetYear += 1;
  }

  // Handle day overflow for current target month
  const maxDaysInMonth = targetMonth === 13 ? ((targetYear + 1) % 4 === 0 ? 6 : 5) : 30;

  if (targetDay > maxDaysInMonth && (freq === 'DAILY' || freq === 'WEEKLY' || freq === 'BIWEEKLY' || freq === 'EVERY_3_WEEKS' || freq === 'EVERY_4_WEEKS' || freq === 'EVERY_10_DAYS')) {
    targetDay -= maxDaysInMonth;
    targetMonth += 1;
    if (targetMonth > 13) {
      targetMonth -= 13;
      targetYear += 1;
    }
  }

  // Cap day if targetMonth has fewer days (e.g. Pagumē)
  const finalMaxDays = targetMonth === 13 ? ((targetYear + 1) % 4 === 0 ? 6 : 5) : 30;
  targetDay = Math.min(targetDay, finalMaxDays);

  return toGregorianDate(targetYear, targetMonth, targetDay);
}

/**
 * Advance an Ethiopian date by N Ethiopian months, then return the Gregorian Date
 */
export function addEthiopianMonths(startDate: Date | string, monthsToAdd: number): Date {
  const d = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const eth = toEthiopianDate(d);

  let targetYear = eth.year;
  let targetMonth = eth.month + monthsToAdd;

  while (targetMonth > 13) {
    targetMonth -= 13;
    targetYear += 1;
  }

  const maxDays = targetMonth === 13 ? ((targetYear + 1) % 4 === 0 ? 6 : 5) : 30;
  const targetDay = Math.min(eth.day, maxDays);

  return toGregorianDate(targetYear, targetMonth, targetDay);
}

/**
 * Format Ethiopian Date as readable string
 * Example: "መስከረም 15, 2018 ዓ.ም. (Meskerem 15, 2018 E.C.)"
 */
export function formatEthiopianDate(gregorianDate: Date | string, includeAmharic = true): string {
  const d = typeof gregorianDate === 'string' ? new Date(gregorianDate) : gregorianDate;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const eth = toEthiopianDate(d);
  if (includeAmharic) {
    return `${eth.monthNameAm} ${eth.day}, ${eth.year} ዓ.ም. (${eth.monthNameEn} ${eth.day}, ${eth.year} E.C.)`;
  }
  return `${eth.monthNameEn} ${eth.day}, ${eth.year} E.C.`;
}

/**
 * Format Date depending on active Calendar Type ('ETHIOPIAN' vs 'GREGORIAN')
 * Note: Under the hood, all date math & calculations (e.g. Equb cycles, 13th month exemption, due dates)
 * are calculated using the Ethiopian Calendar system.
 * When calendarType is 'GREGORIAN', it converts and formats the date into Gregorian (G.C.) format.
 */
export function formatDateByCalendar(
  gregorianDate: Date | string,
  calendarType: 'ETHIOPIAN' | 'GREGORIAN' | string = 'GREGORIAN',
  includeAmharic = true
): string {
  const d = typeof gregorianDate === 'string' ? new Date(gregorianDate) : gregorianDate;
  if (isNaN(d.getTime())) return 'Invalid Date';

  if (calendarType === 'GREGORIAN') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day}, ${year} G.C.`;
  }

  return formatEthiopianDate(d, includeAmharic);
}

/**
 * 13th Month (Pagumē / ጳጉሜ) Exemption Guard Policy Evaluator
 * 
 * Rules requested:
 * 1. Income is earned continuously.
 * 2. All expenses, equb, rent, loans, recurring templates follow Ethiopian Calendar.
 * 3. 13th Month (Pagumē) Exemption:
 *    - Rent, Equb, Loans, and General Bills are FREE / EXEMPT in Pagumē (13th Month).
 *    - ONLY Electricity (and Income) is payable / active during Pagumē.
 */
export interface PagumeExemptionStatus {
  isPagume: boolean;
  isExempt: boolean; // True if payment is waived / free in 13th month
  categoryName: string;
  reason: string;
}

export function evaluatePagumeExemption(
  categoryOrType: string,
  gregorianDate: Date | string = new Date()
): PagumeExemptionStatus {
  const d = typeof gregorianDate === 'string' ? new Date(gregorianDate) : gregorianDate;
  const eth = toEthiopianDate(d);

  const lowerCat = (categoryOrType || '').toLowerCase();

  // If not Pagumē (month 13), standard rules apply
  if (!eth.isPagume) {
    return {
      isPagume: false,
      isExempt: false,
      categoryName: categoryOrType,
      reason: 'Standard Ethiopian Month (Regular Billing Active)'
    };
  }

  // If month IS Pagumē (13th month):
  // Check if category is Electricity or Power or Income
  const isElectricity = lowerCat.includes('electric') || lowerCat.includes('power') || lowerCat.includes('መብራት') || lowerCat.includes('utility');
  const isIncome = lowerCat.includes('income') || lowerCat.includes('sales') || lowerCat.includes('revenue') || lowerCat.includes('receivable');

  if (isElectricity || isIncome) {
    return {
      isPagume: true,
      isExempt: false,
      categoryName: categoryOrType,
      reason: isElectricity
        ? '⚡ Electricity remains payable in Pagumē (13th Month).'
        : '💰 Income generation remains active in Pagumē (13th Month).'
    };
  }

  // All other expenses (Rent, Equb, Loans, Subscriptions, Office expenses) are EXEMPT / FREE in Pagumē
  return {
    isPagume: true,
    isExempt: true,
    categoryName: categoryOrType,
    reason: `🎁 Pagumē (13th Month) Exemption Applied! ${categoryOrType} is FREE for Pagumē (13th Month). No payment due.`
  };
}
