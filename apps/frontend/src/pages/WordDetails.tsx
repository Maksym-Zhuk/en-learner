import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button, FullPageSpinner } from "@/components/ui";
import { WordDetailPanel } from "@/components/word/WordDetailPanel";
import { dictionaryApi } from "@/api/dictionary";

export default function WordDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <WordDetailPanel entry={entry} />
    </div>
  );
}
