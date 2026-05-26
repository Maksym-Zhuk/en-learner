use gloo_storage::Storage;
use leptos::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub user_id: String,
    pub email: String,
    pub token: String,
}

#[derive(Clone, Debug)]
pub struct AuthState {
    pub user: RwSignal<Option<UserInfo>>,
}

impl AuthState {
    pub fn new() -> Self {
        let stored = gloo_storage::LocalStorage::get::<UserInfo>("auth")
            .ok();
        Self {
            user: create_rw_signal(stored),
        }
    }

    pub fn login(&self, info: UserInfo) {
        let _ = gloo_storage::LocalStorage::set("auth", &info);
        self.user.set(Some(info));
    }

    pub fn logout(&self) {
        gloo_storage::LocalStorage::delete("auth");
        self.user.set(None);
    }

    pub fn is_authenticated(&self) -> bool {
        self.user.get().is_some()
    }

    pub fn token(&self) -> Option<String> {
        self.user.get().map(|u| u.token)
    }
}
