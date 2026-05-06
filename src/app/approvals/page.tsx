"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Proposal = {
  id: string;
  transcriptId: string;
  parentFolderId: string | null;
  parentName: string | null;
  segments: string[];
  pendingDocumentCount: number;
  createdAt: string;
};

export default function ApprovalsPage() {
  const [bearer, setBearer] = useState("");
  const [rows, setRows] = useState<Proposal[] | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pending-proposals");
    const data = await res.json();
    setRows(data.proposals as Proposal[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const authHeaders = (): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    const t = bearer.trim();
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  const approve = async (id: string) => {
    setAuthHint(null);
    const res = await fetch("/api/pending-proposals/approve", {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.status === 401) {
      setAuthHint("Unauthorized — sign in on Home or paste Bearer ingest key.");
      return;
    }
    await load();
  };

  const reject = async (id: string) => {
    setAuthHint(null);
    const res = await fetch("/api/pending-proposals/reject", {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.status === 401) {
      setAuthHint("Unauthorized — sign in on Home or paste Bearer ingest key.");
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href="/" className="text-sm text-[var(--muted)]">
        ← Home
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Pending folders</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        New ingests no longer queue folders here; approve legacy rows only,
        or reject them.
      </p>

      <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-xs text-[var(--muted)]">
          Uses your signed-in session from Home. If the server has no{" "}
          <code className="text-[var(--accent)]">AUTH_SECRET</code>, paste the
          ingest key:
        </p>
        <input
          type="password"
          autoComplete="off"
          className="mt-2 w-full min-h-[40px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
          placeholder="Bearer ingest key (fallback)"
          value={bearer}
          onChange={(e) => setBearer(e.target.value)}
        />
      </section>

      {authHint ? (
        <p className="mt-3 text-sm text-amber-300">{authHint}</p>
      ) : null}

      <ul className="mt-6 space-y-4">
        {rows === null ? (
          <li className="text-[var(--muted)]">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="text-[var(--muted)]">Nothing pending.</li>
        ) : (
          rows.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="font-medium">
                {p.parentName ? `${p.parentName} / ` : "Library root / "}
                {p.segments.join(" / ")}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {p.pendingDocumentCount} doc(s) waiting ·{" "}
                {new Date(p.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="min-h-[44px] flex-1 rounded-lg bg-[var(--accent)] font-medium text-[var(--bg)]"
                  onClick={() => void approve(p.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="min-h-[44px] flex-1 rounded-lg border border-[var(--border)] font-medium"
                  onClick={() => void reject(p.id)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
