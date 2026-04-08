import { api } from "./client";
import { desktopLocalCore } from "@/lib/local-core";
import type { ResetWordReviewResponse, ReviewResetMode, WordEntry } from "@/types";

export interface SearchResponse {
  entry: WordEntry;
  from_cache: boolean;
}

export const dictionaryApi = {
  search: (q: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.searchWord(q)
      : api.get<SearchResponse>(`/words/search?q=${encodeURIComponent(q)}`),

  getWord: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.getWord(id)
      : api.get<WordEntry>(`/words/${id}`),

  listSaved: () =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.listSavedWords()
      : api.get<WordEntry[]>("/words/saved"),

  saveWord: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.saveWord(id)
      : api.post(`/words/${id}/save`),
  unsaveWord: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.unsaveWord(id)
      : api.delete(`/words/${id}/save`),
  relearnWord: (id: string, mode: ReviewResetMode = "forgotten") =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.relearnWord(id, mode)
      : api.post<ResetWordReviewResponse>(`/words/${id}/relearn`, { mode }),

  favoriteWord: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.favoriteWord(id)
      : api.post(`/words/${id}/favorite`),
  unfavoriteWord: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.unfavoriteWord(id)
      : api.delete(`/words/${id}/favorite`),

  listFavorites: () =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.listFavorites()
      : api.get<WordEntry[]>("/favorites"),
};
