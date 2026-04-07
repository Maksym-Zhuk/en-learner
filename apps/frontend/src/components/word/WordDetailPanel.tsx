import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { WordHeader } from "./WordHeader";
import { MeaningsSection } from "./MeaningsSection";
import { AddToSetModal } from "./AddToSetModal";
import { dictionaryApi } from "@/api/dictionary";
import type { WordEntry } from "@/types";

interface WordDetailPanelProps {
  entry: WordEntry;
  onWordUpdate?: (updated: WordEntry) => void;
}

export function WordDetailPanel({ entry, onWordUpdate }: WordDetailPanelProps) {
  const [addToSetOpen, setAddToSetOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(entry);
  const qc = useQueryClient();

  useEffect(() => {
    setCurrentEntry(entry);
  }, [entry]);

  const updateEntry = (updates: Partial<WordEntry>) => {
    const updated = { ...currentEntry, ...updates };
    setCurrentEntry(updated);
    qc.setQueryData(["word", updated.id], updated);
    onWordUpdate?.(updated);
  };

  const saveMutation = useMutation({
    mutationFn: () => dictionaryApi.saveWord(currentEntry.id),
    onSuccess: () => {
      toast.success(`"${currentEntry.word}" saved to library`);
      updateEntry({ is_saved: true });
      qc.invalidateQueries({ queryKey: ["saved-words"] });
    },
    onError: () => toast.error("Failed to save word"),
  });

  const unsaveMutation = useMutation({
    mutationFn: () => dictionaryApi.unsaveWord(currentEntry.id),
    onSuccess: () => {
      toast.success(`"${currentEntry.word}" removed from library`);
      updateEntry({ is_saved: false });
      qc.invalidateQueries({ queryKey: ["saved-words"] });
    },
    onError: () => toast.error("Failed to remove word"),
  });

  const favoriteMutation = useMutation({
    mutationFn: () => dictionaryApi.favoriteWord(currentEntry.id),
    onSuccess: () => {
      updateEntry({ is_favorite: true });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: () => toast.error("Failed to add favorite"),
  });

  const unfavoriteMutation = useMutation({
    mutationFn: () => dictionaryApi.unfavoriteWord(currentEntry.id),
    onSuccess: () => {
      updateEntry({ is_favorite: false });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: () => toast.error("Failed to remove favorite"),
  });

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <WordHeader
        entry={currentEntry}
        onSave={() => saveMutation.mutate()}
        onUnsave={() => unsaveMutation.mutate()}
        onFavorite={() => favoriteMutation.mutate()}
        onUnfavorite={() => unfavoriteMutation.mutate()}
        onAddToSet={() => setAddToSetOpen(true)}
        saving={saveMutation.isPending || unsaveMutation.isPending}
      />

      <div className="border-t border-gray-200 dark:border-gray-800" />

      <MeaningsSection meanings={currentEntry.meanings} />

      <div className="text-xs text-gray-400 pt-4">
        Source: {currentEntry.source}
      </div>

      <AddToSetModal
        open={addToSetOpen}
        onClose={() => setAddToSetOpen(false)}
        wordId={currentEntry.id}
        wordName={currentEntry.word}
        onAddedToSet={() => updateEntry({ is_saved: true })}
      />
    </div>
  );
}
