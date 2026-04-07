import { useState, useRef } from "react";
import { Volume2, VolumeX, Loader } from "lucide-react";
import { Button } from "@/components/ui";

interface AudioButtonProps {
  url: string;
}

export function AudioButton({ url }: AudioButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async () => {
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

  if (error) {
    return (
      <Button variant="ghost" size="icon" disabled title="Audio unavailable">
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
