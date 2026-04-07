import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { Button, FullPageSpinner } from "@/components/ui";
import { WordDetailPanel } from "@/components/word/WordDetailPanel";
import { dictionaryApi } from "@/api/dictionary";

export default function WordDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/search");
  };

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ["word", id],
    queryFn: () => dictionaryApi.getWord(id!),
    enabled: !!id,
  });

  if (isLoading) return <FullPageSpinner />;

  if (error || !entry) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Word not found</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button onClick={() => navigate("/search")}>
            <SearchIcon className="h-4 w-4" />
            Open search
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/search?q=${encodeURIComponent(entry.word)}`)}
        >
          <SearchIcon className="h-4 w-4" />
          Open in search
        </Button>
      </div>
      <WordDetailPanel
        entry={entry}
        onLookupWord={(word) => navigate(`/search?q=${encodeURIComponent(word)}`)}
      />
    </div>
  );
}
