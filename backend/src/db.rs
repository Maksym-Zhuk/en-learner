use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

impl AppState {
    pub async fn new() -> anyhow::Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set");
        let pool = PgPool::connect(&database_url).await?;
        let jwt_secret = std::env::var("JWT_SECRET")
            .expect("JWT_SECRET must be set");
        Ok(Self { pool, jwt_secret })
    }
}
