import { api, getBaseUrl } from "./client";
import type {
  AuthProvidersResponse,
  AuthSession,
  AuthUser,
  LoginRequest,
  OAuthStartResponse,
  OAuthStatusResponse,
  RegisterRequest,
} from "@/types";

export const authApi = {
  listProviders: async () => {
    const response = await api.get<AuthProvidersResponse>("/auth/providers");
    return response.providers;
  },

  register: (data: RegisterRequest) => api.post<AuthSession>("/auth/register", data),

  login: (data: LoginRequest) => api.post<AuthSession>("/auth/login", data),

  me: () => api.get<AuthUser>("/auth/me"),

  logout: () => api.post<{ ok: boolean }>("/auth/logout"),

  startOAuth: (provider: string) =>
    api.post<OAuthStartResponse>(`/auth/oauth/${provider}/start`),

  getOAuthStatus: (state: string) =>
    api.get<OAuthStatusResponse>(`/auth/oauth/status/${state}`),

  resolveOAuthUrl: (relativePath: string) => `${getBaseUrl()}${relativePath}`,
};
