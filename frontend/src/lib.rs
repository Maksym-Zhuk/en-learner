mod api;
mod components;
mod pages;
mod state;

use wasm_bindgen::prelude::wasm_bindgen;
use leptos::*;
use leptos_router::*;

use components::toast::{ToastContainer, ToastState};
use pages::{
    deck::DeckPage,
    home::HomePage,
    login::LoginPage,
    quiz::QuizPage,
    register::RegisterPage,
    study::StudyPage,
};
use state::AuthState;

#[component]
fn App() -> impl IntoView {
    provide_context(AuthState::new());
    provide_context(ToastState::new());

    view! {
        <Router>
            <ToastContainer/>
            <Routes>
                <Route path="/login"              view=LoginPage/>
                <Route path="/register"           view=RegisterPage/>
                <Route path="/"                   view=HomePage/>
                <Route path="/deck/:id"           view=DeckPage/>
                <Route path="/deck/:id/study"     view=StudyPage/>
                <Route path="/deck/:id/quiz/:mode" view=QuizPage/>
            </Routes>
        </Router>
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> });
}
