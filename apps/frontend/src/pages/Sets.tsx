import { useDeferredValue, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Layers,
  Trash2,
  Edit2,
  ArrowRight,
  Search,
  Play,
  RefreshCw,
  FolderSearch,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Input, Modal, Skeleton } from "@/components/ui";
import { setsApi } from "@/api/sets";
import type { StudySet } from "@/types";

export default function Sets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<StudySet | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

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
  });

  const createMutation = useMutation({
    mutationFn: () => setsApi.create(name.trim(), description.trim() || undefined),
    onSuccess: () => {
      toast.success("Study set created");
      qc.invalidateQueries({ queryKey: ["sets"] });
      closeCreate();
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError, "Failed to create set")),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      setsApi.update(editingSet!.id, {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      }),
    onSuccess: () => {
      toast.success("Set updated");
      qc.invalidateQueries({ queryKey: ["sets"] });
      closeEdit();
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError, "Failed to update set")),
  });

  const deleteMutation = useMutation({
    mutationFn: setsApi.delete,
    onSuccess: () => {
      toast.success("Set deleted");
      qc.invalidateQueries({ queryKey: ["sets"] });
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError, "Failed to delete set")),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    resetForm();
  };

  const openEdit = (set: StudySet) => {
    setName(set.name);
    setDescription(set.description ?? "");
    setEditingSet(set);
  };

  const closeEdit = () => {
    setEditingSet(null);
    resetForm();
  };

  const filteredSets = sets.filter((set) => {
    if (!deferredQuery) return true;

    return [set.name, set.description ?? ""].some((value) =>
      value.toLowerCase().includes(deferredQuery)
    );
  });

  const totalWords = sets.reduce((sum, set) => sum + set.word_count, 0);
  const nonEmptySets = sets.filter((set) => set.word_count > 0).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Couldn't load study sets"
          description={getErrorMessage(error, "Refresh the page or try again in a moment.")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => refetch()} loading={isFetching}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
              <Button variant="secondary" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create set
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Study Sets</h1>
          <p className="text-sm text-gray-500">
            {sets.length} {sets.length === 1 ? "set" : "sets"} · {totalWords}{" "}
            {totalWords === 1 ? "word" : "words"}
          </p>
        </div>
        <Button onClick={openCreate} className="sm:self-start">
          <Plus className="h-4 w-4" />
          New set
        </Button>
      </div>

      {sets.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets by name or description"
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
            <div className="text-gray-400">Ready to review</div>
            <div className="mt-1 font-semibold">{nonEmptySets} sets</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-gray-400">Showing</div>
            <div className="mt-1 font-semibold">
              {filteredSets.length} of {sets.length}
            </div>
          </div>
        </div>
      )}

      {sets.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="No study sets yet"
          description="Create sets to organize words by topic and review them with flashcards"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create set
            </Button>
          }
        />
      ) : filteredSets.length === 0 ? (
        <EmptyState
          icon={<FolderSearch className="h-8 w-8" />}
          title="No sets match this search"
          description="Try a different keyword or clear the filter to see all study sets."
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSets.map((set) => (
            <div
              key={set.id}
              role="button"
              tabIndex={0}
              className="card group flex flex-col transition-all hover:border-brand-200 hover:shadow-md dark:hover:border-brand-800"
              onClick={() => navigate(`/sets/${set.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/sets/${set.id}`);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(set);
                    }}
                    className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${set.name}"?`)) {
                        deleteMutation.mutate(set.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex-1">
                <h3 className="font-semibold leading-tight">{set.name}</h3>
                {set.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {set.description}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {set.word_count} {set.word_count === 1 ? "word" : "words"}
                </div>
                <div className="flex items-center gap-2">
                  {set.word_count > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/review?set_id=${set.id}`);
                      }}
                    >
                      <Play className="h-4 w-4" />
                      Study
                    </Button>
                  )}
                  <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-brand-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={closeCreate} title="New Study Set">
        <SetForm
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSubmit={() => createMutation.mutate()}
          onCancel={closeCreate}
          loading={createMutation.isPending}
          submitLabel="Create"
        />
      </Modal>

      <Modal open={!!editingSet} onClose={closeEdit} title="Edit Study Set">
        <SetForm
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSubmit={() => updateMutation.mutate()}
          onCancel={closeEdit}
          loading={updateMutation.isPending}
          submitLabel="Save changes"
        />
      </Modal>
    </div>
  );
}

function SetForm({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: {
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Name *</label>
        <Input
          placeholder="e.g. Business English"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit()}
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Description</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Optional description..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && name.trim()) {
              onSubmit();
            }
          }}
        />
        <p className="mt-1 text-xs text-gray-400">Tip: press Ctrl/Cmd + Enter to save quickly.</p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          loading={loading}
          disabled={!name.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
