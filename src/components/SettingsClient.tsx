"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SettingsState = {
  openAiConfigured: boolean;
  ingestConfigured: boolean;
  envOverrides: { openai: boolean; ingest: boolean };
  cookieSessionsAvailable: boolean;
};

function randomIngestKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `yap_${hex}`;
}

export default function SettingsClient() {
  const [st, setSt] = useState<SettingsState | null>(null);
  const [openAiKey, setOpenAiKey] = useState("");
  const [ingestKey, setIngestKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = (await res.json()) as SettingsState;
    setSt(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: { openAiKey?: string; ingestKey?: string } = {};
      if (openAiKey.trim()) body.openAiKey = openAiKey.trim();
      if (ingestKey.trim()) body.ingestKey = ingestKey.trim();

      const headers: HeadersInit = { "Content-Type": "application/json" };
      const authRes = await fetch("/api/auth/status", { credentials: "include" });
      const auth = await authRes.json();
      if (!auth.authenticated && auth.ingestConfigured) {
        const ik = window.prompt(
          "Enter current ingest API key to authorize this change:",
        );
        if (!ik?.trim()) {
          setMsg("Save canceled.");
          setBusy(false);
          return;
        }
        headers.Authorization = `Bearer ${ik.trim()}`;
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);

      setOpenAiKey("");
      setIngestKey("");
      setMsg("Saved.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const clearStoredOpenAi = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const authRes = await fetch("/api/auth/status", { credentials: "include" });
      const auth = await authRes.json();
      if (!auth.authenticated && auth.ingestConfigured) {
        const ik = window.prompt("Enter ingest API key to authorize:");
        if (!ik?.trim()) {
          setBusy(false);
          return;
        }
        headers.Authorization = `Bearer ${ik.trim()}`;
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ openAiKey: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg("Cleared stored OpenAI key (env override still applies if set).");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href="/" className="text-sm text-[var(--muted)]">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">API keys</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Keys are stored in the app database (PostgreSQL). Environment variables
        override stored values when set on the host (for example Railway).
      </p>

      {st ? (
        <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
          <li>OpenAI (effective): {st.openAiConfigured ? "yes" : "no"}</li>
          <li>Ingest (effective): {st.ingestConfigured ? "yes" : "no"}</li>
          <li>
            Cookie sign-in:{" "}
            {st.cookieSessionsAvailable ? "enabled" : "needs an app password"}
          </li>
          {st.envOverrides.openai ? (
            <li className="text-amber-300">
              OPENAI_API_KEY is set in the environment — it overrides the stored key.
            </li>
          ) : null}
          {st.envOverrides.ingest ? (
            <li className="text-amber-300">
              INGEST_API_KEY is set in the environment — it overrides the stored key.
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-4 text-[var(--muted)]">Loading…</p>
      )}

      <section className="mt-8 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <label className="text-sm font-medium" htmlFor="oai">
            OpenAI API key
          </label>
          <input
            id="oai"
            type="password"
            autoComplete="off"
            disabled={!!st?.envOverrides.openai}
            className="mt-2 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 disabled:opacity-50"
            placeholder={st?.envOverrides.openai ? "Managed by environment" : "sk-…"}
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="ing">
            App password (ingest key)
          </label>
          <input
            id="ing"
            type="password"
            autoComplete="off"
            disabled={!!st?.envOverrides.ingest}
            className="mt-2 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 disabled:opacity-50"
            placeholder={
              st?.envOverrides.ingest ? "Managed by environment" : "Any secret string"
            }
            value={ingestKey}
            onChange={(e) => setIngestKey(e.target.value)}
          />
          <button
            type="button"
            disabled={!!st?.envOverrides.ingest || busy}
            className="mt-2 text-sm text-[var(--accent)] disabled:opacity-40"
            onClick={() => setIngestKey(randomIngestKey())}
          >
            Generate random ingest key
          </button>
        </div>

        <button
          type="button"
          disabled={busy || (!openAiKey.trim() && !ingestKey.trim())}
          className="w-full min-h-[44px] rounded-lg bg-[var(--accent)] font-medium text-[var(--bg)] disabled:opacity-40"
          onClick={() => void save()}
        >
          Save to database
        </button>

        {!st?.envOverrides.openai ? (
          <button
            type="button"
            disabled={busy}
            className="w-full min-h-[44px] rounded-lg border border-[var(--border)] text-sm disabled:opacity-40"
            onClick={() => void clearStoredOpenAi()}
          >
            Clear stored OpenAI key
          </button>
        ) : null}
      </section>

      {msg ? (
        <p className="mt-4 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
