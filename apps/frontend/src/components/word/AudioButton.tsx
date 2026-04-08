import { useState, useRef } from "react";
import { Volume2, VolumeX, Loader } from "lucide-react";
import { Button } from "@/components/ui";
import { useAppStore } from "@/store";

interface AudioButtonProps {
  url: string;
}

export function AudioButton({ url }: AudioButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioPlaybackAvailable = useAppStore((s) => s.audioPlaybackAvailable);
  const audioPlaybackIssue = useAppStore((s) => s.audioPlaybackIssue);

  const play = async () => {
    if (!audioPlaybackAvailable) {
      setError(true);
      return;
    }

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    setError(false);
    setLoading(true);

    try {
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setError(true);
        setPlaying(false);
        setLoading(false);
      };
      audio.oncanplaythrough = () => setLoading(false);

      await audio.play();
      setPlaying(true);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  if (!audioPlaybackAvailable || error) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        title={audioPlaybackIssue ?? "Audio unavailable"}
      >
        <VolumeX className="h-4 w-4 text-gray-400" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={play}
      title={playing ? "Pause" : "Play pronunciation"}
      className={playing ? "text-brand-600" : ""}
    >
      {loading ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
    </Button>
  );
}
