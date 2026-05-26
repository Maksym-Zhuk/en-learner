use leptos::*;
use leptos_router::*;
use crate::state::AuthState;
use crate::components::toast::{ToastKind, ToastState};

#[component]
pub fn Navbar() -> impl IntoView {
    let auth = use_context::<AuthState>().expect("AuthState not provided");
    let toast = use_context::<ToastState>().expect("ToastState not provided");
    let navigate = use_navigate();

    let on_logout = {
        let auth = auth.clone();
        let toast = toast.clone();
        let navigate = navigate.clone();
        move |_: web_sys::MouseEvent| {
            let auth = auth.clone();
            let toast = toast.clone();
            let navigate = navigate.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    let _ = crate::api::logout(&token).await;
                }
                auth.logout();
                toast.show("Вихід виконано", ToastKind::Info);
                navigate("/login", Default::default());
            });
        }
    };

    view! {
        <nav class="navbar">
            <div class="navbar-brand">
                <A href="/" class="brand-link">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect width="28" height="28" rx="8" fill="#6366F1"/>
                        <text x="6" y="20" font-size="14" fill="white" font-weight="bold">"E"</text>
                    </svg>
                    <span>"en-learner"</span>
                </A>
            </div>
            <div class="navbar-actions">
                {move || {
                    if auth.is_authenticated() {
                        let on_logout = on_logout.clone();
                        view! {
                            <div class="navbar-user">
                                <span class="user-email">
                                    {move || auth.user.get().map(|u| u.email).unwrap_or_default()}
                                </span>
                                <button class="btn-ghost" on:click=on_logout>
                                    "Вийти"
                                </button>
                            </div>
                        }.into_view()
                    } else {
                        view! {
                            <div class="navbar-auth">
                                <A href="/login" class="btn-ghost">"Увійти"</A>
                                <A href="/register" class="btn-primary">"Реєстрація"</A>
                            </div>
                        }.into_view()
                    }
                }}
            </div>
        </nav>
    }
}
