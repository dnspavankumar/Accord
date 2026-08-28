import React, { useState } from 'react';
import { login, register } from '../api';

export const AuthScreen: React.FC<{ onAuthenticated: (token: string) => void }> = ({ onAuthenticated }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const result = isRegistering ? await register(name, email, password, merchantName) : await login(email, password);
      localStorage.setItem('accord_access_token', result.access_token);
      onAuthenticated(result.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to authenticate.');
    } finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
    <form onSubmit={submit} className="w-full max-w-md bg-white border border-zinc-200 p-8 space-y-5">
      <div className="border-b border-zinc-200 pb-4"><div className="font-pixel text-sm tracking-widest text-zinc-900">ACCORD</div><h1 className="font-sans text-xl font-bold tracking-tight text-zinc-900 mt-5">{isRegistering ? 'Create merchant account' : 'Sign in to Accord'}</h1><p className="font-sans text-xs text-zinc-500 mt-1">Secure access to your merchant gateway.</p></div>
      {isRegistering && <><label className="block font-sans text-xs font-bold uppercase tracking-wider">Your name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal normal-case tracking-normal" /></label><label className="block font-sans text-xs font-bold uppercase tracking-wider">Merchant name<input required value={merchantName} onChange={(e) => setMerchantName(e.target.value)} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal normal-case tracking-normal" /></label></>}
      <label className="block font-sans text-xs font-bold uppercase tracking-wider">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal normal-case tracking-normal" /></label>
      <label className="block font-sans text-xs font-bold uppercase tracking-wider">Password<input required minLength={isRegistering ? 12 : 1} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-zinc-300 px-3 py-2 text-sm font-normal normal-case tracking-normal" />{isRegistering && <span className="block mt-1 text-[10px] font-normal normal-case tracking-normal text-zinc-500">Use at least 12 characters.</span>}</label>
      {error && <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <button disabled={busy} className="w-full bg-zinc-900 text-white font-sans text-xs font-bold uppercase tracking-wider px-4 py-3 disabled:opacity-50">{busy ? 'PLEASE WAIT...' : isRegistering ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
      <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(null); }} className="w-full font-sans text-xs text-zinc-500 hover:text-zinc-900 underline">{isRegistering ? 'Already have an account? Sign in' : 'Create a merchant account'}</button>
    </form>
  </div>;
};

export default AuthScreen;
