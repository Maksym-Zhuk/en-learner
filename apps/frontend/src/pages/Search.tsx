import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Clock, Search as SearchIcon, TriangleAlert, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Input } from "@/components/ui";
import { WordDetailPanel } from "@/components/word/WordDetailPanel";
import { dictionaryApi } from "@/api/dictionary";
import { historyApi, type HistoryEntry } from "@/api/history";
import { useAppStore } from "@/store";
import type { WordEntry } from "@/types";

export default function Search() {
  const { lastSearchQuery, setLastSearchQuery } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(lastSearchQuery);
  const [selectedWord, setSelectedWord] = useState<WordEntry | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState(lastSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSearchedQueryRef = useRef<string | null>(null);
  const latestSearchQueryRef = useRef<string | null>(null);
  const qc = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ["history"],
    queryFn: historyApi.list,
  });

  const recentSearches = useMemo(() => {
    const seen = new Set<string>();

    return history
      .filter((item) => {
        const normalizedQuery = item.query.trim().toLowerCase();

        if (!normalizedQuery || seen.has(normalizedQuery)) {
          return false;
        }

        seen.add(normalizedQuery);
        return true;
      })
      .slice(0, 8);
  }, [history]);

  const searchMutation = useMutation({
    mutationFn: dictionaryApi.search,
    onSuccess: async ({ entry }, searchedQuery) => {
      if (latestSearchQueryRef.current !== searchedQuery) {
        return;
      }

      setSelectedWord(entry);
      setQuery(searchedQuery);
      setLastSearchQuery(searchedQuery);
      setSearchError(null);

      try {
        await historyApi.record(searchedQuery, entry.id);
        qc.invalidateQueries({ queryKey: ["history"] });
      } catch {
        toast.error("Word found, but search history could not be saved");
      }
    },
    onError: (error: Error, searchedQuery) => {
      if (latestSearchQueryRef.current !== searchedQuery) {
        return;
      }

      const message = error.message.includes("not found")
        ? `No results for "${searchedQuery}"`
        : "Search failed";

      setSearchError(message);
      toast.error(message);
    },
  });

  const runSearch = useCallback(
    (rawQuery: string, options?: { syncUrl?: boolean }) => {
      const trimmedQuery = rawQuery.trim();

      if (!trimmedQuery) return;

      latestSearchQueryRef.current = trimmedQuery;
      setLastSubmittedQuery(trimmedQuery);
      setSearchError(null);
      setQuery(trimmedQuery);

      if (options?.syncUrl !== false) {
        autoSearchedQueryRef.current = trimmedQuery;
        setSearchParams({ q: trimmedQuery }, { replace: true });
      }

      searchMutation.mutate(trimmedQuery);
    },
    [searchMutation, setSearchParams]
  );

  const clearSearch = useCallback(() => {
    autoSearchedQueryRef.current = null;
    latestSearchQueryRef.current = null;
    setQuery("");
    setSelectedWord(null);
    setSearchError(null);
    setLastSubmittedQuery("");
    setLastSearchQuery("");
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  }, [setLastSearchQuery, setSearchParams]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runSearch(query);
    }

    if (e.key === "Escape") {
      if (query) {
        clearSearch();
      } else {
        inputRef.current?.blur();
      }
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (e.key === "/" && document.activeElement !== inputRef.current && !isTypingTarget) {
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
    runSearch(urlQuery, { syncUrl: false });
  }, [runSearch, searchParams]);

  const hasDirtyQuery = query.trim().length > 0 && query.trim() !== lastSubmittedQuery;

  return (
    <div className="flex h-full">
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <Input
            ref={inputRef}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            rightElement={
              query ? (
                <button type="button" onClick={clearSearch}>
                  <X className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-600" />
                </button>
              ) : (
                <kbd className="font-mono text-xs text-gray-400">/</kbd>
              )
            }
            placeholder="Search any English word..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-base"
          />

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => runSearch(query)}
              disabled={!query.trim()}
              loading={searchMutation.isPending}
            >
              <SearchIcon className="h-4 w-4" />
              Search
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
            <span>
              {hasDirtyQuery
                ? "Press Enter to search this spelling"
                : 'Press "/" to focus search from anywhere'}
            </span>
            {lastSubmittedQuery && !searchMutation.isPending && (
              <span className="truncate">Last search: {lastSubmittedQuery}</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {recentSearches.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Recent
                </span>
              </div>

              <div className="space-y-1">
                {recentSearches.map((item) => (
                  <RecentSearchButton
                    key={item.id}
                    item={item}
                    active={lastSubmittedQuery.toLowerCase() === item.query.toLowerCase()}
                    onClick={() => runSearch(item.query)}
                  />
                ))}
              </div>
            </div>
          )}

          {recentSearches.length === 0 && !selectedWord && !searchError && (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title="Search a word"
              description="Type an English word, then press Enter or click Search"
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {searchError && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {searchError}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {selectedWord
                    ? `Still showing "${selectedWord.word}". Try a different spelling or pick a recent search.`
                    : "Try another spelling or pick one of your recent searches."}
                </p>
              </div>
            </div>
          </div>
        )}

        {searchMutation.isPending ? (
          <WordDetailSkeleton />
        ) : selectedWord ? (
          <WordDetailPanel
            entry={selectedWord}
            onWordUpdate={(updated) => setSelectedWord(updated)}
            onLookupWord={(word) => runSearch(word)}
          />
        ) : searchError ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<SearchIcon className="h-8 w-8" />}
              title="No word selected"
              description="Try another spelling or revisit one of your recent searches."
              action={
                <Button variant="secondary" onClick={() => inputRef.current?.focus()}>
                  <SearchIcon className="h-4 w-4" />
                  Focus search
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-950/30">
                <SearchIcon className="h-10 w-10 text-brand-300 dark:text-brand-700" />
              </div>
              <p className="text-lg font-medium text-gray-400">No word selected</p>
              <p className="mt-1 text-sm text-gray-400">
                Search for a word to see its definition and save it faster
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RecentSearchButtonProps {
  item: HistoryEntry;
  active: boolean;
  onClick: () => void;
}

function RecentSearchButton({
  item,
  active,
  onClick,
}: RecentSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200"
          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
    >
      <SearchIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.query}</div>
        <div className="truncate text-xs text-gray-400">
          {item.word ? `Found ${item.word}` : "Search history"}
        </div>
      </div>
      <span className="flex-shrink-0 text-xs text-gray-400">
        {formatRelativeTime(item.searched_at)}
      </span>
    </button>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffInMinutes = Math.round((timestamp - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const absoluteMinutes = Math.abs(diffInMinutes);

  if (absoluteMinutes < 60) {
    return formatter.format(diffInMinutes, "minute");
  }

  const diffInHours = Math.round(diffInMinutes / 60);

  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, "hour");
  }

  return formatter.format(Math.round(diffInHours / 24), "day");
}

function WordDetailSkeleton() {
  return (
    <div className="max-w-2xl animate-pulse space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded" />
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-8 w-64 rounded" />
      </div>
      <div className="h-px bg-gray-200 dark:bg-gray-800" />
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="skeleton h-4 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
