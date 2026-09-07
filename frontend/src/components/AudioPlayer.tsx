interface AudioPlayerProps {
  audioUrl: string;
}

/**
 * Native audio player for the selected or recorded audio.
 */
export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  return (
    <audio
      controls
      src={audioUrl}
      preload="metadata"
      className="w-full"
      data-testid="audio-player"
    />
  );
}