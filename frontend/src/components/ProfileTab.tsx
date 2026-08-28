'use client';

import React, { useState } from 'react';
import { UserProfile } from '../types/accord';

interface ProfileTabProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ user, onUpdateUser }) => {
  const [formData, setFormData] = useState<UserProfile>(user);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(formData.public_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
            Operator Profile & Cryptographic Identity
          </h1>
          <p className="font-sans text-xs text-zinc-500 mt-1">
            Manage your gateway identity, contact info, and AP2 buyer agent credentials.
          </p>
        </div>
        {isSaved && (
          <span className="font-sans text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-sm animate-fade-in">
            PROFILE UPDATED SUCCESSFULLY
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-zinc-200 p-6 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <img
                src={formData.avatarUrl}
                alt={formData.name}
                className="w-24 h-24 rounded-full border-2 border-zinc-900 object-cover bg-zinc-100 shadow-sm"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" title="Active Signer" />
            </div>

            <h2 className="font-sans text-lg font-bold text-zinc-900">{formData.name}</h2>
            <p className="font-sans text-xs font-semibold text-zinc-500 mt-0.5">@{formData.username}</p>
            
            <div className="mt-4 pt-4 border-t border-zinc-100 w-full text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Role</span>
                <span className="text-zinc-900 font-semibold">{formData.role}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Organization</span>
                <span className="text-zinc-900 font-semibold">{formData.organization}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Member Since</span>
                <span className="text-zinc-900 font-mono text-[11px]">{formData.created_at}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">AP2 Agent Status</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-sans text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>

          {/* Key Attestation Box */}
          <div className="bg-zinc-950 text-white border border-zinc-800 p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">ED25519 SIGNING KEY</span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="text-[11px] text-zinc-300 hover:text-white underline font-sans"
              >
                {copiedKey ? 'COPIED!' : 'COPY KEY'}
              </button>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded break-all text-[11px] text-zinc-300 leading-relaxed font-mono">
              {formData.public_key}
            </div>
            <div className="text-[11px] text-zinc-500 font-sans">
              AP2 AGENT ID: <span className="text-zinc-300 font-mono">{formData.ap2_agent_id}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white border border-zinc-200 p-6 sm:p-8 space-y-6">
            <h3 className="font-sans text-sm font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-3">
              Operator Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-zinc-300 px-3 py-2 text-sm font-sans text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Username
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-zinc-300 bg-zinc-50 text-zinc-500 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full bg-white border border-zinc-300 px-3 py-2 text-sm font-sans text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-zinc-300 px-3 py-2 text-sm font-sans text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  name="avatarUrl"
                  value={formData.avatarUrl}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-zinc-300 px-3 py-2 text-sm font-sans text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Operator Role
                </label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full bg-white border border-zinc-300 px-3 py-2 text-sm font-sans text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Organization
                </label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  className="w-full bg-white border border-zinc-300 px-3 py-2 text-sm font-sans text-zinc-900 focus:outline-none focus:border-zinc-900 rounded-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
              <button
                type="submit"
                className="bg-zinc-900 text-white hover:bg-zinc-800 font-sans text-xs uppercase tracking-wider font-bold px-6 py-2.5 transition-colors"
              >
                Save Profile Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
