import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Layers, Trash2, Edit2, ArrowRight } from "lucide-react";
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

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ["sets"],
    queryFn: setsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => setsApi.create(name.trim(), description.trim() || undefined),
    onSuccess: () => {
      toast.success("Study set created");
      qc.invalidateQueries({ queryKey: ["sets"] });
      setCreateOpen(false);
      resetForm();
    },
    onError: () => toast.error("Failed to create set"),
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
      setEditingSet(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: setsApi.delete,
    onSuccess: () => {
      toast.success("Set deleted");
      qc.invalidateQueries({ queryKey: ["sets"] });
    },
    onError: () => toast.error("Failed to delete set"),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (set: StudySet) => {
    setName(set.name);
    setDescription(set.description ?? "");
    setEditingSet(set);
  };

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Sets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sets.length} sets</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New set
        </Button>
      </div>

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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => (
            <div
              key={set.id}
              className="card group flex flex-col hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all cursor-pointer"
              onClick={() => navigate(`/sets/${set.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <Layers className="h-4.5 w-4.5 h-5 w-5" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      if (confirm(`Delete "${set.name}"?`)) deleteMutation.mutate(set.id);
                    }}
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
                <span className="text-sm text-gray-400">
                  {set.word_count} {set.word_count === 1 ? "word" : "words"}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-brand-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Study Set">
        <SetForm
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSubmit={() => createMutation.mutate()}
          onCancel={() => setCreateOpen(false)}
          loading={createMutation.isPending}
          submitLabel="Create"
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editingSet}
        onClose={() => setEditingSet(null)}
        title="Edit Study Set"
      >
        <SetForm
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSubmit={() => updateMutation.mutate()}
          onCancel={() => setEditingSet(null)}
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
          rows={2}
          placeholder="Optional description..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
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
