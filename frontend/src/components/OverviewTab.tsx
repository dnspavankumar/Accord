'use client';

import React from 'react';
import { AuditLogEvent } from '../types/accord';

interface OverviewTabProps {
  events: AuditLogEvent[];
  onSelectTransaction?: (txId: string) => void;
  onNavigateToTransactions?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  events,
  onNavigateToTransactions,
}) => {
  // Computed Top Metrics
  const settledEvents = events.filter((e) => e.execution_status === 'SETTLED');
  const totalSettledInr = settledEvents.reduce((acc, curr) => acc + curr.requested_amount, 0);
  
  const distinctAgents = new Set(events.map((e) => e.buyer_agent_id)).size;
  
  const gateRejections = events.filter(
    (e) => e.execution_status === 'GATED' || e.policy_status.startsWith('REJECTED')
  ).length;

  const railRecoveries = events.filter(
    (e) => e.execution_status === 'FAILED_RECOVERED'
  ).length;

  const recentEvents = events.slice(0, 7);

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

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
          System Telemetry & Protocol Health
        </h1>
      </div>

      {/* Top Metrics Row: 4 border-bordered white cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 p-5">
          <div className="font-sans text-xs text-zinc-400 tracking-wider font-semibold uppercase mb-2">
            TOTAL SETTLED (INR)
          </div>
          <div className="font-sans text-3xl font-bold text-zinc-900 tabular-nums">
            ₹{totalSettledInr.toLocaleString('en-IN')}
          </div>
          <div className="font-sans text-[11px] text-zinc-500 mt-2">
            {settledEvents.length} settled mandates
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5">
          <div className="font-sans text-xs text-zinc-400 tracking-wider font-semibold uppercase mb-2">
            ACTIVE BUYER AGENTS
          </div>
          <div className="font-sans text-3xl font-bold text-zinc-900 tabular-nums">
            {distinctAgents}
          </div>
          <div className="font-sans text-[11px] text-zinc-500 mt-2">
            cryptographically verified
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5">
          <div className="font-sans text-xs text-zinc-400 tracking-wider font-semibold uppercase mb-2">
            GATE REJECTIONS
          </div>
          <div className="font-sans text-3xl font-bold text-zinc-900 tabular-nums">
            {gateRejections}
          </div>
          <div className="font-sans text-[11px] text-zinc-500 mt-2">
            policy cap / velocity triggers
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5">
          <div className="font-sans text-xs text-zinc-400 tracking-wider font-semibold uppercase mb-2">
            RAIL RECOVERIES
          </div>
          <div className="font-sans text-3xl font-bold text-zinc-900 tabular-nums">
            {railRecoveries}
          </div>
          <div className="font-sans text-[11px] text-zinc-500 mt-2">
            idempotent auto-healed
          </div>
        </div>
      </div>

      {/* Recent Activity Table Container */}
      <div className="bg-white border border-zinc-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs font-bold text-zinc-900 uppercase tracking-wider">
              RECENT PROTOCOL ACTIVITY
            </span>
            <span className="font-sans text-[11px] text-zinc-400 font-medium">
              ({recentEvents.length} latest events)
            </span>
          </div>
          {onNavigateToTransactions && (
            <button
              onClick={onNavigateToTransactions}
              className="font-sans text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline uppercase tracking-wider transition-colors"
            >
              VIEW ALL AUDIT LOGS →
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-[#fafafa]">
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
                  INTENT HASH
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3 text-right">
                  AMOUNT (INR)
                </th>
                <th className="font-sans text-xs text-zinc-400 font-semibold uppercase tracking-wider px-6 py-3 text-right">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {recentEvents.map((event) => (
                <tr
                  key={event.transaction_id}
                  className="hover:bg-zinc-50/70 transition-colors"
                >
                  <td className="font-sans text-xs text-zinc-500 px-6 py-3.5 whitespace-nowrap tabular-nums font-medium">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="font-sans text-xs text-zinc-900 font-semibold px-6 py-3.5 whitespace-nowrap">
                    {event.transaction_id}
                  </td>
                  <td className="font-sans text-xs text-zinc-700 px-6 py-3.5 whitespace-nowrap font-medium">
                    {event.buyer_agent_id}
                  </td>
                  <td className="font-sans text-xs text-zinc-500 px-6 py-3.5 whitespace-nowrap">
                    <span title={event.intent_hash}>
                      {event.intent_hash.slice(0, 10)}...{event.intent_hash.slice(-8)}
                    </span>
                  </td>
                  <td className="font-sans text-xs text-zinc-900 font-bold px-6 py-3.5 text-right whitespace-nowrap tabular-nums">
                    ₹{event.requested_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    {renderStatusBadge(event)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
