import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  /** URL to the audio blob/object (e.g. from createObjectURL). */
  audioUrl: string;
  color?: string;
  bars?: number;
}

/**
 * Renders a waveform preview of a local audio file using browser-side
 * audio decoding (Web Audio API). The waveform is real audio data — no
 * fake or simulated results are produced.
 */
export default function AudioWaveform({
  audioUrl,
  color = "#34d399",
  bars = 64,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const audioContext = new AudioContext();
    let cancelled = false;

    const draw = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        const step = Math.floor(channelData.length / bars);
        const amplitudes: number[] = [];
        for (let i = 0; i < bars; i += 1) {
          const start = i * step;
          const slice = channelData.slice(start, start + step);
          let max = 0;
          for (const sample of slice) {
            const abs = Math.abs(sample);
            if (abs > max) max = abs;
          }
          amplitudes.push(max);
        }

        if (cancelled) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);
        const barWidth = width / bars;
        for (let i = 0; i < amplitudes.length; i += 1) {
          const value = amplitudes[i] ?? 0;
          const barHeight = Math.max(2, value * height);
          ctx.fillStyle = color;
          ctx.fillRect(
            i * barWidth + barWidth * 0.15,
            (height - barHeight) / 2,
            barWidth * 0.7,
            barHeight
          );
        }
      } catch {
        // Decoding can fail for unsupported codecs; the canvas stays empty.
      }
    };

    void draw();

    return () => {
      cancelled = true;
      void audioContext.close();
    };
  }, [audioUrl, color, bars]);

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full rounded-lg bg-surface/60"
      style={{ display: "block" }}
    />
  );
}