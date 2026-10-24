import { NavTab } from '../../types';

export interface TourStep {
  id: string;
  targetSelector: string;
  tab: NavTab;
  subView?: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'auto';
  badge?: string;
}

/**
 * 8-Step PlusZone Business Spotlight Tour
 * Plain, non-technical copy tailored for Ethiopian business partners
 */
export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard-hero-balance',
    targetSelector: '[data-tour="dashboard-hero-balance"]',
    tab: 'dashboard',
    title: 'Total Business Ledger & Net Profit',
    description: 'Consolidated balance across all business vaults and accounts. Includes real-time Net Profit (MTD), privacy toggle to hide numbers from customers, and quick access to wallet management.',
    placement: 'bottom',
    badge: '1/14 • Balance'
  },
  {
    id: 'dashboard-kpi-weekly-avg',
    targetSelector: '[data-tour="dashboard-kpi-weekly-avg"]',
    tab: 'dashboard',
    title: 'Weekly Daily Average Income',
    description: 'Calculates your rolling 7-day revenue velocity and daily run-rate. Track whether your average daily cash collections are accelerating or slowing down.',
    placement: 'bottom',
    badge: '2/14 • Velocity'
  },
  {
    id: 'dashboard-kpi-income',
    targetSelector: '[data-tour="dashboard-kpi-income"]',
    tab: 'dashboard',
    title: 'Total Revenue & Inflow',
    description: 'Real-time sum of all business sales and customer collections for the current month, alongside your baseline daily sales average.',
    placement: 'bottom',
    badge: '3/14 • Inflow'
  },
  {
    id: 'dashboard-kpi-expense',
    targetSelector: '[data-tour="dashboard-kpi-expense"]',
    tab: 'dashboard',
    title: 'Operating Expenses & Costs',
    description: 'Total business expenditures, supplier purchases, and operating costs with real-time entry count to keep overheads controlled.',
    placement: 'bottom',
    badge: '4/14 • Outflow'
  },
  {
    id: 'dashboard-kpi-receivables',
    targetSelector: '[data-tour="dashboard-kpi-receivables"]',
    tab: 'dashboard',
    title: 'Customer Credit & Bale\'da Tabs',
    description: 'Real-time sum of open credit given to customers. Tap to review pending customer tabs and record partial or full repayments.',
    placement: 'bottom',
    badge: '5/14 • Bale\'da'
  },
  {
    id: 'dashboard-wallets',
    targetSelector: '[data-tour="dashboard-wallets"]',
    tab: 'dashboard',
    title: 'Cash Available & Multi-Wallet Vaults',
    description: 'Live balance breakdown across Telebirr, CBE Bank, eBirr, Cash on hand, and Reserve vaults with percentage allocation bars.',
    placement: 'bottom',
    badge: '6/14 • Vaults'
  },
  {
    id: 'dashboard-launchpad',
    targetSelector: '[data-tour="dashboard-launchpad"]',
    tab: 'dashboard',
    title: 'One-Tap Quick Launchpad',
    description: 'Speed shortcuts for instant actions: Record Sales, Inter-Wallet Transfers, Equb Rounds, Debt Collection, Partner Shares, and P&L Reports.',
    placement: 'top',
    badge: '7/14 • Shortcuts'
  },
  {
    id: 'dashboard-recent-transactions',
    targetSelector: '[data-tour="dashboard-recent-transactions"]',
    tab: 'dashboard',
    title: 'Recent Ledger Postings Feed',
    description: 'Real-time audit trail of income and expenses, highlighting split-wallet payments, credit collection badges, and creator author stamps.',
    placement: 'bottom',
    badge: '8/14 • Audit Feed'
  },
  {
    id: 'dashboard-financial-reports',
    targetSelector: '[data-tour="dashboard-financial-reports"]',
    tab: 'dashboard',
    title: 'Income & Expense Summary Reports',
    description: 'Executive cash flow overview and timeframe filters for Daily, Monthly, and Yearly performance, profit margins, and itemized transaction logs.',
    placement: 'top',
    badge: '9/14 • Analytics'
  },
  {
    id: 'dashboard-equbs',
    targetSelector: '[data-tour="dashboard-equbs"]',
    tab: 'dashboard',
    title: 'Active Equb Rotating Savings',
    description: 'Monitors traditional Ethiopian Equb circles, round progress bars, pot payout sizes, member count, and contribution schedules.',
    placement: 'top',
    badge: '10/14 • Equb'
  },
  {
    id: 'dashboard-alerts',
    targetSelector: '[data-tour="dashboard-alerts"]',
    tab: 'dashboard',
    title: 'Operational Alerts & Notices',
    description: 'Priority business notifications for critical actions, low wallet balances, pending approvals, and operational announcements.',
    placement: 'bottom',
    badge: '11/14 • Alerts'
  },
  {
    id: 'dashboard-agenda',
    targetSelector: '[data-tour="dashboard-agenda"]',
    tab: 'dashboard',
    title: 'Upcoming Agenda & Calendar Dues',
    description: 'Tracks upcoming bills, recurring expenses, and loan installments with native Ethiopian calendar support and Pagumē Month 13 payment exemptions.',
    placement: 'top',
    badge: '12/14 • Agenda'
  },
  {
    id: 'dashboard-loans',
    targetSelector: '[data-tour="dashboard-loans"]',
    tab: 'dashboard',
    title: 'Active Loans & Financing Facilities',
    description: 'Monitors total outstanding borrowed principal, active facilities, and loan repayment obligations.',
    placement: 'top',
    badge: '13/14 • Loans'
  },
  {
    id: 'dashboard-forecast',
    targetSelector: '[data-tour="dashboard-forecast"]',
    tab: 'dashboard',
    title: 'Predictive Future Cashflow Engine',
    description: 'AI-grounded forecast using your rolling weekly revenue velocity to project 7-to-30 day cash runway and liquidity buffers.',
    placement: 'top',
    badge: '14/14 • Forecast'
  },
  {
    id: 'quick-entry',
    targetSelector: '[data-tour="quick-entry"]',
    tab: 'dashboard',
    title: '1-Tap Fast Transaction Entry (Anytime)',
    description: 'Tap this quick-add button anytime in the bottom navigation bar or dashboard to record sales, supplier expenses, or multi-wallet splits in seconds.',
    placement: 'top',
    badge: 'Quick Add'
  }
];

export const ONBOARDING_STORAGE_KEY = 'has_seen_onboarding';

export const DASHBOARD_TOUR_STEPS = ONBOARDING_TOUR_STEPS;

export const TRANSACTIONS_TOUR_STEPS: TourStep[] = [
  {
    id: 'transactions-header',
    targetSelector: '[data-tour="transactions-header"]',
    tab: 'transactions',
    title: 'Financial Ledger & Document Export',
    description: 'Real-time record of all business sales, supplier expenses, and customer credit collections. Export one-click PDF statements or Excel workbooks anytime.',
    placement: 'bottom',
    badge: '1/5 • Overview'
  },
  {
    id: 'transactions-search',
    targetSelector: '[data-tour="transactions-search"]',
    tab: 'transactions',
    title: 'Instant Ledger Search',
    description: 'Quickly find any receipt or posting by customer name, category, transaction note, or amount.',
    placement: 'bottom',
    badge: '2/5 • Search'
  },
  {
    id: 'transactions-filters',
    targetSelector: '[data-tour="transactions-filters"]',
    tab: 'transactions',
    title: 'Multi-Criteria Filter Bar',
    description: 'Filter by Income, Expense, Credit Sales, specific Wallet (e.g. Telebirr, CBE Bank), Category, Business vs Personal, or toggle Non-Working Days.',
    placement: 'bottom',
    badge: '3/5 • Filters'
  },
  {
    id: 'transactions-list',
    targetSelector: '[data-tour="transactions-list"]',
    tab: 'transactions',
    title: 'Chronological Entries & Audit Stamps',
    description: 'Every entry records the date, creator user stamp, branch, split payment breakdown, and Telebirr/Bank SMS verification badges. Click any row for details or reversals.',
    placement: 'bottom',
    badge: '4/5 • Entries'
  },
  {
    id: 'quick-entry-tx',
    targetSelector: '[data-tour="quick-entry"]',
    tab: 'transactions',
    title: '1-Tap Fast Entry',
    description: 'Tap this quick-add button anytime to post a new sale, expense, or split-wallet transaction directly into your accounts.',
    placement: 'top',
    badge: '5/5 • Quick Add'
  }
];

export const WALLETS_TOUR_STEPS: TourStep[] = [
  {
    id: 'wallets-actions',
    targetSelector: '[data-tour="wallets-actions"]',
    tab: 'wallets',
    title: 'Transfer & Account Actions',
    description: 'Initiate inter-wallet transfers between banks, Telebirr, and cash vaults with zero discrepancy. SuperAdmins can also register new accounts.',
    placement: 'bottom',
    badge: '1/4 • Actions'
  },
  {
    id: 'wallets-overview',
    targetSelector: '[data-tour="wallets-overview"]',
    tab: 'wallets',
    title: 'Reconciled Cash Available',
    description: 'Your total liquid working capital aggregated across Telebirr, Commercial Bank of Ethiopia (CBE), eBirr, Cash on Hand, and Savings.',
    placement: 'bottom',
    badge: '2/4 • Cash Available'
  },
  {
    id: 'wallets-grid',
    targetSelector: '[data-tour="wallets-grid"]',
    tab: 'wallets',
    title: 'Vault Accounts & Limits',
    description: 'View individual balances, daily spending ceilings, and freeze/lock status. Click any account card to load its dedicated statement.',
    placement: 'bottom',
    badge: '3/4 • Accounts'
  },
  {
    id: 'wallets-ledger',
    targetSelector: '[data-tour="wallets-ledger"]',
    tab: 'wallets',
    title: 'Account-Specific Statements',
    description: 'Review the chronological ledger and running balance history specifically for the selected wallet.',
    placement: 'top',
    badge: '4/4 • Statements'
  }
];

export const EQUB_TOUR_STEPS: TourStep[] = [
  {
    id: 'equb-section',
    targetSelector: '[data-tour="equb-section"]',
    tab: 'equb',
    title: 'Equb Navigation Tabs',
    description: 'Switch between active community Equb Circles, Fair Lottery Spin Draw, Winner Payout Ledger, and Member Contribution Rosters.',
    placement: 'bottom',
    badge: '1/4 • Navigation'
  },
  {
    id: 'equb-create',
    targetSelector: '[data-tour="equb-create"]',
    tab: 'equb',
    title: 'Start New Equb Circle',
    description: 'Configure custom rotating savings pools with flexible daily, weekly, or monthly cycles, fixed share amounts, and member lists.',
    placement: 'bottom',
    badge: '2/4 • Create Circle'
  },
  {
    id: 'equb-cards',
    targetSelector: '[data-tour="equb-cards"]',
    tab: 'equb',
    title: 'Active Equbs & Round Status',
    description: 'Track total pool size, current round number, total collected funds, and member payment indicators.',
    placement: 'bottom',
    badge: '3/4 • Pool Status'
  },
  {
    id: 'equb-draw',
    targetSelector: '[data-tour="equb-draw"]',
    tab: 'equb',
    title: 'Fair Lottery Spin Machine',
    description: 'Conduct transparent, tamper-proof winner selection with animated wheel celebration and instant wallet payout logging.',
    placement: 'top',
    badge: '4/4 • Fair Draw'
  }
];

export const CHAT_TOUR_STEPS: TourStep[] = [
  {
    id: 'chat-header',
    targetSelector: '[data-tour="chat-header"]',
    tab: 'chat',
    title: 'Real-Time Branch Communication',
    description: 'Instant, secure internal messaging between managers, cashiers, accountants, and partners.',
    placement: 'bottom',
    badge: '1/4 • Team Chat'
  },
  {
    id: 'chat-channels',
    targetSelector: '[data-tour="chat-channels"]',
    tab: 'chat',
    title: 'Chat Channels & Search',
    description: 'Switch between general team discussions, branch-specific alerts, or search previous financial discussions.',
    placement: 'bottom',
    badge: '2/4 • Channels'
  },
  {
    id: 'chat-messages',
    targetSelector: '[data-tour="chat-messages"]',
    tab: 'chat',
    title: 'Message Feed & Financial References',
    description: 'Send and receive messages with receipts, transaction tags, audio notes, and emoji reactions.',
    placement: 'bottom',
    badge: '3/4 • Messages'
  },
  {
    id: 'chat-composer',
    targetSelector: '[data-tour="chat-composer"]',
    tab: 'chat',
    title: 'Message Composer & Attachments',
    description: 'Type updates, attach receipt images, link transaction IDs, or broadcast important store announcements.',
    placement: 'top',
    badge: '4/4 • Composer'
  }
];

export const REPORTS_TOUR_STEPS: TourStep[] = [
  {
    id: 'reports-export',
    targetSelector: '[data-tour="reports-export"]',
    tab: 'more',
    subView: 'REPORTS',
    title: 'Executive Statements & Email Hub',
    description: 'Generate official PDF statements, download multi-tab Excel workbooks (.xlsx), or configure automated 2nd-of-month email dispatch to partners.',
    placement: 'bottom',
    badge: '1/4 • Export Hub'
  },
  {
    id: 'financial-reports',
    targetSelector: '[data-tour="financial-reports"]',
    tab: 'more',
    subView: 'REPORTS',
    title: 'Timeframe & Scope Filters',
    description: 'Filter financial analytics by Daily, Weekly, Monthly, Quarterly, or custom fiscal calendar ranges.',
    placement: 'bottom',
    badge: '2/4 • Filters'
  },
  {
    id: 'reports-pnl',
    targetSelector: '[data-tour="reports-pnl"]',
    tab: 'more',
    subView: 'REPORTS',
    title: 'Income & Expense Statement',
    description: 'Examine Gross Revenue, Operating Costs, and calculated Net Profit Margins with complete transparency.',
    placement: 'bottom',
    badge: '3/4 • P&L Statement'
  },
  {
    id: 'partner-distributions',
    targetSelector: '[data-tour="partner-distributions"]',
    tab: 'more',
    subView: 'REPORTS',
    title: 'Partner Profit Distributions',
    description: 'Automatically calculate distributable net profits and partner dividend allocations based on pre-agreed ownership equity percentages.',
    placement: 'top',
    badge: '4/4 • Dividends'
  }
];

export const RECEIVABLES_TOUR_STEPS: TourStep[] = [
  {
    id: 'loans-receivables',
    targetSelector: '[data-tour="loans-receivables"]',
    tab: 'more',
    subView: 'RECEIVABLES',
    title: 'Customer Credit & Late Payment KPIs',
    description: 'Monitor total outstanding money owed by customers, aging brackets, and amounts past the 15-day settlement window.',
    placement: 'bottom',
    badge: '1/3 • Overview'
  },
  {
    id: 'receivables-add',
    targetSelector: '[data-tour="receivables-add"]',
    tab: 'more',
    subView: 'RECEIVABLES',
    title: 'Record New Customer Credit',
    description: 'Issue a new customer tab with debtor name, phone number, purchased items, and due date.',
    placement: 'bottom',
    badge: '2/3 • Record Tab'
  },
  {
    id: 'receivables-list',
    targetSelector: '[data-tour="receivables-list"]',
    tab: 'more',
    subView: 'RECEIVABLES',
    title: 'Customer Tabs & 1-Tap Collection',
    description: 'View active credit tabs. Tap "Collect" to immediately record full or partial customer repayments into your chosen wallet.',
    placement: 'top',
    badge: '3/3 • Collect Credit'
  }
];

export const MORE_HUB_TOUR_STEPS: TourStep[] = [
  {
    id: 'more-hub-profile',
    targetSelector: '[data-tour="more-hub-profile"]',
    tab: 'more',
    subView: 'HUB',
    title: 'User Profile & Security',
    description: 'Manage your personal user account, profile photo, and security credentials.',
    placement: 'bottom',
    badge: '1/3 • Profile'
  },
  {
    id: 'more-hub-grid',
    targetSelector: '[data-tour="more-hub-grid"]',
    tab: 'more',
    subView: 'HUB',
    title: 'Business Management Tools',
    description: 'Direct access to Financial Reports, Customer Receivables, Asset Registers, Recurring Dues, and Ethiopian Calendar.',
    placement: 'bottom',
    badge: '2/3 • Tools'
  },
  {
    id: 'more-hub-security',
    targetSelector: '[data-tour="more-hub-security"]',
    tab: 'more',
    subView: 'HUB',
    title: 'Security, Fraud Prevention & Settings',
    description: 'Access payment fraud detection, audit trails, user permission roles, cloud backups, and app settings.',
    placement: 'top',
    badge: '3/3 • Security'
  }
];

export const CALENDAR_TOUR_STEPS: TourStep[] = [
  {
    id: 'calendar-kpis',
    targetSelector: '[data-tour="calendar-kpis"]',
    tab: 'more',
    subView: 'CALENDAR',
    title: 'Monthly Cash Outflow & Expense Run-Rate',
    description: 'Summarizes projected fixed expenses, recurring bills, and active debt amortizations scheduled for the selected month.',
    placement: 'bottom',
    badge: '1/4 • Outflow KPIs'
  },
  {
    id: 'calendar-header',
    targetSelector: '[data-tour="calendar-header"]',
    tab: 'more',
    subView: 'CALENDAR',
    title: 'Financial Calendar & ICS / Google Sync',
    description: 'Export all business obligations directly to Google Calendar or Apple Calendar using universal .ICS calendar files.',
    placement: 'bottom',
    badge: '2/4 • Calendar Sync'
  },
  {
    id: 'calendar-modes',
    targetSelector: '[data-tour="calendar-modes"]',
    tab: 'more',
    subView: 'CALENDAR',
    title: 'Month Grid & Agenda Views',
    description: 'Toggle between the interactive monthly calendar grid or chronological agenda list to inspect due dates at a glance.',
    placement: 'bottom',
    badge: '3/4 • Views'
  },
  {
    id: 'calendar-grid',
    targetSelector: '[data-tour="calendar-grid"]',
    tab: 'more',
    subView: 'CALENDAR',
    title: 'Dual Ethiopian (E.C.) & Gregorian Calendar',
    description: 'Switch between Ethiopian Calendar (Meskerem, Tikimt, etc.) and Gregorian dates with automatic Pagumē Month 13 payment exemptions.',
    placement: 'top',
    badge: '4/4 • Dual Calendar'
  }
];

export const FULL_APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard-hero-balance',
    targetSelector: '[data-tour="dashboard-hero-balance"]',
    tab: 'dashboard',
    title: 'Executive Balance & Net Profit',
    description: 'Consolidated balance across all vaults, real-time Net Profit, and privacy toggle to hide balances in public.',
    placement: 'bottom',
    badge: '1/6 • Dashboard'
  },
  {
    id: 'transactions-header',
    targetSelector: '[data-tour="transactions-header"]',
    tab: 'transactions',
    title: 'Financial Ledger & Journal',
    description: 'Real-time double-entry audit trail of every sale, expense, split payment, and customer tab collection.',
    placement: 'bottom',
    badge: '2/6 • Ledger'
  },
  {
    id: 'wallets-overview',
    targetSelector: '[data-tour="wallets-overview"]',
    tab: 'wallets',
    title: 'Multi-Vault Accounts & Cash Available',
    description: 'Live reconciled balances across Telebirr, CBE Bank, Cash on Hand, and inter-wallet transfers.',
    placement: 'bottom',
    badge: '3/6 • Wallets'
  },
  {
    id: 'equb-section',
    targetSelector: '[data-tour="equb-section"]',
    tab: 'equb',
    title: 'Traditional Equb Rotating Savings',
    description: 'Digital rotating savings circles, fair lottery draws with celebration confetti, and automatic wallet payouts.',
    placement: 'bottom',
    badge: '4/6 • Equb'
  },
  {
    id: 'chat-header',
    targetSelector: '[data-tour="chat-header"]',
    tab: 'chat',
    title: 'Team Chat & Instant Communication',
    description: 'Secure internal messaging between managers, cashiers, accountants, and partners.',
    placement: 'bottom',
    badge: '5/6 • Chat'
  },
  {
    id: 'more-hub-grid',
    targetSelector: '[data-tour="more-hub-grid"]',
    tab: 'more',
    subView: 'HUB',
    title: 'Operations Hub & Executive Reports',
    description: 'In-depth financial reports, customer credit (Bale\'da), Ethiopian calendar, asset registers, and user permissions.',
    placement: 'top',
    badge: '6/6 • Operations'
  }
];

/**
 * Returns the tailored tour steps and title for any given tab and optional subView.
 */
export function getPageTourSteps(tab: NavTab, subView?: string): { steps: TourStep[]; title: string } {
  if (tab === 'dashboard') {
    return { steps: DASHBOARD_TOUR_STEPS, title: 'Dashboard Walkthrough' };
  }
  if (tab === 'transactions') {
    return { steps: TRANSACTIONS_TOUR_STEPS, title: 'Financial Ledger Tour' };
  }
  if (tab === 'wallets') {
    return { steps: WALLETS_TOUR_STEPS, title: 'Wallets & Banking Tour' };
  }
  if (tab === 'equb') {
    return { steps: EQUB_TOUR_STEPS, title: 'Equb Savings Tour' };
  }
  if (tab === 'chat') {
    return { steps: CHAT_TOUR_STEPS, title: 'Team Chat Tour' };
  }
  if (tab === 'more') {
    const sv = (subView || 'HUB').toUpperCase();
    if (sv === 'REPORTS') {
      return { steps: REPORTS_TOUR_STEPS, title: 'Financial Reports Tour' };
    }
    if (sv === 'RECEIVABLES') {
      return { steps: RECEIVABLES_TOUR_STEPS, title: 'Customer Credit (Bale\'da) Tour' };
    }
    if (sv === 'CALENDAR') {
      return { steps: CALENDAR_TOUR_STEPS, title: 'Financial Calendar Tour' };
    }
    return { steps: MORE_HUB_TOUR_STEPS, title: 'Operations Hub Tour' };
  }
  return { steps: DASHBOARD_TOUR_STEPS, title: 'App Tour' };
}
