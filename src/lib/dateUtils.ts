/**
 * Date Duration & Span Utility
 * Accurately calculates chronological spans across transaction datasets
 * in natural, human-readable language (e.g., "1 month and 3 weeks", "2 weeks and 3 days").
 */

import { toEthiopianDate, EthiopianDate } from './ethiopianCalendar';

export interface DataDurationSpan {
  durationText: string;
  totalDays: number;
  startDate: Date;
  endDate: Date;
  startDateFormatted: string;
  endDateFormatted: string;
  rangeLabel: string;
  ethiopianRangeLabel?: string;
  breakdown: {
    years: number;
    months: number;
    weeks: number;
    days: number;
  };
}

/**
 * Calculates human-readable duration between two dates (inclusive of endpoints)
 * e.g., "1 month and 3 weeks", "2 weeks and 4 days", "1 day".
 */
export function formatDataDurationSpan(
  startDateInput: Date | string | number,
  endDateInput: Date | string | number
): DataDurationSpan {
  const d1Raw = new Date(startDateInput);
  const d2Raw = new Date(endDateInput);

  const d1 = new Date(d1Raw.getFullYear(), d1Raw.getMonth(), d1Raw.getDate());
  const d2 = new Date(d2Raw.getFullYear(), d2Raw.getMonth(), d2Raw.getDate());

  const start = d1.getTime() <= d2.getTime() ? d1 : d2;
  const end = d1.getTime() <= d2.getTime() ? d2 : d1;

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const totalDays = diffDays + 1; // Inclusive calendar days

  const startFmt = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const endFmt = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Ethiopian Calendar formatting
  let ethiopianRangeLabel: string | undefined;
  try {
    const ethStart: EthiopianDate = toEthiopianDate(start);
    const ethEnd: EthiopianDate = toEthiopianDate(end);
    if (ethStart.year === ethEnd.year && ethStart.month === ethEnd.month && ethStart.day === ethEnd.day) {
      ethiopianRangeLabel = `${ethStart.monthNameEn} ${ethStart.day}, ${ethStart.year} E.C.`;
    } else {
      ethiopianRangeLabel = `${ethStart.monthNameEn} ${ethStart.day}, ${ethStart.year} – ${ethEnd.monthNameEn} ${ethEnd.day}, ${ethEnd.year} E.C.`;
    }
  } catch (err) {
    // Non-fatal if conversion fails
    console.warn('Ethiopian date conversion error:', err);
  }

  // Single Day
  if (diffDays === 0) {
    return {
      durationText: '1 day',
      totalDays: 1,
      startDate: start,
      endDate: end,
      startDateFormatted: startFmt,
      endDateFormatted: endFmt,
      rangeLabel: startFmt,
      ethiopianRangeLabel,
      breakdown: { years: 0, months: 0, weeks: 0, days: 1 }
    };
  }

  const isStartFirstOfMonth = start.getDate() === 1;
  const daysInEndMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const isEndLastOfMonth = end.getDate() === daysInEndMonth;

  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let years = 0;
  let months = 0;

  // Step full years
  while (true) {
    const nextYear = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate());
    if (nextYear.getTime() <= end.getTime()) {
      years++;
      cur = nextYear;
    } else {
      break;
    }
  }

  // Step full calendar months
  while (true) {
    const targetMonth = cur.getMonth() + 1;
    const targetYear = cur.getFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const maxDaysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    const dayToUse = Math.min(start.getDate(), maxDaysInMonth);
    const nextMonth = new Date(targetYear, normalizedMonth, dayToUse);

    if (nextMonth.getTime() <= end.getTime()) {
      months++;
      cur = nextMonth;
    } else {
      break;
    }
  }

  // If start is 1st of month and end is last of month, full month boundary reached
  if (isStartFirstOfMonth && isEndLastOfMonth && cur.getMonth() === end.getMonth()) {
    months++;
    cur = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  }

  // For periods under 1 month, calculate weeks and days directly from total inclusive days
  if (years === 0 && months === 0) {
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    const parts: string[] = [];
    if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

    let durationText = `${totalDays} days`;
    if (parts.length === 1) durationText = parts[0];
    else if (parts.length === 2) durationText = `${parts[0]} and ${parts[1]}`;

    return {
      durationText,
      totalDays,
      startDate: start,
      endDate: end,
      startDateFormatted: startFmt,
      endDateFormatted: endFmt,
      rangeLabel: `${startFmt} – ${endFmt}`,
      ethiopianRangeLabel,
      breakdown: { years: 0, months: 0, weeks, days }
    };
  }

  const remainingDays = Math.max(0, Math.round((end.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24)));
  const weeks = Math.floor(remainingDays / 7);
  const days = remainingDays % 7;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

  let durationText = '';
  if (parts.length === 0) {
    durationText = `${totalDays} days`;
  } else if (parts.length === 1) {
    durationText = parts[0];
  } else if (parts.length === 2) {
    durationText = `${parts[0]} and ${parts[1]}`;
  } else {
    durationText = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }

  return {
    durationText,
    totalDays,
    startDate: start,
    endDate: end,
    startDateFormatted: startFmt,
    endDateFormatted: endFmt,
    rangeLabel: `${startFmt} – ${endFmt}`,
    ethiopianRangeLabel,
    breakdown: { years, months, weeks, days }
  };
}

/**
 * Extracts chronological data duration from a list of transactions
 */
export function getTransactionsDateSpan(transactions: { date: string }[]): DataDurationSpan | null {
  if (!transactions || transactions.length === 0) return null;

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  transactions.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return;

    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  });

  if (!minDate || !maxDate) return null;
  return formatDataDurationSpan(minDate, maxDate);
}
