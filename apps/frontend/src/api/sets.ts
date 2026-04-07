import { api } from "./client";
import type {
  CreateSetRequest,
  StudySet,
  UpdateSetRequest,
  WordEntry,
} from "@/types";

export const setsApi = {
  list: () => api.get<StudySet[]>("/sets"),

  get: (id: string) => api.get<StudySet>(`/sets/${id}`),

  create: (name: string, description?: string) =>
    api.post<StudySet>("/sets", { name, description } satisfies CreateSetRequest),

  update: (id: string, data: UpdateSetRequest) =>
    api.put<StudySet>(`/sets/${id}`, data),

  delete: (id: string) => api.delete(`/sets/${id}`),

  listWords: (id: string) => api.get<WordEntry[]>(`/sets/${id}/words`),

  addWord: (setId: string, wordId: string) =>
    api.post(`/sets/${setId}/words`, { word_id: wordId }),

  removeWord: (setId: string, wordId: string) =>
    api.delete(`/sets/${setId}/words/${wordId}`),
};
