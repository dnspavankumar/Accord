import { AuditLogEvent, BackendCatalog, CheckoutPrepareResponse, GuardrailPolicy, IntentMandate, MerchantDashboard, MerchantProductInput, Product } from './types/accord';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function mapCatalog(catalog: BackendCatalog): Product[] {
  return catalog.dataFeedElement.map((item) => ({
    sku: item.sku,
    name: item.name,
    price: Number(item.price),
    stock: item.stock_quantity,
    category: item.category,
    ap2_jsonld: item,
  }));
}

function mapTransaction(transaction: AuditLogEvent): AuditLogEvent {
  return {
    ...transaction,
    // FastAPI serializes Decimal values as strings. Keep the UI arithmetic numeric.
    requested_amount: Number(transaction.requested_amount),
  };
}

export const getCatalog = () => request<BackendCatalog>('/api/v1/ap2/catalog');
export const createMerchantProduct = (product: MerchantProductInput) =>
  request<MerchantProductInput & { is_active: boolean }>('/api/v1/merchant/catalog', {
    method: 'POST', body: JSON.stringify({ ...product, currency: 'INR' }),
  });
export const archiveMerchantProduct = (sku: string) =>
  request<void>(`/api/v1/merchant/catalog/${encodeURIComponent(sku)}`, { method: 'DELETE' });
export const updateMerchantProduct = (sku: string, product: Omit<MerchantProductInput, 'sku'>) =>
  request<MerchantProductInput & { is_active: boolean }>(`/api/v1/merchant/catalog/${encodeURIComponent(sku)}`, {
    method: 'PATCH', body: JSON.stringify(product),
  });
export const prepareCheckout = (input: Omit<IntentMandate, 'payment_method'>) =>
  request<CheckoutPrepareResponse>('/api/v1/accord/merchant/checkout/prepare', { method: 'POST', body: JSON.stringify(input) });
export const confirmCheckout = (transactionId: string, payment: { razorpay_payment_id: string; razorpay_signature: string }) =>
  request<AuditLogEvent>(`/api/v1/accord/merchant/checkout/${transactionId}/confirm`, { method: 'POST', body: JSON.stringify(payment) });
export const getTransactions = async () =>
  (await request<AuditLogEvent[]>('/api/v1/accord/transactions')).map(mapTransaction);
function mapPolicy(policy: Record<string, number | string>): GuardrailPolicy {
  return {
    max_transaction_limit_inr: Number(policy.max_transaction_limit_inr),
    max_item_quantity: Number(policy.max_item_quantity ?? policy.max_quantity_per_item),
    velocity_limit_per_hour: Number(policy.velocity_limit_per_hour ?? policy.velocity_limit),
  };
}
export const getPolicy = async () => mapPolicy(await request<Record<string, number | string>>('/api/v1/accord/policy'));
export const updatePolicy = async (policy: GuardrailPolicy) => mapPolicy(await request<Record<string, number | string>>('/api/v1/accord/policy', {
  method: 'PUT',
  body: JSON.stringify({
    max_transaction_limit_inr: policy.max_transaction_limit_inr,
    max_quantity_per_item: policy.max_item_quantity,
    velocity_limit: policy.velocity_limit_per_hour,
    allowed_currency: 'INR',
    velocity_window_seconds: 3600,
  }),
}));
export const getMerchantDashboard = async () => {
  const dashboard = await request<MerchantDashboard>('/api/v1/accord/merchant/dashboard');
  return {
    ...dashboard,
    received_amount: Number(dashboard.received_amount),
    payments: dashboard.payments.map((payment) => ({
      ...payment,
      requested_amount: Number(payment.requested_amount),
    })),
  };
};
export const executeMandate = (mandate: IntentMandate) =>
  request<AuditLogEvent>('/api/v1/accord/transact', {
    method: 'POST',
    body: JSON.stringify(mandate),
  });
