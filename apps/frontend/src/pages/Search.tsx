import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon, X, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { Input, EmptyState } from "@/components/ui";
import { WordDetailPanel } from "@/components/word/WordDetailPanel";
import { dictionaryApi } from "@/api/dictionary";
import { historyApi } from "@/api/history";
import { useAppStore } from "@/store";
import type { WordEntry } from "@/types";
import { useQuery } from "@tanstack/react-query";

export default function Search() {
  const { lastSearchQuery, setLastSearchQuery } = useAppStore();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(lastSearchQuery);
  const [selectedWord, setSelectedWord] = useState<WordEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSearchedQueryRef = useRef<string | null>(null);
  const qc = useQueryClient();

  // History for recent suggestions
  const { data: history = [] } = useQuery({
    queryKey: ["history"],
    queryFn: historyApi.list,
  });

  const recentQueries = [...new Set(history.map((h) => h.query))].slice(0, 8);

  const searchMutation = useMutation({
    mutationFn: dictionaryApi.search,
    onSuccess: async ({ entry }, searchedQuery) => {
      setSelectedWord(entry);
      setQuery(searchedQuery);
      setLastSearchQuery(searchedQuery);
      // Record in history
      await historyApi.record(searchedQuery, entry.id);
      qc.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (e: Error) => {
      toast.error(e.message.includes("not found") ? `"${query}" not found` : "Search failed");
    },
  });

  const handleSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      searchMutation.mutate(trimmed);
    },
    [searchMutation]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch(query);
  };

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const urlQuery = searchParams.get("q")?.trim();

    if (!urlQuery) {
      autoSearchedQueryRef.current = null;
      return;
    }

    if (autoSearchedQueryRef.current === urlQuery) {
      return;
    }

    autoSearchedQueryRef.current = urlQuery;
    setQuery(urlQuery);
    searchMutation.mutate(urlQuery);
  }, [searchMutation, searchParams]);

  return (
    <div className="flex h-full">
      {/* Left panel: search + recent */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Search bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <Input
            ref={inputRef}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            rightElement={
              query ? (
                <button onClick={() => { setQuery(""); setSelectedWord(null); }}>
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              ) : (
                <kbd className="text-xs text-gray-400 font-mono">/</kbd>
              )
            }
            placeholder="Search any English word..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-base"
          />
          {searchMutation.isPending && (
            <p className="mt-2 text-xs text-gray-400 animate-pulse">Searching...</p>
          )}
        </div>

        {/* Recent searches */}
        <div className="flex-1 overflow-y-auto p-3">
          {recentQueries.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent</span>
              </div>
              <div className="space-y-0.5">
                {recentQueries.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setQuery(q); handleSearch(q); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    <SearchIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentQueries.length === 0 && !selectedWord && (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title="Search a word"
              description="Type an English word and press Enter to look it up"
            />
          )}
        </div>
      </div>

      {/* Right panel: word detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {searchMutation.isPending ? (
          <WordDetailSkeleton />
        ) : selectedWord ? (
          <WordDetailPanel
            entry={selectedWord}
            onWordUpdate={(updated) => setSelectedWord(updated)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-950/30">
                <SearchIcon className="h-10 w-10 text-brand-300 dark:text-brand-700" />
              </div>
              <p className="text-lg font-medium text-gray-400">No word selected</p>
              <p className="mt-1 text-sm text-gray-400">
                Search for a word to see its definition
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WordDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="space-y-3">
        <div className="h-10 w-48 skeleton rounded" />
        <div className="h-5 w-32 skeleton rounded" />
        <div className="h-8 w-64 skeleton rounded" />
      </div>
      <div className="h-px bg-gray-200 dark:bg-gray-800" />
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-20 skeleton rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-full skeleton rounded" />
            <div className="h-4 w-4/5 skeleton rounded" />
            <div className="h-4 w-3/5 skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
