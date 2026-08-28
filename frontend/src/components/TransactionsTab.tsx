'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEvent } from '../types/accord';
import { API_BASE_URL } from '../api';

interface TransactionsTabProps {
  events: AuditLogEvent[];
  onAddEvent?: (newEvent: AuditLogEvent) => void;
}

type FilterType = 'ALL' | 'SETTLED' | 'GATED' | 'RECOVERED';

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  events: initialEvents,
  onAddEvent,
}) => {
  const [events, setEvents] = useState<AuditLogEvent[]>(initialEvents);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync external initial events
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  // Live SSE connection for durable backend audit events.
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let handleEvent: ((event: MessageEvent) => void) | null = null;

    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/accord/telemetry/stream`);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      handleEvent = (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.transaction_id) {
            const event: AuditLogEvent = {
              ...parsed,
              requested_amount: Number(parsed.requested_amount ?? parsed.amount),
            };
            setEvents((prev) => [event, ...prev]);
            if (onAddEvent) onAddEvent(event);
          }
        } catch {
          // ignore non-json ping
        }
      };
      eventSource.addEventListener('audit', handleEvent);

      eventSource.onerror = () => {
        setSseConnected(false);
        if (eventSource) {
          eventSource.close();
        }
        // Do not fabricate events when the backend is unavailable.
        if (false) {
          setInterval(() => {
            const randomAgentId = [
              'agent_0x9b4c_arbitrage_v2',
              'agent_autonomous_trader_09',
              'agent_synth_finops_01',
              'agent_crypto_sentinel_x',
              'agent_deepseek_orch_2',
            ][Math.floor(Math.random() * 5)];

            const randomSku = [
              'SKU-NVIDIA-H100-HR',
              'SKU-INFER-EDGE-DEDICATED',
              'SKU-TOKEN-PACK-100M',
              'SKU-PROXY-RESIDENTIAL-CLUSTER',
            ][Math.floor(Math.random() * 4)];

            const amounts = [3450, 1890, 6900, 8200, 14500, 28000];
            const chosenAmount = amounts[Math.floor(Math.random() * amounts.length)];
            const isGated = chosenAmount > 25000;
            const isRecovered = Math.random() > 0.85;

            const newTxId = `tx_acc_${Math.random().toString(16).slice(2, 10)}`;
            const newHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
            
            const newEvent: AuditLogEvent = {
              transaction_id: newTxId,
              timestamp: new Date().toISOString(),
              buyer_agent_id: randomAgentId,
              intent_hash: newHash,
              requested_amount: chosenAmount,
              policy_status: isGated ? 'REJECTED_CAP' : 'APPROVED',
              execution_status: isGated
                ? 'GATED'
                : isRecovered
                ? 'FAILED_RECOVERED'
                : 'SETTLED',
              razorpay_order_id: isGated ? null : `order_RPZ_${Math.floor(10000000 + Math.random() * 90000000)}`,
              razorpay_payment_id: isGated ? null : `pay_RPZ_${Math.floor(10000000 + Math.random() * 90000000)}`,
              failure_reason: isGated
                ? `POLICY_VIOLATION: Requested amount ₹${chosenAmount.toLocaleString('en-IN')} exceeds threshold.`
                : isRecovered
                ? 'RECOVERY_TRIGGERED: Transient RPC glitch resolved through automatic idempotent replay.'
                : null,
              ap2_mandate: {
                protocol_version: 'AP2/1.0',
                mandate_id: `mnd_${Math.floor(100000 + Math.random() * 900000)}`,
                agent_public_key: `ed25519:${Math.random().toString(36).substring(2, 18)}`,
                signature_algorithm: 'Ed25519-SHA256',
                intent_spec: {
                  action: 'PURCHASE_ORDER',
                  item_sku: randomSku,
                  item_name: 'AP2 Standard Infrastructure Asset',
                  quantity: 1,
                  max_unit_price: chosenAmount + 500,
                  currency: 'INR',
                },
              },
              razorpay_payload: isGated
                ? undefined
                : {
                    amount_in_paise: chosenAmount * 100,
                    currency: 'INR',
                    receipt: `rcpt_accord_${newTxId.replace('tx_acc_', '')}`,
                    notes: {
                      agent_id: randomAgentId,
                      protocol: 'AP2_M2M_GATEWAY',
                      intent_hash: newHash,
                    },
                  },
            };

            setEvents((prev) => [newEvent, ...prev]);
            if (onAddEvent) onAddEvent(newEvent);
          }, 12000);
        }
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (eventSource) {
        if (handleEvent) eventSource.removeEventListener('audit', handleEvent);
        eventSource.close();
      }
    };
  }, [onAddEvent]);

  // Filter & Search
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filter tab
      if (activeFilter === 'SETTLED' && event.execution_status !== 'SETTLED') {
        return false;
      }
      if (
        activeFilter === 'GATED' &&
        event.execution_status !== 'GATED' &&
        !(event.policy_status?.startsWith('REJECTED') ?? false)
      ) {
        return false;
      }
      if (activeFilter === 'RECOVERED' && event.execution_status !== 'FAILED_RECOVERED') {
        return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        event.transaction_id.toLowerCase().includes(q) ||
        event.buyer_agent_id.toLowerCase().includes(q) ||
        event.intent_hash.toLowerCase().includes(q) ||
        (event.razorpay_order_id && event.razorpay_order_id.toLowerCase().includes(q)) ||
        (event.razorpay_payment_id && event.razorpay_payment_id.toLowerCase().includes(q)) ||
        event.requested_amount.toString().includes(q)
      );
    });
  }, [events, activeFilter, searchTerm]);

  const toggleExpand = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const renderStatusBadge = (event: AuditLogEvent) => {
    if (event.execution_status === 'SETTLED') {
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-sans text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm">
          SETTLED
        </span>
      );
    }
    if (
      event.execution_status === 'GATED' ||
      event.policy_status === 'REJECTED_CAP' ||
      event.policy_status === 'REJECTED_VELOCITY'
    ) {
      return (
        <span className="bg-rose-50 text-rose-700 border border-rose-300 font-sans text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm">
          REJECTED
        </span>
      );
    }
    if (event.execution_status === 'FAILED_RECOVERED') {
      return (
        <span className="bg-amber-50 text-amber-800 border border-amber-300 font-sans text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm">
          RECOVERED
        </span>
      );
    }
    return (
      <span className="border border-zinc-300 text-zinc-600 font-sans text-[10px] font-medium px-2 py-0.5 uppercase tracking-wider rounded-sm">
        {event.execution_status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
          AP2 Audit Log & Telemetry Stream
        </h1>
      </div>

      {/* Filter bar & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by TxID, Agent ID, Intent Hash, or Razorpay ID..."
            className="w-full font-sans text-xs text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 px-3 py-2 rounded-none focus:outline-none focus:border-zinc-900 bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 font-sans text-xs text-zinc-400 hover:text-zinc-900 font-semibold"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 border border-zinc-200 bg-white p-1">
          {(['ALL', 'SETTLED', 'GATED', 'RECOVERED'] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`font-sans text-xs px-3 py-1 uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 font-medium'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transactions Table with Expandable Terminal Inspector */}
      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-[#fafafa]">
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3 w-12 text-center">
                  VIEW
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3">
                  TIMESTAMP
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3">
                  TRANSACTION ID
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3">
                  BUYER AGENT
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3">
                  POLICY STATUS
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3 text-right">
                  AMOUNT
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3 text-right">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center font-sans text-xs text-zinc-400 font-medium">
                    NO TRANSACTIONS MATCHING CRITERIA
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const isExpanded = expandedTxId === event.transaction_id;
                  return (
                    <React.Fragment key={event.transaction_id}>
                      <tr
                        onClick={() => toggleExpand(event.transaction_id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-zinc-50 font-medium' : 'hover:bg-zinc-50/70'
                        }`}
                      >
                        <td className="font-sans text-xs text-zinc-400 text-center px-4 py-3.5 select-none font-semibold">
                          {isExpanded ? '▼' : '►'}
                        </td>
                        <td className="font-sans text-xs text-zinc-500 px-6 py-3.5 whitespace-nowrap tabular-nums">
                          {new Date(event.timestamp).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="font-sans text-xs text-zinc-900 font-bold px-6 py-3.5 whitespace-nowrap">
                          {event.transaction_id}
                        </td>
                        <td className="font-sans text-xs text-zinc-700 px-6 py-3.5 whitespace-nowrap font-medium">
                          {event.buyer_agent_id}
                        </td>
                        <td className="font-sans text-xs text-zinc-600 px-6 py-3.5 whitespace-nowrap font-medium">
                          {event.policy_status}
                        </td>
                        <td className="font-sans text-xs text-zinc-900 font-bold px-6 py-3.5 text-right whitespace-nowrap tabular-nums">
                          ₹{event.requested_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          {renderStatusBadge(event)}
                        </td>
                      </tr>

                      {/* Expandable Terminal Inspector Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="bg-zinc-950 text-zinc-100 font-sans text-xs p-5 rounded-none border-t border-zinc-800 space-y-4">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                <span className="text-zinc-400 font-semibold tracking-wider">
                                  RAW AP2 PROTOCOL & TELEMETRY INSPECTOR: {event.transaction_id}
                                </span>
                                <span className="text-zinc-500 text-[11px] font-medium">
                                  ISO_TIME: {event.timestamp}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left: AP2 Mandate Specification */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-zinc-400 font-bold uppercase text-[11px] tracking-wide">
                                      01 AP2 INTENT MANDATE & CRYPTOGRAPHY
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopy(
                                          JSON.stringify(event.ap2_mandate || {}, null, 2),
                                          `mandate_${event.transaction_id}`
                                        );
                                      }}
                                      className="text-[10px] text-zinc-400 hover:text-white uppercase font-semibold tracking-wide border border-zinc-800 px-2 py-0.5 bg-zinc-900"
                                    >
                                      {copiedKey === `mandate_${event.transaction_id}`
                                        ? 'COPIED'
                                        : 'COPY JSON'}
                                    </button>
                                  </div>

                                  <div className="bg-black/60 border border-zinc-800 p-3 space-y-1.5 overflow-x-auto text-[11px]">
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">INTENT_SHA256:</span>
                                      <span className="text-zinc-200 break-all select-all">
                                        {event.intent_hash}
                                      </span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">BUYER_AGENT_ID:</span>
                                      <span className="text-zinc-200">{event.buyer_agent_id}</span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">MANDATE_ID:</span>
                                      <span className="text-zinc-200">
                                        {event.ap2_mandate?.mandate_id || 'mnd_auto_assigned'}
                                      </span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">SIGNATURE_ALGO:</span>
                                      <span className="text-zinc-200">
                                        {event.ap2_mandate?.signature_algorithm || 'Ed25519-SHA256'}
                                      </span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">AGENT_PUBKEY:</span>
                                      <span className="text-zinc-300 break-all">
                                        {event.ap2_mandate?.agent_public_key || 'ed25519:verified_key'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Razorpay Settlement & Policy Diagnostics */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-zinc-400 font-bold uppercase text-[11px] tracking-wide">
                                      02 RAZORPAY RAIL & GATE EVALUATION
                                    </span>
                                    {event.razorpay_payload && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(
                                            JSON.stringify(event.razorpay_payload, null, 2),
                                            `rpz_${event.transaction_id}`
                                          );
                                        }}
                                        className="text-[10px] text-zinc-400 hover:text-white uppercase font-semibold tracking-wide border border-zinc-800 px-2 py-0.5 bg-zinc-900"
                                      >
                                        {copiedKey === `rpz_${event.transaction_id}`
                                          ? 'COPIED'
                                          : 'COPY PAYLOAD'}
                                      </button>
                                    )}
                                  </div>

                                  <div className="bg-black/60 border border-zinc-800 p-3 space-y-1.5 text-[11px]">
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">POLICY_RESULT:</span>
                                      <span
                                        className={
                                          event.policy_status === 'APPROVED'
                                            ? 'text-emerald-400 font-bold'
                                            : 'text-rose-400 font-bold underline'
                                        }
                                      >
                                        {event.policy_status}
                                      </span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">EXECUTION:</span>
                                      <span
                                        className={
                                          event.execution_status === 'SETTLED'
                                            ? 'text-emerald-400 font-semibold'
                                            : event.execution_status === 'GATED'
                                            ? 'text-rose-400 font-semibold'
                                            : event.execution_status === 'FAILED_RECOVERED'
                                            ? 'text-amber-400 font-semibold'
                                            : 'text-zinc-200 font-medium'
                                        }
                                      >
                                        {event.execution_status}
                                      </span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">RAZORPAY_ORDER:</span>
                                      <span className="text-zinc-200">
                                        {event.razorpay_order_id || 'N/A (GATED PRIOR TO CREATION)'}
                                      </span>
                                    </div>
                                    <div className="flex">
                                      <span className="text-zinc-500 w-32 shrink-0 font-medium">RAZORPAY_PAY_ID:</span>
                                      <span className="text-zinc-200">
                                        {event.razorpay_payment_id || 'N/A (UNSETTLED)'}
                                      </span>
                                    </div>
                                    {event.failure_reason && (
                                      <div className="pt-2 border-t border-zinc-800">
                                        <span className="text-zinc-400 block mb-0.5 font-medium">
                                          DIAGNOSTIC_REASON:
                                        </span>
                                        <span className="text-zinc-300 block bg-zinc-900/80 p-1.5 border border-zinc-700">
                                          {event.failure_reason}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionsTab;
