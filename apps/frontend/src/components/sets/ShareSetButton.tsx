import { useMutation } from "@tanstack/react-query";
import type { ComponentProps, MouseEvent } from "react";
import { Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { reviewApi } from "@/api/review";
import { Button } from "@/components/ui";
import { buildPublicTestUrl } from "@/utils/public-links";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

interface ShareSetButtonProps {
  setId: string;
  setName: string;
  cardsCount: number;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  stopPropagation?: boolean;
}

export function ShareSetButton({
  setId,
  setName,
  cardsCount,
  label = "Share",
  variant = "secondary",
  size = "sm",
  disabled,
  className,
  stopPropagation,
}: ShareSetButtonProps) {
  const shareMutation = useMutation({
    mutationFn: () => reviewApi.createSharedSetLink(setId),
    onSuccess: async (data) => {
      const shareUrl = buildPublicTestUrl(data.token);

      try {
        if (typeof navigator.share === "function") {
          await navigator.share({
            title: `${setName} study set`,
            text: buildShareText(setName, cardsCount),
            url: shareUrl,
          });
          return;
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Shared set link copied");
        return;
      } catch {
        toast.success(`Share this link: ${shareUrl}`);
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to prepare shared set link"));
    },
  });

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    shareMutation.mutate();
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || cardsCount === 0}
      loading={shareMutation.isPending}
      onClick={handleClick}
      className={className}
      title={cardsCount === 0 ? "Add words before sharing this set" : undefined}
    >
      <Share2 className="h-4 w-4" />
      {label}
    </Button>
  );
}

function buildShareText(setName: string, cardsCount: number) {
  return `${cardsCount} ${cardsCount === 1 ? "card" : "cards"} from ${setName}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
