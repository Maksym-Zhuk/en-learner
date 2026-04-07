// Re-export shared types and add frontend-specific types

export type {
  WordEntry,
  WordSearchResult,
  Phonetic,
  Meaning,
  Definition,
  StudySet,
  StudySetWithWords,
  ReviewCard,
  ReviewSession,
  ReviewRating,
  CardState,
  CardFace,
  SubmitReviewRequest,
  SubmitReviewResponse,
  SessionSummary,
  DashboardStats,
  HardWord,
  WordsByState,
  SearchHistoryEntry,
  RecentWord,
  FavoriteWord,
  AppSettings,
  CreateSetRequest,
  UpdateSetRequest,
  SaveWordRequest,
  AddToSetRequest,
} from "@en-learner/shared";

// Frontend-only types

export interface NavItem {
  label: string;
  to: string;
  icon: string;
}

export type ToastType = "success" | "error" | "info";
