'use client';

import React, { useEffect, useState } from 'react';
import { TabId, AuditLogEvent, GuardrailPolicy, Product, UserProfile } from '../types/accord';
import { Navbar } from '../components/Navbar';
import { OverviewTab } from '../components/OverviewTab';
import { TransactionsTab } from '../components/TransactionsTab';
import { CatalogTab } from '../components/CatalogTab';
import { PolicyTab } from '../components/PolicyTab';
import { ProfileTab } from '../components/ProfileTab';
import { AuthScreen } from '../components/AuthScreen';
import {
  INITIAL_POLICY,
  INITIAL_USER_PROFILE,
} from '../data/mockData';
import { getCatalog, getPolicy, getTransactions, mapCatalog } from '../api';

export default function AccordConsolePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [events, setEvents] = useState<AuditLogEvent[]>([]);
  const [policy, setPolicy] = useState<GuardrailPolicy>(INITIAL_POLICY);
  const [products, setProducts] = useState<Product[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('accord_access_token'));

  useEffect(() => {
    if (!authToken) { setIsLoading(false); return; }
    Promise.all([getCatalog(), getTransactions(), getPolicy()])
      .then(([catalog, transactions, livePolicy]) => {
        setProducts(mapCatalog(catalog));
        setEvents(transactions);
        setPolicy(livePolicy);
        setApiError(null);
      })
      .catch((error: Error) => setApiError(error.message))
      .finally(() => setIsLoading(false));
  }, [authToken]);

  if (!authToken) return <AuthScreen onAuthenticated={setAuthToken} />;

  const handleAddEvent = (newEvent: AuditLogEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
  };

  const handleSavePolicy = (updatedPolicy: GuardrailPolicy) => {
    setPolicy(updatedPolicy);
  };

  const reloadCatalog = () => {
    getCatalog().then((catalog) => setProducts(mapCatalog(catalog))).catch((error: Error) => setApiError(error.message));
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans flex flex-col">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} user={user} />

      {/* Main Page Container */}
      <main className="max-w-7xl mx-auto px-8 py-8 w-full flex-1">
        {apiError && <div className="mb-4 border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">Backend unavailable. Start the API to load live merchant data: {apiError}</div>}
        {isLoading && <div className="mb-4 border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">Connecting to Accord backend...</div>}
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
            onProductsChanged={reloadCatalog}
          />
        )}

        {activeTab === 'policy' && (
          <PolicyTab
            policy={policy}
            onSavePolicy={handleSavePolicy}
          />
        )}

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
