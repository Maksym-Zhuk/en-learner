import { AlertTriangle, GraduationCap, RotateCcw } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { ReviewResetMode } from "@/types";

interface RelearnWordModalProps {
  open: boolean;
  onClose: () => void;
  word: string;
  loading?: boolean;
  onSelect: (mode: ReviewResetMode) => void;
}

export function RelearnWordModal({
  open,
  onClose,
  word,
  loading,
  onSelect,
}: RelearnWordModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Return Word To Study">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose how <span className="font-semibold text-gray-900 dark:text-gray-100">{word}</span>{" "}
          should come back into your queue.
        </p>

        <OptionCard
          icon={<RotateCcw className="h-5 w-5" />}
          title="Forgot it"
          description="Keep the existing history, but bring the word back right away in relearning mode."
          onClick={() => onSelect("forgotten")}
          loading={loading}
        />

        <OptionCard
          icon={<GraduationCap className="h-5 w-5" />}
          title="Reset as new"
          description="Clear progress and treat this word like a fresh card again."
          onClick={() => onSelect("new")}
          loading={loading}
        />

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Reset as new wipes the learning progress for this word. Forgot it only places it back into the active queue.
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function OptionCard({
  icon,
  title,
  description,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </button>
  );
}
