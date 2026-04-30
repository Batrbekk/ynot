'use client';

import * as React from 'react';

export function ClaimAccountForm({ orderId, email }: { orderId: string; email?: string }) {
  const [password, setPassword] = React.useState('');
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (done) return (
    <div className="rounded-md bg-green-50 p-4">Account created. You&apos;ll find this order in your account next time you sign in.</div>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch('/api/account/claim', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, password }),
    });
    if (res.ok) { setDone(true); return; }
    const j = await res.json();
    setErr(j.message ?? j.error ?? 'Could not save');
  }

  return (
    <form onSubmit={submit} className="rounded-md border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Save your details</h3>
      <p className="text-sm text-neutral-600">
        Set a password to track this order{email ? ` and find ${email}'s past orders later` : ''}.
      </p>
      <input
        type="password" required minLength={12} value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border rounded px-3 py-2"
        placeholder="Password (12+ characters)"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" className="btn btn-primary w-full">Create account</button>
    </form>
  );
}
