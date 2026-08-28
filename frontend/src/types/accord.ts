export interface Product {
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  ap2_jsonld: Record<string, unknown>;
}

export interface BackendCatalog {
  dataFeedElement: Array<{
    sku: string;
    name: string;
    description: string;
    price: number | string;
    currency: string;
    stock_quantity: number;
    category: string;
    offers?: Record<string, unknown>;
  }>;
}

export interface IntentMandate {
  protocol_version: 'AP2-2026';
  buyer_agent_id: string;
  cart: Array<{ sku: string; quantity: number; unit_price: number }>;
  max_authorized_amount: number;
  currency: 'INR';
  payment_method: { provider: string; token: string; simulate_failure: boolean };
}

export type PolicyStatus = 'APPROVED' | 'REJECTED_CAP' | 'REJECTED_VELOCITY';

export type ExecutionStatus = 
  | 'INITIATED' 
  | 'GATED' 
  | 'SETTLED' 
  | 'FAILED_RECOVERED' 
  | 'TERMINATED';

export interface AuditLogEvent {
  transaction_id: string;
  timestamp: string;
  buyer_agent_id: string;
  intent_hash: string;
  requested_amount: number;
  policy_status: PolicyStatus | null;
  execution_status: ExecutionStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  failure_reason: string | null;
  // Optional AP2 Mandate payload metadata for inspector view
  ap2_mandate?: {
    protocol_version: string;
    mandate_id: string;
    agent_public_key: string;
    signature_algorithm: string;
    intent_spec: {
      action: string;
      item_sku: string;
      item_name: string;
      quantity: number;
      max_unit_price: number;
      currency: string;
    };
  };
  razorpay_payload?: {
    amount_in_paise: number;
    currency: string;
    receipt: string;
    notes: {
      agent_id: string;
      protocol: string;
      intent_hash: string;
    };
  };
}

export interface MerchantDashboard {
  received_amount: number;
  received_payment_count: number;
  recovered_payment_count: number;
  payments: AuditLogEvent[];
}

export interface GuardrailPolicy {
  max_transaction_limit_inr: number;
  max_item_quantity: number;
  velocity_limit_per_hour: number;
}

export interface UserProfile {
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  role: string;
  organization: string;
  ap2_agent_id: string;
  public_key: string;
  created_at: string;
}

export type TabId = 'overview' | 'transactions' | 'catalog' | 'policy' | 'merchant' | 'profile';
