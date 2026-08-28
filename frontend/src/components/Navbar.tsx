'use client';

import React from 'react';
import { TabId, UserProfile } from '../types/accord';

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  user: UserProfile;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, user }) => {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '01 Overview' },
    { id: 'transactions', label: '02 Transactions' },
    { id: 'catalog', label: '03 Catalog' },
    { id: 'policy', label: '04 Policy Rules' },
    { id: 'merchant', label: '05 Merchant Payments' },
  ];

  return (
    <header className="bg-zinc-950 border-b border-zinc-800 px-8 py-4 w-full text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <svg
            className="w-5 h-5 text-white shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            style={{ imageRendering: 'pixelated' }}
            aria-hidden="true"
          >
            {/* Center Core */}
            <rect x="7" y="7" width="2" height="2" />

            {/* Inner Ring */}
            <rect x="5" y="5" width="2" height="1" />
            <rect x="9" y="5" width="2" height="1" />
            <rect x="5" y="10" width="2" height="1" />
            <rect x="9" y="10" width="2" height="1" />

            {/* Asymmetric Spikes */}
            <rect x="7" y="1" width="2" height="3" />
            <rect x="7" y="12" width="2" height="3" />
            <rect x="1" y="7" width="3" height="2" />
            <rect x="12" y="7" width="3" height="2" />

            {/* Corner Pixel Artifacts */}
            <rect x="2" y="2" width="2" height="2" />
            <rect x="12" y="2" width="2" height="2" />
            <rect x="2" y="12" width="2" height="2" />
            <rect x="12" y="12" width="2" height="1" />
          </svg>
          <span className="font-pixel text-sm tracking-widest text-white select-none">
            ACCORD
          </span>
        </div>

        {/* Center: Tab Navigation */}
        <nav className="flex items-center gap-1 sm:gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-2 px-3.5 transition-colors ${
                  isActive
                    ? 'border-b-2 border-white text-white font-sans text-xs uppercase tracking-wider font-bold'
                    : 'text-zinc-400 font-sans text-xs hover:text-white uppercase tracking-wider font-medium'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Profile Picture and Username */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onTabChange('profile')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-all border ${
              activeTab === 'profile'
                ? 'bg-zinc-900 border-zinc-700 text-white'
                : 'border-transparent hover:border-zinc-800 hover:bg-zinc-900/60 text-zinc-300 hover:text-white'
            }`}
            title="Open Profile Page"
          >
            <div className="relative w-7 h-7 rounded-full overflow-hidden border border-zinc-700 shrink-0 bg-zinc-800 flex items-center justify-center">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-sans text-xs font-bold text-white">
                  {user.name.charAt(0)}
                </span>
              )}
            </div>
            <span className="font-sans text-xs font-semibold tracking-tight hidden sm:inline-block">
              @{user.username}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
