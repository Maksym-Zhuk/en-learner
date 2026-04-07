import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  BookmarkMinus,
  Heart,
  Loader,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { dictionaryApi } from "@/api/dictionary";
import type { WordEntry } from "@/types";

export default function SavedWords() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const {
    data: words = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["saved-words"],
    queryFn: dictionaryApi.listSaved,
  });

  const favoriteCount = useMemo(
    () => words.filter((word) => word.is_favorite).length,
    [words]
  );

  const filteredWords = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();

    return words.filter((word) => {
      if (showFavoritesOnly && !word.is_favorite) {
        return false;
      }

      if (!normalizedFilter) {
        return true;
      }

      return matchesWordFilter(word, normalizedFilter);
    });
  }, [filter, showFavoritesOnly, words]);

  const unsaveMutation = useMutation({
    mutationFn: dictionaryApi.unsaveWord,
    onSuccess: (_data, wordId) => {
      const removedWord = words.find((word) => word.id === wordId);

      qc.setQueryData<WordEntry[]>(["saved-words"], (existing) =>
        existing ? existing.filter((word) => word.id !== wordId) : existing
      );
      qc.setQueryData<WordEntry[]>(["favorites"], (existing) =>
        existing
          ? existing.map((word) =>
              word.id === wordId ? { ...word, is_saved: false } : word
            )
          : existing
      );
      qc.setQueryData<WordEntry>(["word", wordId], (existing) =>
        existing ? { ...existing, is_saved: false } : existing
      );
      qc.invalidateQueries({ queryKey: ["saved-words"] });

      if (removedWord) {
        toast.success(`"${removedWord.word}" removed from library`);
      } else {
        toast.success("Removed from library");
      }
    },
    onError: () => toast.error("Failed to remove"),
  });

  const favoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      favorite ? dictionaryApi.favoriteWord(id) : dictionaryApi.unfavoriteWord(id),
    onSuccess: (_data, variables) => {
      const targetWord = words.find((word) => word.id === variables.id);

      if (!targetWord) {
        qc.invalidateQueries({ queryKey: ["saved-words"] });
        qc.invalidateQueries({ queryKey: ["favorites"] });
        return;
      }

      const updatedWord = { ...targetWord, is_favorite: variables.favorite };

      qc.setQueryData<WordEntry[]>(["saved-words"], (existing) =>
        existing
          ? existing.map((word) =>
              word.id === variables.id ? updatedWord : word
            )
          : existing
      );
      qc.setQueryData<WordEntry[]>(["favorites"], (existing) => {
        if (!existing) return existing;

        if (!variables.favorite) {
          return existing.filter((word) => word.id !== variables.id);
        }

        const hasWord = existing.some((word) => word.id === variables.id);
        const next = existing.map((word) =>
          word.id === variables.id ? updatedWord : word
        );

        return hasWord ? next : [updatedWord, ...next];
      });
      qc.setQueryData<WordEntry>(["word", variables.id], (existing) =>
        existing ? { ...existing, is_favorite: variables.favorite } : existing
      );
      qc.invalidateQueries({ queryKey: ["favorites"] });

      toast.success(
        variables.favorite ? "Added to favorites" : "Removed from favorites"
      );
    },
    onError: () => toast.error("Failed to update favorite"),
  });

  const pendingUnsaveId = unsaveMutation.isPending ? unsaveMutation.variables : null;
  const pendingFavoriteId = favoriteMutation.isPending
    ? favoriteMutation.variables?.id
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="Saved words are unavailable"
          description={getErrorMessage(error, "The library could not be loaded right now.")}
          action={
            <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Saved Words</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {words.length} words in your library, {favoriteCount} marked as favorite
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/search")}>
          <Search className="h-4 w-4" />
          Add words
        </Button>
      </div>

      {words.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No saved words yet"
          description="Search for words and save them to build your vocabulary library"
          action={
            <Button onClick={() => navigate("/search")}>
              <Search className="h-4 w-4" />
              Search words
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  leftIcon={<Search className="h-4 w-4" />}
                  rightElement={
                    filter ? (
                      <button type="button" onClick={() => setFilter("")}>
                        <X className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-600" />
                      </button>
                    ) : undefined
                  }
                  placeholder="Filter by word, translation, or definition..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={showFavoritesOnly ? "ghost" : "secondary"}
                  size="sm"
                  onClick={() => setShowFavoritesOnly(false)}
                >
                  All
                  <span className="text-xs text-gray-400">{words.length}</span>
                </Button>
                <Button
                  variant={showFavoritesOnly ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowFavoritesOnly(true)}
                >
                  <Heart className="h-4 w-4" fill={showFavoritesOnly ? "currentColor" : "none"} />
                  Favorites
                  <span className="text-xs text-gray-400">{favoriteCount}</span>
                </Button>
              </div>
            </div>

            {(filter.trim() || showFavoritesOnly) && (
              <p className="mt-3 text-xs text-gray-400">
                Showing {filteredWords.length} of {words.length} saved words.
              </p>
            )}
          </div>

          {filteredWords.length === 0 ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No matching saved words"
              description={
                showFavoritesOnly
                  ? "Try clearing the current filters or favorite a few words first."
                  : "Try a different search term."
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilter("");
                    setShowFavoritesOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWords.map((word) => {
                const removing = pendingUnsaveId === word.id;
                const updatingFavorite = pendingFavoriteId === word.id;

                return (
                  <div
                    key={word.id}
                    className="card group cursor-pointer transition-all hover:border-brand-200 hover:shadow-md dark:hover:border-brand-800"
                    onClick={() => navigate(`/words/${word.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-lg font-semibold leading-tight">
                            {word.word}
                          </div>
                          {word.is_favorite && (
                            <Heart
                              className="h-4 w-4 flex-shrink-0 text-red-400"
                              fill="currentColor"
                            />
                          )}
                        </div>
                        {word.phonetic_text && (
                          <div className="mt-0.5 font-mono text-xs text-gray-400">
                            {word.phonetic_text}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            favoriteMutation.mutate({
                              id: word.id,
                              favorite: !word.is_favorite,
                            });
                          }}
                          disabled={updatingFavorite}
                          className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:hover:bg-gray-800"
                          aria-label={
                            word.is_favorite
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          {updatingFavorite ? (
                            <Loader className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <Heart
                              className={`h-4 w-4 ${
                                word.is_favorite ? "text-red-400" : "text-gray-400"
                              }`}
                              fill={word.is_favorite ? "currentColor" : "none"}
                            />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unsaveMutation.mutate(word.id);
                          }}
                          disabled={removing}
                          className="rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-950/20"
                          aria-label="Remove from library"
                        >
                          {removing ? (
                            <Loader className="h-4 w-4 animate-spin text-red-400" />
                          ) : (
                            <BookmarkMinus className="h-4 w-4 text-red-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {word.translation_uk && (
                      <div className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
                        {word.translation_uk}
                      </div>
                    )}

                    {word.meanings.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {word.meanings.slice(0, 2).map((meaning) => (
                          <Badge key={meaning.part_of_speech} variant="pos">
                            {meaning.part_of_speech}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {word.meanings[0]?.definitions[0]?.definition && (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {word.meanings[0].definitions[0].definition}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function matchesWordFilter(word: WordEntry, normalizedFilter: string) {
  if (word.word.toLowerCase().includes(normalizedFilter)) {
    return true;
  }

  if (word.translation_uk?.toLowerCase().includes(normalizedFilter)) {
    return true;
  }

  return word.meanings.some((meaning) =>
    meaning.definitions.some((definition) => {
      return (
        definition.definition.toLowerCase().includes(normalizedFilter) ||
        definition.example?.toLowerCase().includes(normalizedFilter) ||
        definition.synonyms.some((synonym) =>
          synonym.toLowerCase().includes(normalizedFilter)
        ) ||
        definition.antonyms.some((antonym) =>
          antonym.toLowerCase().includes(normalizedFilter)
        )
      );
    })
  );
}
