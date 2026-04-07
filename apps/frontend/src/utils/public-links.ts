function normalizeUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export function getPublicAppBaseUrl(): string {
  const configured = normalizeUrl(
    window.__EN_LEARNER_RUNTIME_CONFIG?.publicAppUrl ??
      import.meta.env.VITE_PUBLIC_APP_URL
  );

  if (configured) {
    return configured;
  }

  return normalizeUrl(`${window.location.origin}${window.location.pathname}`);
}

export function buildPublicTestUrl(token: string): string {
  return `${getPublicAppBaseUrl()}#/public/tests/${encodeURIComponent(token)}`;
}
