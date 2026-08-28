# Accord — Open Protocol Engine & Guardrail Gateway for Autonomous Agent-to-Merchant Commerce

## 1. Overview

**Accord** is a high-trust protocol bridge and policy-gated execution gateway designed to make e-commerce merchants directly transactable by AI buyer agents.

Operating on top of modern agentic commerce standards such as **AP2 / UAP** and **Razorpay** payment infrastructure, Accord exposes machine-readable product catalogs and executes headless, cryptographically audited transactions under strict, deterministic financial guardrails.

---

## 2. System Overview

Traditional storefronts rely on visual GUIs designed for human interaction. Accord translates standard merchant inventories into agent-readable standards while acting as a security proxy between incoming AI purchase requests and financial execution.

```text
┌─────────────────┐
│  AI Buyer Agent │
└────────┬────────┘
         │
         │ AP2 Intent Mandate
         ▼
┌──────────────────────────────────┐
│         ACCORD ENGINE            │
│                                  │
│  1. Catalog Resolver              │
│  2. Policy Evaluator              │
│  3. Financial Ledger              │
└──────────────┬───────────────────┘
               │
               │ Razorpay API
               │ Tokenized Payment
               ▼
┌──────────────────────────────────┐
│       Razorpay Test Gateway      │
└──────────────────────────────────┘
```

---

## 3. Core Capabilities

### AP2-Compliant Catalog Endpoints

Dynamically transforms inventory data into JSON-LD catalog schemas optimized for:

* LLM semantic search
* Stock verification
* Programmatic cart assembly

### Bounded Financial Execution

Evaluates incoming purchase intents against hard-coded merchant and buyer policies **before any API call reaches the financial rails**.

### Headless Razorpay Integration

Manages:

* Tokenized order creation
* `/orders` API interaction
* Payment authorization
* Webhook processing
* Signature verification

All without requiring human interaction with a payment GUI.

### Graceful Failure & Retry Engine

Automatically intercepts:

* Payment declines
* Invalid card tokens
* Parameter mismatches

The engine executes deterministic recovery paths when permitted by policy or returns a structured, audit-logged error state.

### Cryptographic Audit Trail

Logs every state transition, from initial catalog discovery through payment settlement, providing a cryptographically verifiable and explainable record of money movement.

---

## 4. Architecture & Technology Stack

| Component                  | Technology             | Responsibility                                                    |
| -------------------------- | ---------------------- | ----------------------------------------------------------------- |
| Protocol & API Server      | FastAPI (Python 3.11+) | AP2 JSON-LD endpoints, webhook listeners, SSE telemetry           |
| Execution & Guard Agent    | PydanticAI / LangGraph | Structured mandate parsing, policy verification, state management |
| Payment Adapter            | Razorpay Python SDK    | Order generation, test tokenization, signature verification       |
| Audit Ledger & Persistence | PostgreSQL / SQLite    | Cryptographically hashed event logs and state storage             |
| Merchant Telemetry UI      | Next.js, Tailwind CSS  | Live visualization of agent-to-agent transactions and logs        |

---

## 5. Transaction Lifecycle

### 5.1 Catalog Discovery

The buyer agent queries:

```text
GET /api/v1/ap2/catalog
```

Accord returns a structured, machine-readable representation of products, pricing, availability, and inventory thresholds.

### 5.2 Mandate Submission

The buyer submits an AP2 Intent Mandate containing:

* Target item SKU
* Quantity
* Authorized spending cap
* Currency
* Payment token
* Buyer agent identity

Endpoint:

```text
POST /api/v1/accord/transact
```

### 5.3 Guardrail Evaluation

Accord performs deterministic policy checks before interacting with Razorpay.

These checks include:

* Transaction value limits
* Item quantity limits
* Currency restrictions
* Signed-intent requirements
* Buyer-agent velocity limits
* Category authorization

### 5.4 Razorpay Order Creation

If the mandate passes all applicable policies, Accord invokes the Razorpay API to create an order.

```text
razorpay.Order.create(...)
```

The resulting order ID becomes part of the transaction's audit trail.

### 5.5 Payment Authorization

The execution layer attempts payment authorization using the permitted payment token against the Razorpay test environment.

### 5.6 Exception Handling & Settlement

If the payment succeeds:

```text
INITIATED → GATED → EXECUTED
```

If the payment fails, Accord evaluates whether a policy-permitted retry is possible.

A recoverable failure may transition to:

```text
FAILED_RECOVERED
```

Otherwise, the transaction terminates with:

```text
FAILED_TERMINATED
```

Every transition is recorded in the audit ledger.

---

## 6. Security & Guardrail Specifications

Accord enforces deterministic execution boundaries. Any financial request that violates a configured policy is rejected **before the payment gateway is invoked**.

### Default Merchant Policy

```json
{
  "policy_id": "pol_merchant_default",
  "rules": {
    "max_transaction_value_inr": 10000.00,
    "max_item_quantity_per_order": 5,
    "allowed_currency": "INR",
    "require_signed_intent": true,
    "velocity_limit": {
      "max_requests_per_buyer_agent": 10,
      "time_window_seconds": 3600
    }
  }
}
```

---

## 7. Protocol Data Models

### 7.1 AP2 Catalog Endpoint

**Endpoint:**

```text
GET /api/v1/ap2/catalog
```

**Example response:**

```json
{
  "@context": "https://schema.org/",
  "@type": "DataFeed",
  "dataFeedElement": [
    {
      "@type": "Product",
      "sku": "SKU-SERVO-01",
      "name": "Industrial Servo Motor",
      "offers": {
        "@type": "Offer",
        "price": "4500.00",
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock"
      }
    }
  ]
}
```

### 7.2 Intent Mandate Payload

**Endpoint:**

```text
POST /api/v1/accord/transact
```

**Example request:**

```json
{
  "protocol_version": "AP2-2026",
  "buyer_agent_id": "agent_buyer_99x",
  "cart": [
    {
      "sku": "SKU-SERVO-01",
      "quantity": 1,
      "unit_price": 4500.00
    }
  ],
  "max_authorized_amount": 5000.00,
  "currency": "INR",
  "payment_method": {
    "provider": "razorpay_test",
    "token": "tok_test_card_success"
  }
}
```

---

## 8. Audit Ledger Schema

Every financial interaction produces an immutable state record.

| Field                 | Type   | Description                                                               |
| --------------------- | ------ | ------------------------------------------------------------------------- |
| `transaction_id`      | UUID   | Unique identifier for the transaction session                             |
| `buyer_id`            | String | ID of the external agent initiating the trade                             |
| `intent_hash`         | String | SHA-256 hash of the incoming AP2 Mandate                                  |
| `policy_result`       | Enum   | `PASSED`, `REJECTED_CAP_EXCEEDED`, `REJECTED_VELOCITY`                    |
| `razorpay_order_id`   | String | Razorpay order reference (`order_...`)                                    |
| `razorpay_payment_id` | String | Tokenized payment execution ID (`pay_...`)                                |
| `status`              | Enum   | `INITIATED`, `GATED`, `EXECUTED`, `FAILED_RECOVERED`, `FAILED_TERMINATED` |

---

## 9. End-to-End Architecture

```text
                 ┌──────────────────────┐
                 │    AI Buyer Agent    │
                 └──────────┬───────────┘
                            │
                     AP2 / UAP Intent
                            │
                            ▼
                 ┌──────────────────────┐
                 │   Accord API Layer   │
                 │       FastAPI        │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌─────────────┐
      │  Catalog   │ │   Policy   │ │    Audit    │
      │  Resolver  │ │  Evaluator │ │    Ledger   │
      └────────────┘ └─────┬──────┘ └─────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Execution /   │
                    │ Guard Agent   │
                    │ PydanticAI /  │
                    │ LangGraph     │
                    └───────┬───────┘
                            │
                     Policy Approved
                            │
                            ▼
                    ┌───────────────┐
                    │    Razorpay   │
                    │  Test Gateway │
                    └───────┬───────┘
                            │
                            ▼
                    Payment / Webhook
                            │
                            ▼
                    ┌───────────────┐
                    │ Cryptographic │
                    │ Audit Record  │
                    └───────────────┘
```

---

## 10. Local Setup & Quickstart

### Prerequisites

* Python 3.11+
* Razorpay Test Account
* Razorpay Test API keys

### Installation

```bash
git clone https://github.com/your-org/accord.git
cd accord

python -m venv venv
source venv/bin/activate

# Windows:
# venv\Scripts\activate

pip install -r requirements.txt
```

### Configure Environment Variables

Create a `.env` file in the project root:

```env
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_key_secret"
ENVIRONMENT="development"
DATABASE_URL="sqlite:///./accord_ledger.db"
```

### Run Accord Protocol Server

```bash
uvicorn app.main:app --reload --port 8000
```

### Verify the Protocol Endpoint

Once the server is running, access:

```text
GET http://localhost:8000/api/v1/ap2/catalog
```

The endpoint should return the machine-readable AP2 catalog.

---

## 11. Design Principles

Accord is built around four core principles:

1. **Agent-native commerce** — merchants become directly discoverable and transactable by autonomous buyer agents.
2. **Policy before payment** — every transaction is evaluated against deterministic financial guardrails before reaching the payment gateway.
3. **Cryptographic accountability** — every meaningful state transition is recorded and auditable.
4. **Deterministic execution** — autonomous agents operate within explicitly bounded financial and operational permissions.

---

## 12. Summary

Accord provides a secure protocol layer between autonomous AI buyer agents and merchant payment infrastructure.

By combining **AP2/UAP-compatible commerce interfaces**, **deterministic policy enforcement**, **headless Razorpay execution**, and a **cryptographically auditable ledger**, Accord enables autonomous commerce without giving AI agents unrestricted access to financial rails.

## 10. Production Merchant Checkout Workflow

The merchant application supports two payment modes:

1. **AP2 headless execution** for an already-authorized buyer-agent payment token.
2. **Razorpay Checkout** for a human-approved merchant checkout session.

The human-approved flow is:

```text
POST /api/v1/merchant/checkout/prepare
  → validate mandate, policy, price, stock, and inventory reservation
  → create a Razorpay order
  → return checkout options to the frontend

Merchant reviews the order and confirms payment in Razorpay Checkout

POST /api/v1/merchant/checkout/{transaction_id}/confirm
  → verify Razorpay order/payment/signature
  → settle the ledger and keep the payment ID

POST /api/v1/merchant/webhooks/razorpay
  → verify the webhook signature
  → idempotently settle captured payments
```

### Razorpay production configuration

Create `backend/.env` and never commit it:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Use Razorpay test keys until the complete payment and webhook flow has been verified. The local simulation remains available when credentials are absent. The merchant dashboard counts only transactions with a recorded payment ID as received money.

### Production readiness checklist

- [ ] Configure Razorpay test credentials and webhook URL.
- [ ] Verify Checkout signature before marking a transaction settled.
- [ ] Verify webhook signatures and process events idempotently.
- [ ] Use PostgreSQL or another production database instead of local SQLite.
- [ ] Add authentication and merchant tenancy before exposing the API publicly.
- [ ] Configure HTTPS, CORS origins, logging, backups, and payment reconciliation.

## 11. Local MySQL Setup

Accord uses MySQL by default. Start the local server, install the async MySQL driver, create the database/user, then configure the connection:

```bash
sudo service mysql start
cd accord
.venv/bin/pip install -r backend/requirements.txt
chmod +x backend/setup_mysql.sh
ACCORD_DB_PASSWORD='choose-a-local-password' ./backend/setup_mysql.sh
cp backend/.env.example backend/.env
```

Update `backend/.env` with the same password used by `ACCORD_DB_PASSWORD`, then run `./start.sh`. Accord creates its tables and seed catalog automatically in the MySQL `accord` database. The previous SQLite file is intentionally left untouched as a fallback during migration.
# Accord
# Accord
# Accord
# Accord
