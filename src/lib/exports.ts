import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import { ERPState, Transaction } from '../types';
import { calculateTotalBusinessBalance, formatETB } from './store';
import { formatDateByCalendar } from './ethiopianCalendar';

export interface ExportOptions {
  state: ERPState;
  transactions?: Transaction[];
  dateRangeLabel?: string;
  reportTitle?: string;
  includeCoverPage?: boolean;
  orientation?: 'portrait' | 'landscape';
  groupBy?: 'NONE' | 'CATEGORY' | 'PAYMENT_METHOD' | 'USER' | 'BRANCH' | 'DAY' | 'MONTH';
  startDate?: string;
  endDate?: string;
}

/**
 * Helper to get wallet name by ID
 */
const getWalletName = (walletId: string, state: ERPState): string => {
  const w = state.wallets.find(item => item.id === walletId);
  return w ? w.name : walletId;
};

/**
 * Financial Analysis Helper
 */
export const calculateFinancialAnalysis = (transactions: Transaction[], state: ERPState) => {
  const activeTxs = transactions.filter(t => !t.reversed);
  const incomeTxs = activeTxs.filter(t => t.type === 'INCOME');
  const expenseTxs = activeTxs.filter(t => t.type === 'EXPENSE');

  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const grossProfit = totalIncome;
  const netProfit = totalIncome - totalExpense;
  const totalCount = activeTxs.length;

  // Group by day for daily averages & extremes
  const incomeByDay: Record<string, number> = {};
  const expenseByDay: Record<string, number> = {};
  const allDays = new Set<string>();

  activeTxs.forEach(t => {
    const dayStr = t.date.slice(0, 10);
    allDays.add(dayStr);
    if (t.type === 'INCOME') {
      incomeByDay[dayStr] = (incomeByDay[dayStr] || 0) + t.amount;
    } else {
      expenseByDay[dayStr] = (expenseByDay[dayStr] || 0) + t.amount;
    }
  });

  const uniqueDaysCount = Math.max(allDays.size, 1);
  const avgDailyIncome = totalIncome / uniqueDaysCount;
  const avgDailyExpense = totalExpense / uniqueDaysCount;

  // Highest & lowest income days
  let highestIncomeDay = { date: '-', amount: 0 };
  let lowestIncomeDay = { date: '-', amount: Infinity };
  Object.entries(incomeByDay).forEach(([d, amt]) => {
    if (amt > highestIncomeDay.amount) highestIncomeDay = { date: d, amount: amt };
    if (amt < lowestIncomeDay.amount) lowestIncomeDay = { date: d, amount: amt };
  });
  if (lowestIncomeDay.amount === Infinity) lowestIncomeDay = { date: '-', amount: 0 };

  // Highest & lowest expense days
  let highestExpenseDay = { date: '-', amount: 0 };
  let lowestExpenseDay = { date: '-', amount: Infinity };
  Object.entries(expenseByDay).forEach(([d, amt]) => {
    if (amt > highestExpenseDay.amount) highestExpenseDay = { date: d, amount: amt };
    if (amt < lowestExpenseDay.amount) lowestExpenseDay = { date: d, amount: amt };
  });
  if (lowestExpenseDay.amount === Infinity) lowestExpenseDay = { date: '-', amount: 0 };

  // Cash vs Bank percentage
  let cashTotal = 0;
  let bankTotal = 0;
  state.wallets.forEach(w => {
    const bal = w.openingBalance + w.totalIn - w.totalOut;
    if (w.type === 'CASH') cashTotal += bal;
    else bankTotal += bal;
  });
  const totalLiquid = cashTotal + bankTotal;
  const cashPercent = totalLiquid > 0 ? (cashTotal / totalLiquid) * 100 : 0;
  const bankPercent = totalLiquid > 0 ? (bankTotal / totalLiquid) * 100 : 0;

  return {
    totalIncome,
    totalExpense,
    grossProfit,
    netProfit,
    totalCount,
    avgDailyIncome,
    avgDailyExpense,
    highestIncomeDay,
    lowestIncomeDay,
    highestExpenseDay,
    lowestExpenseDay,
    cashTotal,
    bankTotal,
    cashPercent,
    bankPercent,
    uniqueDaysCount
  };
};

/**
 * 1. Generate Clean Professional PDF Financial Statement
 */
export const generatePDFReport = ({
  state,
  transactions = state.transactions,
  dateRangeLabel = 'All Time',
  reportTitle = 'Executive Financial Statement & Operational Report',
  includeCoverPage = true,
  orientation = 'landscape',
  groupBy = 'NONE'
}: ExportOptions) => {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const reportId = `REP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const generatedTimeStr = new Date().toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const currentUser = state.currentUser?.name || 'Admin';

  const analysis = calculateFinancialAnalysis(transactions, state);
  const totalBalance = calculateTotalBusinessBalance(state.wallets, state.transactions, state.transfers);
  const totalAssetsValue = state.assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalLoansOutstanding = state.loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const netWorth = totalBalance + totalAssetsValue - totalLoansOutstanding;

  // ---------------- COVER PAGE (PDF) ----------------
  if (includeCoverPage) {
    // Background Dark Header Banner
    doc.setFillColor(19, 25, 38); // #131926
    doc.rect(0, 0, pageWidth, pageHeight * 0.35, 'F');

    // Accent Stripe
    doc.setFillColor(0, 212, 170); // #00D4AA
    doc.rect(0, pageHeight * 0.35 - 3, pageWidth, 3, 'F');

    // Logo & Company Header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('PLUS GAMEZONE PLC', pageWidth / 2, 32, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 212, 170);
    doc.text('PLUSZONE FINANCE ERP • AUDITED REPORTING SYSTEM', pageWidth / 2, 42, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(reportTitle.toUpperCase(), pageWidth / 2, 58, { align: 'center' });

    // Report Details Box on Cover
    const boxY = pageHeight * 0.42;
    const boxWidth = pageWidth * 0.7;
    const boxX = (pageWidth - boxWidth) / 2;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, boxY, boxWidth, 90, 4, 4, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 115, 130);

    const details = [
      { label: 'REPORT PERIOD:', val: dateRangeLabel },
      { label: 'REPORT ID:', val: reportId },
      { label: 'GENERATED DATE:', val: generatedTimeStr },
      { label: 'PREPARED BY:', val: `${currentUser} (${state.currentUser?.branch || 'Main Branch'})` },
      { label: 'GROSS REVENUE:', val: formatETB(analysis.totalIncome) },
      { label: 'OPERATING EXPENSES:', val: formatETB(analysis.totalExpense) },
      { label: 'NET PROFIT MARGIN:', val: formatETB(analysis.netProfit) },
      { label: 'TOTAL RECORD COUNT:', val: `${analysis.totalCount} Transactions` }
    ];

    let currentY = boxY + 14;
    details.forEach(item => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, boxX + 16, currentY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(19, 25, 38);
      doc.text(item.val, boxX + 75, currentY);

      currentY += 9;
    });

    // Footer note on cover page
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Confidential • Generated for internal management & auditing purposes.', pageWidth / 2, pageHeight - 15, { align: 'center' });

    // Start content on page 2
    doc.addPage();
  }

  // ---------------- HEADER BANNER ON CONTENT PAGES ----------------
  doc.setFillColor(19, 25, 38);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PLUS GAMEZONE PLC', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 212, 170);
  doc.text(reportTitle.toUpperCase(), 14, 17);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`ID: ${reportId} | Period: ${dateRangeLabel}`, pageWidth - 14, 10, { align: 'right' });
  doc.text(`Generated: ${generatedTimeStr} | By: ${currentUser}`, pageWidth - 14, 17, { align: 'right' });

  // ---------------- SUMMARY CARDS BANNER ----------------
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 26, pageWidth - 28, 22, 2, 2, 'F');
  doc.setDrawColor(220, 225, 235);
  doc.roundedRect(14, 26, pageWidth - 28, 22, 2, 2, 'D');

  const colStep = (pageWidth - 36) / 5;

  // KPI 1
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 115, 130);
  doc.text('TOTAL REVENUE', 20, 32);
  doc.setFontSize(10);
  doc.setTextColor(16, 124, 65);
  doc.text(formatETB(analysis.totalIncome), 20, 40);

  // KPI 2
  doc.setFontSize(7.5);
  doc.setTextColor(100, 115, 130);
  doc.text('OPERATING EXPENSE', 20 + colStep, 32);
  doc.setFontSize(10);
  doc.setTextColor(197, 34, 31);
  doc.text(formatETB(analysis.totalExpense), 20 + colStep, 40);

  // KPI 3
  doc.setFontSize(7.5);
  doc.setTextColor(100, 115, 130);
  doc.text('NET PROFIT', 20 + colStep * 2, 32);
  doc.setFontSize(10);
  doc.setTextColor(analysis.netProfit >= 0 ? 16 : 197, analysis.netProfit >= 0 ? 124 : 34, analysis.netProfit >= 0 ? 65 : 31);
  doc.text(formatETB(analysis.netProfit), 20 + colStep * 2, 40);

  // KPI 4
  doc.setFontSize(7.5);
  doc.setTextColor(100, 115, 130);
  doc.text('LIQUID CASH', 20 + colStep * 3, 32);
  doc.setFontSize(10);
  doc.setTextColor(15, 98, 254);
  doc.text(formatETB(totalBalance), 20 + colStep * 3, 40);

  // KPI 5
  doc.setFontSize(7.5);
  doc.setTextColor(100, 115, 130);
  doc.text('NET WORTH', 20 + colStep * 4, 32);
  doc.setFontSize(10);
  doc.setTextColor(19, 25, 38);
  doc.text(formatETB(netWorth), 20 + colStep * 4, 40);

  // ---------------- TABLE DATA & GROUPING ----------------
  let tableData: any[][] = [];

  if (groupBy === 'NONE') {
    let runningBal = 0;
    tableData = transactions.map((t, index) => {
      if (!t.reversed) {
        runningBal += t.type === 'INCOME' ? t.amount : -t.amount;
      }
      return [
        (index + 1).toString(),
        formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', true),
        t.type,
        t.category,
        t.description.length > 55 ? t.description.slice(0, 55) + '...' : t.description,
        getWalletName(t.walletId, state),
        t.branch || 'Main',
        formatETB(t.amount),
        t.creatorName || 'System',
        t.reversed ? 'REVERSED' : 'ACTIVE'
      ];
    });
  } else {
    // Grouped by Category, Payment Method, User, Branch, Day, Month
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      let key = 'Other';
      if (groupBy === 'CATEGORY') key = t.category || 'Uncategorized';
      else if (groupBy === 'PAYMENT_METHOD') key = getWalletName(t.walletId, state);
      else if (groupBy === 'USER') key = t.creatorName || 'System';
      else if (groupBy === 'BRANCH') key = t.branch || 'Main';
      else if (groupBy === 'DAY') key = t.date.slice(0, 10);
      else if (groupBy === 'MONTH') key = t.date.slice(0, 7);

      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    Object.entries(groups).forEach(([groupKey, groupTxs]) => {
      const groupActive = groupTxs.filter(t => !t.reversed);
      const groupInc = groupActive.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const groupExp = groupActive.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      const groupSubtotal = groupInc - groupExp;

      // Group Header Row
      tableData.push([
        `GROUP: ${groupKey.toUpperCase()} (${groupTxs.length} items)`,
        '', '', '', '', '', '',
        `Net: ${formatETB(groupSubtotal)}`,
        '', ''
      ]);

      groupTxs.forEach((t, index) => {
        tableData.push([
          `  ${index + 1}`,
          formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', true),
          t.type,
          t.category,
          t.description.length > 55 ? t.description.slice(0, 55) + '...' : t.description,
          getWalletName(t.walletId, state),
          t.branch || 'Main',
          formatETB(t.amount),
          t.creatorName || 'System',
          t.reversed ? 'REVERSED' : 'ACTIVE'
        ]);
      });
    });
  }

  autoTable(doc, {
    startY: 52,
    head: [['#', 'Date & Time', 'Type', 'Category', 'Description', 'Wallet Account', 'Branch', 'Amount (ETB)', 'Created By', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [19, 25, 38],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 40, 55]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 18, fontStyle: 'bold' },
      3: { cellWidth: 28 },
      4: { cellWidth: orientation === 'landscape' ? 60 : 38 },
      5: { cellWidth: 32 },
      6: { cellWidth: 20 },
      7: { cellWidth: 32, fontStyle: 'bold', halign: 'right' },
      8: { cellWidth: 28, fontStyle: 'bold' },
      9: { cellWidth: 18, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const firstColText = data.row.cells[0]?.text[0] || '';
        if (firstColText.startsWith('GROUP:')) {
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 23, 42];
        } else {
          const typeCell = data.row.cells[2]?.text[0];
          const statusCell = data.row.cells[9]?.text[0];

          if (statusCell === 'REVERSED') {
            data.cell.styles.textColor = [148, 163, 184];
          } else if (typeCell === 'INCOME') {
            if (data.column.index === 2 || data.column.index === 7) {
              data.cell.styles.textColor = [16, 124, 65];
            }
          } else if (typeCell === 'EXPENSE') {
            if (data.column.index === 2 || data.column.index === 7) {
              data.cell.styles.textColor = [197, 34, 31];
            }
          }
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 18 }
  });

  // ---------------- PAGE FOOTERS (Page X of Y) ----------------
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (includeCoverPage && i === 1) continue; // Skip cover page footer

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.text('PLUS GAMEZONE PLC • CONFIDENTIAL FINANCIAL STATEMENT', 14, pageHeight - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  doc.save(`Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * 1B. Generate Dedicated Transaction, Loan, Equb & Receivable Audit PDF Report
 * Exactly mirrors the 13-column executive audit layout with:
 * - All Transactions (with Running Balance)
 * - Loans Equb Receivables filtered ledger
 * - Register Status reconciliation summary
 */
export const generateAuditPDFReport = ({
  state,
  transactions = state.transactions
}: ExportOptions) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const isLoanEqubRcv = (t: Transaction): boolean => {
    if (t.refType === 'EQUB' || t.refType === 'LOAN' || t.refType === 'RECEIVABLE') return true;
    const cat = (t.category || '').toLowerCase();
    if (
      cat.includes('equb') ||
      cat.includes('ekub') ||
      cat.includes('loan') ||
      cat.includes('debt') ||
      cat.includes('receivable')
    ) return true;
    const desc = (t.description || '').toLowerCase();
    if (
      desc.includes('ekub') ||
      desc.includes('equb') ||
      desc.includes('agerye') ||
      desc.includes('leli') ||
      desc.includes('loan') ||
      desc.includes('repayment') ||
      desc.includes('receivable') ||
      desc.includes("bale'da") ||
      desc.includes("bale' da") ||
      desc.includes('weframu') ||
      (desc.includes('zeru') && desc.includes('loan'))
    ) return true;
    return false;
  };

  // Header Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 25, 38);
  doc.text('Transaction, Loan, Equb & Receivable Audit', 14, 15);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated from Financial_Report_${new Date().toISOString().slice(0, 10)}.xlsx. The report preserves recorded transaction details and flags limitations in dedicated registers.`, 14, 21);

  // How to read this report
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 25, 38);
  doc.text('How to read this report', 14, 28);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('• Creation date: where a separate creation date is not stored, the transaction date is shown as the recorded date; it should not automatically be treated as the original loan or Equb creation date.', 14, 33);
  doc.text('• Repayment dates: repayments are shown only where they appear as recorded transactions. Matching a repayment to a specific loan may require checking IDs, descriptions, references and amounts.', 14, 37);
  doc.text('• Wallets: wallet/account values are reproduced from the transaction ledger.', 14, 41);
  doc.text('• Register limitations: the source workbook\'s dedicated loan/liability, receivable and Equb registers independently verify creation dates, full repayment schedules and balances.', 14, 45);

  // Section 1: All Transactions
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 25, 38);
  doc.text('All Transactions', 14, 52);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${transactions.length} rows · 13 columns`, 55, 52);

  let runningBal = 0;
  const allRows = transactions.map((t, idx) => {
    if (!t.reversed) {
      runningBal += t.type === 'INCOME' ? t.amount : -t.amount;
    }
    return [
      (idx + 1).toString(),
      t.id,
      formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', false),
      t.type,
      t.category,
      t.description,
      getWalletName(t.walletId, state),
      t.amount.toString(),
      runningBal.toString(),
      t.creatorName || 'Suraphel',
      t.branch || 'Main',
      t.notes || t.refType || '-',
      t.reversed ? 'Reversed' : 'Active'
    ];
  });

  const column13Styles: any = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 32 },
    2: { cellWidth: 20 },
    3: { cellWidth: 14, fontStyle: 'bold' },
    4: { cellWidth: 22 },
    5: { cellWidth: 50 },
    6: { cellWidth: 18 },
    7: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
    8: { cellWidth: 18, halign: 'right' },
    9: { cellWidth: 20 },
    10: { cellWidth: 12 },
    11: { cellWidth: 22 },
    12: { cellWidth: 14, halign: 'center' }
  };

  autoTable(doc, {
    startY: 56,
    head: [['#', 'Transaction ID', 'Date & Time', 'Type', 'Category', 'Description', 'Wallet Account', 'Amount (ETB)', 'Running Balance (ETB)', 'Created By', 'Branch', 'Notes / Reference', 'Status']],
    body: allRows,
    theme: 'grid',
    headStyles: {
      fillColor: [19, 25, 38],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 40, 55]
    },
    columnStyles: column13Styles,
    margin: { left: 14, right: 14, bottom: 16 }
  });

  // Section 2: Loans Equb Receivables (Filtered Table)
  doc.addPage('a4', 'landscape');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 25, 38);
  doc.text('Loans Equb Receivables', 14, 15);

  const loanEqubTxs = transactions.filter(isLoanEqubRcv);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${loanEqubTxs.length} rows · 13 columns`, 65, 15);

  let loanRunningBal = 0;
  const loanEqubRows = loanEqubTxs.map((t, idx) => {
    if (!t.reversed) {
      loanRunningBal += t.type === 'INCOME' ? t.amount : -t.amount;
    }
    return [
      (idx + 1).toString(),
      t.id,
      formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', false),
      t.type,
      t.category,
      t.description,
      getWalletName(t.walletId, state),
      t.amount.toString(),
      loanRunningBal.toString(),
      t.creatorName || 'Suraphel',
      t.branch || 'Main',
      t.notes || t.refType || (t.category?.includes('Equb') ? 'EQUB' : t.category?.includes('Loan') ? 'LOAN' : 'RECEIVABLE'),
      t.reversed ? 'Reversed' : 'Active'
    ];
  });

  autoTable(doc, {
    startY: 20,
    head: [['#', 'Transaction ID', 'Date & Time', 'Type', 'Category', 'Description', 'Wallet Account', 'Amount (ETB)', 'Running Balance (ETB)', 'Created By', 'Branch', 'Notes / Reference', 'Status']],
    body: loanEqubRows,
    theme: 'grid',
    headStyles: {
      fillColor: [55, 48, 163],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 40, 55]
    },
    columnStyles: column13Styles,
    margin: { left: 14, right: 14, bottom: 16 }
  });

  // Section 3: Register Status
  const lastY = (doc as any).lastAutoTable?.finalY || 40;
  const registerStartY = lastY + 12 < pageHeight - 50 ? lastY + 12 : 20;
  if (registerStartY === 20) {
    doc.addPage('a4', 'landscape');
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 25, 38);
  doc.text('Register Status', 14, registerStartY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('3 rows · 4 columns', 50, registerStartY);

  const totalUncollected = state.receivables.reduce((s, r) => s + (r.status === 'OUTSTANDING' ? r.amountOwed - r.amountCollected : 0), 0);
  const totalLoans = state.loans.reduce((s, l) => s + l.outstandingBalance, 0);

  autoTable(doc, {
    startY: registerStartY + 5,
    head: [['Register', 'Status', 'Reported outstanding (ETB)', 'Note']],
    body: [
      [
        'Receivables',
        state.receivables.length > 0 ? `Active records entered in dedicated register (${state.receivables.length} accounts)` : 'No records entered in dedicated register',
        totalUncollected.toString(),
        'Customer credit accounts with issue dates, due dates, amounts owed, collected, and outstanding balances.'
      ],
      [
        'Loans & Liabilities',
        state.loans.length > 0 ? `Active records entered in dedicated register (${state.loans.length} loans)` : 'No records entered in dedicated register',
        totalLoans.toString(),
        'Loan liabilities mapped with counterparties, initial amounts, payment installments, and remaining principal balances.'
      ],
      [
        'Equb Ledger',
        state.equbs.length > 0 ? `Active records entered in dedicated register (${state.equbs.length} groups)` : 'No records entered in dedicated register',
        '0',
        'Rotational community savings groups mapped with round contributions, active members, rounds completed, and payouts claimed.'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [19, 25, 38],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 40, 55]
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 110 }
    },
    margin: { left: 14, right: 14, bottom: 16 }
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
    doc.text('Transaction, Loan, Equb & Receivable Audit', 14, pageHeight - 5);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
  }

  doc.save(`Transaction_Loan_Equb_Receivable_Audit_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// Style Definitions for XLSX Export
const STYLES = {
  bannerTitle: {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '131926' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  },
  bannerSubtitle: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '00D4AA' } },
    fill: { fgColor: { rgb: '1E2D40' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  },
  sectionHeader: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E2D40' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  },
  tableHeaderNavy: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '131926' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '334155' } },
      bottom: { style: 'medium', color: { rgb: '334155' } }
    }
  },
  tableHeaderCreator: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '1E3A8A' } },
      bottom: { style: 'medium', color: { rgb: '1E3A8A' } }
    }
  },
  tableHeaderGreen: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '166534' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  tableHeaderRed: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '991B1B' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  tableHeaderTeal: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0F766E' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  tableHeaderIndigo: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '3730A3' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  cellIncome: {
    fill: { fgColor: { rgb: 'E6F4EA' } },
    font: { name: 'Calibri', sz: 10, color: { rgb: '137333' }, bold: true }
  },
  cellExpense: {
    fill: { fgColor: { rgb: 'FCE8E6' } },
    font: { name: 'Calibri', sz: 10, color: { rgb: 'C5221F' }, bold: true }
  },
  cellReversed: {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { name: 'Calibri', sz: 10, color: { rgb: '94A3B8' }, strike: true }
  },
  cellCreator: {
    fill: { fgColor: { rgb: 'DBEAFE' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E40AF' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  },
  totalRow: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    border: {
      top: { style: 'thin', color: { rgb: '0F172A' } },
      bottom: { style: 'double', color: { rgb: '0F172A' } }
    }
  }
};

/**
 * Helper to apply styling to a worksheet generated by XLSX.utils.aoa_to_sheet
 */
const formatWorksheet = (
  ws: any,
  {
    headerRowIdx,
    headerStyle = STYLES.tableHeaderNavy,
    creatorColIdx = -1,
    colWidths = []
  }: {
    headerRowIdx: number;
    headerStyle?: any;
    creatorColIdx?: number;
    colWidths?: number[];
  }
) => {
  if (!ws || !ws['!ref']) return;

  const range = XLSX.utils.decode_range(ws['!ref']);

  // Set Auto-filter on header row
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIdx, c: 0 },
      e: { r: range.e.r, c: range.e.c }
    })
  };

  // Freeze Header Row
  ws['!views'] = [{ state: 'frozen', ySplit: headerRowIdx + 1 }];

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) continue;

      if (R === 0) {
        ws[cellRef].s = STYLES.bannerTitle;
      } else if (R === 1) {
        ws[cellRef].s = STYLES.bannerSubtitle;
      } else if (R === headerRowIdx) {
        if (C === creatorColIdx) {
          ws[cellRef].s = STYLES.tableHeaderCreator;
        } else {
          ws[cellRef].s = headerStyle;
        }
      } else if (R > headerRowIdx) {
        if (C === creatorColIdx) {
          ws[cellRef].s = STYLES.cellCreator;
        } else {
          const val = ws[cellRef].v;
          if (typeof val === 'number') {
            ws[cellRef].s = {
              alignment: { horizontal: 'right' },
              font: { name: 'Calibri', sz: 10 }
            };
          }
        }
      }
    }
  }

  if (colWidths.length > 0) {
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
  }
};

/**
 * 2. Generate Comprehensive Multi-Tab Banking & Financial Reporting Excel Workbook (.xlsx)
 */
export const generateExcelReport = ({
  state,
  transactions = state.transactions,
  dateRangeLabel = 'All Time',
  reportTitle = 'Executive Financial Reporting Package'
}: ExportOptions) => {
  const wb = XLSX.utils.book_new();

  const analysis = calculateFinancialAnalysis(transactions, state);
  const totalBalance = calculateTotalBusinessBalance(state.wallets, state.transactions, state.transfers);
  const totalAssetsValue = state.assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalLoansOutstanding = state.loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const netWorth = totalBalance + totalAssetsValue - totalLoansOutstanding;

  // ---------------- TAB 1: EXECUTIVE DASHBOARD & SUMMARY ----------------
  const summaryAOA: any[][] = [
    ['PLUS GAMEZONE PLC — AUDITED FINANCIAL DASHBOARD & SUMMARY'],
    ['Report Title', reportTitle, `Period: ${dateRangeLabel}`, `Generated: ${new Date().toLocaleString()}`, `By: ${state.currentUser?.name || 'Admin'}`],
    [],
    ['EXECUTIVE FINANCIAL METRICS', 'AMOUNT (ETB)', 'REMARK / STATUS'],
    ['Total Gross Revenue (Income)', analysis.totalIncome, 'Total Inflow'],
    ['Total Operating Expenses', analysis.totalExpense, 'Total Outflow'],
    ['Net Profit Margin', analysis.netProfit, analysis.netProfit >= 0 ? 'Surplus / Profit' : 'Deficit / Loss'],
    ['Average Daily Revenue', analysis.avgDailyIncome, 'Based on active record days'],
    ['Average Daily Expense', analysis.avgDailyExpense, 'Based on active record days'],
    ['Highest Revenue Single Day', analysis.highestIncomeDay.amount, `Date: ${analysis.highestIncomeDay.date}`],
    ['Highest Expense Single Day', analysis.highestExpenseDay.amount, `Date: ${analysis.highestExpenseDay.date}`],
    ['Liquid Cash Wallet Balances', analysis.cashTotal, `${analysis.cashPercent.toFixed(1)}% of total liquid cash`],
    ['Bank Accounts Balance', analysis.bankTotal, `${analysis.bankPercent.toFixed(1)}% of total liquid cash`],
    ['Total Liquid Cash Available', totalBalance, 'Across all wallets & bank accounts'],
    ['Fixed Assets Valuation', totalAssetsValue, 'Equipment, Gaming units & Holdings'],
    ['Outstanding Liabilities / Debt', totalLoansOutstanding, 'Active loans & liabilities'],
    ['Total Business Net Worth', netWorth, 'Equity Valuation'],
    [],
    ['BANK & WALLET ACCOUNTS SUMMARY', 'TYPE', 'OPENING BAL (ETB)', 'TOTAL IN (ETB)', 'TOTAL OUT (ETB)', 'CURRENT BALANCE (ETB)'],
    ...state.wallets.map(w => {
      const currentBal = w.openingBalance + w.totalIn - w.totalOut;
      return [w.name, w.type, w.openingBalance, w.totalIn, w.totalOut, currentBal];
    }),
    [],
    ['CATEGORY PERFORMANCE SUMMARY', 'TYPE', 'RECORD COUNT', 'TOTAL AMOUNT (ETB)']
  ];

  const categoryMap: Record<string, { type: string; count: number; total: number }> = {};
  transactions.forEach(t => {
    if (t.reversed) return;
    if (!categoryMap[t.category]) {
      categoryMap[t.category] = { type: t.type, count: 0, total: 0 };
    }
    categoryMap[t.category].count += 1;
    categoryMap[t.category].total += t.amount;
  });

  Object.entries(categoryMap).forEach(([cat, data]) => {
    summaryAOA.push([cat, data.type, data.count, data.total]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
  formatWorksheet(wsSummary, {
    headerRowIdx: 3,
    headerStyle: STYLES.sectionHeader,
    colWidths: [38, 24, 28, 22, 22, 24]
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Dashboard');

  // ---------------- TAB 2: TRANSACTIONS AUDIT LEDGER ----------------
  let runningBalance = 0;
  const allLedgerAOA: any[][] = [
    ['PLUS GAMEZONE PLC — ALL TRANSACTIONS AUDIT LEDGER'],
    [`Report Title: ${reportTitle}`, `Scope: ${dateRangeLabel}`, `Generated: ${formatDateByCalendar(new Date(), state.calendarType || 'GREGORIAN', true)}`, `By: ${state.currentUser?.name || 'Admin'}`],
    [],
    ['#', 'Transaction ID', 'Date & Time', 'Type', 'Category', 'Description', 'Wallet Account', 'Amount (ETB)', 'Running Balance (ETB)', 'Created By', 'Branch', 'Notes / Reference', 'Status'],
    ...transactions.map((t, i) => {
      if (!t.reversed) {
        runningBalance += t.type === 'INCOME' ? t.amount : -t.amount;
      }
      return [
        i + 1,
        t.id,
        formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', true),
        t.type,
        t.category,
        t.description,
        getWalletName(t.walletId, state),
        t.amount,
        runningBalance,
        t.creatorName || 'System',
        t.branch || 'Main',
        t.notes || t.refType || '-',
        t.reversed ? 'Reversed' : 'Active'
      ];
    })
  ];

  const wsAllLedger = XLSX.utils.aoa_to_sheet(allLedgerAOA);
  formatWorksheet(wsAllLedger, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderNavy,
    creatorColIdx: 9,
    colWidths: [6, 16, 22, 12, 22, 36, 26, 18, 20, 24, 14, 22, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsAllLedger, 'Transactions');

  // ---------------- TAB 3: LOANS, EQUB & RECEIVABLES AUDIT LEDGER ----------------
  const isLoanEqubRcv = (t: Transaction): boolean => {
    if (t.refType === 'EQUB' || t.refType === 'LOAN' || t.refType === 'RECEIVABLE') return true;
    const cat = (t.category || '').toLowerCase();
    if (
      cat.includes('equb') ||
      cat.includes('ekub') ||
      cat.includes('loan') ||
      cat.includes('debt') ||
      cat.includes('receivable')
    ) return true;
    const desc = (t.description || '').toLowerCase();
    if (
      desc.includes('ekub') ||
      desc.includes('equb') ||
      desc.includes('agerye') ||
      desc.includes('leli') ||
      desc.includes('loan') ||
      desc.includes('repayment') ||
      desc.includes('receivable') ||
      desc.includes("bale'da") ||
      desc.includes("bale' da") ||
      desc.includes('weframu') ||
      (desc.includes('zeru') && desc.includes('loan'))
    ) return true;
    return false;
  };

  const loanEqubRcvTransactions = transactions.filter(isLoanEqubRcv);
  let loanEqubRunningBal = 0;
  const loanEqubAOA: any[][] = [
    ['PLUS GAMEZONE PLC — LOANS, EQUB & RECEIVABLES TRANSACTION AUDIT'],
    [`Dedicated Audit Records: ${loanEqubRcvTransactions.length}`, `Scope: ${dateRangeLabel}`, `Generated: ${formatDateByCalendar(new Date(), state.calendarType || 'GREGORIAN', true)}`],
    [],
    ['#', 'Transaction ID', 'Date & Time', 'Type', 'Category', 'Description', 'Wallet Account', 'Amount (ETB)', 'Running Balance (ETB)', 'Created By', 'Branch', 'Notes / Reference', 'Status'],
    ...loanEqubRcvTransactions.map((t, i) => {
      if (!t.reversed) {
        loanEqubRunningBal += t.type === 'INCOME' ? t.amount : -t.amount;
      }
      return [
        i + 1,
        t.id,
        formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', true),
        t.type,
        t.category,
        t.description,
        getWalletName(t.walletId, state),
        t.amount,
        loanEqubRunningBal,
        t.creatorName || 'System',
        t.branch || 'Main',
        t.notes || t.refType || (t.category?.includes('Equb') ? 'EQUB' : t.category?.includes('Loan') ? 'LOAN' : '-'),
        t.reversed ? 'Reversed' : 'Active'
      ];
    })
  ];

  const wsLoanEqub = XLSX.utils.aoa_to_sheet(loanEqubAOA);
  formatWorksheet(wsLoanEqub, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderIndigo,
    creatorColIdx: 9,
    colWidths: [6, 16, 22, 12, 22, 36, 26, 18, 20, 24, 14, 22, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsLoanEqub, 'Loans Equb Receivables');

  // ---------------- TAB 4: REGISTER STATUS SUMMARY ----------------
  const totalUncollectedReceivables = state.receivables.reduce((s, r) => s + (r.status === 'OUTSTANDING' ? r.amountOwed - r.amountCollected : 0), 0);
  const registerStatusAOA: any[][] = [
    ['PLUS GAMEZONE PLC — AUDIT REGISTER STATUS & RECONCILIATION SUMMARY'],
    [`Total Outstanding Liabilities: ${formatETB(totalLoansOutstanding)}`, `Total Pending Receivables: ${formatETB(totalUncollectedReceivables)}`, `Generated: ${formatDateByCalendar(new Date(), state.calendarType || 'GREGORIAN', true)}`],
    [],
    ['#', 'Register Name', 'Register Status', 'Total Records', 'Reported Outstanding (ETB)', 'Audit Status & Reconciliation Notes'],
    [
      1,
      'Receivables',
      state.receivables.length > 0 ? 'Active records entered in dedicated register' : 'No records entered in dedicated register',
      state.receivables.length,
      totalUncollectedReceivables,
      'Customer credits mapped with customer names, issue dates, due dates, amounts owed, collected, and outstanding statuses.'
    ],
    [
      2,
      'Loans & Liabilities',
      state.loans.length > 0 ? 'Active records entered in dedicated register' : 'No records entered in dedicated register',
      state.loans.length,
      totalLoansOutstanding,
      'Liability records mapped with lenders, counterparties, directions, initial amounts, payment installments, and outstanding balances.'
    ],
    [
      3,
      'Equb Ledger',
      state.equbs.length > 0 ? 'Active records entered in dedicated register' : 'No records entered in dedicated register',
      state.equbs.length,
      0,
      'Rotational community savings groups mapped with round contributions, active members, rounds completed, and payouts claimed.'
    ]
  ];

  const wsRegisterStatus = XLSX.utils.aoa_to_sheet(registerStatusAOA);
  formatWorksheet(wsRegisterStatus, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderNavy,
    colWidths: [6, 24, 38, 16, 26, 60]
  });

  XLSX.utils.book_append_sheet(wb, wsRegisterStatus, 'Register Status');

  // ---------------- TAB 5: INCOME STATEMENT ----------------
  const incomeTransactions = transactions.filter(t => t.type === 'INCOME');
  const incomeAOA: any[][] = [
    ['PLUS GAMEZONE PLC — GROSS REVENUE & INCOME STATEMENT'],
    [`Total Revenue: ${formatETB(analysis.totalIncome)}`, `Records: ${incomeTransactions.length}`, `Generated: ${formatDateByCalendar(new Date(), state.calendarType || 'GREGORIAN', true)}`],
    [],
    ['#', 'Date & Time', 'Source Category', 'Description', 'Customer', 'Deposit Bank / Wallet', 'Amount (ETB)', 'Created By', 'Branch', 'Status'],
    ...incomeTransactions.map((t, i) => [
      i + 1,
      formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', true),
      t.category,
      t.description,
      t.notes || 'General Customer',
      getWalletName(t.walletId, state),
      t.amount,
      t.creatorName || 'System',
      t.branch || 'Main',
      t.reversed ? 'Reversed' : 'Active'
    ])
  ];

  const wsIncome = XLSX.utils.aoa_to_sheet(incomeAOA);
  formatWorksheet(wsIncome, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderGreen,
    creatorColIdx: 7,
    colWidths: [6, 22, 22, 36, 24, 26, 18, 24, 14, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');

  // ---------------- TAB 4: EXPENSES STATEMENT ----------------
  const expenseTransactions = transactions.filter(t => t.type === 'EXPENSE');
  const expenseAOA: any[][] = [
    ['PLUS GAMEZONE PLC — OPERATING EXPENSES LEDGER'],
    [`Total Expenses: ${formatETB(analysis.totalExpense)}`, `Records: ${expenseTransactions.length}`, `Generated: ${formatDateByCalendar(new Date(), state.calendarType || 'GREGORIAN', true)}`],
    [],
    ['#', 'Date & Time', 'Expense Category', 'Description / Vendor', 'Payment Method / Wallet', 'Amount (ETB)', 'Approved / Created By', 'Branch', 'Status'],
    ...expenseTransactions.map((t, i) => [
      i + 1,
      formatDateByCalendar(t.date, state.calendarType || 'GREGORIAN', true),
      t.category,
      t.description,
      getWalletName(t.walletId, state),
      t.amount,
      t.creatorName || 'System',
      t.branch || 'Main',
      t.reversed ? 'Reversed' : 'Active'
    ])
  ];

  const wsExpense = XLSX.utils.aoa_to_sheet(expenseAOA);
  formatWorksheet(wsExpense, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderRed,
    creatorColIdx: 6,
    colWidths: [6, 22, 22, 36, 26, 18, 26, 14, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsExpense, 'Expenses');

  // ---------------- TAB 5: RECEIVABLES & CUSTOMERS ----------------
  const receivablesAOA: any[][] = [
    ['PLUS GAMEZONE PLC — CUSTOMER RECEIVABLES & OUTSTANDING BALANCE LEDGER'],
    [`Total Uncollected Receivables: ${formatETB(state.receivables.reduce((s, r) => s + (r.status === 'OUTSTANDING' ? r.amountOwed - r.amountCollected : 0), 0))}`],
    [],
    ['#', 'Customer Name', 'Description', 'Amount Owed (ETB)', 'Amount Collected (ETB)', 'Outstanding Balance (ETB)', 'Due Date', 'Status', 'Settlement Wallet'],
    ...state.receivables.map((r, i) => {
      const targetW = r.walletId ? state.wallets.find(w => w.id === r.walletId) : null;
      return [
        i + 1,
        r.customerName,
        r.description,
        r.amountOwed,
        r.amountCollected,
        r.amountOwed - r.amountCollected,
        r.dueDate,
        r.status,
        r.status === 'COLLECTED'
          ? (targetW ? `${targetW.name} (${targetW.type})` : 'Settled')
          : 'Pending Collection'
      ];
    })
  ];

  const wsReceivables = XLSX.utils.aoa_to_sheet(receivablesAOA);
  formatWorksheet(wsReceivables, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderNavy,
    colWidths: [6, 28, 36, 20, 20, 22, 16, 14, 26]
  });

  XLSX.utils.book_append_sheet(wb, wsReceivables, 'Receivables');

  // ---------------- TAB 6: INVENTORY & FIXED ASSETS ----------------
  const assetsAOA: any[][] = [
    ['PLUS GAMEZONE PLC — INVENTORY & FIXED ASSETS VALUATION'],
    [`Total Asset Holdings: ${formatETB(totalAssetsValue)}`, `Active Items: ${state.assets.length}`],
    [],
    ['#', 'Item / Asset Name', 'Category', 'Purchase Date', 'Purchase Price (ETB)', 'Current Valuation (ETB)', 'Depreciation Method', 'Status'],
    ...state.assets.map((a, i) => [
      i + 1,
      a.name,
      a.category,
      a.purchaseDate,
      a.purchasePrice,
      a.currentValue,
      a.depreciationMethod,
      a.status
    ])
  ];

  const wsAssets = XLSX.utils.aoa_to_sheet(assetsAOA);
  formatWorksheet(wsAssets, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderTeal,
    colWidths: [6, 28, 20, 16, 22, 22, 22, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsAssets, 'Inventory & Assets');

  // ---------------- TAB 7: LOANS & LIABILITIES ----------------
  const loansAOA: any[][] = [
    ['PLUS GAMEZONE PLC — LOANS & DEBT LIABILITIES AUDIT'],
    [`Total Outstanding Debt: ${formatETB(totalLoansOutstanding)}`],
    [],
    ['#', 'Loan Title', 'Counterparty / Lender', 'Direction', 'Initial Amount (ETB)', 'Outstanding Balance (ETB)', 'Interest Rate %', 'Due Date', 'Status'],
    ...state.loans.map((l, i) => [
      i + 1,
      l.title,
      l.counterparty,
      l.direction || 'BORROWED',
      l.initialAmount,
      l.outstandingBalance,
      l.interestRatePercent || 0,
      l.dueDate,
      l.status
    ])
  ];

  const wsLoans = XLSX.utils.aoa_to_sheet(loansAOA);
  formatWorksheet(wsLoans, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderRed,
    colWidths: [6, 26, 26, 16, 22, 24, 16, 16, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsLoans, 'Loans & Liabilities');

  // ---------------- TAB 8: EQUB LEDGER ----------------
  const equbAOA: any[][] = [
    ['PLUS GAMEZONE PLC — EQUB SAVINGS & POOL LEDGER'],
    [`Active Equbs: ${state.equbs.length}`],
    [],
    ['#', 'Equb Group Name', 'Members Count', 'Round Contribution (ETB)', 'Current Round', 'Total Rounds', 'Interval', 'Status'],
    ...state.equbs.map((e, i) => [
      i + 1,
      e.name,
      e.members.length,
      e.contributionPerRound,
      e.currentRound,
      e.totalRounds,
      e.interval,
      e.status
    ])
  ];

  const wsEqub = XLSX.utils.aoa_to_sheet(equbAOA);
  formatWorksheet(wsEqub, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderIndigo,
    colWidths: [6, 28, 16, 22, 16, 14, 18, 12]
  });

  XLSX.utils.book_append_sheet(wb, wsEqub, 'Equb Ledger');

  // ---------------- TAB 9: USER AUDIT & CREATOR SUMMARY ----------------
  const creatorMap: Record<string, { name: string; role: string; branch: string; incTotal: number; expTotal: number; count: number }> = {};

  transactions.forEach(t => {
    if (t.reversed) return;
    const name = t.creatorName || 'System';
    if (!creatorMap[name]) {
      const userObj = state.users.find(u => u.name === name);
      creatorMap[name] = {
        name,
        role: userObj?.role || 'Staff',
        branch: t.branch || 'Main',
        incTotal: 0,
        expTotal: 0,
        count: 0
      };
    }

    creatorMap[name].count += 1;
    if (t.type === 'INCOME') {
      creatorMap[name].incTotal += t.amount;
    } else {
      creatorMap[name].expTotal += t.amount;
    }
  });

  const userAOA: any[][] = [
    ['PLUS GAMEZONE PLC — EMPLOYEE & CREATOR AUDIT TRAIL'],
    [`Total Active Personnel: ${Object.keys(creatorMap).length}`, `Generated: ${new Date().toLocaleString()}`],
    [],
    ['#', 'Created By', 'System Role', 'Branch', 'Revenue Posted (ETB)', 'Expenses Posted (ETB)', 'Total Volume (ETB)', 'Records Created'],
    ...Object.values(creatorMap).map((u, i) => [
      i + 1,
      u.name,
      u.role,
      u.branch,
      u.incTotal,
      u.expTotal,
      u.incTotal + u.expTotal,
      u.count
    ])
  ];

  const wsUserAudit = XLSX.utils.aoa_to_sheet(userAOA);
  formatWorksheet(wsUserAudit, {
    headerRowIdx: 3,
    headerStyle: STYLES.tableHeaderIndigo,
    creatorColIdx: 1,
    colWidths: [6, 28, 16, 16, 22, 22, 26, 18]
  });

  XLSX.utils.book_append_sheet(wb, wsUserAudit, 'Employee Audit');

  // Export Complete Multi-Tab Excel Workbook
  XLSX.writeFile(wb, `Financial_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * 3. Print Layout Helper
 */
export const printFinancialStatement = () => {
  window.print();
};
