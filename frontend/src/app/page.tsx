'use client';

import React, { useEffect, useState } from 'react';
import { TabId, AuditLogEvent, GuardrailPolicy, Product, UserProfile } from '../types/accord';
import { Navbar } from '../components/Navbar';
import { OverviewTab } from '../components/OverviewTab';
import { TransactionsTab } from '../components/TransactionsTab';
import { CatalogTab } from '../components/CatalogTab';
import { PolicyTab } from '../components/PolicyTab';
import { ProfileTab } from '../components/ProfileTab';
import { MerchantTab } from '../components/MerchantTab';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_PRODUCTS,
  INITIAL_POLICY,
  INITIAL_USER_PROFILE,
} from '../data/mockData';
import { getCatalog, getPolicy, getTransactions, mapCatalog } from '../api';

export default function AccordConsolePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [events, setEvents] = useState<AuditLogEvent[]>(INITIAL_AUDIT_LOGS);
  const [policy, setPolicy] = useState<GuardrailPolicy>(INITIAL_POLICY);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [apiError, setApiError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER_PROFILE);

  useEffect(() => {
    Promise.all([getCatalog(), getTransactions(), getPolicy()])
      .then(([catalog, transactions, livePolicy]) => {
        setProducts(mapCatalog(catalog));
        setEvents(transactions);
        setPolicy(livePolicy);
      })
      .catch((error: Error) => setApiError(error.message));
  }, []);

  const handleAddEvent = (newEvent: AuditLogEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
  };

  const handleSavePolicy = (updatedPolicy: GuardrailPolicy) => {
    setPolicy(updatedPolicy);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans flex flex-col">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} user={user} />

      {/* Main Page Container */}
      <main className="max-w-7xl mx-auto px-8 py-8 w-full flex-1">
        {apiError && <div className="mb-4 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">Backend unavailable; showing local preview data. Start the API to use live catalog and execution.</div>}
        {activeTab === 'overview' && (
          <OverviewTab
            events={events}
            onNavigateToTransactions={() => setActiveTab('transactions')}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTab
            events={events}
            onAddEvent={handleAddEvent}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogTab
            products={products}
            currentPolicy={policy}
            onExecuteAgentMandate={handleAddEvent}
          />
        )}

        {activeTab === 'policy' && (
          <PolicyTab
            policy={policy}
            onSavePolicy={handleSavePolicy}
          />
        )}

        {activeTab === 'merchant' && <MerchantTab />}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onUpdateUser={setUser}
          />
        )}
      </main>
    </div>
  );
}
