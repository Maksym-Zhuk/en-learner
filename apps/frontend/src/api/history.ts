import { api } from "./client";
import { desktopLocalCore } from "@/lib/local-core";

export interface HistoryEntry {
  id: string;
  query: string;
  word_id: string | null;
  word: string | null;
  searched_at: string;
}

export const historyApi = {
  list: () =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.listHistory()
      : api.get<HistoryEntry[]>("/history"),
  record: (query: string, word_id?: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.recordSearch(query, word_id)
      : api.post("/history", { query, word_id }),
};
