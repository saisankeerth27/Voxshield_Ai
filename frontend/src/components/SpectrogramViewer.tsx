import { Waves } from "lucide-react";

/**
 * Spectrogram viewer foundation.
 *
 * Real spectrograms require analysis output (a later phase). Until then,
 * only a placeholder is shown — no fake spectrogram is rendered.
 */
export default function SpectrogramViewer() {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-700 bg-surface/60 p-6 text-center">
      <Waves className="h-8 w-8 text-slate-600" />
      <p className="text-sm text-slate-500">
        Spectrogram will appear after analysis.
      </p>
    </div>
  );
}