import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Trash2, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { setsApi } from "@/api/sets";

export default function SetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: set, isLoading: loadingSet } = useQuery({
    queryKey: ["set", id],
    queryFn: () => setsApi.get(id!),
    enabled: !!id,
  });

  const { data: words = [], isLoading: loadingWords } = useQuery({
    queryKey: ["set-words", id],
    queryFn: () => setsApi.listWords(id!),
    enabled: !!id,
  });

  const removeMutation = useMutation({
    mutationFn: (wordId: string) => setsApi.removeWord(id!, wordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["set-words", id] });
      qc.invalidateQueries({ queryKey: ["set", id] });
      toast.success("Removed from set");
    },
    onError: () => toast.error("Failed to remove"),
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <button
        onClick={() => navigate("/sets")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All sets
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{set?.name}</h1>
          {set?.description && (
            <p className="mt-1 text-gray-500">{set.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-400">{words.length} words</p>
        </div>
        <Button
          disabled={words.length === 0}
          onClick={() => navigate(`/review?set_id=${id}`)}
        >
          <Play className="h-4 w-4" />
          Study set
        </Button>
      </div>

      {/* Words */}
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
        <div className="grid gap-3 sm:grid-cols-2">
          {words.map((word) => (
            <div
              key={word.id}
              className="card group flex items-start justify-between gap-3 hover:border-brand-200 dark:hover:border-brand-800 transition-all cursor-pointer"
              onClick={() => navigate(`/words/${word.id}`)}
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
                {word.meanings.length > 0 && (
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {word.meanings.slice(0, 2).map((m) => (
                      <Badge key={m.part_of_speech} variant="pos">
                        {m.part_of_speech}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeMutation.mutate(word.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
