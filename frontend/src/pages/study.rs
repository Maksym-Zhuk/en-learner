use leptos::*;
use leptos_router::*;
use crate::api::Card;
use crate::state::AuthState;
use crate::components::{flip_card::FlipCard, navbar::Navbar};

#[component]
pub fn StudyPage() -> impl IntoView {
    let auth = use_context::<AuthState>().expect("AuthState not provided");
    let navigate = use_navigate();
    let params = use_params_map();

    if !auth.is_authenticated() {
        navigate("/login", Default::default());
    }

    let deck_id = move || params.with(|p| p.get("id").cloned().unwrap_or_default());
    let cards: RwSignal<Vec<Card>> = create_rw_signal(vec![]);
    let current_index = create_rw_signal(0usize);
    let flipped = create_rw_signal(false);
    let knew_count = create_rw_signal(0usize);
    let session_done = create_rw_signal(false);
    let loading = create_rw_signal(true);
    let shake = create_rw_signal(false);

    {
        let auth = auth.clone();
        create_effect(move |_| {
            let id = deck_id();
            let auth = auth.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    if let Ok(mut c) = crate::api::get_cards(&token, &id).await {
                        use js_sys::Math;
                        let n = c.len();
                        for i in (1..n).rev() {
                            let j = (Math::random() * (i + 1) as f64) as usize;
                            c.swap(i, j);
                        }
                        cards.set(c);
                        loading.set(false);
                    }
                }
            });
        });
    }

    let total = move || cards.get().len();
    let progress = move || {
        let t = total();
        if t == 0 { 0.0 } else { current_index.get() as f64 / t as f64 * 100.0 }
    };

    let advance = move |knew: bool| {
        flipped.set(false);
        if knew {
            knew_count.update(|k| *k += 1);
        } else {
            shake.set(true);
            set_timeout(move || shake.set(false), std::time::Duration::from_millis(600));
        }
        let next = current_index.get() + 1;
        if next >= total() {
            session_done.set(true);
        } else {
            current_index.set(next);
        }
    };

    view! {
        <div class="app-layout">
            <Navbar/>
            <main class="study-main">
                {move || if loading.get() {
                    view! { <div class="loading-spinner-center"><span class="spinner-lg"></span></div> }.into_view()
                } else if session_done.get() {
                    let knew = knew_count.get();
                    let tot = total();
                    let pct = if tot > 0 { knew * 100 / tot } else { 0 };
                    let navigate1 = navigate.clone();
                    let navigate2 = navigate.clone();
                    view! {
                        <div class="session-summary fade-in">
                            <div class="summary-ring">
                                <svg viewBox="0 0 120 120" width="120" height="120">
                                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1e2a4a" stroke-width="10"/>
                                    <circle cx="60" cy="60" r="50" fill="none" stroke="#6366F1" stroke-width="10"
                                        stroke-dasharray=format!("{} 314", pct as f64 * 3.14)
                                        stroke-linecap="round"
                                        transform="rotate(-90 60 60)"/>
                                </svg>
                                <div class="summary-pct">{pct}"%"</div>
                            </div>
                            <h2>"Сесію завершено!"</h2>
                            <p class="summary-score">
                                "Правильно: "<strong>{knew}</strong>" / "{tot}
                            </p>
                            <div class="summary-actions">
                                <button class="btn-primary" on:click=move |_| {
                                    current_index.set(0);
                                    knew_count.set(0);
                                    session_done.set(false);
                                    flipped.set(false);
                                }>"Почати знову"</button>
                                <button class="btn-ghost" on:click=move |_| {
                                    navigate1(
                                        &format!("/deck/{}", deck_id()),
                                        Default::default()
                                    );
                                }>"До колоди"</button>
                            </div>
                        </div>
                    }.into_view()
                } else if cards.get().is_empty() {
                    let navigate = navigate.clone();
                    view! {
                        <div class="empty-state">
                            <p>"Колода порожня"</p>
                            <button class="btn-primary" on:click=move |_| navigate("/", Default::default())>
                                "На головну"
                            </button>
                        </div>
                    }.into_view()
                } else {
                    let card = cards.get()[current_index.get()].clone();
                    view! {
                        <div class="study-session">
                            <div class="progress-bar-wrapper">
                                <div class="progress-bar">
                                    <div class="progress-fill"
                                         style=move || format!("width: {}%", progress())>
                                    </div>
                                </div>
                                <span class="progress-label">
                                    {move || current_index.get() + 1}" / "{total}
                                </span>
                            </div>

                            <div
                                class="flip-card-container"
                                class:shake=move || shake.get()
                                on:click=move |_| flipped.update(|f| *f = !*f)
                            >
                                <FlipCard card=card flipped=flipped.read_only()/>
                            </div>
                            <p class="flip-hint">"Натисніть на картку, щоб перегорнути"</p>

                            <div class="study-buttons">
                                <button class="btn-wrong" on:click=move |_| advance(false)>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M4 4l12 12M16 4L4 16"
                                              stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                                    </svg>
                                    "Не знав"
                                </button>
                                <button class="btn-correct" on:click=move |_| advance(true)>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M4 10l5 5 7-8"
                                              stroke="currentColor" stroke-width="2.5"
                                              stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    "Знав"
                                </button>
                            </div>
                        </div>
                    }.into_view()
                }}
            </main>
        </div>
    }
}
