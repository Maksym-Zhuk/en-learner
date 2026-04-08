import { api } from "./client";
import { desktopLocalCore } from "@/lib/local-core";
import type {
  CreateSetRequest,
  StudySet,
  UpdateSetRequest,
  WordEntry,
} from "@/types";

export const setsApi = {
  list: () =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.listSets()
      : api.get<StudySet[]>("/sets"),

  get: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.getSet(id)
      : api.get<StudySet>(`/sets/${id}`),

  create: (name: string, description?: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.createSet(name, description)
      : api.post<StudySet>("/sets", { name, description } satisfies CreateSetRequest),

  update: (id: string, data: UpdateSetRequest) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.updateSet(id, data)
      : api.put<StudySet>(`/sets/${id}`, data),

  delete: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.deleteSet(id)
      : api.delete(`/sets/${id}`),

  listWords: (id: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.listSetWords(id)
      : api.get<WordEntry[]>(`/sets/${id}/words`),

  addWord: (setId: string, wordId: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.addWordToSet(setId, wordId)
      : api.post(`/sets/${setId}/words`, { word_id: wordId }),

  removeWord: (setId: string, wordId: string) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.removeWordFromSet(setId, wordId)
      : api.delete(`/sets/${setId}/words/${wordId}`),
};
