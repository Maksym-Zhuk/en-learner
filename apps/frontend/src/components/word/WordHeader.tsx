import { Heart, BookmarkPlus, BookmarkCheck, Plus } from "lucide-react";
import { Button, Tooltip } from "@/components/ui";
import { AudioButton } from "./AudioButton";
import type { WordEntry } from "@/types";

interface WordHeaderProps {
  entry: WordEntry;
  onSave: () => void;
  onUnsave: () => void;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onAddToSet: () => void;
  saving?: boolean;
}

export function WordHeader({
  entry,
  onSave,
  onUnsave,
  onFavorite,
  onUnfavorite,
  onAddToSet,
  saving,
}: WordHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      {/* Left: word info */}
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{entry.word}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {entry.phonetic_text && (
            <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
              {entry.phonetic_text}
            </span>
          )}
          {entry.phonetic_audio_url && (
            <AudioButton url={entry.phonetic_audio_url} />
          )}
        </div>
        {entry.translation_uk && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">UA</span>
            <span className="text-base font-medium text-brand-700 dark:text-brand-300">
              {entry.translation_uk}
            </span>
          </div>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <Tooltip content={entry.is_favorite ? "Remove from favorites" : "Add to favorites"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={entry.is_favorite ? onUnfavorite : onFavorite}
            className={entry.is_favorite ? "text-red-500 hover:text-red-600" : ""}
          >
            <Heart
              className="h-4 w-4"
              fill={entry.is_favorite ? "currentColor" : "none"}
            />
          </Button>
        </Tooltip>

        <Tooltip content="Add to study set">
          <Button variant="ghost" size="icon" onClick={onAddToSet}>
            <Plus className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Button
          variant={entry.is_saved ? "secondary" : "primary"}
          size="sm"
          onClick={entry.is_saved ? onUnsave : onSave}
          loading={saving}
        >
          {entry.is_saved ? (
            <>
              <BookmarkCheck className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <BookmarkPlus className="h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
