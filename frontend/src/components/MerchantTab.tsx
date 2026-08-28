import React, { useEffect, useState } from 'react';
import { getMerchantDashboard } from '../api';
import { AuditLogEvent, MerchantDashboard } from '../types/accord';

export const MerchantTab: React.FC = () => {
  const [dashboard, setDashboard] = useState<MerchantDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMerchantDashboard().then(setDashboard).catch((reason: Error) => setError(reason.message));
  }, []);

  const formatAmount = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const formatDate = (timestamp: string) => new Date(timestamp).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">Merchant Payments Dashboard</h1>
        <p className="font-sans text-xs text-zinc-500 mt-1">Payments received through the Accord merchant gateway.</p>
      </div>

      {error && <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">Unable to load merchant payments: {error}</div>}
      {!dashboard && !error && <div className="bg-white border border-zinc-200 p-6 text-xs text-zinc-500">Loading payment records...</div>}

      {dashboard && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Metric label="RECEIVED AMOUNT (INR)" value={formatAmount(dashboard.received_amount)} detail="successful merchant payments" />
            <Metric label="RECEIVED PAYMENTS" value={String(dashboard.received_payment_count)} detail="settled payment records" />
            <Metric label="RECOVERED PAYMENTS" value={String(dashboard.recovered_payment_count)} detail="completed through recovery rail" />
          </div>

          <div className="bg-white border border-zinc-200">
            <div className="px-6 py-4 border-b border-zinc-200 font-sans text-xs font-bold uppercase tracking-wider text-zinc-900">RECENT RECEIVED PAYMENTS</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead><tr className="border-b border-zinc-200 bg-[#fafafa]">
                  {['DATE', 'TRANSACTION', 'BUYER AGENT', 'PAYMENT ID', 'AMOUNT (INR)', 'STATUS'].map((heading) => <th key={heading} className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3 whitespace-nowrap">{heading}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-zinc-200">
                  {dashboard.payments.map((payment) => <PaymentRow key={payment.transaction_id} payment={payment} formatAmount={formatAmount} formatDate={formatDate} />)}
                  {!dashboard.payments.length && <tr><td colSpan={6} className="px-6 py-8 text-center font-sans text-xs text-zinc-500">No payments received yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <div className="bg-white border border-zinc-200 p-5">
    <div className="font-sans text-xs text-zinc-400 tracking-wider font-semibold uppercase mb-2">{label}</div>
    <div className="font-sans text-3xl font-bold text-zinc-900 tabular-nums break-words">{value}</div>
    <div className="font-sans text-[11px] text-zinc-500 mt-2">{detail}</div>
  </div>
);

const PaymentRow: React.FC<{ payment: AuditLogEvent; formatAmount: (amount: number) => string; formatDate: (date: string) => string }> = ({ payment, formatAmount, formatDate }) => (
  <tr className="hover:bg-zinc-50/70 transition-colors">
    <td className="font-sans text-xs text-zinc-500 px-6 py-3.5 whitespace-nowrap">{formatDate(payment.timestamp)}</td>
    <td className="font-sans text-xs text-zinc-900 font-semibold px-6 py-3.5 whitespace-nowrap">{payment.transaction_id}</td>
    <td className="font-sans text-xs text-zinc-700 px-6 py-3.5 whitespace-nowrap">{payment.buyer_agent_id}</td>
    <td className="font-sans text-xs text-zinc-500 px-6 py-3.5 whitespace-nowrap">{payment.razorpay_payment_id}</td>
    <td className="font-sans text-xs text-zinc-900 font-bold px-6 py-3.5 whitespace-nowrap tabular-nums">{formatAmount(payment.requested_amount)}</td>
    <td className="px-6 py-3.5 whitespace-nowrap"><span className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-sans text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm">{payment.execution_status === 'FAILED_RECOVERED' ? 'RECOVERED' : 'RECEIVED'}</span></td>
  </tr>
);

export default MerchantTab;
