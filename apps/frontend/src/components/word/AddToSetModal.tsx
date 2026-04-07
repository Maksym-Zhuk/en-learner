import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Layers, Loader, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Modal, Button, Input, EmptyState } from "@/components/ui";
import { setsApi } from "@/api/sets";
import type { WordEntry } from "@/types";

interface AddToSetModalProps {
  open: boolean;
  onClose: () => void;
  wordId: string;
  wordName: string;
  onAddedToSet?: () => void;
}

export function AddToSetModal({
  open,
  onClose,
  wordId,
  wordName,
  onAddedToSet,
}: AddToSetModalProps) {
  const qc = useQueryClient();
  const [newSetName, setNewSetName] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewSetName("");
      setSetFilter("");
      setCreating(false);
      setActiveSetId(null);
    }
  }, [open]);

  const {
    data: sets = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["sets"],
    queryFn: setsApi.list,
    enabled: open,
  });

  const filteredSets = useMemo(() => {
    const filter = setFilter.trim().toLowerCase();

    if (!filter) return sets;

    return sets.filter((set) =>
      `${set.name} ${set.description ?? ""}`.toLowerCase().includes(filter)
    );
  }, [setFilter, sets]);

  const matchingSet = useMemo(() => {
    const normalizedName = newSetName.trim().toLowerCase();

    if (!normalizedName) return null;

    return (
      sets.find((set) => set.name.trim().toLowerCase() === normalizedName) ??
      null
    );
  }, [newSetName, sets]);

  const addMutation = useMutation({
    mutationFn: (setId: string) => setsApi.addWord(setId, wordId),
    onMutate: (setId) => {
      setActiveSetId(setId);
    },
    onSuccess: (_data, setId) => {
      toast.success(`Added "${wordName}" to set`);
      qc.setQueryData<WordEntry>(["word", wordId], (existing) =>
        existing ? { ...existing, is_saved: true } : existing
      );
      qc.invalidateQueries({ queryKey: ["sets"] });
      qc.invalidateQueries({ queryKey: ["set", setId] });
      qc.invalidateQueries({ queryKey: ["set-words", setId] });
      qc.invalidateQueries({ queryKey: ["saved-words"] });
      onAddedToSet?.();
      onClose();
    },
    onError: () => toast.error("Failed to add word to set"),
    onSettled: () => {
      setActiveSetId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const set = await setsApi.create(newSetName.trim());
      await setsApi.addWord(set.id, wordId);
      return set;
    },
    onSuccess: (set) => {
      toast.success(`Created set and added "${wordName}"`);
      qc.setQueryData<WordEntry>(["word", wordId], (existing) =>
        existing ? { ...existing, is_saved: true } : existing
      );
      qc.invalidateQueries({ queryKey: ["sets"] });
      qc.invalidateQueries({ queryKey: ["set", set.id] });
      qc.invalidateQueries({ queryKey: ["set-words", set.id] });
      qc.invalidateQueries({ queryKey: ["saved-words"] });
      onAddedToSet?.();
      setNewSetName("");
      setCreating(false);
      onClose();
    },
    onError: () => toast.error("Failed to create set"),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Add "${wordName}" to a set`}>
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Adding to a set also saves this word
              </p>
              <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                It will appear in Saved Words and be ready for review.
              </p>
            </div>
          </div>
        </div>

        {sets.length > 0 && !isError && (
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Filter sets..."
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
          />
        )}

        {/* Existing sets */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 skeleton rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="Couldn't load study sets"
            description={getErrorMessage(error, "Try again or create a new set below.")}
            action={
              <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
                Retry
              </Button>
            }
          />
        ) : sets.length === 0 && !creating ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No study sets yet"
            description="Create your first set below"
          />
        ) : sets.length > 0 && filteredSets.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matching sets"
            description={`No sets match "${setFilter.trim()}"`}
          />
        ) : sets.length > 0 ? (
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {filteredSets.map((set) => (
              <button
                key={set.id}
                onClick={() => addMutation.mutate(set.id)}
                disabled={addMutation.isPending || createMutation.isPending}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{set.name}</div>
                  {set.description && (
                    <div className="truncate text-xs text-gray-400">
                      {set.description}
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  {activeSetId === set.id && (
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {activeSetId === set.id ? "Adding..." : `${set.word_count} words`}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
          {creating ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Set name..."
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSetName.trim()) createMutation.mutate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  autoFocus
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={!newSetName.trim()}
                  loading={createMutation.isPending}
                >
                  Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>

              {matchingSet && (
                <button
                  type="button"
                  onClick={() => addMutation.mutate(matchingSet.id)}
                  className="text-xs text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Use existing set "{matchingSet.name}" instead
                </button>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(true);
                if (setFilter.trim()) {
                  setNewSetName(setFilter.trim());
                }
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              New set
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
