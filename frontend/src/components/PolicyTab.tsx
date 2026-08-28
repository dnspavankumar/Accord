'use client';

import React, { useState } from 'react';
import { GuardrailPolicy } from '../types/accord';
import { updatePolicy } from '../api';

interface PolicyTabProps {
  policy: GuardrailPolicy;
  onSavePolicy: (updated: GuardrailPolicy) => void;
}

export const PolicyTab: React.FC<PolicyTabProps> = ({ policy, onSavePolicy }) => {
  const [formData, setFormData] = useState<GuardrailPolicy>({ ...policy });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const saved = await updatePolicy(formData);
      setFormData(saved);
      onSavePolicy(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveSuccess(false);
      setSaveError(error instanceof Error ? error.message : 'Unable to save policy changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const defaults: GuardrailPolicy = {
      max_transaction_limit_inr: 25000,
      max_item_quantity: 5,
      velocity_limit_per_hour: 30,
    };
    setFormData(defaults);
    setSaveError(null);
    try {
      const saved = await updatePolicy(defaults);
      setFormData(saved);
      onSavePolicy(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to reset policy changes.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
          Guardrail Policy Manifest & Gate Configurations
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* POLICY_01: FINANCIAL_BOUNDS */}
        <div className="bg-white border border-zinc-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-900">
              POLICY 01: FINANCIAL BOUNDS
            </span>
            <span className="font-sans text-[11px] font-semibold text-zinc-400">
              HARD CAP GATE
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-sans text-sm font-semibold text-zinc-900">
                Max Single-Transaction Amount (INR)
              </label>
              <span className="font-sans text-lg font-bold text-zinc-900 tabular-nums">
                ₹{formData.max_transaction_limit_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <p className="font-sans text-xs text-zinc-500">
              Any buyer agent attempting an AP2 checkout exceeding this threshold is immediately gated
              and rejected with <span className="text-zinc-800 font-bold">REJECTED_CAP</span>.
            </p>

            <div className="space-y-2">
              <input
                type="range"
                min={1000}
                max={100000}
                step={500}
                value={formData.max_transaction_limit_inr}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    max_transaction_limit_inr: Number(e.target.value),
                  }))
                }
                className="w-full accent-zinc-900 cursor-pointer"
              />
              <div className="flex justify-between font-sans text-[10px] text-zinc-400 font-semibold">
                <span>MIN: ₹1,000</span>
                <span>DEFAULT: ₹25,000</span>
                <span>MAX: ₹100,000</span>
              </div>
            </div>

            <div className="pt-2">
              <input
                type="number"
                min={500}
                max={500000}
                value={formData.max_transaction_limit_inr}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    max_transaction_limit_inr: Math.max(0, Number(e.target.value)),
                  }))
                }
                className="w-full font-sans text-xs text-zinc-900 border border-zinc-200 px-3 py-2 rounded-none focus:outline-none focus:border-zinc-900 bg-white tabular-nums font-medium"
              />
            </div>
          </div>
        </div>

        {/* POLICY_02: CART_SAFEGUARDS */}
        <div className="bg-white border border-zinc-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-900">
              POLICY 02: CART SAFEGUARDS
            </span>
            <span className="font-sans text-[11px] font-semibold text-zinc-400">
              ITEM CAP GATE
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-sans text-sm font-semibold text-zinc-900">
                Max Quantity per Item Mandate
              </label>
              <span className="font-sans text-lg font-bold text-zinc-900 tabular-nums">
                {formData.max_item_quantity} UNITS
              </span>
            </div>

            <p className="font-sans text-xs text-zinc-500">
              Restricts hoarding and inventory drainage attacks from automated agent purchasing loops.
            </p>

            <div className="space-y-2">
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={formData.max_item_quantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    max_item_quantity: Number(e.target.value),
                  }))
                }
                className="w-full accent-zinc-900 cursor-pointer"
              />
              <div className="flex justify-between font-sans text-[10px] text-zinc-400 font-semibold">
                <span>1 UNIT</span>
                <span>DEFAULT: 5 UNITS</span>
                <span>50 UNITS</span>
              </div>
            </div>

            <div className="pt-2">
              <input
                type="number"
                min={1}
                max={100}
                value={formData.max_item_quantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    max_item_quantity: Math.max(1, Number(e.target.value)),
                  }))
                }
                className="w-full font-sans text-xs text-zinc-900 border border-zinc-200 px-3 py-2 rounded-none focus:outline-none focus:border-zinc-900 bg-white tabular-nums font-medium"
              />
            </div>
          </div>
        </div>

        {/* POLICY_03: VELOCITY_RULES */}
        <div className="bg-white border border-zinc-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-900">
              POLICY 03: VELOCITY RULES
            </span>
            <span className="font-sans text-[11px] font-semibold text-zinc-400">
              RATE LIMIT GATE
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-sans text-sm font-semibold text-zinc-900">
                Hourly Agent Mandate Velocity Limit
              </label>
              <span className="font-sans text-lg font-bold text-zinc-900 tabular-nums">
                {formData.velocity_limit_per_hour} REQ / HR
              </span>
            </div>

            <p className="font-sans text-xs text-zinc-500">
              Maximum cryptographic intent invocations allowed per buyer agent public key in any
              rolling 60-minute window. Triggers <span className="text-zinc-800 font-bold">REJECTED_VELOCITY</span> when violated.
            </p>

            <div className="space-y-2">
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={formData.velocity_limit_per_hour}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    velocity_limit_per_hour: Number(e.target.value),
                  }))
                }
                className="w-full accent-zinc-900 cursor-pointer"
              />
              <div className="flex justify-between font-sans text-[10px] text-zinc-400 font-semibold">
                <span>5 REQ/HR</span>
                <span>DEFAULT: 30 REQ/HR</span>
                <span>200 REQ/HR</span>
              </div>
            </div>

            <div className="pt-2">
              <input
                type="number"
                min={1}
                max={500}
                value={formData.velocity_limit_per_hour}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    velocity_limit_per_hour: Math.max(1, Number(e.target.value)),
                  }))
                }
                className="w-full font-sans text-xs text-zinc-900 border border-zinc-200 px-3 py-2 rounded-none focus:outline-none focus:border-zinc-900 bg-white tabular-nums font-medium"
              />
            </div>
          </div>
        </div>

        {/* Status notification */}
        {saveSuccess && (
          <div className="bg-zinc-900 text-white font-sans text-xs p-3.5 border border-black flex items-center justify-between font-medium">
            <span>✓ POLICY MANIFEST DEPLOYED: GATE PARAMETERS ACTIVE ON ALL RAZORPAY RAILS</span>
            <span className="text-[10px] text-zinc-400 font-semibold">HOT RELOAD OK</span>
          </div>
        )}
        {saveError && (
          <div className="bg-rose-50 text-rose-700 font-sans text-xs p-3.5 border border-rose-300">
            POLICY SAVE FAILED: {saveError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="font-sans text-xs text-zinc-500 hover:text-zinc-900 underline uppercase tracking-wider font-semibold transition-colors"
          >
            RESET PROTOCOL DEFAULTS
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="bg-zinc-900 text-white font-sans text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-none hover:bg-black transition-colors"
          >
            {isSaving ? 'SAVING POLICY...' : 'SAVE POLICY CHANGES'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PolicyTab;
