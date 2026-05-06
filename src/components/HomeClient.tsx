"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FolderTreeNode } from "@/lib/tree-build";

type AuthStatus = {
  authenticated: boolean;
  openAiConfigured: boolean;
  ingestConfigured: boolean;
  cookieSessionsAvailable: boolean;
  envOverrides: { openai: boolean; ingest: boolean };
};

function TreeList({
  nodes,
  depth,
}: {
  nodes: FolderTreeNode[];
  depth: number;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul
      className={`space-y-1 ${depth ? "ml-3 border-l border-[var(--border)] pl-3" : ""}`}
    >
      {nodes.map((n) => (
        <li key={n.id}>
          <Link
            href={`/folder/${n.id}`}
            className="flex min-h-[44px] items-center justify-between rounded-lg px-2 py-2 hover:bg-[var(--surface)]"
          >
            <span>{n.name}</span>
            <span className="text-sm text-[var(--muted)]">{n.docCount}</span>
          </Link>
          <TreeList nodes={n.children} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default function HomeClient() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [signInKey, setSignInKey] = useState("");
  const [bearer, setBearer] = useState("");
  const [tree, setTree] = useState<FolderTreeNode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refreshAuth = useCallback(async () => {
    const res = await fetch("/api/auth/status", { credentials: "include" });
    const data = (await res.json()) as AuthStatus;
    setAuth(data);
  }, []);

  const loadTree = useCallback(async () => {
    const res = await fetch("/api/tree");
    const data = await res.json();
    setTree(data.tree as FolderTreeNode[]);
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const ingestHeaders = (): HeadersInit => {
    const h: HeadersInit = {};
    const t = bearer.trim();
    if (t) {
      h.Authorization = `Bearer ${t}`;
    }
    return h;
  };

  const ingestForm = async (form: FormData) => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        credentials: "include",
        headers: ingestHeaders(),
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      setStatus(
        `Ingested: ${body.extractions ?? 0} note(s). Transcript saved.`,
      );
      await loadTree();
      await refreshAuth();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  };

  const submitText = async () => {
    const fd = new FormData();
    fd.set("text", noteText);
    await ingestForm(fd);
    setNoteText("");
  };

  const onPickFile = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("audio", f);
    await ingestForm(fd);
    fileRef.current!.value = "";
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current = null;
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunksRef.current.push(ev.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType });
      const fd = new FormData();
      fd.set(
        "audio",
        blob,
        `recording.${blob.type.includes("webm") ? "webm" : "ogg"}`,
      );
      await ingestForm(fd);
    };
    rec.start();
    mediaRef.current = rec;
    setStatus("Recording… tap Stop when done.");
  };

  const signIn = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingestKey: signInKey.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      setSignInKey("");
      setStatus("Signed in.");
      await refreshAuth();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await refreshAuth();
    setStatus("Signed out.");
  };

  const needsSetup =
    auth && (!auth.openAiConfigured || !auth.ingestConfigured);
  const needsBearerFallback =
    auth &&
    auth.ingestConfigured &&
    !auth.cookieSessionsAvailable &&
    !auth.authenticated;

  const cookieModeBlocked =
    !!auth &&
    auth.ingestConfigured &&
    !auth.authenticated &&
    auth.cookieSessionsAvailable;

  const bearerModeBlocked =
    !!auth &&
    auth.ingestConfigured &&
    !auth.cookieSessionsAvailable &&
    !auth.authenticated &&
    !bearer.trim();

  const ingestDisabled =
    !!needsSetup || cookieModeBlocked || bearerModeBlocked;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Yap to Context</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Configure API keys in Settings (stored in the database). Sign in here
          to ingest and approve folders from this browser.
        </p>
      </header>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/settings">Settings (API keys)</Link>
        <Link href="/approvals">Pending folder approvals</Link>
      </nav>

      {needsSetup ? (
        <p className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-3 text-sm">
          Finish setup: open{" "}
          <Link href="/settings" className="text-[var(--accent)]">
            Settings
          </Link>{" "}
          and save your OpenAI and ingest keys.
        </p>
      ) : null}

      {auth &&
      auth.ingestConfigured &&
      !auth.authenticated &&
      auth.cookieSessionsAvailable ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enter the ingest API key from Settings (stored in the app).
          </p>
          <input
            type="password"
            autoComplete="off"
            className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3"
            placeholder="Ingest API key"
            value={signInKey}
            onChange={(e) => setSignInKey(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !signInKey.trim()}
            className="mt-3 w-full min-h-[44px] rounded-lg bg-[var(--accent)] font-medium text-[var(--bg)] disabled:opacity-40"
            onClick={() => void signIn()}
          >
            Sign in
          </button>
        </section>
      ) : null}

      {auth?.authenticated ? (
        <button
          type="button"
          className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 text-sm"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      ) : null}

      {needsBearerFallback ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">Bearer header</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Cookie sign-in needs{" "}
            <code className="text-[var(--accent)]">AUTH_SECRET</code> on the
            server (set it on Railway). Until then, paste your ingest key for
            each request from this device.
          </p>
          <input
            type="password"
            autoComplete="off"
            className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3"
            placeholder="Ingest API key (Bearer)"
            value={bearer}
            onChange={(e) => setBearer(e.target.value)}
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-medium">Add from text</h2>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-[var(--text)]"
          placeholder="Paste rough notes…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !noteText.trim() || ingestDisabled}
          className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--border)] px-3 font-medium disabled:opacity-40"
          onClick={() => void submitText()}
        >
          Ingest text
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-medium">Audio</h2>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || ingestDisabled}
            className="min-h-[44px] rounded-lg bg-[var(--accent)] px-3 font-medium text-[var(--bg)] disabled:opacity-40"
            onClick={() => void startRecording()}
          >
            Start recording
          </button>
          <button
            type="button"
            disabled={busy || ingestDisabled}
            className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 font-medium disabled:opacity-40"
            onClick={stopRecording}
          >
            Stop & upload
          </button>
          <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm">
            Upload file
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              capture="environment"
              className="hidden"
              disabled={ingestDisabled}
              onChange={() => void onPickFile()}
            />
          </label>
        </div>
      </section>

      {status ? (
        <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
          {status}
        </p>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex min-h-[44px] items-center justify-between">
          <h2 className="font-medium">Library</h2>
          <button
            type="button"
            className="text-sm text-[var(--accent)]"
            onClick={() => void loadTree()}
          >
            Refresh
          </button>
        </div>
        <div className="mt-3">
          {tree ? (
            <TreeList nodes={tree} depth={0} />
          ) : (
            <p className="text-[var(--muted)]">Loading…</p>
          )}
        </div>
      </section>
    </div>
  );
}
