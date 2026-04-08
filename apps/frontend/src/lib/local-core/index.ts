import { api, getBaseUrl } from "@/api/client";
import { nativeDesktopApi } from "@/native/desktop";
import type {
  AppSettings,
  CardFace,
  CardState,
  DashboardStats,
  PublicTestLink,
  ResetWordReviewResponse,
  ReviewCard,
  ReviewRating,
  ReviewResetMode,
  ReviewSession,
  SearchHistoryEntry,
  SessionSummary,
  StudySet,
  SubmitReviewRequest,
  SubmitReviewResponse,
  UpdateSetRequest,
  WordEntry,
  WordSearchResult,
} from "@/types";
import { scheduleReview } from "./review-engine";

const DB_NAME = "en-learner-local-core";
const STORE_NAME = "app-state";
const STORE_KEY = "main";
const DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";
const LINGVA_API_BASE = "https://lingva.ml/api/v1/en/uk";
const DEFAULT_SETTINGS: AppSettings = {
  dark_mode: false,
  daily_review_limit: 100,
  new_cards_per_day: 20,
  audio_autoplay: false,
  show_translation_immediately: false,
  ui_language: "en",
};

type StoredWord = Omit<WordEntry, "is_saved" | "is_favorite">;

interface LocalSetRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  word_ids: string[];
}

interface LocalReviewCardRecord {
  id: string;
  word_id: string;
  face: CardFace;
  state: CardState;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
}

interface LocalReviewSessionRecord {
  id: string;
  set_id: string | null;
  started_at: string;
  finished_at: string | null;
  total_cards: number;
  reviewed: number;
}

interface LocalReviewLogRecord {
  id: string;
  session_id: string;
  card_id: string;
  rating: ReviewRating;
  time_spent_ms: number;
  state_before: CardState;
  state_after: CardState;
  interval_before: number;
  interval_after: number;
  reviewed_at: string;
}

interface LocalDailyStatRecord {
  date: string;
  words_reviewed: number;
  minutes_studied: number;
  updated_at: string;
}

interface LocalAppState {
  version: 1;
  words: Record<string, StoredWord>;
  word_lookup: Record<string, string>;
  saved_words: Record<string, string>;
  favorite_words: Record<string, string>;
  sets: Record<string, LocalSetRecord>;
  search_history: SearchHistoryEntry[];
  review_cards: Record<string, LocalReviewCardRecord>;
  review_sessions: Record<string, LocalReviewSessionRecord>;
  review_logs: LocalReviewLogRecord[];
  daily_stats: Record<string, LocalDailyStatRecord>;
  settings: AppSettings;
}

interface RawDictionaryEntry {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{
      definition?: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
}

interface ShareSetUploadPayload {
  set_name: string;
  set_description: string | null;
  cards: ReviewCard[];
}

let dbPromise: Promise<IDBDatabase> | null = null;
let stateCache: LocalAppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export const desktopLocalCore = {
  isAvailable() {
    return nativeDesktopApi.isAvailable() && typeof window.indexedDB !== "undefined";
  },

  async searchWord(query: string): Promise<WordSearchResult> {
    const normalizedQuery = normalizeLookupKey(query);

    if (!normalizedQuery) {
      throw new Error("Search query cannot be empty");
    }

    const cached = await withRead((state) => findWordByLookup(state, normalizedQuery));
    if (cached) {
      return { entry: cached, from_cache: true };
    }

    const fetched = await fetchDictionaryWord(normalizedQuery);

    return withWrite((state) => {
      const canonicalKey = normalizeLookupKey(fetched.word);
      const existingId =
        state.word_lookup[normalizedQuery] ?? state.word_lookup[canonicalKey] ?? null;
      const wordId = existingId ?? fetched.id;
      const now = nowIso();
      const existing = existingId ? state.words[existingId] : null;

      state.words[wordId] = {
        ...fetched,
        id: wordId,
        created_at: existing?.created_at ?? fetched.created_at,
        updated_at: now,
      };
      state.word_lookup[canonicalKey] = wordId;
      state.word_lookup[normalizedQuery] = wordId;

      return {
        entry: decorateWord(state, state.words[wordId]),
        from_cache: false,
      };
    });
  },

  async getWord(id: string): Promise<WordEntry> {
    return withRead((state) => decorateWord(state, requireWord(state, id)));
  },

  async listSavedWords(): Promise<WordEntry[]> {
    return withRead((state) =>
      Object.entries(state.saved_words)
        .sort((a, b) => compareIsoDesc(a[1], b[1]))
        .map(([wordId]) => decorateWord(state, requireWord(state, wordId)))
    );
  },

  async saveWord(id: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      requireWord(state, id);
      state.saved_words[id] = nowIso();
      ensureReviewCards(state, id);
      return { ok: true as const };
    });
  },

  async unsaveWord(id: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      delete state.saved_words[id];
      return { ok: true as const };
    });
  },

  async relearnWord(
    id: string,
    mode: ReviewResetMode = "forgotten"
  ): Promise<ResetWordReviewResponse> {
    return withWrite((state) => {
      requireWord(state, id);
      const dueAt = nowIso();
      let cardsReset = 0;

      for (const card of findCardsForWord(state, id)) {
        cardsReset += 1;

        if (mode === "new") {
          card.state = "new";
          card.due_at = dueAt;
          card.interval_days = 0;
          card.ease_factor = 2.5;
          card.reps = 0;
          card.lapses = 0;
          card.last_reviewed_at = null;
          continue;
        }

        card.state = card.state === "new" ? "new" : "relearning";
        card.due_at = dueAt;
        card.interval_days = 0;
      }

      return {
        word_id: id,
        cards_reset: cardsReset,
        mode,
        due_at: dueAt,
        queued_at: nowIso(),
      };
    });
  },

  async favoriteWord(id: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      requireWord(state, id);
      state.favorite_words[id] = nowIso();
      return { ok: true as const };
    });
  },

  async unfavoriteWord(id: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      delete state.favorite_words[id];
      return { ok: true as const };
    });
  },

  async listFavorites(): Promise<WordEntry[]> {
    return withRead((state) =>
      Object.entries(state.favorite_words)
        .sort((a, b) => compareIsoDesc(a[1], b[1]))
        .map(([wordId]) => decorateWord(state, requireWord(state, wordId)))
    );
  },

  async listSets(): Promise<StudySet[]> {
    return withRead((state) =>
      Object.values(state.sets)
        .sort((a, b) => compareIsoDesc(a.updated_at, b.updated_at))
        .map(toStudySet)
    );
  },

  async getSet(id: string): Promise<StudySet> {
    return withRead((state) => toStudySet(requireSet(state, id)));
  },

  async createSet(name: string, description?: string): Promise<StudySet> {
    return withWrite((state) => {
      const trimmedName = name.trim();
      const trimmedDescription = normalizeNullableText(description);

      if (!trimmedName) {
        throw new Error("Set name cannot be empty");
      }

      const createdAt = nowIso();
      const set: LocalSetRecord = {
        id: createId(),
        name: trimmedName,
        description: trimmedDescription,
        created_at: createdAt,
        updated_at: createdAt,
        word_ids: [],
      };

      state.sets[set.id] = set;
      return toStudySet(set);
    });
  },

  async updateSet(id: string, patch: UpdateSetRequest): Promise<StudySet> {
    return withWrite((state) => {
      const set = requireSet(state, id);

      if (typeof patch.name === "string") {
        const trimmedName = patch.name.trim();
        if (!trimmedName) {
          throw new Error("Set name cannot be empty");
        }
        set.name = trimmedName;
      }

      if ("description" in patch) {
        set.description = normalizeNullableText(patch.description ?? null);
      }

      set.updated_at = nowIso();
      return toStudySet(set);
    });
  },

  async deleteSet(id: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      requireSet(state, id);
      delete state.sets[id];

      for (const session of Object.values(state.review_sessions)) {
        if (session.set_id === id) {
          session.set_id = null;
        }
      }

      return { ok: true as const };
    });
  },

  async listSetWords(id: string): Promise<WordEntry[]> {
    return withRead((state) => {
      const set = requireSet(state, id);
      return set.word_ids
        .map((wordId) => state.words[wordId])
        .filter((word): word is StoredWord => Boolean(word))
        .map((word) => decorateWord(state, word));
    });
  },

  async addWordToSet(setId: string, wordId: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      const set = requireSet(state, setId);
      requireWord(state, wordId);

      set.word_ids = [wordId, ...set.word_ids.filter((id) => id !== wordId)];
      set.updated_at = nowIso();
      state.saved_words[wordId] = nowIso();
      ensureReviewCards(state, wordId);

      return { ok: true as const };
    });
  },

  async removeWordFromSet(setId: string, wordId: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      const set = requireSet(state, setId);
      set.word_ids = set.word_ids.filter((id) => id !== wordId);
      set.updated_at = nowIso();
      return { ok: true as const };
    });
  },

  async startReviewSession(setId?: string, limit = 20): Promise<ReviewSession> {
    return withWrite((state) => {
      const now = Date.now();
      const clampedLimit = Math.min(Math.max(1, limit), 100);
      const allowedWordIds = setId ? new Set(requireSet(state, setId).word_ids) : null;
      const cards = Object.values(state.review_cards)
        .filter((card) => {
          if (isoToMillis(card.due_at) > now) {
            return false;
          }

          if (!state.saved_words[card.word_id]) {
            return false;
          }

          if (allowedWordIds && !allowedWordIds.has(card.word_id)) {
            return false;
          }

          return true;
        })
        .sort(compareReviewCards)
        .slice(0, clampedLimit)
        .map((card) => buildReviewCard(state, card));

      const sessionId = createId();
      state.review_sessions[sessionId] = {
        id: sessionId,
        set_id: setId ?? null,
        started_at: nowIso(),
        finished_at: null,
        total_cards: cards.length,
        reviewed: 0,
      };

      return {
        session_id: sessionId,
        cards,
        total: cards.length,
        new_count: cards.filter((card) => card.state === "new").length,
        review_count: cards.filter((card) => card.state === "review").length,
        relearning_count: cards.filter((card) => card.state === "relearning").length,
      };
    });
  },

  async submitReview(data: SubmitReviewRequest): Promise<SubmitReviewResponse> {
    return withWrite((state) => {
      const session = state.review_sessions[data.session_id];
      if (!session) {
        throw new Error(`Session "${data.session_id}" not found`);
      }

      const card = state.review_cards[data.card_id];
      if (!card) {
        throw new Error(`Card "${data.card_id}" not found`);
      }

      const result = scheduleReview(
        card.state,
        card.interval_days,
        card.ease_factor,
        card.reps,
        card.lapses,
        data.rating
      );
      const reviewedAt = nowIso();

      state.review_logs.push({
        id: createId(),
        session_id: data.session_id,
        card_id: data.card_id,
        rating: data.rating,
        time_spent_ms: Math.max(0, data.time_spent_ms),
        state_before: card.state,
        state_after: result.new_state,
        interval_before: card.interval_days,
        interval_after: result.interval_days,
        reviewed_at: reviewedAt,
      });

      card.state = result.new_state;
      card.due_at = result.due_at;
      card.interval_days = result.interval_days;
      card.ease_factor = result.ease_factor;
      card.reps += 1;
      card.lapses = result.lapses;
      card.last_reviewed_at = reviewedAt;

      session.reviewed += 1;

      const today = todayKey();
      const dailyStat = state.daily_stats[today] ?? {
        date: today,
        words_reviewed: 0,
        minutes_studied: 0,
        updated_at: reviewedAt,
      };
      dailyStat.words_reviewed += 1;
      dailyStat.minutes_studied += Math.max(0, data.time_spent_ms) / 60_000;
      dailyStat.updated_at = reviewedAt;
      state.daily_stats[today] = dailyStat;

      return {
        next_due_at: result.due_at,
        interval_days: result.interval_days,
        new_state: result.new_state,
      };
    });
  },

  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    return withWrite((state) => {
      const session = state.review_sessions[sessionId];
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      if (!session.finished_at) {
        session.finished_at = nowIso();
      }

      const logs = state.review_logs.filter((entry) => entry.session_id === sessionId);
      const durationMs = Math.max(
        0,
        isoToMillis(session.finished_at) - isoToMillis(session.started_at)
      );

      return {
        total_reviewed: logs.length,
        again_count: logs.filter((entry) => entry.rating === "again").length,
        hard_count: logs.filter((entry) => entry.rating === "hard").length,
        good_count: logs.filter((entry) => entry.rating === "good").length,
        easy_count: logs.filter((entry) => entry.rating === "easy").length,
        duration_ms: durationMs,
      };
    });
  },

  async createSharedSetLink(setId: string): Promise<PublicTestLink> {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      throw new Error(
        "Remote backend URL is not configured. Open Settings and set a cloud backend URL first."
      );
    }

    const payload = await withRead((state) => {
      const set = requireSet(state, setId);
      return {
        set_name: set.name,
        set_description: set.description,
        cards: buildSharedDeckCards(state, set),
      } satisfies ShareSetUploadPayload;
    });

    return api.post<PublicTestLink>(`/sets/${setId}/share`, payload);
  },

  async listHistory(): Promise<SearchHistoryEntry[]> {
    return withRead((state) => state.search_history.slice(0, 100));
  },

  async recordSearch(query: string, wordId?: string): Promise<{ ok: true }> {
    return withWrite((state) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return { ok: true as const };
      }

      state.search_history.unshift({
        id: createId(),
        query: trimmedQuery,
        word_id: wordId ?? null,
        word: wordId ? state.words[wordId]?.word ?? null : null,
        searched_at: nowIso(),
      });
      state.search_history = state.search_history.slice(0, 500);
      return { ok: true as const };
    });
  },

  async getSettings(): Promise<AppSettings> {
    return withRead((state) => clone(state.settings));
  },

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return withWrite((state) => {
      if (typeof patch.dark_mode === "boolean") {
        state.settings.dark_mode = patch.dark_mode;
      }

      if (typeof patch.daily_review_limit === "number") {
        state.settings.daily_review_limit = validateLimit(
          "daily_review_limit",
          patch.daily_review_limit,
          10,
          500
        );
      }

      if (typeof patch.new_cards_per_day === "number") {
        state.settings.new_cards_per_day = validateLimit(
          "new_cards_per_day",
          patch.new_cards_per_day,
          1,
          100
        );
      }

      if (typeof patch.audio_autoplay === "boolean") {
        state.settings.audio_autoplay = patch.audio_autoplay;
      }

      if (typeof patch.show_translation_immediately === "boolean") {
        state.settings.show_translation_immediately = patch.show_translation_immediately;
      }

      if (typeof patch.ui_language === "string") {
        state.settings.ui_language = normalizeUiLanguage(patch.ui_language);
      }

      return clone(state.settings);
    });
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return withRead((state) => {
      const savedWordIds = new Set(Object.keys(state.saved_words));
      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayStartMs = startOfToday.getTime();

      const dueWordIds = new Set(
        Object.values(state.review_cards)
          .filter(
            (card) =>
              savedWordIds.has(card.word_id) && isoToMillis(card.due_at) <= now
          )
          .map((card) => card.word_id)
      );

      const wordsByState = {
        new: 0,
        learning: 0,
        review: 0,
        relearning: 0,
      };

      for (const card of Object.values(state.review_cards)) {
        if (!savedWordIds.has(card.word_id)) {
          continue;
        }
        wordsByState[card.state] += 1;
      }

      const hardestWords = Array.from(savedWordIds)
        .map((wordId) => {
          const cards = findCardsForWord(state, wordId);
          const totalLapses = cards.reduce((sum, card) => sum + card.lapses, 0);
          if (totalLapses === 0) {
            return null;
          }

          return {
            word_id: wordId,
            word: requireWord(state, wordId).word,
            lapses: totalLapses,
            ease_factor: Math.min(...cards.map((card) => card.ease_factor)),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.lapses - a.lapses || a.ease_factor - b.ease_factor)
        .slice(0, 5);

      const recentSets = Object.values(state.sets)
        .sort((a, b) => compareIsoDesc(a.updated_at, b.updated_at))
        .slice(0, 5)
        .map(toStudySet);

      const recentWords = Array.from(
        state.search_history.reduce((acc, entry) => {
          if (!entry.word_id) {
            return acc;
          }

          const current = acc.get(entry.word_id);
          if (!current) {
            acc.set(entry.word_id, {
              word_id: entry.word_id,
              last_searched_at: entry.searched_at,
              search_count: 1,
            });
            return acc;
          }

          current.search_count += 1;
          if (isoToMillis(entry.searched_at) > isoToMillis(current.last_searched_at)) {
            current.last_searched_at = entry.searched_at;
          }
          return acc;
        }, new Map<string, { word_id: string; last_searched_at: string; search_count: number }>())
      )
        .map(([, entry]) => {
          const word = requireWord(state, entry.word_id);
          return {
            word_id: entry.word_id,
            word: word.word,
            phonetic_text: word.phonetic_text,
            translation_uk: word.translation_uk,
            last_searched_at: entry.last_searched_at,
            search_count: entry.search_count,
          };
        })
        .sort((a, b) => compareIsoDesc(a.last_searched_at, b.last_searched_at))
        .slice(0, 8);

      return {
        total_words_saved: savedWordIds.size,
        words_due_today: dueWordIds.size,
        current_streak_days: computeStreak(state.daily_stats),
        total_reviews_today: state.review_logs.filter(
          (entry) => isoToMillis(entry.reviewed_at) >= todayStartMs
        ).length,
        words_by_state: wordsByState,
        hardest_words: hardestWords,
        recent_sets: recentSets,
        recent_words: recentWords,
      };
    });
  },
};

function buildSharedDeckCards(
  state: LocalAppState,
  set: LocalSetRecord
): ReviewCard[] {
  return set.word_ids
    .flatMap((wordId) => findCardsForWord(state, wordId))
    .sort((a, b) => {
      const wordCompare = requireWord(state, a.word_id).word.localeCompare(
        requireWord(state, b.word_id).word
      );
      if (wordCompare !== 0) {
        return wordCompare;
      }
      return facePriority(a.face) - facePriority(b.face);
    })
    .map((card) => buildReviewCard(state, card));
}

function buildReviewCard(
  state: LocalAppState,
  card: LocalReviewCardRecord
): ReviewCard {
  const word = requireWord(state, card.word_id);

  return {
    id: card.id,
    word_id: card.word_id,
    word: word.word,
    translation_uk: word.translation_uk,
    phonetic_text: word.phonetic_text,
    primary_definition: getPrimaryDefinition(word),
    primary_example: getPrimaryExample(word),
    face: card.face,
    state: card.state,
    due_at: card.due_at,
    interval_days: card.interval_days,
    ease_factor: card.ease_factor,
    reps: card.reps,
    lapses: card.lapses,
    last_reviewed_at: card.last_reviewed_at,
  };
}

function ensureReviewCards(state: LocalAppState, wordId: string) {
  for (const face of allCardFaces()) {
    const existing = findCardByWordAndFace(state, wordId, face);
    if (existing) {
      continue;
    }

    const cardId = createId();
    state.review_cards[cardId] = {
      id: cardId,
      word_id: wordId,
      face,
      state: "new",
      due_at: nowIso(),
      interval_days: 0,
      ease_factor: 2.5,
      reps: 0,
      lapses: 0,
      last_reviewed_at: null,
    };
  }
}

function findCardByWordAndFace(
  state: LocalAppState,
  wordId: string,
  face: CardFace
) {
  return Object.values(state.review_cards).find(
    (card) => card.word_id === wordId && card.face === face
  );
}

function findCardsForWord(state: LocalAppState, wordId: string) {
  return Object.values(state.review_cards).filter((card) => card.word_id === wordId);
}

function compareReviewCards(a: LocalReviewCardRecord, b: LocalReviewCardRecord) {
  const stateDelta = statePriority(b.state) - statePriority(a.state);
  if (stateDelta !== 0) {
    return stateDelta;
  }

  return isoToMillis(a.due_at) - isoToMillis(b.due_at);
}

function statePriority(state: CardState) {
  switch (state) {
    case "review":
      return 4;
    case "relearning":
      return 3;
    case "learning":
      return 2;
    default:
      return 1;
  }
}

function facePriority(face: CardFace) {
  switch (face) {
    case "en_to_uk":
      return 0;
    case "uk_to_en":
      return 1;
    case "definition_to_word":
      return 2;
    default:
      return 3;
  }
}

function allCardFaces(): CardFace[] {
  return ["en_to_uk", "uk_to_en", "definition_to_word", "example_to_word"];
}

function toStudySet(set: LocalSetRecord): StudySet {
  return {
    id: set.id,
    name: set.name,
    description: set.description,
    word_count: set.word_ids.length,
    created_at: set.created_at,
    updated_at: set.updated_at,
  };
}

function decorateWord(state: LocalAppState, word: StoredWord): WordEntry {
  return {
    ...word,
    is_saved: Boolean(state.saved_words[word.id]),
    is_favorite: Boolean(state.favorite_words[word.id]),
  };
}

function findWordByLookup(state: LocalAppState, lookupKey: string) {
  const wordId = state.word_lookup[lookupKey];
  if (!wordId || !state.words[wordId]) {
    return null;
  }

  return decorateWord(state, state.words[wordId]);
}

function requireWord(state: LocalAppState, id: string) {
  const word = state.words[id];
  if (!word) {
    throw new Error("Word not found");
  }
  return word;
}

function requireSet(state: LocalAppState, id: string) {
  const set = state.sets[id];
  if (!set) {
    throw new Error(`Set "${id}" not found`);
  }
  return set;
}

function getPrimaryDefinition(word: StoredWord) {
  return word.meanings
    .flatMap((meaning) => meaning.definitions)
    .find((definition) => definition.definition.trim())?.definition ?? null;
}

function getPrimaryExample(word: StoredWord) {
  return word.meanings
    .flatMap((meaning) => meaning.definitions)
    .find((definition) => definition.example?.trim())?.example ?? null;
}

function computeStreak(dailyStats: LocalAppState["daily_stats"]) {
  const hasReviewOn = (key: string) => (dailyStats[key]?.words_reviewed ?? 0) > 0;
  let streak = 0;
  let current = todayKey();

  while (true) {
    if (!hasReviewOn(current) && streak === 0 && current === todayKey()) {
      current = previousDayKey(current);
      continue;
    }

    if (!hasReviewOn(current)) {
      break;
    }

    streak += 1;
    current = previousDayKey(current);

    if (streak > 3650) {
      break;
    }
  }

  return streak;
}

async function fetchDictionaryWord(query: string): Promise<StoredWord> {
  const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(query)}`);

  if (response.status === 404) {
    throw new Error(`Word "${query}" not found`);
  }

  if (!response.ok) {
    throw new Error(`Dictionary lookup failed with HTTP ${response.status}`);
  }

  const entries = (await response.json()) as RawDictionaryEntry[];
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Word "${query}" not found`);
  }

  const canonicalWord = (entries[0]?.word ?? query).trim().toLowerCase() || query;
  let phoneticText: string | null = null;
  let phoneticAudioUrl: string | null = null;
  const meanings: StoredWord["meanings"] = [];

  for (const entry of entries) {
    if (!phoneticText && entry.phonetic?.trim()) {
      phoneticText = entry.phonetic.trim();
    }

    for (const phonetic of entry.phonetics ?? []) {
      if (!phoneticText && phonetic.text?.trim()) {
        phoneticText = phonetic.text.trim();
      }
      if (!phoneticAudioUrl && phonetic.audio?.trim()) {
        phoneticAudioUrl = normalizeAudioUrl(phonetic.audio.trim());
      }
    }

    for (const rawMeaning of entry.meanings ?? []) {
      const partOfSpeech = rawMeaning.partOfSpeech?.trim() || "unknown";
      const definitions = (rawMeaning.definitions ?? [])
        .filter((definition) => definition.definition?.trim())
        .map((definition) => ({
          definition: definition.definition!.trim(),
          example: definition.example?.trim() || null,
          synonyms: definition.synonyms ?? [],
          antonyms: definition.antonyms ?? [],
        }));

      if (definitions.length === 0) {
        continue;
      }

      const existingMeaning = meanings.find(
        (meaning) => meaning.part_of_speech === partOfSpeech
      );
      if (existingMeaning) {
        for (const definition of definitions) {
          if (
            !existingMeaning.definitions.some(
              (entry) => entry.definition === definition.definition
            )
          ) {
            existingMeaning.definitions.push(definition);
          }
        }
        continue;
      }

      meanings.push({
        part_of_speech: partOfSpeech,
        definitions,
      });
    }
  }

  const createdAt = nowIso();
  const translationUk = await fetchTranslation(canonicalWord).catch(() => null);

  return {
    id: createId(),
    word: canonicalWord,
    phonetic_text: phoneticText,
    phonetic_audio_url: phoneticAudioUrl,
    meanings,
    translation_uk: translationUk,
    source: "dictionaryapi.dev",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

async function fetchTranslation(word: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${LINGVA_API_BASE}/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { translation?: string };
    return body.translation?.trim() || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeAudioUrl(url: string) {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

function validateLimit(name: string, value: number, min: number, max: number) {
  if (value >= min && value <= max) {
    return value;
  }

  throw new Error(`${name} must be between ${min} and ${max}`);
}

function normalizeUiLanguage(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error("ui_language cannot be empty");
  }
  return normalized;
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function previousDayKey(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function compareIsoDesc(left: string, right: string) {
  return isoToMillis(right) - isoToMillis(left);
}

function isoToMillis(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? 0 : millis;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

async function withRead<T>(fn: (state: LocalAppState) => T | Promise<T>): Promise<T> {
  const state = await loadState();
  return fn(state);
}

async function withWrite<T>(fn: (state: LocalAppState) => T | Promise<T>): Promise<T> {
  let result: T;

  const operation = async () => {
    const state = await loadState();
    result = await fn(state);
    await persistState(state);
  };

  const queued = writeQueue.then(operation, operation);
  writeQueue = queued.then(
    () => undefined,
    () => undefined
  );

  await queued;
  return result!;
}

async function loadState(): Promise<LocalAppState> {
  if (stateCache) {
    return clone(stateCache);
  }

  const db = await openDatabase();
  const stored = await new Promise<LocalAppState | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STORE_KEY);

    request.onsuccess = () => resolve(request.result as LocalAppState | undefined);
    request.onerror = () => reject(request.error ?? new Error("Failed to load local state"));
  });

  stateCache = normalizeState(stored);
  return clone(stateCache);
}

async function persistState(state: LocalAppState) {
  const db = await openDatabase();
  const next = clone(state);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(next, STORE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to persist local state"));
  });

  stateCache = next;
}

function normalizeState(stored?: LocalAppState): LocalAppState {
  if (!stored) {
    return createInitialState();
  }

  return {
    version: 1,
    words: stored.words ?? {},
    word_lookup: stored.word_lookup ?? {},
    saved_words: stored.saved_words ?? {},
    favorite_words: stored.favorite_words ?? {},
    sets: stored.sets ?? {},
    search_history: stored.search_history ?? [],
    review_cards: stored.review_cards ?? {},
    review_sessions: stored.review_sessions ?? {},
    review_logs: stored.review_logs ?? [],
    daily_stats: stored.daily_stats ?? {},
    settings: {
      ...DEFAULT_SETTINGS,
      ...(stored.settings ?? {}),
    },
  };
}

function createInitialState(): LocalAppState {
  return {
    version: 1,
    words: {},
    word_lookup: {},
    saved_words: {},
    favorite_words: {},
    sets: {},
    search_history: [],
    review_cards: {},
    review_sessions: {},
    review_logs: [],
    daily_stats: {},
    settings: clone(DEFAULT_SETTINGS),
  };
}

function openDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open local storage"));
  });

  return dbPromise;
}
