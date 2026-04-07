import { startTransition, useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock3, History as HistoryIcon, Search } from "lucide-react";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { historyApi, type HistoryEntry } from "@/api/history";

export default function History() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearch = deferredSearchValue.trim().toLowerCase();

  const {
    data: history = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["history"],
    queryFn: historyApi.list,
  });

  const filteredHistory = history.filter((entry) => {
    if (!normalizedSearch) {
      return true;
    }

    return [entry.query, entry.word ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedSearch)
    );
  });

  const sections = groupHistoryByDay(filteredHistory);
  const uniqueQueries = new Set(history.map((entry) => entry.query.toLowerCase())).size;
  const todayCount = history.filter((entry) => isSameDay(new Date(entry.searched_at), new Date())).length;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <Skeleton className="h-56 rounded-3xl" />
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-48 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          icon={<HistoryIcon className="h-8 w-8" />}
          title="Search history is unavailable"
          description="The app could not load recent searches right now."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="card">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Search Trail</div>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
                <HistoryIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Revisit what you searched recently
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Scan the timeline, jump back into a word detail page, or repeat
                  a search with one click.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[380px]">
            <SummaryTile label="Entries" value={`${history.length}`} />
            <SummaryTile label="Unique terms" value={`${uniqueQueries}`} />
            <SummaryTile label="Today" value={`${todayCount}`} />
          </div>
        </div>

        <div className="panel-muted mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={searchValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              startTransition(() => setSearchValue(nextValue));
            }}
            placeholder="Filter by query or matched word"
            leftIcon={<Search className="h-4 w-4" />}
            rightElement={
              searchValue ? (
                <button
                  type="button"
                  className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => setSearchValue("")}
                >
                  Clear
                </button>
              ) : null
            }
          />

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock3 className="h-4 w-4" />
            Showing {filteredHistory.length} of {history.length}
          </div>
        </div>
      </section>

      {history.length === 0 ? (
        <EmptyState
          icon={<Clock3 className="h-8 w-8" />}
          title="No search history yet"
          description="Words you search for will appear here so you can quickly return to them."
          action={
            <Button onClick={() => navigate("/search")}>
              <Search className="h-4 w-4" />
              Search words
            </Button>
          }
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No matches for this filter"
          description="Try a broader query or clear the filter to see the full timeline."
          action={
            <Button variant="secondary" onClick={() => setSearchValue("")}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.key} className="card">
              <div className="flex flex-col gap-2 border-b border-gray-200/80 pb-4 dark:border-gray-800/80 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {section.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {section.subtitle}
                  </p>
                </div>
                <div className="text-sm text-gray-400 dark:text-gray-500">
                  {section.entries.length} item{section.entries.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {section.entries.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    onOpen={() => {
                      if (entry.word_id) {
                        navigate(`/words/${entry.word_id}`);
                        return;
                      }

                      navigate(`/search?q=${encodeURIComponent(entry.query)}`);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="metric-tile">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  onOpen,
}: {
  entry: HistoryEntry;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-transparent bg-gray-50/80 px-4 py-4 text-left transition-colors hover:border-gray-200 hover:bg-white dark:bg-gray-900/40 dark:hover:border-gray-800 dark:hover:bg-gray-900"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm dark:bg-gray-950 dark:text-gray-500">
        <Search className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {entry.query}
          </div>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {entry.word_id ? "Word page" : "Repeat search"}
          </span>
        </div>

        {entry.word && entry.word !== entry.query && (
          <div className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
            Matched word: {entry.word}
          </div>
        )}
      </div>

      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatRelativeDate(entry.searched_at)}
        </div>
        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {formatTime(entry.searched_at)}
        </div>
      </div>

      <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
    </button>
  );
}

function groupHistoryByDay(entries: HistoryEntry[]) {
  const sections = new Map<
    string,
    {
      key: string;
      title: string;
      subtitle: string;
      entries: HistoryEntry[];
    }
  >();

  for (const entry of entries) {
    const date = new Date(entry.searched_at);
    const key = getDayKey(date);

    if (!sections.has(key)) {
      sections.set(key, {
        key,
        title: formatSectionTitle(date),
        subtitle: formatSectionSubtitle(date),
        entries: [],
      });
    }

    sections.get(key)!.entries.push(entry);
  }

  return Array.from(sections.values());
}

function formatSectionTitle(date: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatSectionSubtitle(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeDate(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
