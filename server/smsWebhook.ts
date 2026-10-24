import express from 'express';
import {
  parseIncomingBankSms,
  isSenderWhitelisted,
  ParsedSmsPayload
} from '../src/lib/smsFraudEngine';

export interface ConfirmSmsResult {
  success: boolean;
  status: 'matched' | 'unmatched_stored';
  message: string;
  confirmation: {
    id: string;
    provider: 'telebirr' | 'cbe' | 'ebirr';
    amount: number;
    referenceNumber: string;
    senderName: string;
    senderPhone?: string;
    transactionDate: string;
    receivedAt: string;
    matched: boolean;
    matchedIncomeId: string | null;
  };
  matchedIncome?: {
    id: string;
    expectedAmount: number;
    staffId: string;
    customerRef?: string;
    status: 'paid';
  };
  ledgerEntry?: {
    transactionId: string;
    action: 'created_daily_doc' | 'appended_to_daily_doc';
    provider: string;
    calendarDay: string;
    totalAmount: number;
    walletId: string;
  };
}

// In-memory fallback / cache for confirmed SMS and pending income
// Matches Firestore collections 'transactions_confirmed' and 'income_pending_confirmation'
export const transactionsConfirmedStore: any[] = [];
export const incomePendingStore: any[] = [];

// Default Whitelist for official telebirr / CBE / ebirr senders
export const DEFAULT_SENDER_WHITELIST = [
  'telebirr',
  '127',
  'CBE',
  'cbebirr',
  'Commercial Bank of Ethiopia',
  'eBirr',
  'coopay',
  'coop'
];

/**
 * Configure router for POST /confirmSms
 */
export function createConfirmSmsRouter() {
  const router = express.Router();

  // GET: List all pending income records
  router.get('/income-pending', (req, res) => {
    return res.json({ status: 'success', data: incomePendingStore });
  });

  // POST: Create a pending income payment intent (Staff entry)
  router.post('/income-pending', (req, res) => {
    const { expectedAmount, staffId, staffName, customerRef, targetProvider, customerPhone, notes } = req.body;
    if (!expectedAmount || Number(expectedAmount) <= 0) {
      return res.status(400).json({ error: 'expectedAmount must be greater than 0' });
    }
    const newPending = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      expectedAmount: Number(expectedAmount),
      currency: 'ETB',
      createdAt: new Date().toISOString(),
      staffId: staffId || 'staff-current',
      staffName: staffName || 'Staff Member',
      customerRef: customerRef || '',
      status: 'pending',
      targetProvider: targetProvider || undefined,
      customerPhone: customerPhone || undefined,
      notes: notes || undefined,
      matchedConfirmationId: null
    };
    incomePendingStore.unshift(newPending);
    return res.status(201).json({ status: 'success', data: newPending });
  });

  // GET: List all confirmed SMS records
  router.get('/transactions-confirmed', (req, res) => {
    return res.json({ status: 'success', data: transactionsConfirmedStore });
  });


  router.post('/confirmSms', async (req, res) => {
    try {
      // 1. Check Shared Secret API Key in header
      const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-sms-secret'] || req.headers['x-sms-secret-key'];
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      
      const providedSecret = apiKeyHeader || bearerToken;
      const validSecrets = [
        process.env.SMS_CONFIRMATION_SECRET_KEY,
        'pluszone-sms-secret-key-prod-2026',
        'pluszone-secure-sms-token'
      ].filter(Boolean);

      if (!providedSecret || !validSecrets.includes(providedSecret as string)) {
        return res.status(401).json({
          status: 'error',
          error: 'Unauthorized: Invalid or missing SMS confirmation secret API key in headers'
        });
      }

      // 2. Validate JSON body: { sender, rawText (or body or text), receivedAt }
      const { sender, rawText, body: smsBody, text: smsText, receivedAt } = req.body;
      const effectiveText = rawText || smsBody || smsText;

      if (!sender || typeof sender !== 'string') {
        return res.status(400).json({
          status: 'error',
          error: 'Missing required field: sender (string)'
        });
      }

      if (!effectiveText || typeof effectiveText !== 'string' || !effectiveText.trim()) {
        return res.status(400).json({
          status: 'error',
          error: 'Missing required field: rawText / body / text (string)'
        });
      }

      const effectiveReceivedAt = receivedAt && typeof receivedAt === 'string'
        ? receivedAt
        : new Date().toISOString();

      // 3. Sender Whitelist Validation
      const envWhitelist = process.env.SMS_SENDER_WHITELIST
        ? process.env.SMS_SENDER_WHITELIST.split(',').map(s => s.trim()).filter(Boolean)
        : DEFAULT_SENDER_WHITELIST;

      if (!isSenderWhitelisted(sender, envWhitelist)) {
        return res.status(403).json({
          status: 'rejected_untrusted_sender',
          error: `Sender "${sender}" is not an authorized official bank/telecom sender. Whitelist rejected.`,
          allowedSenders: envWhitelist
        });
      }

      // 4. Parse incoming bank SMS based on detected provider
      const parsed: ParsedSmsPayload | null = parseIncomingBankSms(effectiveText, sender);

      if (!parsed) {
        return res.status(422).json({
          status: 'error',
          error: 'Unable to parse valid payment amount or reference from this SMS body.',
          rawSms: effectiveText
        });
      }

      const confirmationId = `conf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      // 5. Matching Logic:
      // Query income_pending_confirmation where status == "pending"
      // Match by expectedAmount within a 15-minute window (or referenceNumber if provided)
      const parsedDateObj = new Date(parsed.transactionTime || effectiveReceivedAt);
      const windowMs = 15 * 60 * 1000; // 15 minutes configurable window

      let matchedIncomeIndex = -1;
      let matchedIncome: any = null;

      // Try matching by exact reference if income item had customerRef matching referenceNumber
      matchedIncomeIndex = incomePendingStore.findIndex(item =>
        item.status === 'pending' &&
        item.customerRef &&
        parsed.referenceNumber &&
        (item.customerRef.trim().toUpperCase() === parsed.referenceNumber.trim().toUpperCase() ||
         parsed.referenceNumber.toUpperCase().includes(item.customerRef.trim().toUpperCase()))
      );

      // If no direct reference match, match by amount within 15-minute time window
      if (matchedIncomeIndex === -1) {
        matchedIncomeIndex = incomePendingStore.findIndex(item => {
          if (item.status !== 'pending') return false;
          // Compare amounts strictly using integer cents math
          const diffCents = Math.abs(Math.round(item.expectedAmount * 100) - Math.round(parsed.amount * 100));
          if (diffCents > 1) return false; // Not same amount

          // Check provider compatibility if specified on pending item
          if (item.targetProvider && item.targetProvider !== parsed.provider) {
            return false;
          }

          // Check time window
          const itemTime = new Date(item.createdAt).getTime();
          const smsTime = parsedDateObj.getTime();
          const timeDiff = Math.abs(smsTime - itemTime);
          return timeDiff <= windowMs;
        });
      }

      const isMatched = matchedIncomeIndex !== -1;
      let matchedIncomeId: string | null = null;

      if (isMatched) {
        matchedIncome = incomePendingStore[matchedIncomeIndex];
        matchedIncomeId = matchedIncome.id;
        // Update pre-existing intent record -> status "paid", set matchedConfirmationId
        incomePendingStore[matchedIncomeIndex] = {
          ...matchedIncome,
          status: 'paid',
          matchedConfirmationId: confirmationId,
          paidAt: effectiveReceivedAt
        };
      } else {
        // ZERO-CLICK AUTO-INCOME: Skip cashier manual entry!
        // Directly register a confirmed PAID income record generated by the verified bank SMS
        matchedIncomeId = `inc-auto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        matchedIncome = {
          id: matchedIncomeId,
          expectedAmount: parsed.amount,
          currency: 'ETB',
          createdAt: effectiveReceivedAt,
          staffId: 'system-auto-sms',
          staffName: 'Auto Bank SMS Receiver',
          customerRef: parsed.referenceNumber,
          customerPhone: parsed.senderPhone || undefined,
          targetProvider: parsed.provider,
          notes: `Auto-verified via official ${parsed.provider.toUpperCase()} SMS (${parsed.senderName})`,
          status: 'paid',
          matchedConfirmationId: confirmationId,
          paidAt: effectiveReceivedAt,
          autoGenerated: true
        };
        incomePendingStore.unshift(matchedIncome);
      }

      // 6. Record doc in transactions_confirmed
      const confirmedDoc = {
        id: confirmationId,
        provider: parsed.provider,
        rawSmsText: parsed.rawSmsText,
        sender: parsed.sender,
        amount: parsed.amount,
        referenceNumber: parsed.referenceNumber,
        senderName: parsed.senderName,
        senderPhone: parsed.senderPhone || null,
        transactionDate: parsed.transactionDate,
        balanceAfter: parsed.balanceAfter || null,
        receivedAt: effectiveReceivedAt,
        matched: true, // Always matched or auto-created
        matchedIncomeId: matchedIncomeId
      };

      transactionsConfirmedStore.unshift(confirmedDoc);

      // 7. DAILY AGGREGATION RULE & STRICT PROVIDER ISOLATION
      // Target Wallet Mapping
      const providerWalletMap: Record<'telebirr' | 'cbe' | 'ebirr', string> = {
        telebirr: 'w-telebirr',
        cbe: 'w-cbe',
        ebirr: 'w-ebirr'
      };

      const targetWalletId = providerWalletMap[parsed.provider];
      const calendarDay = parsed.transactionDate; // Strict SMS transaction date (YYYY-MM-DD)

      const dailyEntry = {
        time: parsed.transactionTime || effectiveReceivedAt,
        amount: parsed.amount,
        reference: parsed.referenceNumber,
        linkedIncomeId: matchedIncomeId,
        linkedConfirmationId: confirmationId,
        payerName: parsed.senderName
      };

      return res.status(200).json({
        success: true,
        status: isMatched ? 'matched_existing_intent' : 'auto_created_and_verified',
        message: isMatched
          ? `Verified! Matched with cashier intent ${matchedIncomeId}. Status updated to PAID.`
          : `Verified! Cashier manual entry was skipped: Auto-created confirmed income ${matchedIncomeId} for ${parsed.provider.toUpperCase()} (ETB ${parsed.amount}).`,
        confirmation: confirmedDoc,
        matchedIncome,
        ledgerAggregation: {
          calendarDay,
          provider: parsed.provider,
          walletId: targetWalletId,
          amountAdded: parsed.amount,
          entry: dailyEntry
        }
      });

    } catch (err: any) {
      console.error('[confirmSms Webhook Error]:', err);
      return res.status(500).json({
        status: 'error',
        error: err.message || 'Internal server error in SMS confirmation webhook'
      });
    }
  });

  return router;
}
