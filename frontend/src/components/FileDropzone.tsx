import { useCallback, useRef, useState } from "react";
import { FileUp, TriangleAlert } from "lucide-react";
import { ALLOWED_EXTENSIONS } from "../types/analysis";

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * Drag-and-drop / click-to-select file input restricted to allowed audio
 * types. Validation itself lives in the parent; this component only routes
 * the chosen file upward.
 */
export default function FileDropzone({
  onFileSelected,
  error,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) {
        onFileSelected(file);
      }
    },
    [onFileSelected],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio file"
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-slate-700 bg-slate-800/30"
            : dragging
              ? "border-emerald-400 bg-emerald-500/10"
              : "border-slate-600 hover:border-emerald-500"
        }`}
      >
        <FileUp className="h-8 w-8 text-emerald-400" />
        <p className="mt-3 text-sm font-medium text-slate-200">
          Drag &amp; drop audio here, or click to browse
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Supported: {ALLOWED_EXTENSIONS.join(", ").toUpperCase()} — up to 25 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".wav,.mp3,.m4a,.ogg,audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}