'use client';

import React, { useState } from 'react';
import { Product, GuardrailPolicy, AuditLogEvent, MerchantProductInput } from '../types/accord';
import { archiveMerchantProduct, confirmCheckout, createMerchantProduct, draftWithAgent, prepareCheckout, updateMerchantProduct } from '../api';

interface CatalogTabProps {
  products: Product[];
  currentPolicy: GuardrailPolicy;
  onExecuteAgentMandate?: (event: AuditLogEvent) => void;
  onProductsChanged?: () => void;
}

export const CatalogTab: React.FC<CatalogTabProps> = ({
  products,
  currentPolicy,
  onExecuteAgentMandate,
  onProductsChanged,
}) => {
  // Global or per-card toggle mode
  const [viewModes, setViewModes] = useState<Record<string, 'STOREFRONT' | 'JSONLD'>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [testQuantity, setTestQuantity] = useState<number>(1);
  const [testAgentId, setTestAgentId] = useState<string>('agent_0x9b4c_arbitrage_v2');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<AuditLogEvent | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [agentRequest, setAgentRequest] = useState('');
  const [agentDraft, setAgentDraft] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [newProduct, setNewProduct] = useState<MerchantProductInput>({
    sku: '', name: '', description: '', price: 0, stock_quantity: 0, category: '',
  });

  const toggleViewMode = (sku: string) => {
    setViewModes((prev) => ({
      ...prev,
      [sku]: prev[sku] === 'JSONLD' ? 'STOREFRONT' : 'JSONLD',
    }));
  };

  const handleOpenTestModal = (product: Product) => {
    setSelectedProduct(product);
    setTestQuantity(1);
    setExecutionResult(null);
    setExecutionError(null);
  };

  const handleAddProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setProductError(null);
    try {
      if (editingSku) {
        const { sku: _sku, ...editableProduct } = newProduct;
        await updateMerchantProduct(editingSku, editableProduct);
      } else {
        await createMerchantProduct(newProduct);
      }
      setNewProduct({ sku: '', name: '', description: '', price: 0, stock_quantity: 0, category: '' });
      setShowAddProduct(false);
      setEditingSku(null);
      onProductsChanged?.();
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'Unable to create product.');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingSku(product.sku);
    setNewProduct({ sku: product.sku, name: product.name, description: '', price: product.price, stock_quantity: product.stock, category: product.category });
    setProductError(null);
    setShowAddProduct(true);
  };

  const handleArchiveProduct = async (sku: string) => {
    if (!window.confirm(`Archive product ${sku}? It will no longer be available to agents.`)) return;
    try {
      await archiveMerchantProduct(sku);
      onProductsChanged?.();
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'Unable to archive product.');
    }
  };

  const handleAgentDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsDrafting(true); setAgentError(null); setAgentDraft(null);
    try {
      const draft = await draftWithAgent(agentRequest);
      const product = products.find((item) => item.sku === draft.sku);
      if (!product) throw new Error('The suggested product is no longer in this catalog.');
      setSelectedProduct(product);
      setTestQuantity(draft.quantity);
      setAgentDraft(`${draft.product_name} × ${draft.quantity} — ${draft.reason}`);
      setAgentRequest('');
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Unable to reach the local Ollama model.');
    } finally { setIsDrafting(false); }
  };

  const handleRunAgentMandate = async () => {
    if (!selectedProduct) return;
    setIsExecuting(true);
    setExecutionError(null);

    const totalAmount = selectedProduct.price * testQuantity;
    try {
      const checkout = await prepareCheckout({
        protocol_version: 'AP2-2026',
        buyer_agent_id: testAgentId,
        cart: [{ sku: selectedProduct.sku, quantity: testQuantity, unit_price: selectedProduct.price }],
        max_authorized_amount: totalAmount,
        currency: 'INR',
      });
      let result: AuditLogEvent;
      if (checkout.key_id) {
        await loadRazorpayCheckout();
        const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
        if (!Razorpay) throw new Error('Razorpay Checkout could not be loaded.');
        result = await new Promise<AuditLogEvent>((resolve, reject) => {
          const instance = new Razorpay({
            key: checkout.key_id,
            amount: checkout.amount_in_paise,
            currency: checkout.currency,
            name: 'Accord Merchant',
            description: selectedProduct.name,
            order_id: checkout.order_id,
            handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
              try { resolve(await confirmCheckout(checkout.transaction_id, response)); } catch (error) { reject(error); }
            },
            modal: { ondismiss: () => reject(new Error('Payment window was closed before completion.')) },
          });
          instance.open();
        });
      } else {
        result = await confirmCheckout(checkout.transaction_id, {
          razorpay_payment_id: 'pay_simulated_checkout',
          razorpay_signature: 'sig_simulated',
        });
      }
      setExecutionResult(result);
      onExecuteAgentMandate?.(result);
    } catch (error) {
      console.error('Mandate execution failed', error);
      setIsExecuting(false);
      setExecutionError(error instanceof Error ? error.message : 'Mandate execution failed.');
      return;
    }
    const isExceedingCap = totalAmount > currentPolicy.max_transaction_limit_inr;
    const isExceedingQty = testQuantity > currentPolicy.max_item_quantity;
    const isRejected = isExceedingCap || isExceedingQty;

    const txId = `tx_acc_${Math.random().toString(16).slice(2, 10)}`;
    const randomHex = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const intentHash = `0x${randomHex}`;

    let failureReason: string | null = null;
    let policyStatus: 'APPROVED' | 'REJECTED_CAP' | 'REJECTED_VELOCITY' = 'APPROVED';

    if (isExceedingCap) {
      policyStatus = 'REJECTED_CAP';
      failureReason = `POLICY_VIOLATION: Amount ₹${totalAmount.toLocaleString('en-IN')} exceeds limit of ₹${currentPolicy.max_transaction_limit_inr.toLocaleString('en-IN')}`;
    } else if (isExceedingQty) {
      policyStatus = 'REJECTED_CAP';
      failureReason = `POLICY_VIOLATION: Quantity ${testQuantity} exceeds item limit of ${currentPolicy.max_item_quantity}`;
    }

    const eventResult: AuditLogEvent = {
      transaction_id: txId,
      timestamp: new Date().toISOString(),
      buyer_agent_id: testAgentId,
      intent_hash: intentHash,
      requested_amount: totalAmount,
      policy_status: policyStatus,
      execution_status: isRejected ? 'GATED' : 'SETTLED',
      razorpay_order_id: isRejected
        ? null
        : `order_RPZ_${Math.floor(10000000 + Math.random() * 90000000)}`,
      razorpay_payment_id: isRejected
        ? null
        : `pay_RPZ_${Math.floor(10000000 + Math.random() * 90000000)}`,
      failure_reason: failureReason,
      ap2_mandate: {
        protocol_version: 'AP2/1.0',
        mandate_id: `mnd_${Math.floor(100000 + Math.random() * 900000)}`,
        agent_public_key: `ed25519:${Math.random().toString(36).substring(2, 20)}`,
        signature_algorithm: 'Ed25519-SHA256',
        intent_spec: {
          action: 'PURCHASE_ORDER',
          item_sku: selectedProduct.sku,
          item_name: selectedProduct.name,
          quantity: testQuantity,
          max_unit_price: selectedProduct.price,
          currency: 'INR',
        },
      },
      razorpay_payload: isRejected
        ? undefined
        : {
            amount_in_paise: totalAmount * 100,
            currency: 'INR',
            receipt: `rcpt_accord_${txId.replace('tx_acc_', '')}`,
            notes: {
              agent_id: testAgentId,
              protocol: 'AP2_M2M_GATEWAY',
              intent_hash: intentHash,
            },
          },
    };

    setTimeout(() => {
      setIsExecuting(false);
      setExecutionResult(eventResult);
      if (onExecuteAgentMandate) {
        onExecuteAgentMandate(eventResult);
      }
    }, 600);
  };

  const loadRazorpayCheckout = () => new Promise<void>((resolve, reject) => {
    if ((window as Window & { Razorpay?: unknown }).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
            AP2 Catalog & Machine-to-Machine Intent Registry
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs font-semibold text-zinc-600 border border-zinc-200 px-3 py-1.5 bg-white tracking-wide">
            ACTIVE GUARDRAIL: MAX ₹{currentPolicy.max_transaction_limit_inr.toLocaleString('en-IN')} / TX
          </span>
          <button onClick={() => { setProductError(null); setEditingSku(null); setShowAddProduct(true); }} className="bg-zinc-900 text-white font-sans text-xs font-bold tracking-wider uppercase px-3 py-2">ADD PRODUCT</button>
        </div>
      </div>

      {productError && <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{productError}</div>}

      <form onSubmit={handleAgentDraft} className="border border-zinc-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-900">ASK LOCAL QWEN TO FIND A PRODUCT</span>
          <span className="font-sans text-[10px] uppercase tracking-wider text-zinc-400">DRAFT ONLY · NO PAYMENT</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input required minLength={2} value={agentRequest} onChange={(e) => setAgentRequest(e.target.value)} placeholder="e.g. I need one motor for testing" className="flex-1 border border-zinc-300 px-3 py-2 text-sm font-sans" />
          <button disabled={isDrafting} className="bg-zinc-900 text-white font-sans text-xs font-bold uppercase tracking-wider px-4 py-2 disabled:opacity-50">{isDrafting ? 'ASKING QWEN...' : 'ASK QWEN'}</button>
        </div>
        {agentDraft && <div className="border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">DRAFT READY: {agentDraft}. Review the checkout modal before paying.</div>}
        {agentError && <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{agentError}</div>}
      </form>

      {showAddProduct && (
        <form onSubmit={handleAddProduct} className="bg-white border border-zinc-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3"><span className="font-sans text-xs font-bold uppercase tracking-wider">{editingSku ? 'EDIT MERCHANT PRODUCT' : 'ADD MERCHANT PRODUCT'}</span><button type="button" onClick={() => { setShowAddProduct(false); setEditingSku(null); }} className="font-sans text-xs uppercase text-zinc-500">CLOSE</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([['sku', 'SKU'], ['name', 'PRODUCT NAME'], ['category', 'CATEGORY']] as const).map(([field, label]) => <label key={field} className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">{label}<input required readOnly={field === 'sku' && Boolean(editingSku)} value={newProduct[field]} onChange={(e) => setNewProduct((current) => ({ ...current, [field]: e.target.value }))} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal normal-case tracking-normal read-only:bg-zinc-50" /></label>)}
            <label className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">PRICE (INR)<input required type="number" min="0.01" step="0.01" value={newProduct.price || ''} onChange={(e) => setNewProduct((current) => ({ ...current, price: Number(e.target.value) }))} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal tracking-normal" /></label>
            <label className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">STOCK<input required type="number" min="0" value={newProduct.stock_quantity} onChange={(e) => setNewProduct((current) => ({ ...current, stock_quantity: Number(e.target.value) }))} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal tracking-normal" /></label>
            <label className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-700 sm:col-span-2 lg:col-span-3">DESCRIPTION<input value={newProduct.description} onChange={(e) => setNewProduct((current) => ({ ...current, description: e.target.value }))} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal normal-case tracking-normal" /></label>
          </div>
          <button type="submit" className="bg-zinc-900 text-white font-sans text-xs font-bold uppercase tracking-wider px-5 py-2.5">{editingSku ? 'SAVE PRODUCT' : 'CREATE PRODUCT'}</button>
        </form>
      )}

      {/* 3-Column Grid of White Cards with Thin Black Borders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const currentMode = viewModes[product.sku] || 'STOREFRONT';
          const isJsonLd = currentMode === 'JSONLD';

          return (
            <div
              key={product.sku}
              className="bg-white border border-zinc-200 p-6 flex flex-col justify-between space-y-4"
            >
              {/* Top Meta & Toggle */}
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                  <span className="font-sans text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                    {product.category}
                  </span>
                  <button
                    onClick={() => toggleViewMode(product.sku)}
                    className="font-sans text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 underline uppercase tracking-wider transition-colors"
                  >
                    {isJsonLd ? 'STOREFRONT VIEW' : 'AP2 JSON-LD'}
                  </button>
                </div>

                {/* Main Content Area: Storefront View vs AP2 JSON-LD */}
                {!isJsonLd ? (
                  <div className="space-y-4">
                    <h3 className="font-sans font-bold text-zinc-900 text-base leading-snug">
                      {product.name}
                    </h3>
                    
                    <div className="space-y-2 border-t border-zinc-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs text-zinc-400 font-medium">SKU</span>
                        <span className="font-sans text-xs text-zinc-700 font-bold">{product.sku}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs text-zinc-400 font-medium">PRICE</span>
                        <span className="font-sans text-sm text-zinc-900 font-bold tabular-nums">
                          ₹{product.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs text-zinc-400 font-medium">IN STOCK</span>
                        <span className="font-sans text-xs text-zinc-600 font-medium">{product.stock} units</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                        @context: "https://schema.org/"
                      </span>
                    </div>
                    {/* Sans-serif code box */}
                    <pre className="bg-zinc-950 text-zinc-200 font-sans text-[11px] p-3 rounded-none overflow-x-auto max-h-56 leading-relaxed border border-zinc-800 font-normal">
                      {JSON.stringify(product.ap2_jsonld, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleOpenTestModal(product)}
                  className="bg-zinc-900 hover:bg-black text-white font-sans text-xs font-bold tracking-wider uppercase px-4 py-2.5 w-full rounded-none transition-colors"
                >
                  TEST AGENT MANDATE
                </button>
                <button onClick={() => handleEditProduct(product)} className="mt-2 w-full border border-zinc-300 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 font-sans text-[10px] font-bold tracking-wider uppercase px-4 py-2">EDIT PRODUCT</button>
                <button onClick={() => handleArchiveProduct(product.sku)} className="mt-2 w-full border border-zinc-300 text-zinc-600 hover:border-rose-400 hover:text-rose-700 font-sans text-[10px] font-bold tracking-wider uppercase px-4 py-2">ARCHIVE PRODUCT</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Mandate Simulation Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-900 max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <span className="font-sans font-bold text-xs uppercase tracking-widest text-zinc-900">
                AP2 MANDATE EMULATOR: {selectedProduct.sku}
              </span>
              <button
                onClick={() => setSelectedProduct(null)}
                className="font-sans text-xs font-semibold text-zinc-500 hover:text-zinc-900 uppercase"
              >
                CLOSE
              </button>
            </div>

            <div className="space-y-4 font-sans text-xs">
              <div>
                <label className="text-zinc-500 font-semibold block mb-1">TARGET ITEM</label>
                <div className="font-sans font-bold text-zinc-900 text-sm">
                  {selectedProduct.name}
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-medium">
                  Unit Price: ₹{selectedProduct.price.toLocaleString('en-IN')} INR
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 font-semibold block mb-1">BUYER AGENT ID</label>
                  <select
                    value={testAgentId}
                    onChange={(e) => setTestAgentId(e.target.value)}
                    className="w-full bg-white border border-zinc-200 p-2 font-sans text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none"
                  >
                    <option value="agent_0x9b4c_arbitrage_v2">agent_0x9b4c_arbitrage_v2</option>
                    <option value="agent_autonomous_trader_09">agent_autonomous_trader_09</option>
                    <option value="agent_deepseek_orch_2">agent_deepseek_orch_2</option>
                    <option value="agent_synth_finops_01">agent_synth_finops_01</option>
                    <option value="agent_crypto_sentinel_x">agent_crypto_sentinel_x</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 font-semibold block mb-1">PURCHASE QUANTITY</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={testQuantity}
                    onChange={(e) => setTestQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-zinc-200 p-2 font-sans text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none tabular-nums"
                  />
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">ESTIMATED MANDATE TOTAL:</span>
                  <span className="font-bold text-zinc-900 tabular-nums">
                    ₹{(selectedProduct.price * testQuantity).toLocaleString('en-IN')} INR
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">POLICY CAP THRESHOLD:</span>
                  <span className="text-zinc-600 font-semibold tabular-nums">
                    ₹{currentPolicy.max_transaction_limit_inr.toLocaleString('en-IN')} INR
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">EXPECTED POLICY OUTCOME:</span>
                  <span
                    className={
                      selectedProduct.price * testQuantity > currentPolicy.max_transaction_limit_inr ||
                      testQuantity > currentPolicy.max_item_quantity
                        ? 'text-rose-600 font-bold'
                        : 'text-emerald-700 font-bold'
                    }
                  >
                    {selectedProduct.price * testQuantity > currentPolicy.max_transaction_limit_inr
                      ? 'WILL BE GATED (EXCEEDS CAP)'
                      : testQuantity > currentPolicy.max_item_quantity
                      ? 'WILL BE GATED (EXCEEDS QTY)'
                      : 'APPROVED (READY FOR RAZORPAY)'}
                  </span>
                </div>
              </div>

              {executionError && (
                <div className="bg-rose-50 text-rose-700 border border-rose-300 p-3 text-[11px]">
                  EXECUTION FAILED: {executionError}
                </div>
              )}

              {executionResult && (
                <div className="bg-zinc-950 text-zinc-100 p-3 border border-zinc-800 space-y-1.5 text-[11px]">
                  <div className="text-zinc-400 font-bold uppercase tracking-wider">
                    EXECUTION AUDIT RECORD GENERATED:
                  </div>
                  <div>TX_ID: {executionResult.transaction_id}</div>
                  <div className="flex items-center gap-2">
                    <span>POLICY_STATUS:</span>
                    <span
                      className={
                        executionResult.policy_status === 'APPROVED'
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      {executionResult.policy_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>EXECUTION_STATUS:</span>
                    <span
                      className={
                        executionResult.execution_status === 'SETTLED'
                          ? 'text-emerald-400 font-bold'
                          : executionResult.execution_status === 'GATED'
                          ? 'text-rose-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {executionResult.execution_status}
                    </span>
                  </div>
                  {executionResult.razorpay_order_id && (
                    <div>RAZORPAY_ORDER: {executionResult.razorpay_order_id}</div>
                  )}
                  {executionResult.failure_reason && (
                    <div className="text-zinc-300 bg-zinc-900 p-1 border border-zinc-700 font-medium">
                      {executionResult.failure_reason}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleRunAgentMandate}
                disabled={isExecuting}
                className="flex-1 bg-zinc-900 hover:bg-black text-white font-sans text-xs font-bold uppercase tracking-wider px-4 py-3 rounded-none transition-colors disabled:opacity-50"
              >
                {isExecuting ? 'PREPARING SECURE CHECKOUT...' : 'REVIEW & PAY WITH RAZORPAY'}
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="border border-zinc-300 hover:border-zinc-900 text-zinc-700 font-sans text-xs font-bold uppercase tracking-wider px-4 py-3 rounded-none transition-colors"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogTab;
