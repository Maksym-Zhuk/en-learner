// ============================================================
// Shared API contract types between frontend and backend
// These must stay in sync with Rust structs in models/
// ============================================================

// --- Dictionary / Word ---

export interface Phonetic {
  text: string | null;
  audio_url: string | null;
}

export interface Definition {
  definition: string;
  example: string | null;
  synonyms: string[];
  antonyms: string[];
}

export interface Meaning {
  part_of_speech: string;
  definitions: Definition[];
}

export interface WordEntry {
  id: string;
  word: string;
  phonetic_text: string | null;
  phonetic_audio_url: string | null;
  meanings: Meaning[];
  translation_uk: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  is_saved: boolean;
  is_favorite: boolean;
}

export interface WordSearchResult {
  entry: WordEntry;
  from_cache: boolean;
}

// --- Study Sets ---

export interface StudySet {
  id: string;
  name: string;
  description: string | null;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudySetWithWords extends StudySet {
  words: WordEntry[];
}

export interface CreateSetRequest {
  name: string;
  description?: string;
}

export interface UpdateSetRequest {
  name?: string;
  description?: string | null;
}

// --- Review / Flashcards ---

export type CardState = "new" | "learning" | "review" | "relearning";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type CardFace = "en_to_uk" | "uk_to_en" | "definition_to_word" | "example_to_word";

export interface ReviewCard {
  id: string;
  word_id: string;
  word: string;
  translation_uk: string | null;
  phonetic_text: string | null;
  primary_definition: string | null;
  primary_example: string | null;
  face: CardFace;
  state: CardState;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
}

export interface ReviewSession {
  session_id: string;
  cards: ReviewCard[];
  total: number;
  new_count: number;
  review_count: number;
  relearning_count: number;
}

export interface SubmitReviewRequest {
  session_id: string;
  card_id: string;
  rating: ReviewRating;
  time_spent_ms: number;
}

export interface SubmitReviewResponse {
  next_due_at: string;
  interval_days: number;
  new_state: CardState;
}

export type ReviewResetMode = "forgotten" | "new";

export interface ResetWordReviewRequest {
  mode?: ReviewResetMode;
}

export interface ResetWordReviewResponse {
  word_id: string;
  cards_reset: number;
  mode: ReviewResetMode;
  due_at: string;
  queued_at: string;
}

export interface SessionSummary {
  total_reviewed: number;
  again_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
  duration_ms: number;
}

export interface PublicTestLink {
  token: string;
  set_id: string;
  set_name: string;
  cards_count: number;
  api_path: string;
  web_path: string;
}

export interface PublicTestDeck {
  token: string;
  set_id: string;
  set_name: string;
  set_description: string | null;
  cards: ReviewCard[];
  total: number;
}

// --- Auth / Connectivity ---

export type ConnectivityMode = "auto" | "offline" | "online";
export type AuthMode = "none" | "guest" | "remote";
export type AuthProviderId =
  | "password"
  | "google"
  | "github"
  | "microsoft"
  | "discord"
  | "apple";

export interface AuthUser {
  id: string;
  email: string | null;
  display_name: string;
  provider: string;
  created_at: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expires_at: string;
}

export interface AuthProvider {
  id: AuthProviderId;
  label: string;
  kind: "password" | "oauth";
  available: boolean;
  requires_external_browser: boolean;
  start_path: string | null;
  description: string;
}

export interface AuthProvidersResponse {
  providers: AuthProvider[];
}

export interface OAuthStartResponse {
  provider: AuthProviderId;
  state: string;
  authorization_url: string;
  poll_path: string;
  expires_at: string;
  requires_external_browser: boolean;
}

export interface OAuthStatusResponse {
  status: "pending" | "complete" | "failed";
  session: AuthSession | null;
  error: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// --- Dashboard ---

export interface DashboardStats {
  total_words_saved: number;
  words_due_today: number;
  current_streak_days: number;
  total_reviews_today: number;
  hardest_words: HardWord[];
  recent_sets: StudySet[];
  recent_words: RecentWord[];
  words_by_state: WordsByState;
}

export interface HardWord {
  word_id: string;
  word: string;
  lapses: number;
  ease_factor: number;
}

export interface WordsByState {
  new: number;
  learning: number;
  review: number;
  relearning: number;
}

// --- History ---

export interface SearchHistoryEntry {
  id: string;
  query: string;
  word_id: string | null;
  word: string | null;
  searched_at: string;
}

export interface RecentWord {
  word_id: string;
  word: string;
  phonetic_text: string | null;
  translation_uk: string | null;
  last_searched_at: string;
  search_count: number;
}

// --- Favorites ---

export interface FavoriteWord extends WordEntry {
  favorited_at: string;
}

// --- Settings ---

export interface AppSettings {
  dark_mode: boolean;
  daily_review_limit: number;
  new_cards_per_day: number;
  audio_autoplay: boolean;
  show_translation_immediately: boolean;
  ui_language: string;
}

// --- Saved Words ---

export interface SaveWordRequest {
  word_id: string;
}

export interface AddToSetRequest {
  word_id: string;
  set_id: string;
}

// --- API Response wrappers ---

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResult<T> = { data: T; error?: never } | { data?: never; error: ApiError };
