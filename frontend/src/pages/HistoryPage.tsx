import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History as HistoryIcon, Trash2, TriangleAlert } from "lucide-react";
import { audioService } from "../services/audioService";
import { getApiErrorMessage } from "../utils/apiError";
import { formatFileSize, formatTimestamp } from "../utils/format";
import StatusBadge from "../components/StatusBadge";
import type { AudioListItem } from "../types/analysis";

const PAGE_SIZE = 10;

function statusVariant(status: string): "ok" | "warn" | "danger" | "idle" {
  switch (status) {
    case "COMPLETED":
    case "DEEPFAKE_ANALYZED":
    case "SPEAKER_ANALYZED":
      return "ok";
    case "FAILED":
      return "danger";
    case "PROCESSING":
      return "warn";
    default:
      return "idle";
  }
}

function formatProbability(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatSimilarity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(4);
}

export default function HistoryPage() {
  const [items, setItems] = useState<AudioListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback((targetPage: number) => {
    setLoading(true);
    setError(null);
    audioService
      .list(targetPage, PAGE_SIZE)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setPage(data.page);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "Unable to load history."));
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleDelete = (analysisId: string) => {
    setDeletingId(analysisId);
    audioService
      .remove(analysisId)
      .then(() => {
        const remainingOnPage = items.length === 1 && page > 1 ? page - 1 : page;
        load(remainingOnPage);
      })
      .catch((err) => {
        setDeletingId(null);
        setError(getApiErrorMessage(err, "Unable to delete the record."));
      });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3">
        <HistoryIcon className="h-6 w-6 text-emerald-400" />
        <h1 className="text-2xl font-bold">Detection History</h1>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Audio records uploaded for analysis, newest first.
      </p>

      {error ? (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-xl border border-white/5 bg-surface-light">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Loading history…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-lg font-semibold text-slate-300">
              No uploads yet
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Uploaded audio will appear here once you analyze a file.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Filename</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium">AI Prob.</th>
                <th className="px-4 py-3 font-medium">Speaker</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.analysis_id}
                  className="border-b border-white/5 last:border-b-0"
                >
                  <td className="max-w-[260px] px-4 py-3">
                    <p className="truncate text-slate-200">{item.filename}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {item.analysis_id}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatFileSize(item.file_size)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatTimestamp(item.created_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {formatProbability(item.ai_probability)}
                  </td>
                  <td className="px-4 py-3">
                    {item.speaker_similarity !== null && item.speaker_similarity !== undefined ? (
                      <span
                        className={
                          item.speaker_verified ? "text-emerald-400" : "text-amber-400"
                        }
                      >
                        {formatSimilarity(item.speaker_similarity)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={item.status}
                      variant={statusVariant(item.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(item.analysis_id)}
                      disabled={deletingId === item.analysis_id}
                      aria-label={`Delete ${item.filename}`}
                      className="text-slate-500 transition-colors hover:text-red-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && items.length > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-slate-400">
            Page {page} of {totalPages} · {total} record{total === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 transition-colors hover:border-emerald-500 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 transition-colors hover:border-emerald-500 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}