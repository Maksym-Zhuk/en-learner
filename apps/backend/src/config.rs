use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub dictionary_api_url: String,
    pub lingva_api_url: String,
    pub public_backend_url: Option<String>,
    pub public_app_url: Option<String>,
    pub auth_session_ttl_hours: i64,
    pub serve_frontend: bool,
    pub frontend_dist_dir: Option<PathBuf>,
}

impl Config {
    pub fn from_env() -> Self {
        let frontend_dist_dir = std::env::var("FRONTEND_DIST_DIR").ok().map(PathBuf::from);

        Self {
            host: std::env::var("BACKEND_HOST")
                .or_else(|_| std::env::var("HOST"))
                .unwrap_or_else(|_| "127.0.0.1".into()),
            port: std::env::var("BACKEND_PORT")
                .or_else(|_| std::env::var("PORT"))
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            database_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://en_learner:en_learner@127.0.0.1:5432/en_learner".into()
            }),
            dictionary_api_url: std::env::var("DICTIONARY_API_URL")
                .unwrap_or_else(|_| "https://api.dictionaryapi.dev/api/v2/entries/en".into()),
            lingva_api_url: std::env::var("LINGVA_API_URL")
                .unwrap_or_else(|_| "https://lingva.ml/api/v1".into()),
            public_backend_url: std::env::var("PUBLIC_BACKEND_URL")
                .or_else(|_| std::env::var("EN_LEARNER_PUBLIC_BACKEND_URL"))
                .ok(),
            public_app_url: std::env::var("PUBLIC_APP_URL")
                .or_else(|_| std::env::var("EN_LEARNER_PUBLIC_APP_URL"))
                .ok(),
            auth_session_ttl_hours: std::env::var("AUTH_SESSION_TTL_HOURS")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(24 * 30),
            serve_frontend: env_flag("SERVE_FRONTEND") || frontend_dist_dir.is_some(),
            frontend_dist_dir,
        }
    }

    pub fn listen_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn resolve_frontend_dist_dir(&self) -> Option<PathBuf> {
        if !self.serve_frontend {
            return None;
        }

        self.frontend_dist_candidates()
            .into_iter()
            .find(|candidate| candidate.join("index.html").is_file())
    }

    fn frontend_dist_candidates(&self) -> Vec<PathBuf> {
        let mut candidates = Vec::new();

        if let Some(frontend_dist) = &self.frontend_dist_dir {
            candidates.push(frontend_dist.clone());
        }

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join("dist"));
                candidates.push(exe_dir.join("../dist"));
                candidates.push(exe_dir.join("../frontend/dist"));
                candidates.push(exe_dir.join("../../../frontend/dist"));
            }
        }

        candidates
    }
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}
