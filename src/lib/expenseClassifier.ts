import { Transaction } from '../types';

/**
 * Checks if an expense should be classified as PERSONAL rather than BUSINESS.
 * Core rule: if the expense says gg, hermi, zeru, house expense / home expense,
 * or food and refreshments, it is personal.
 */
export function isPersonalExpense(description?: string, category?: string): boolean {
  const desc = (description || '').toLowerCase();
  const cat = (category || '').toLowerCase();

  // 1. "gg" as an independent word/token (e.g. "gg lunch", "gg transport", "gg and hermi lunch", "Gg & Hermi")
  const ggRegex = /(^|[\s_.,&/()\-+])gg([\s_.,&/()\-+]|$)/i;
  if (ggRegex.test(desc) || ggRegex.test(cat)) {
    return true;
  }

  // 2. "hermi" (e.g. "Hermi Dinner", "hermi Transport", "hermi lunch", "Hermi Din")
  if (desc.includes('hermi') || cat.includes('hermi')) {
    return true;
  }

  // 3. "zeru" (e.g. "zerubabel Transport", "zeru misa & erat", "zeru misa", "zeru transport", "zeru and hermi breakfast")
  if (desc.includes('zeru') || cat.includes('zeru')) {
    return true;
  }

  // 4. "house expense" or "home expense" (in description, or dedicated category)
  if (
    desc.includes('house expense') ||
    desc.includes('home expense') ||
    desc.includes('home epense') ||
    desc.includes('house exp') ||
    desc.includes('home exp') ||
    /\b(house|home)\s+(expense|epense|cost)\b/i.test(desc) ||
    cat === 'home expense' ||
    cat === 'house expense'
  ) {
    return true;
  }

  // 5. "food and refreshments" (category or description mentioning food, refreshments, meals, lunch, dinner, breakfast, misa, erat, kurs)
  if (
    cat.includes('food') ||
    cat.includes('refreshment') ||
    cat === 'owner withdrawal' ||
    desc.includes('food and refreshments') ||
    desc.includes('food & refreshments') ||
    desc.includes('food') ||
    desc.includes('refreshment') ||
    desc.includes('refreshments') ||
    desc.includes('lunch') ||
    desc.includes('dinner') ||
    desc.includes('breakfast') ||
    desc.includes('misa') ||
    desc.includes('erat') ||
    desc.includes('kurs') ||
    desc.includes('tertibega')
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves whether an expense transaction is 'BUSINESS' or 'PERSONAL'.
 * Income transactions return undefined.
 */
export function resolveExpenseScope(
  type: string,
  description?: string,
  category?: string,
  explicitScope?: 'BUSINESS' | 'PERSONAL'
): 'BUSINESS' | 'PERSONAL' | undefined {
  if (type !== 'EXPENSE') return undefined;

  // If matches personal keywords, rule dictates it is PERSONAL
  if (isPersonalExpense(description, category)) {
    return 'PERSONAL';
  }

  // Otherwise, respect explicit assignment or default to BUSINESS
  if (explicitScope) {
    return explicitScope;
  }

  return 'BUSINESS';
}

/**
 * Normalizes all transactions in a list, ensuring any expense matching
 * gg, hermi, zeru, house/home expense, or food and refreshments is classified as PERSONAL.
 */
export function normalizeTransactionScopes(transactions: Transaction[]): Transaction[] {
  return transactions.map(tx => {
    if (tx.type !== 'EXPENSE') return tx;

    const correctScope = resolveExpenseScope(tx.type, tx.description, tx.category, tx.expenseScope);
    if (tx.expenseScope !== correctScope) {
      return {
        ...tx,
        expenseScope: correctScope
      };
    }
    return tx;
  });
}
