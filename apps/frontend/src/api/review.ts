import { api } from "./client";
import { desktopLocalCore } from "@/lib/local-core";
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
    if (desktopLocalCore.isAvailable()) {
      return desktopLocalCore.startReviewSession(setId, limit);
    }

    const params = new URLSearchParams();
    if (setId) params.set("set_id", setId);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return api.get<ReviewSession>(`/review/session${qs ? "?" + qs : ""}`);
  },

  submit: (data: SubmitReviewRequest) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.submitReview(data)
      : api.post<SubmitReviewResponse>("/review/submit", data),

  summary: (sessionId: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.getSessionSummary(sessionId)
      : api.get<SessionSummary>(`/review/session/${sessionId}/summary`),

  createSharedSetLink: (setId: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.createSharedSetLink(setId)
      : api.post<PublicTestLink>(`/sets/${setId}/share`, {}),

  createPublicTestLink: (setId: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.createSharedSetLink(setId)
      : api.post<PublicTestLink>(`/sets/${setId}/share`, {}),

  getPublicTestDeck: (token: string) =>
    api.get<PublicTestDeck>(`/public/tests/${token}`),
};
