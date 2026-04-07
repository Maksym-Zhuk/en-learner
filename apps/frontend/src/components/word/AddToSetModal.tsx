import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Layers } from "lucide-react";
import toast from "react-hot-toast";
import { Modal, Button, Input, EmptyState } from "@/components/ui";
import { setsApi } from "@/api/sets";

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
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewSetName("");
      setCreating(false);
    }
  }, [open]);

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ["sets"],
    queryFn: setsApi.list,
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (setId: string) => setsApi.addWord(setId, wordId),
    onSuccess: (_data, setId) => {
      toast.success(`Added "${wordName}" to set`);
      qc.invalidateQueries({ queryKey: ["sets"] });
      qc.invalidateQueries({ queryKey: ["set", setId] });
      qc.invalidateQueries({ queryKey: ["set-words", setId] });
      qc.invalidateQueries({ queryKey: ["saved-words"] });
      onAddedToSet?.();
      onClose();
    },
    onError: () => toast.error("Failed to add word to set"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const set = await setsApi.create(newSetName.trim());
      await setsApi.addWord(set.id, wordId);
      return set;
    },
    onSuccess: (set) => {
      toast.success(`Created set and added "${wordName}"`);
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
    <Modal open={open} onClose={onClose} title={`Add "${wordName}" to set`}>
      <div className="space-y-3">
        {/* Existing sets */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 skeleton rounded-lg" />
            ))}
          </div>
        ) : sets.length === 0 && !creating ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No study sets yet"
            description="Create your first set below"
          />
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {sets.map((set) => (
              <button
                key={set.id}
                onClick={() => addMutation.mutate(set.id)}
                disabled={addMutation.isPending}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="font-medium">{set.name}</span>
                <span className="text-xs text-gray-400">{set.word_count} words</span>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
          {creating ? (
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
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreating(true)}
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
