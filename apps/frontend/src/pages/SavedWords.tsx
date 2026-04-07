import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Heart } from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { dictionaryApi } from "@/api/dictionary";

export default function SavedWords() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: words = [], isLoading } = useQuery({
    queryKey: ["saved-words"],
    queryFn: dictionaryApi.listSaved,
  });

  const unsaveMutation = useMutation({
    mutationFn: dictionaryApi.unsaveWord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-words"] });
      toast.success("Removed from library");
    },
    onError: () => toast.error("Failed to remove"),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saved Words</h1>
          <p className="text-sm text-gray-500 mt-0.5">{words.length} words in your library</p>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {words.map((word) => (
            <div
              key={word.id}
              className="card group cursor-pointer hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all"
              onClick={() => navigate(`/words/${word.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-lg leading-tight">{word.word}</div>
                  {word.phonetic_text && (
                    <div className="font-mono text-xs text-gray-400 mt-0.5">
                      {word.phonetic_text}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unsaveMutation.mutate(word.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <Heart className="h-3.5 w-3.5 text-red-400" fill="currentColor" />
                </button>
              </div>

              {word.translation_uk && (
                <div className="mt-2 text-sm text-brand-600 dark:text-brand-400 font-medium">
                  {word.translation_uk}
                </div>
              )}

              {word.meanings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {word.meanings.slice(0, 2).map((m) => (
                    <Badge key={m.part_of_speech} variant="pos">
                      {m.part_of_speech}
                    </Badge>
                  ))}
                </div>
              )}

              {word.meanings[0]?.definitions[0]?.definition && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {word.meanings[0].definitions[0].definition}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
