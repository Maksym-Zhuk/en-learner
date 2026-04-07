import {
  BookmarkCheck,
  BookmarkPlus,
  Heart,
  Loader,
  Plus,
} from "lucide-react";
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
  favoriting?: boolean;
}

export function WordHeader({
  entry,
  onSave,
  onUnsave,
  onFavorite,
  onUnfavorite,
  onAddToSet,
  saving,
  favoriting,
}: WordHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
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

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              entry.is_saved
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {entry.is_saved ? "In library" : "Not saved yet"}
          </span>
          {entry.is_favorite && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
              Favorite
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 md:items-end">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onAddToSet}>
            <Plus className="h-4 w-4" />
            Add to set
          </Button>

          <Tooltip content={entry.is_favorite ? "Remove from favorites" : "Add to favorites"}>
            <Button
              variant="ghost"
              size="icon"
              onClick={entry.is_favorite ? onUnfavorite : onFavorite}
              disabled={favoriting}
              className={entry.is_favorite ? "text-red-500 hover:text-red-600" : ""}
              aria-label={entry.is_favorite ? "Remove from favorites" : "Add to favorites"}
            >
              {favoriting ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className="h-4 w-4"
                  fill={entry.is_favorite ? "currentColor" : "none"}
                />
              )}
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

        <p className="text-xs text-gray-400 md:max-w-xs md:text-right">
          {entry.is_saved
            ? "Saved words stay in your library and can be added to any study set."
            : "Save this word or add it to a study set to keep it in your library."}
        </p>
      </div>
    </div>
  );
}
