use crate::AppState;
use axum::Router;

pub mod auth;
pub mod dashboard;
pub mod history;
pub mod review;
mod routes;
pub mod sets;
pub mod settings;
pub mod words;

pub fn router() -> Router<AppState> {
    routes::router()
}
