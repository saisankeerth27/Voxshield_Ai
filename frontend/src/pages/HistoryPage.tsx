import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileUp,
  History as HistoryIcon,
  Mic,
  Trash2,
  TriangleAlert,
} from "lucide-react";
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
    case "RISK_CALCULATED":
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
  return `${(value * 100).toFixed(0)}%`;
}

function aiLabel(record: AudioListItem): string {
  const label = record.deepfake_label ?? "";
  if (label.toUpperCase().includes("SYNTH")) return "Synthetic";
  if (label.toUpperCase().includes("HUMAN")) return "Human";
  return "—";
}

function riskMeta(level: string | null): {
  label: string;
  chip: string;
} | null {
  switch (level) {
    case "HIGH":
      return { label: "HIGH", chip: "border-red-500/40 bg-red-500/10 text-red-400" };
    case "MEDIUM":
      return { label: "MEDIUM", chip: "border-amber-500/40 bg-amber-500/10 text-amber-400" };
    case "LOW":
      return { label: "LOW", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" };
    default:
      return null;
  }
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
    <div className="mx-auto max-w-6xl px-4 py-10">
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
            <HistoryIcon className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-base font-semibold text-slate-300">
              No analysis history yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Analyze your first voice recording to see results here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Audio</th>
                  <th className="px-4 py-3 font-medium">AI Detection</th>
                  <th className="px-4 py-3 font-medium">Speaker Match</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const risk = riskMeta(item.risk_level ?? null);
                  const aiLabelValue = aiLabel(item);
                  return (
                    <tr
                      key={item.analysis_id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {formatTimestamp(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {item.source === "MICROPHONE" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                            <Mic className="h-3.5 w-3.5 text-violet-400" />
                            Microphone
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                            <FileUp className="h-3.5 w-3.5" />
                            Upload
                          </span>
                        )}
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate text-slate-200">{item.filename}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatFileSize(item.file_size)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.ai_probability !== null &&
                        item.ai_probability !== undefined ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              aiLabelValue === "Synthetic"
                                ? "border-red-500/40 bg-red-500/10 text-red-400"
                                : aiLabelValue === "Human"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : "border-slate-600 bg-surface text-slate-300"
                            }`}
                          >
                            {aiLabelValue === "—"
                              ? `${formatProbability(item.ai_probability)} AI`
                              : aiLabelValue}
                            <span className="font-mono opacity-80">
                              {formatProbability(item.ai_probability)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.speaker_similarity !== null &&
                        item.speaker_similarity !== undefined ? (
                          <span
                            className={
                              item.speaker_verified
                                ? "inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400"
                                : "inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400"
                            }
                          >
                            {item.speaker_verified ? "Match" : "No match"}
                            <span className="ml-1 font-mono opacity-80">
                              {formatProbability(item.speaker_similarity)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {risk ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${risk.chip}`}
                          >
                            {risk.label}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge
                          label={item.status}
                          variant={statusVariant(item.status)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Link
                            to={`/analysis/${item.analysis_id}`}
                            aria-label={`View details for ${item.filename}`}
                            className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-emerald-400"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                          <button
                            onClick={() => handleDelete(item.analysis_id)}
                            disabled={deletingId === item.analysis_id}
                            aria-label={`Delete ${item.filename}`}
                            className="text-slate-500 transition-colors hover:text-red-400 disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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