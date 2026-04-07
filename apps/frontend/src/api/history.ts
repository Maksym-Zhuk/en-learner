import { api } from "./client";

export interface HistoryEntry {
  id: string;
  query: string;
  word_id: string | null;
  word: string | null;
  searched_at: string;
}

export const historyApi = {
  list: () => api.get<HistoryEntry[]>("/history"),
  record: (query: string, word_id?: string) =>
    api.post("/history", { query, word_id }),
};
