import { useState, useRef, useEffect } from "react";

export interface AudioControllerProps {
  audioUrls?: (string | null)[];
  replayCount: number;
  onPlayStart: () => void;
  onPlaybackComplete: () => void;
  onPlaybackError: () => void;
}

export function AudioController({
  audioUrls = [],
  replayCount,
  onPlayStart,
  onPlaybackComplete,
  onPlaybackError,
}: AudioControllerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioError = () => {
    console.error(
      "Audio element error on chunk:",
      currentChunkIndex,
      audioRef.current?.error
    );
    setIsPlaying(false);
    onPlaybackError();
  };

  const currentAudioUrl = audioUrls[currentChunkIndex] || "";

  // Load and play next chunk when ready
  useEffect(() => {
    if (isPlaying && audioRef.current && currentAudioUrl) {
      if (audioRef.current.src !== currentAudioUrl) {
        audioRef.current.load();
        audioRef.current.play().catch((err) => {
          console.error("Playback failed for chunk:", currentChunkIndex, err);
        });
      }
    }
  }, [currentChunkIndex, isPlaying, currentAudioUrl]);

  const handlePlayClick = () => {
    if (replayCount >= 3 || isPlaying) return;
    
    if (audioRef.current && currentAudioUrl) {
      onPlayStart();
      audioRef.current.play().catch((err) => {
        console.error("Audio playback failed:", err);
      });
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    // Revoke the blob URL for the chunk that just finished — it will not be needed again
    const playedUrl = audioUrls[currentChunkIndex];
    if (playedUrl && playedUrl.startsWith("blob:")) {
      URL.revokeObjectURL(playedUrl);
    }

    if (currentChunkIndex < audioUrls.length - 1) {
      setCurrentTime(0);
      setDuration(0);
      setCurrentChunkIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setCurrentChunkIndex(0);
      onPlaybackComplete();
    }
  };

  const totalChunks = audioUrls.length || 1;
  const progressPct = duration > 0
    ? ((currentChunkIndex + (currentTime / duration)) / totalChunks) * 100
    : (currentChunkIndex / totalChunks) * 100;

  // Format time (e.g. 1:30)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Enforce disabled play
  const isPlayDisabled = isPlaying || replayCount >= 3 || !currentAudioUrl;

  return (
    <div className="flex flex-col gap-4 p-5 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl shadow-sm">
      <audio
        ref={audioRef}
        src={currentAudioUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleAudioError}
        className="hidden"
        preload="metadata"
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[var(--brand-ink-soft)]">
            {audioUrls.length > 1 ? `Listening Passage (Part ${currentChunkIndex + 1}/${audioUrls.length})` : "Listening Passage"}
          </span>
          <span className="text-xs text-[var(--brand-muted)]">
            {replayCount >= 3
              ? "Replay limit reached (3/3)"
              : `Plays used: ${replayCount} / 3`}
          </span>
        </div>

        <button
          type="button"
          onClick={handlePlayClick}
          disabled={isPlayDisabled}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            isPlayDisabled
              ? "bg-[var(--brand-surface-2)] text-[var(--brand-muted)] border border-[var(--brand-border)] cursor-not-allowed"
              : "bg-[var(--brand-teal)] text-white hover:bg-[var(--brand-teal-ink)] active:scale-[0.98] shadow-sm"
          }`}
        >
          {isPlaying ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--brand-muted)]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Playing...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.324-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              {replayCount === 0 ? "Play Audio" : "Replay Audio"}
            </>
          )}
        </button>
      </div>

      {/* Non-scrubbable, read-only progress track */}
      <div className="flex flex-col gap-1.5">
        <div 
          className="w-full h-2 bg-[var(--brand-surface-2)] rounded-full overflow-hidden border border-[var(--brand-border)]"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-[var(--brand-teal)] transition-all duration-100 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-semibold text-[var(--brand-muted)]">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
