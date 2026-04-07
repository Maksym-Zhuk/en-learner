import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Clock, Search } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui";
import { historyApi } from "@/api/history";

export default function History() {
  const navigate = useNavigate();
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: historyApi.list,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search History</h1>
        <p className="text-sm text-gray-500 mt-0.5">{history.length} entries</p>
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-8 w-8" />}
          title="No search history"
          description="Words you search for will appear here"
        />
      ) : (
        <div className="space-y-1.5">
          {history.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                if (entry.word_id) navigate(`/words/${entry.word_id}`);
                else navigate(`/search?q=${encodeURIComponent(entry.query)}`);
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-transparent px-4 py-3 text-left hover:border-gray-200 hover:bg-white dark:hover:border-gray-800 dark:hover:bg-gray-900 transition-all"
            >
              <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{entry.query}</div>
                {entry.word && entry.word !== entry.query && (
                  <div className="text-xs text-gray-400">{entry.word}</div>
                )}
              </div>
              <div className="flex-shrink-0 text-xs text-gray-400">
                {formatDate(entry.searched_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
