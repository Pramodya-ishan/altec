import React, { useEffect, useState } from "react";
import { Loader2, Lock, Save, Search, Server, ShieldCheck, UserRound, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import type { AppData } from "../../types";

export default function AdminDashboardView() {
  const {
    adminTargetEmail,
    data,
    profile,
    saveData,
    setAdminTargetEmail,
    showNotification,
  } = useApp();
  const [emailInput, setEmailInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);

  const isAdmin = profile?.role === "admin" || profile?.roles?.includes("admin");

  useEffect(() => {
    setJsonInput(adminTargetEmail ? JSON.stringify(data, null, 2) : "");
  }, [adminTargetEmail, data]);

  const handleOpenUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      showNotification("Enter a valid student email address.", "error");
      return;
    }
    setLoadingUser(true);
    try {
      await setAdminTargetEmail(email);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleExitSupportMode = async () => {
    setLoadingUser(true);
    try {
      await setAdminTargetEmail(null);
      setEmailInput("");
    } finally {
      setLoadingUser(false);
    }
  };

  const handleSaveData = () => {
    if (!adminTargetEmail) return;
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("The payload must be a JSON object.");
      }
      saveData(parsed as AppData);
      showNotification(`Audited update queued for ${adminTargetEmail}.`, "success");
    } catch (error: any) {
      showNotification(error?.message || "The JSON payload is invalid.", "error");
    }
  };

  if (!isAdmin) {
    return (
      <section className="mx-auto mt-20 flex h-full max-w-lg flex-col items-center justify-center p-12 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-200 bg-red-100 text-red-600 shadow-sm">
          <Lock className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Access restricted</h1>
        <p className="text-sm font-medium text-slate-600">Administrator privileges are required to open the support console.</p>
      </section>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-20">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-5 pt-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400 bg-indigo-600 text-white shadow">
          <Server className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">System admin console</h1>
          <p className="text-sm font-semibold text-slate-600">Audited student support and retrieval-system maintenance.</p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
        <div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Student support</h2>
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-600">
              Open a specific account by email. Every view and edit uses the protected support API and creates an audit event.
            </p>
            <form className="space-y-3" onSubmit={handleOpenUser}>
              <label className="block text-sm font-bold text-slate-800" htmlFor="support-email">Student email</label>
              <input
                id="support-email"
                type="email"
                autoComplete="off"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="student@example.com"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
              />
              <button
                type="submit"
                disabled={loadingUser}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingUser ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                Open audited support mode
              </button>
            </form>
          </div>
        </div>

        <section className="flex min-h-[600px] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 p-6 shadow-xl">
          {adminTargetEmail ? (
            <>
              <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Audited progress payload</h2>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-300">{adminTargetEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExitSupportMode()}
                    disabled={loadingUser}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-600 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Exit
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveData}
                    className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-emerald-950 hover:bg-emerald-400"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save audited update
                  </button>
                </div>
              </div>
              <label className="sr-only" htmlFor="support-json">Student progress JSON</label>
              <textarea
                id="support-json"
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                className="min-h-[480px] flex-1 resize-none rounded-2xl border border-slate-600 bg-black/30 p-5 font-mono text-xs leading-relaxed text-emerald-300"
                spellCheck={false}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500">
                <UserRound className="h-8 w-8" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-white">No student account open</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                Enter the exact email address in the support panel. The console no longer enumerates or writes Firestore records directly from the browser.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
