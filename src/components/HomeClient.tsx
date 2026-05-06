"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXTRACTION_PAYLOAD_OVERVIEW,
  ROOT_LIBRARY_GUIDES,
  extractionJsonSchemaFormatted,
} from "@/lib/library-schema-copy";
import type { FolderTreeNode } from "@/lib/tree-build";
import {
  authedFetch,
  clearStoredSecret,
  getStoredSecret,
  setStoredSecret,
} from "@/lib/client-auth";

type AuthStatus = {
  secretConfigured: boolean;
  openAiConfigured: boolean;
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
  const [signedIn, setSignedIn] = useState(false);
  const [signInPassword, setSignInPassword] = useState("");
  const [tree, setTree] = useState<FolderTreeNode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refreshAuth = useCallback(async () => {
    const res = await fetch("/api/auth/status");
    const data = (await res.json()) as AuthStatus;
    setAuth(data);
  }, []);

  const loadTree = useCallback(async () => {
    const res = await authedFetch("/api/tree");
    if (!res.ok) {
      setTree([]);
      return;
    }
    const data = await res.json();
    setTree(data.tree as FolderTreeNode[]);
  }, []);

  useEffect(() => {
    setSignedIn(!!getStoredSecret());
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (signedIn) void loadTree();
  }, [loadTree, signedIn]);

  const ingestForm = async (form: FormData) => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await authedFetch("/api/ingest", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      setStatus(
        `Ingested: ${body.extractions ?? 0} note(s). Transcript saved.`,
      );
      await loadTree();
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
      const candidate = signInPassword.trim();
      const res = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: candidate }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      setStoredSecret(candidate);
      setSignedIn(true);
      setSignInPassword("");
      setStatus("Signed in.");
      await loadTree();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    clearStoredSecret();
    setSignedIn(false);
    setTree(null);
    setStatus("Signed out.");
  };

  const serverNotReady = !!auth && (!auth.secretConfigured || !auth.openAiConfigured);
  const ingestDisabled = serverNotReady || !signedIn;

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
        const res = await authedFetch("/api/folders", {
          method: "POST",
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
          Set <code className="text-[var(--accent)]">OPENAI_API_KEY</code> and{" "}
          <code className="text-[var(--accent)]">AUTH_SECRET</code> as Railway
          service variables. Sign in below with{" "}
          <code className="text-[var(--accent)]">AUTH_SECRET</code> to capture
          notes and manage folders.
        </p>
      </header>

      {auth && !auth.secretConfigured ? (
        <p className="rounded-xl border border-red-600/50 bg-red-950/40 px-4 py-3 text-sm">
          Server not ready: set{" "}
          <code className="text-[var(--accent)]">AUTH_SECRET</code> in Railway
          variables, then redeploy.
        </p>
      ) : null}

      {auth && auth.secretConfigured && !auth.openAiConfigured ? (
        <p className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-3 text-sm">
          Set <code className="text-[var(--accent)]">OPENAI_API_KEY</code> in
          Railway to enable transcription and extraction.
        </p>
      ) : null}

      {auth && auth.secretConfigured && !signedIn ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enter the app password (<code className="text-[var(--accent)]">AUTH_SECRET</code>).
          </p>
          <input
            type="password"
            autoComplete="off"
            className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3"
            placeholder="App password"
            value={signInPassword}
            onChange={(e) => setSignInPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && signInPassword.trim() && !busy) {
                void signIn();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !signInPassword.trim()}
            className="mt-3 w-full min-h-[44px] rounded-lg bg-[var(--accent)] font-medium text-[var(--bg)] disabled:opacity-40"
            onClick={() => void signIn()}
          >
            Sign in
          </button>
        </section>
      ) : null}

      {signedIn ? (
        <button
          type="button"
          className="min-h-[44px] self-start rounded-lg border border-[var(--border)] px-3 text-sm"
          onClick={signOut}
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
          {!signedIn ? (
            <p className="text-[var(--muted)]">Sign in to view the library.</p>
          ) : tree === null ? (
            <p className="text-[var(--muted)]">Loading…</p>
          ) : (
            <TreeList
              nodes={tree}
              depth={0}
              folderActionsDisabled={ingestDisabled}
              busy={busy}
              onAddChild={(id) => void createFolder(id)}
            />
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
