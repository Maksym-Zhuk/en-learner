import { useDeferredValue, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Trash2,
  BookOpen,
  Search,
  RefreshCw,
  FolderSearch,
  Plus,
  Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { setsApi } from "@/api/sets";
import { reviewApi } from "@/api/review";
import { buildPublicTestUrl } from "@/utils/public-links";

export default function SetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [removingWordId, setRemovingWordId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const {
    data: set,
    isLoading: loadingSet,
    isError: setError,
    error: setQueryError,
    refetch: refetchSet,
  } = useQuery({
    queryKey: ["set", id],
    queryFn: () => setsApi.get(id!),
    enabled: !!id,
  });

  const {
    data: words = [],
    isLoading: loadingWords,
    isError: wordsError,
    error: wordsQueryError,
    refetch: refetchWords,
  } = useQuery({
    queryKey: ["set-words", id],
    queryFn: () => setsApi.listWords(id!),
    enabled: !!id,
  });

  const removeMutation = useMutation({
    mutationFn: (wordId: string) => setsApi.removeWord(id!, wordId),
    onMutate: (wordId) => {
      setRemovingWordId(wordId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["set-words", id] });
      qc.invalidateQueries({ queryKey: ["set", id] });
      qc.invalidateQueries({ queryKey: ["sets"] });
      toast.success("Removed from set");
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError, "Failed to remove")),
    onSettled: () => {
      setRemovingWordId(null);
    },
  });

  const shareMutation = useMutation({
    mutationFn: () => reviewApi.createPublicTestLink(id!),
    onSuccess: async (data) => {
      const shareUrl = buildPublicTestUrl(data.token);

      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Public test link copied");
      } catch {
        toast.success(`Public test link: ${shareUrl}`);
      }
    },
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, "Failed to create public test link")),
  });

  if (loadingSet || loadingWords) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const combinedError = setQueryError ?? wordsQueryError;

  if (setError || wordsError) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="Couldn't load this set"
          description={getErrorMessage(combinedError, "Try again in a moment.")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => {
                  refetchSet();
                  refetchWords();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
              <Button variant="secondary" onClick={() => navigate("/sets")}>
                Back to sets
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="Study set not found"
          description="This set may have been removed or the link is no longer valid."
          action={
            <Button onClick={() => navigate("/sets")}>
              <ArrowLeft className="h-4 w-4" />
              Back to sets
            </Button>
          }
        />
      </div>
    );
  }

  const filteredWords = words.filter((word) => {
    if (!deferredQuery) return true;

    const searchableText = [
      word.word,
      word.translation_uk ?? "",
      word.meanings.map((meaning) => meaning.part_of_speech).join(" "),
      word.meanings
        .flatMap((meaning) => meaning.definitions.map((definition) => definition.definition))
        .join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(deferredQuery);
  });

  const translatedWords = words.filter((word) => word.translation_uk).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/sets")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All sets
      </button>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{set.name}</h1>
            {set.description && <p className="max-w-2xl text-gray-500">{set.description}</p>}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {words.length} {words.length === 1 ? "word" : "words"}
              </span>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                {translatedWords} translated
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Tap a word to open details
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Button variant="secondary" onClick={() => navigate("/search")}>
              <Plus className="h-4 w-4" />
              Add words
            </Button>
            <Button
              variant="secondary"
              disabled={words.length === 0}
              loading={shareMutation.isPending}
              onClick={() => shareMutation.mutate()}
            >
              <Link2 className="h-4 w-4" />
              Copy test link
            </Button>
            <Button
              disabled={words.length === 0}
              onClick={() => navigate(`/review?set_id=${id}`)}
            >
              <Play className="h-4 w-4" />
              Study set
            </Button>
          </div>
        </div>
      </div>

      {words.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No words in this set"
          description="Go to Search and add words to this set using the + button"
          action={
            <Button variant="secondary" onClick={() => navigate("/search")}>
              Search words
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search words, translations, or definitions"
              leftIcon={<Search className="h-4 w-4" />}
              rightElement={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                ) : null
              }
            />
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
              Showing <span className="font-semibold">{filteredWords.length}</span> of{" "}
              <span className="font-semibold">{words.length}</span>
            </div>
          </div>

          {filteredWords.length === 0 ? (
            <EmptyState
              icon={<FolderSearch className="h-8 w-8" />}
              title="No words match this search"
              description="Try a different keyword or clear the filter to see the whole set."
              action={
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredWords.map((word) => (
                <div
                  key={word.id}
                  role="button"
                  tabIndex={0}
                  className="card group flex items-start justify-between gap-3 transition-all hover:border-brand-200 dark:hover:border-brand-800"
                  onClick={() => navigate(`/words/${word.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/words/${word.id}`);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{word.word}</span>
                      {word.phonetic_text && (
                        <span className="font-mono text-xs text-gray-400">
                          {word.phonetic_text}
                        </span>
                      )}
                    </div>
                    {word.translation_uk && (
                      <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                        {word.translation_uk}
                      </span>
                    )}
                    {getPrimaryDefinition(word) && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {getPrimaryDefinition(word)}
                      </p>
                    )}
                    {word.meanings.length > 0 && (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {word.meanings.slice(0, 3).map((meaning) => (
                          <Badge key={meaning.part_of_speech} variant="pos">
                            {meaning.part_of_speech}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove "${word.word}" from "${set.name}"?`)) {
                        removeMutation.mutate(word.id);
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="flex-shrink-0 rounded p-1.5 opacity-100 transition-colors hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-950/20"
                    aria-label={`Remove ${word.word} from ${set.name}`}
                  >
                    {removeMutation.isPending && removingWordId === word.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getPrimaryDefinition(word: {
  meanings: Array<{ definitions: Array<{ definition: string }> }>;
}): string | null {
  return word.meanings.flatMap((meaning) => meaning.definitions)[0]?.definition ?? null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
