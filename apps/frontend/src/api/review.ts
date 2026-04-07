import { api } from "./client";
import type { ReviewSession, SubmitReviewResponse } from "@/types";

export interface SessionSummary {
  total_reviewed: number;
  again_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
  duration_ms: number;
}

export const reviewApi = {
  startSession: (setId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (setId) params.set("set_id", setId);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return api.get<ReviewSession>(`/review/session${qs ? "?" + qs : ""}`);
  },

  submit: (data: {
    session_id: string;
    card_id: string;
    rating: string;
    time_spent_ms: number;
  }) => api.post<SubmitReviewResponse>("/review/submit", data),

  summary: (sessionId: string) =>
    api.get<SessionSummary>(`/review/session/${sessionId}/summary`),
};
