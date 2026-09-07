import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer, TriangleAlert } from "lucide-react";
import { audioService } from "../services/audioService";
import { getApiErrorMessage } from "../utils/apiError";

/**
 * Standalone report page rendered outside the app layout so the browser
 * print/save-as-PDF flow only captures the report itself. The printable
 * HTML document is produced by the backend and embedded here via srcdoc.
 */
export default function ReportPage() {
  const { analysisId = "" } = useParams<{ analysisId: string }>();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    audioService
      .getReport(analysisId)
      .then((reportHtml) => {
        if (cancelled) return;
        setHtml(reportHtml);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "Unable to load the analysis report."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  const handlePrint = () => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.print();
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-surface px-6 py-4 print:hidden">
        <Link
          to={`/analysis/${analysisId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to details
        </Link>
        <button
          onClick={handlePrint}
          disabled={!html}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="ml-3 text-sm text-slate-400">Generating report…</span>
        </div>
      ) : error ? (
        <div className="px-6 py-16">
          <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : html ? (
        <iframe
          ref={iframeRef}
          title="Analysis report"
          srcDoc={html}
          className="h-[calc(100vh-57px)] w-full border-0"
        />
      ) : null}
    </div>
  );
}