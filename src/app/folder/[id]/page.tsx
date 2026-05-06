"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type DocRow = {
  id: string;
  title: string;
  createdAt: string;
};

export default function FolderPage() {
  const params = useParams();
  const id = params.id as string;
  const [docs, setDocs] = useState<DocRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/folders/${id}/documents`);
      const data = await res.json();
      setDocs(data.documents as DocRow[]);
    })();
  }, [id]);

  const download = () => {
    window.location.href = `/api/folders/${id}/download`;
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href="/" className="text-sm text-[var(--muted)]">
        ← Home
      </Link>
      <div className="mt-4 flex min-h-[44px] items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Folder</h1>
        <button
          type="button"
          className="min-h-[44px] shrink-0 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-[var(--bg)]"
          onClick={download}
        >
          Download ZIP
        </button>
      </div>
      <p className="mt-1 font-mono text-xs text-[var(--muted)]">{id}</p>

      <ul className="mt-6 space-y-2">
        {docs === null ? (
          <li className="text-[var(--muted)]">Loading…</li>
        ) : docs.length === 0 ? (
          <li className="text-[var(--muted)]">No documents here.</li>
        ) : (
          docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/document/${d.id}`}
                className="flex min-h-[44px] flex-col justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <span>{d.title}</span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
