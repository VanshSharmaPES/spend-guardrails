import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  LogLevel,
  OrdersController,
  SubscriptionsController,
  TransactionSearchController,
} from '@paypal/paypal-server-sdk';
import type { PurchaseProposal } from './types';

const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
    oAuthClientSecret: process.env.PAYPAL_SECRET!,
  },
  timeout: 0,
  environment: Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: {
      logBody: true
    },
    logResponse: {
      logHeaders: true
    }
  },
});

// Transactions from the last 30 days (Transaction Search allows at most 31).
export async function getRecentTransactions() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { result } = await new TransactionSearchController(client).searchTransactions({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    fields: 'all', // include payer info, not just transaction info
    pageSize: 20,
  });
  return result.transactionDetails ?? [];
}

// return=representation includes billing cycles and payment preferences in the list.
export async function getBillingPlans() {
  const { result } = await new SubscriptionsController(client).listBillingPlans({
    pageSize: 20,
    prefer: 'return=representation',
  });
  return result.plans ?? [];
}

export async function getBalances() {
  const { result } = await new TransactionSearchController(client).searchBalances({});
  return result;
}

// Separate client with logging off: order requests contain card details.
const paymentsClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
    oAuthClientSecret: process.env.PAYPAL_SECRET!,
  },
  timeout: 0,
  environment: Environment.Sandbox,
});

// PayPal's public sandbox test Visa. The agent's funding source; both clients are sandbox-only.
const SANDBOX_TEST_CARD = { name: 'Demo Agent', number: '4111111111111111', expiry: '2030-12', securityCode: '123' };

// A card payment source creates and captures in one call, with no buyer step.
// requestId makes retries safe: PayPal returns the same order instead of charging twice.
export async function payForProposal(proposal: PurchaseProposal, requestId: string) {
  const { result } = await new OrdersController(paymentsClient).createOrder({
    paypalRequestId: requestId,
    prefer: 'return=representation',
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          referenceId: requestId,
          customId: requestId,
          description: `${proposal.merchant} / ${proposal.category}`.slice(0, 127),
          amount: { currencyCode: proposal.amount.currencyCode, value: proposal.amount.value },
        },
      ],
      paymentSource: { card: SANDBOX_TEST_CARD },
    },
  });
  const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
  return {
    paypalOrderId: result.id ?? '',
    status: String(capture?.status ?? result.status ?? 'UNKNOWN'),
    capturedAt: capture?.createTime ?? new Date().toISOString(),
  };
}
