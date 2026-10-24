import { NavTab } from '../../types';

export interface PageHelpItem {
  id: string;
  tab: NavTab;
  subView?: string;
  title: string;
  badge: string;
  iconName: 'LayoutDashboard' | 'ReceiptText' | 'Wallet' | 'PiggyBank' | 'MessageSquare' | 'BarChart3' | 'FileCheck' | 'Calendar' | 'Sliders';
  summary: string;
  highlights: { label: string; text: string }[];
  howToGuides: { title: string; steps: string[] }[];
  proTips: string[];
  faq: { q: string; a: string }[];
  tourStepCount: number;
}

export const PAGE_HELP_DATA: PageHelpItem[] = [
  {
    id: 'dashboard',
    tab: 'dashboard',
    title: 'Executive Financial Dashboard',
    badge: 'Overview & Velocity',
    iconName: 'LayoutDashboard',
    summary: 'The primary command center for business owners and managers. Provides a real-time consolidated financial overview, rolling 7-day revenue velocity, daily cash run-rates, outstanding liabilities, and predictive cashflow runway.',
    highlights: [
      { label: 'Consolidated Ledger Balance', text: 'Aggregate working capital across all accounts (Telebirr, CBE Bank, Cash Vault) with a 1-tap privacy eye toggle to blur amounts around customers.' },
      { label: 'Net Profit & Margins', text: 'Calculated in real-time as Gross Inflow minus Total Operating Expenses for the current month.' },
      { label: 'Weekly Revenue Velocity', text: 'Rolling 7-day average daily collection pace that measures business acceleration.' },
      { label: 'Receivables & Equb Alerts', text: 'Live counters showing pending customer credit tabs (Bale\'da) and rotating savings commitments due.' },
      { label: '30-Day Predictive Runway', text: 'AI-grounded projection factoring in recurring obligations, loans, and revenue trends to prevent cash crunches.' }
    ],
    howToGuides: [
      {
        title: 'How to mask financial balances when customers are present',
        steps: [
          'Locate the Eye icon in the top header or next to the main balance card.',
          'Tap the eye icon to blur all financial figures across the app with "••••••••".',
          'Tap it again when in private to restore clear visibility.'
        ]
      },
      {
        title: 'How to quickly record a transaction from the dashboard',
        steps: [
          'Click the floating or centered "+ Quick Entry" button.',
          'Choose Income (Sale) or Expense (Supplier/Operating cost).',
          'Enter the amount, select the vault (e.g. Telebirr), add a quick note, and tap Save.'
        ]
      }
    ],
    proTips: [
      'Compare your "Weekly Daily Average" against your baseline daily sales to spot demand surges or slow days early.',
      'Check the Pagume notification during the 13th month of the Ethiopian calendar for automatic equb and loan obligation exemptions.'
    ],
    faq: [
      {
        q: 'Why does my Net Profit differ from my Total Liquid Cash?',
        a: 'Net Profit reflects revenue minus expenses during the selected period. Total Liquid Cash includes historical accumulated capital, loans received, and inter-wallet balances.'
      },
      {
        q: 'What is the "Weekly Velocity"?',
        a: 'It averages your actual cash inflows over the last 7 calendar days to give you a reliable daily income baseline.'
      }
    ],
    tourStepCount: 15
  },
  {
    id: 'transactions',
    tab: 'transactions',
    title: 'Financial Ledger & Audit Journal',
    badge: 'Audited Double-Entry',
    iconName: 'ReceiptText',
    summary: 'The immutable book of record for all business sales, supplier payments, multi-wallet splits, and customer credit collections with complete audit trails, creator timestamps, and Telebirr/Bank SMS verification stamps.',
    highlights: [
      { label: 'Double-Entry Audit Trail', text: 'Every entry records creator ID, exact timestamp, branch, and wallet adjustments.' },
      { label: 'Instant Multi-Filter Bar', text: 'Filter by Income, Expense, Wallet, Category, or toggle non-working days.' },
      { label: '1-Click Official Export', text: 'Generate audited PDF statements or download full Excel workbooks (.xlsx).' },
      { label: 'Split-Payment Support', text: 'Split large receipts across cash, Telebirr, and CBE Bank seamlessly.' },
      { label: 'Reversal & Edit Controls', text: 'Admin-controlled reversals with mandatory change reason audit logging.' }
    ],
    howToGuides: [
      {
        title: 'How to export a filtered transaction statement',
        steps: [
          'Use the filter pills to select your desired Date Range, Wallet, or Category.',
          'Click the "Export PDF" or "Export xlsx" button at the top right of the ledger.',
          'Your formatted statement will download immediately ready for tax or partner audits.'
        ]
      },
      {
        title: 'How to find a past customer payment',
        steps: [
          'Click the search bar at the top of the ledger.',
          'Type the customer name, reference code, or phone number to filter instantly.'
        ]
      }
    ],
    proTips: [
      'Use the "Non-Working Days" filter to isolate transactions logged on weekends or public holidays.',
      'Every transaction carries an immutable audit hash to guarantee tamper resistance.'
    ],
    faq: [
      {
        q: 'Can a Cashier delete a transaction?',
        a: 'No. Cashiers can only request reversals. Only Admins and SuperAdmins can approve or execute transaction reversals.'
      },
      {
        q: 'How does split payment work?',
        a: 'When recording an entry, choose "Split" to distribute the total amount into multiple accounts (e.g., 500 ETB Cash + 1,200 ETB Telebirr).'
      }
    ],
    tourStepCount: 5
  },
  {
    id: 'wallets',
    tab: 'wallets',
    title: 'Multi-Vault Wallets & Banking',
    badge: 'Liquidity Management',
    iconName: 'Wallet',
    summary: 'Manage all company bank accounts, digital mobile wallets, and physical cash vaults in one consolidated treasury view with real-time inter-wallet transfers and reconciliation.',
    highlights: [
      { label: 'Supported Vault Types', text: 'Native tracking for Telebirr, CBE Bank, eBirr, Awash Bank, Dashen Bank, and Physical Cash Registers.' },
      { label: 'Inter-Wallet Transfers', text: 'Move funds between accounts with instant balance adjustments and zero ledger discrepancy.' },
      { label: 'Balance Caps & Alerts', text: 'Set maximum holding ceilings and minimum cash reserve alerts per account.' },
      { label: 'Dedicated Account Ledgers', text: 'Click any wallet card to isolate and inspect its historical transaction feed.' }
    ],
    howToGuides: [
      {
        title: 'How to transfer funds between Telebirr and CBE Bank',
        steps: [
          'Click the "Transfer Funds" button at the top of the Wallets page.',
          'Select the Source Account (e.g. Telebirr) and Destination Account (e.g. CBE Bank).',
          'Enter the amount and any reference fee, then click "Confirm Transfer".'
        ]
      },
      {
        title: 'How to view the statement for a specific wallet',
        steps: [
          'Scroll to the Wallet Cards grid and tap on the card you want to inspect.',
          'The lower section will automatically filter and display the chronological ledger for that account.'
        ]
      }
    ],
    proTips: [
      'Lock inactive cash boxes to prevent unauthorized bookings while maintaining historical reporting.',
      'Regularly reconcile physical cash drawers with the "Cash on Hand" digital ledger balance at the end of each shift.'
    ],
    faq: [
      {
        q: 'What happens if a wallet goes into negative balance?',
        a: 'The system highlights the card in warning rose and calculates overdraft exposure unless overdraft is explicitly prohibited for that account.'
      }
    ],
    tourStepCount: 4
  },
  {
    id: 'equb',
    tab: 'equb',
    title: 'Traditional Equb Rotating Savings',
    badge: 'Rotating ROSCA Savings',
    iconName: 'PiggyBank',
    summary: 'Digitizes the time-honored Ethiopian rotating credit association (Equb). Manages member contribution rosters, automated round rotations, fair digital lottery draws, and wallet payout disbursements.',
    highlights: [
      { label: 'Circle Lifecycle Management', text: 'Configure daily, weekly, or monthly circles with fixed share amounts and target dates.' },
      { label: 'Fair Digital Lottery Draw', text: 'Animated lottery spin wheel to select the round winner transparently with confetti celebrations.' },
      { label: 'Automated Wallet Payouts', text: 'Disburse pool pots directly to the winner\'s preferred account with auto-generated receipt.' },
      { label: 'Pagume Month Exemption', text: 'Built-in support for the Ethiopian 13th month (Pagume) with automatic cycle adjustment.' }
    ],
    howToGuides: [
      {
        title: 'How to create a new Equb circle',
        steps: [
          'Click "+ New Equb Circle" at the top of the page.',
          'Enter the circle name, share contribution amount, cycle frequency, and target pot size.',
          'Add member names and assign their phone numbers and payout preferences.',
          'Click "Create Circle" to activate the pool.'
        ]
      },
      {
        title: 'How to conduct a fair winner draw',
        steps: [
          'Open an active circle and navigate to the "Lottery Draw" tab.',
          'Verify all current round dues are settled by members.',
          'Click "Spin Lottery Wheel" to randomly select the winner with full audit timestamping.'
        ]
      }
    ],
    proTips: [
      'Enable "Auto-Disburse Payout" to automatically credit the winner\'s linked Telebirr or Bank wallet when a draw completes.',
      'Check member payment indicators to quickly identify overdue contributors before running a draw.'
    ],
    faq: [
      {
        q: 'Can a past winner win again in the same cycle?',
        a: 'No. The fair lottery algorithm strictly excludes previous round winners until all members have received their payout.'
      }
    ],
    tourStepCount: 4
  },
  {
    id: 'chat',
    tab: 'chat',
    title: 'Team Chat & Branch Messenger',
    badge: 'Real-Time Sync',
    iconName: 'MessageSquare',
    summary: 'Encrypted internal messaging platform connecting store managers, cashiers, partners, and accountants. Attach financial receipts, share transaction IDs, broadcast announcements, and consult the AI Financial Partner.',
    highlights: [
      { label: 'Instant Branch Collaboration', text: 'Real-time multi-user communication with unread message badges and audio notifications.' },
      { label: 'Financial Reference Linking', text: 'Tag transactions, customer credit tabs, or equb circles directly inside any chat message.' },
      { label: 'Executive Announcements', text: 'SuperAdmins can broadcast pinned notices to all staff across branches.' },
      { label: 'AI Financial Advisor', text: 'Consult the AI assistant for instant calculations, Ethiopian tax guidance, and cashflow optimization.' }
    ],
    howToGuides: [
      {
        title: 'How to reference a transaction in a message',
        steps: [
          'In the chat input bar, click the paperclip or "Attach Reference" icon.',
          'Search or pick the relevant recent transaction from the popup list.',
          'Type your note and hit Send. The recipient can click the tag to inspect the exact entry.'
        ]
      }
    ],
    proTips: [
      'Use pinned announcements for shift handover instructions or daily cash balancing checklists.',
      'Staff with the Cashier role can quickly alert managers to approve high-value transactions directly via chat.'
    ],
    faq: [
      {
        q: 'Are chat conversations saved?',
        a: 'Yes, all team messages and attachments are safely stored and synced across active devices.'
      }
    ],
    tourStepCount: 4
  },
  {
    id: 'reports',
    tab: 'more',
    subView: 'REPORTS',
    title: 'Financial Statements & Banking Reports',
    badge: 'P&L, Balance Sheet & Audits',
    iconName: 'BarChart3',
    summary: 'Comprehensive financial reporting suite including audited Profit & Loss (P&L) statements, expense category breakdowns, partner dividend distributions, multi-tab Excel workbooks, and automated monthly email dispatches.',
    highlights: [
      { label: 'Audited P&L Statements', text: 'Gross Income, Cost of Sales, Operating Expenses, and calculated Net Profit Margins.' },
      { label: 'Partner Profit Distributions', text: 'Automatic equity-based dividend allocations based on pre-configured ownership percentages.' },
      { label: 'Automated 2nd-of-Month Emails', text: 'Schedule automatic dispatch of executive PDF & Excel statements to partners on the 2nd of each month.' },
      { label: 'Multi-Tab Excel Exports', text: 'Download comprehensive .xlsx workbooks containing raw journals, category rollups, and wallet summaries.' }
    ],
    howToGuides: [
      {
        title: 'How to configure automated monthly email reports',
        steps: [
          'Click the "Monthly Email Hub" button at the top of the Reports page.',
          'Configure your company SMTP server or select direct executive notification.',
          'Set your authorized recipient emails (Admins and SuperAdmins).',
          'Toggle the schedule on; executive reports will automatically dispatch on the 2nd of each month.'
        ]
      },
      {
        title: 'How to review partner profit distributions',
        steps: [
          'Scroll down to the "Partner Profit Distributions & Equity Shares" card.',
          'Review the distributable net profit split among partner profiles based on equity shares.'
        ]
      }
    ],
    proTips: [
      'Generate reports on both Gregorian (G.C.) and Ethiopian (E.C.) fiscal calendars for local tax filings.',
      'Check the Expense Category breakdown chart to identify which department has the highest cost run-rate.'
    ],
    faq: [
      {
        q: 'How are partner equity shares configured?',
        a: 'SuperAdmins can configure partner ownership percentages in More Hub → System Administration → Partner Equity.'
      }
    ],
    tourStepCount: 4
  },
  {
    id: 'receivables',
    tab: 'more',
    subView: 'RECEIVABLES',
    title: 'Customer Credit & Bale\'da Tabs',
    badge: 'Credit & Aging Management',
    iconName: 'FileCheck',
    summary: 'Track credit extended to customers (Bale\'da), manage payment terms, monitor aging schedules, and record repayments with 1-tap wallet deposits.',
    highlights: [
      { label: 'Aging Brackets & Late Alerts', text: 'Unsettled credit past 15 days automatically moves to the Late Payment warning queue.' },
      { label: '1-Tap Repayment Collection', text: 'Collect full or partial repayments with automatic ledger posting and wallet balance updates.' },
      { label: 'Debtor Contact Cards', text: 'Quick phone call and SMS reminder links to follow up on pending customer balances.' },
      { label: 'Credit Limit Safeguards', text: 'Prevent runaway debt by establishing maximum allowable credit limits per customer.' }
    ],
    howToGuides: [
      {
        title: 'How to record a new customer credit tab',
        steps: [
          'Click "+ Record Credit" at the top of the Receivables view.',
          'Enter the Customer Name, Phone Number, Credit Amount, and optional Due Date.',
          'Specify the items or service provided, then click "Save Credit Tab".'
        ]
      },
      {
        title: 'How to record a customer repayment',
        steps: [
          'Locate the customer\'s tab in the active receivables list.',
          'Click "Collect Payment".',
          'Enter the payment amount (supports partial payments) and select which wallet (Cash, Telebirr, CBE) received the funds.',
          'Click Confirm; the credit balance reduces and the wallet balance increases immediately.'
        ]
      }
    ],
    proTips: [
      'Check the "Late (>15 Days)" card regularly to prioritize collection calls on overdue accounts.',
      'Customers who pay promptly can be flagged for higher credit limits in their profile notes.'
    ],
    faq: [
      {
        q: 'Does collecting a receivable create a transaction?',
        a: 'Yes! Collecting a receivable automatically logs an audited Income transaction into your selected wallet with full receipt references.'
      }
    ],
    tourStepCount: 3
  },
  {
    id: 'more_hub',
    tab: 'more',
    subView: 'HUB',
    title: 'Operations Hub & System Settings',
    badge: 'Administration & Security',
    iconName: 'Sliders',
    summary: 'The administrative backbone of PlusZone ERP. Access business management tools, Ethiopian calendar settings, fixed asset registers, fraud prevention systems, and user permission roles.',
    highlights: [
      { label: 'Calendar Engine Toggle', text: 'Switch seamlessly between Ethiopian Calendar (E.C.) and Gregorian (G.C.) across statements and due dates.' },
      { label: 'User Roles & Permissions', text: 'Granular access control for SuperAdmin, Admin, Cashier, and Partner roles.' },
      { label: 'Fraud Detection & Audit Logs', text: 'Review suspicious transaction flags, after-hours bookings, and deleted entry logs.' },
      { label: 'Cloud Backups & Restore', text: 'Export full encrypted database backups and restore states safely.' }
    ],
    howToGuides: [
      {
        title: 'How to switch to the Ethiopian Calendar',
        steps: [
          'In the More Hub, look at the top "Calendar System" toggle card.',
          'Tap "🇪🇹 Ethiopian (E.C.)".',
          'All dates across the application, statements, and equbs will update to Ethiopian month formats (Meskerem, Tikimt, etc.).'
        ]
      }
    ],
    proTips: [
      'Regularly download a JSON backup from System Administration before executing large batch reconciliations.',
      'Assign the Cashier role to front-desk staff to restrict access to sensitive partner profit distributions and system settings.'
    ],
    faq: [
      {
        q: 'Who can access the System Administration section?',
        a: 'Only users with the SuperAdmin or Admin role can access system settings, user management, and fraud controls.'
      }
    ],
    tourStepCount: 3
  },
  {
    id: 'calendar',
    tab: 'more',
    subView: 'CALENDAR',
    title: 'Financial Calendar & Obligations',
    badge: 'Dual Calendar & Obligations',
    iconName: 'Calendar',
    summary: 'An interactive dual Ethiopian (E.C.) and Gregorian (G.C.) calendar scheduling all upcoming business bills, rotating equb rounds, loan amortizations, and customer credit collections with Pagumē month payment exemptions.',
    highlights: [
      { label: 'Dual Calendar Support', text: 'Seamlessly switch between Ethiopian Calendar (Meskerem, Tikimt, etc.) and Gregorian formats.' },
      { label: 'Pagumē 13th Month Rules', text: 'Automatic exemptions for equb rounds and loan installments during Pagumē to honor customary local business practices.' },
      { label: 'Month Grid & Agenda Views', text: 'Switch between an interactive monthly calendar view or a chronological agenda list of payment dues.' },
      { label: 'Google & Apple Calendar Sync', text: 'Export .ICS calendar files to synchronize obligations with personal smartphones and Google Calendar.' }
    ],
    howToGuides: [
      {
        title: 'How to export obligations to Google Calendar',
        steps: [
          'Navigate to Financial Calendar in More Hub.',
          'Click the "Export .ICS" button in the calendar toolbar.',
          'Open the downloaded file or import it into Google Calendar / Apple Calendar.'
        ]
      },
      {
        title: 'How to switch between Ethiopian and Gregorian calendar',
        steps: [
          'Locate the calendar type toggle button in the month navigation bar.',
          'Select "ETHIOPIAN" or "GREGORIAN".',
          'All day cells and month labels will update immediately.'
        ]
      }
    ],
    proTips: [
      'Click any day cell with colored dots to filter and inspect all transactions and bills due on that date.',
      'Check the monthly cash outflow cards at the top to forecast debt servicing costs for the upcoming month.'
    ],
    faq: [
      {
        q: 'Why are some bills exempt during Pagumē?',
        a: 'In Ethiopian business convention, the 13th month (Pagumē) typically consists of only 5 or 6 days, during which monthly recurring charges and equbs are traditionally exempted.'
      }
    ],
    tourStepCount: 4
  }
];

export function getPageHelp(tab: NavTab, subView?: string): PageHelpItem {
  if (tab === 'dashboard') {
    return PAGE_HELP_DATA.find(item => item.id === 'dashboard') || PAGE_HELP_DATA[0];
  }
  if (tab === 'transactions') {
    return PAGE_HELP_DATA.find(item => item.id === 'transactions') || PAGE_HELP_DATA[1];
  }
  if (tab === 'wallets') {
    return PAGE_HELP_DATA.find(item => item.id === 'wallets') || PAGE_HELP_DATA[2];
  }
  if (tab === 'equb') {
    return PAGE_HELP_DATA.find(item => item.id === 'equb') || PAGE_HELP_DATA[3];
  }
  if (tab === 'chat') {
    return PAGE_HELP_DATA.find(item => item.id === 'chat') || PAGE_HELP_DATA[4];
  }
  if (tab === 'more') {
    const sv = (subView || 'HUB').toUpperCase();
    if (sv === 'REPORTS') {
      return PAGE_HELP_DATA.find(item => item.id === 'reports') || PAGE_HELP_DATA[5];
    }
    if (sv === 'RECEIVABLES') {
      return PAGE_HELP_DATA.find(item => item.id === 'receivables') || PAGE_HELP_DATA[6];
    }
    if (sv === 'CALENDAR') {
      return PAGE_HELP_DATA.find(item => item.id === 'calendar') || PAGE_HELP_DATA[8];
    }
    return PAGE_HELP_DATA.find(item => item.id === 'more_hub') || PAGE_HELP_DATA[7];
  }
  return PAGE_HELP_DATA[0];
}

export function getAllPageHelpItems(): PageHelpItem[] {
  return PAGE_HELP_DATA;
}
