import { AuditLogEvent, BackendCatalog, GuardrailPolicy, IntentMandate, MerchantDashboard, Product } from './types/accord';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
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
export const getTransactions = async () =>
  (await request<AuditLogEvent[]>('/api/v1/accord/transactions')).map(mapTransaction);
export const getPolicy = () => request<GuardrailPolicy>('/api/v1/accord/policy');
export const updatePolicy = (policy: GuardrailPolicy) =>
  request<GuardrailPolicy>('/api/v1/accord/policy', { method: 'PUT', body: JSON.stringify(policy) });
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
