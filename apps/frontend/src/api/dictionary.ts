import { api } from "./client";
import type { WordEntry } from "@/types";

export interface SearchResponse {
  entry: WordEntry;
  from_cache: boolean;
}

export const dictionaryApi = {
  search: (q: string) =>
    api.get<SearchResponse>(`/words/search?q=${encodeURIComponent(q)}`),

  getWord: (id: string) => api.get<WordEntry>(`/words/${id}`),

  listSaved: () => api.get<WordEntry[]>("/words/saved"),

  saveWord: (id: string) => api.post(`/words/${id}/save`),
  unsaveWord: (id: string) => api.delete(`/words/${id}/save`),

  favoriteWord: (id: string) => api.post(`/words/${id}/favorite`),
  unfavoriteWord: (id: string) => api.delete(`/words/${id}/favorite`),

  listFavorites: () => api.get<WordEntry[]>("/favorites"),
};
