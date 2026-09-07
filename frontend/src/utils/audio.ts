/**
 * Load the duration (in seconds) of an audio blob using the HTMLAudio
 * element. Resolves with null when duration cannot be determined.
 */
export function loadAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
    };

    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    });

    audio.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });

    audio.src = url;
  });
}

export default loadAudioDuration;