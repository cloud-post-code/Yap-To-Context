"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXTRACTION_PAYLOAD_OVERVIEW,
  ROOT_LIBRARY_GUIDES,
  extractionJsonSchemaFormatted,
} from "@/lib/library-schema-copy";
import type { FolderTreeNode } from "@/lib/tree-build";

type AuthStatus = {
  authenticated: boolean;
  openAiConfigured: boolean;
  ingestConfigured: boolean;
  cookieSessionsAvailable: boolean;
  deploymentBlocked?: boolean;
  envOverrides: { openai: boolean; ingest: boolean };
};

function TreeList({
  nodes,
  depth,
  folderActionsDisabled,
  busy,
  onAddChild,
}: {
  nodes: FolderTreeNode[];
  depth: number;
  folderActionsDisabled: boolean;
  busy: boolean;
  onAddChild: (parentId: string) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul
      className={`space-y-1 ${depth ? "ml-3 border-l border-[var(--border)] pl-3" : ""}`}
    >
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 py-2 hover:bg-[var(--surface)]">
            <Link
              href={`/folder/${n.id}`}
              className="flex min-w-0 flex-1 items-center justify-between py-1"
            >
              <span className="truncate">{n.name}</span>
              <span className="ml-2 shrink-0 text-sm text-[var(--muted)]">
                {n.docCount}
              </span>
            </Link>
            <button
              type="button"
              title="Add subgroup"
              disabled={folderActionsDisabled || busy}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-lg leading-none text-[var(--accent)] disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                onAddChild(n.id);
              }}
            >
              +
            </button>
          </div>
          <TreeList
            nodes={n.children}
            depth={depth + 1}
            folderActionsDisabled={folderActionsDisabled}
            busy={busy}
            onAddChild={onAddChild}
          />
        </li>
      ))}
    </ul>
  );
}

export default function HomeClient() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [signInKey, setSignInKey] = useState("");
  const [tree, setTree] = useState<FolderTreeNode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
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

  const ingestForm = async (form: FormData) => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        credentials: "include",
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
    const rec = mediaRef.current;
    if (!rec) return;
    setIsRecording(false);
    setBusy(true);
    setStatus("Transcribing and organizing…");
    rec.stop();
    mediaRef.current = null;
  };

  const startRecording = async () => {
    if (mediaRef.current) return;
    try {
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
      setIsRecording(true);
      setStatus("Recording… tap again to stop and save.");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Could not access microphone",
      );
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else void startRecording();
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
  const cookieModeBlocked =
    !!auth &&
    auth.ingestConfigured &&
    !auth.authenticated &&
    auth.cookieSessionsAvailable;

  const ingestDisabled = !!needsSetup || cookieModeBlocked;

  const createFolder = useCallback(
    async (parentId: string | null) => {
      if (ingestDisabled) {
        setStatus("Sign in with the app password to add folders.");
        return;
      }
      const label =
        parentId === null ? "Library name (top-level folder)" : "Subgroup name";
      const raw = window.prompt(label);
      if (raw === null) return;
      const name = raw.trim();
      if (!name) return;

      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch("/api/folders", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId, name }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || res.statusText);
        await loadTree();
        setStatus(
          parentId === null
            ? `Added library “${name}”.`
            : `Added subgroup “${name}”.`,
        );
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Could not create folder");
      } finally {
        setBusy(false);
      }
    },
    [ingestDisabled, loadTree],
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Yap to Context</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          On Railway, set <code className="text-[var(--accent)]">OPENAI_API_KEY</code>
          , <code className="text-[var(--accent)]">INGEST_API_KEY</code> (short app
          password), and <code className="text-[var(--accent)]">AUTH_SECRET</code>{" "}
          as service variables. Otherwise add keys under Settings. Sign in with the
          app password (same value as{" "}
          <code className="text-[var(--accent)]">INGEST_API_KEY</code> when set on
          the host) to capture notes and manage folders.
        </p>
      </header>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/settings">Settings (API keys)</Link>
        <Link href="/approvals">Pending folder approvals (legacy)</Link>
      </nav>

      {auth?.deploymentBlocked ? (
        <p className="rounded-xl border border-red-600/50 bg-red-950/40 px-4 py-3 text-sm">
          Deployment misconfigured: add{" "}
          <code className="text-[var(--accent)]">AUTH_SECRET</code> to Railway
          variables alongside <code className="text-[var(--accent)]">INGEST_API_KEY</code>
          , then redeploy. Sessions cannot start until both are set.
        </p>
      ) : null}

      {needsSetup ? (
        <p className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-3 text-sm">
          Finish setup: open{" "}
          <Link href="/settings" className="text-[var(--accent)]">
            Settings
          </Link>{" "}
          and save your OpenAI key, plus an app password if the host did not set{" "}
          <code className="text-[var(--accent)]">INGEST_API_KEY</code>.
        </p>
      ) : null}

      {auth &&
      !auth.deploymentBlocked &&
      auth.ingestConfigured &&
      !auth.authenticated &&
      auth.cookieSessionsAvailable ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enter the app password (not your OpenAI key).
          </p>
          <input
            type="password"
            autoComplete="off"
            className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3"
            placeholder="App password"
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
        <h2 className="font-medium">Voice</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          One tap to record, tap again to finish. The model transcribes, splits
          into notes, and places them under the folders that fit best.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            disabled={ingestDisabled || busy}
            className={`min-h-[44px] w-full rounded-lg px-3 font-medium disabled:opacity-40 ${
              isRecording
                ? "border-2 border-red-500/80 bg-transparent text-red-400"
                : "bg-[var(--accent)] text-[var(--bg)]"
            }`}
            onClick={toggleRecording}
          >
            {isRecording ? "Stop recording" : "Start recording"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={ingestDisabled || busy}
            onChange={() => void onPickFile()}
          />
          <button
            type="button"
            disabled={ingestDisabled || busy}
            className="text-center text-sm text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 disabled:opacity-40"
            onClick={() => fileRef.current?.click()}
          >
            Upload an audio file instead
          </button>
        </div>
      </section>

      {status ? (
        <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
          {status}
        </p>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex min-h-[44px] flex-wrap items-center gap-2">
          <h2 className="font-medium">Library</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              title="Add top-level library"
              disabled={ingestDisabled || busy}
              className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-lg leading-none text-[var(--accent)] disabled:opacity-40"
              onClick={() => void createFolder(null)}
            >
              +
            </button>
            <button
              type="button"
              className="text-sm text-[var(--accent)]"
              onClick={() => void loadTree()}
            >
              Refresh
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Use + next to a folder to add a subgroup. Capture chooses existing
          folders automatically; create folders here first if you want specific
          placements.
        </p>
        <div className="mt-3">
          {tree ? (
            <TreeList
              nodes={tree}
              depth={0}
              folderActionsDisabled={ingestDisabled}
              busy={busy}
              onAddChild={(id) => void createFolder(id)}
            />
          ) : (
            <p className="text-[var(--muted)]">Loading…</p>
          )}
        </div>
      </section>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <summary className="cursor-pointer font-medium">
          Library formats &amp; JSON shape
        </summary>
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-[var(--muted)]">
            Guides use your actual folder names (Blog, Company, Ideas, Inbox).
            Subgroups are yours to create with + before ingest can target them.
          </p>
          <ul className="space-y-4">
            {ROOT_LIBRARY_GUIDES.map((g) => (
              <li key={g.folderName}>
                <p className="font-medium">{g.label}</p>
                <p className="mt-1 text-[var(--muted)]">{g.purpose}</p>
                <p className="mt-2 font-mono text-xs text-[var(--text)]">
                  {g.examplePathsMarkdown}
                </p>
              </li>
            ))}
          </ul>
          <div>
            <p className="font-medium">Extraction payload</p>
            <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">
              {EXTRACTION_PAYLOAD_OVERVIEW}
            </p>
          </div>
          <div>
            <p className="font-medium">OpenAI JSON Schema</p>
            <pre className="mt-2 max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text)]">
              {extractionJsonSchemaFormatted()}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}
