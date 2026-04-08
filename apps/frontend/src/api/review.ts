import { api } from "./client";
import type {
  PublicTestDeck,
  PublicTestLink,
  ReviewSession,
  SessionSummary,
  SubmitReviewRequest,
  SubmitReviewResponse,
} from "@/types";

export const reviewApi = {
  startSession: (setId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (setId) params.set("set_id", setId);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return api.get<ReviewSession>(`/review/session${qs ? "?" + qs : ""}`);
  },

  submit: (data: SubmitReviewRequest) =>
    api.post<SubmitReviewResponse>("/review/submit", data),

  summary: (sessionId: string) =>
    api.get<SessionSummary>(`/review/session/${sessionId}/summary`),

  createSharedSetLink: (setId: string) =>
    api.post<PublicTestLink>(`/sets/${setId}/share`),

  createPublicTestLink: (setId: string) =>
    api.post<PublicTestLink>(`/sets/${setId}/share`),

  getPublicTestDeck: (token: string) =>
    api.get<PublicTestDeck>(`/public/tests/${token}`),
};
