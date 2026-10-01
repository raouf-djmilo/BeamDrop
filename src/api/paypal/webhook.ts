/**
 * PayPal Automated Subscriptions Webhook Handler
 * Source file for TypeScript reference / builds
 */

export interface PayPalWebhookEvent {
  id: string;
  event_version: string;
  create_time: string;
  resource_type: string;
  event_type:
    | 'BILLING.SUBSCRIPTION.ACTIVATED'
    | 'PAYMENT.SALE.COMPLETED'
    | 'BILLING.SUBSCRIPTION.CANCELLED'
    | 'BILLING.SUBSCRIPTION.SUSPENDED'
    | 'BILLING.SUBSCRIPTION.EXPIRED'
    | string;
  summary: string;
  resource: {
    id?: string;
    custom_id?: string;
    custom?: string;
    plan_id?: string;
    status?: string;
    billing_agreement_id?: string;
    [key: string]: any;
  };
}

export const PAYPAL_WEBHOOK_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'PAYMENT.SALE.COMPLETED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED'
] as const;
