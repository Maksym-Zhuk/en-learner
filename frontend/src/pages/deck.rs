use leptos::*;
use leptos_router::*;
use crate::api::Card;
use crate::state::AuthState;
use crate::components::{card::CardItem, navbar::Navbar, toast::{ToastKind, ToastState}};

#[component]
pub fn DeckPage() -> impl IntoView {
    let auth = use_context::<AuthState>().expect("AuthState not provided");
    let toast = use_context::<ToastState>().expect("ToastState not provided");
    let navigate = use_navigate();
    let params = use_params_map();

    if !auth.is_authenticated() {
        navigate("/login", Default::default());
    }

    let deck_id = move || params.with(|p| p.get("id").cloned().unwrap_or_default());
    let cards: RwSignal<Vec<Card>> = create_rw_signal(vec![]);
    let loading = create_rw_signal(true);

    {
        let auth = auth.clone();
        create_effect(move |_| {
            let id = deck_id();
            let auth = auth.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    match crate::api::get_cards(&token, &id).await {
                        Ok(c) => { cards.set(c); loading.set(false); }
                        Err(_) => loading.set(false),
                    }
                }
            });
        });
    }

    let on_delete = {
        let auth = auth.clone();
        let toast = toast.clone();
        move |id: String| {
            let auth = auth.clone();
            let toast = toast.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    match crate::api::delete_card(&token, &id).await {
                        Ok(_) => {
                            cards.update(|c| c.retain(|card| card.id != id));
                            toast.show("Картку видалено", ToastKind::Info);
                        }
                        Err(e) => toast.show(e, ToastKind::Error),
                    }
                }
            });
        }
    };

    view! {
        <div class="app-layout">
            <Navbar/>
            <main class="main-content">
                <div class="deck-page-header">
                    <button class="btn-ghost btn-back" on:click={
                        let navigate = navigate.clone();
                        move |_| navigate("/", Default::default())
                    }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M12 4L6 10l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        "Назад"
                    </button>
                    <div class="deck-study-actions">
                        <A href=move || format!("/deck/{}/study", deck_id()) class="btn-primary">
                            "Картки"
                        </A>
                        <A href=move || format!("/deck/{}/quiz/multiple", deck_id()) class="btn-outline">
                            "Вибір відповіді"
                        </A>
                        <A href=move || format!("/deck/{}/quiz/write", deck_id()) class="btn-outline">
                            "Написати"
                        </A>
                        <A href=move || format!("/deck/{}/quiz/match", deck_id()) class="btn-outline">
                            "Зіставити"
                        </A>
                    </div>
                </div>

                {move || if loading.get() {
                    view! { <div class="loading-spinner-center"><span class="spinner-lg"></span></div> }.into_view()
                } else if cards.get().is_empty() {
                    let navigate = navigate.clone();
                    view! {
                        <div class="empty-state">
                            <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                                <rect x="15" y="25" width="70" height="50" rx="10" fill="#1e2a4a" stroke="#6366F1" stroke-width="2"/>
                                <line x1="30" y1="42" x2="70" y2="42" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
                                <line x1="30" y1="52" x2="58" y2="52" stroke="#4f52c0" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <h3>"Колода порожня"</h3>
                            <p>"Поверніться на головну сторінку і знайдіть нові слова"</p>
                            <button class="btn-primary" on:click=move |_| navigate("/", Default::default())>
                                "На головну"
                            </button>
                        </div>
                    }.into_view()
                } else {
                    let on_delete = on_delete.clone();
                    view! {
                        <div class="cards-stats">
                            <span class="cards-count">{move || cards.get().len()}" карток"</span>
                        </div>
                        <div class="cards-list">
                            <For
                                each=move || cards.get()
                                key=|c| c.id.clone()
                                children={
                                    let on_delete = on_delete.clone();
                                    move |card| {
                                        let on_delete = on_delete.clone();
                                        view! {
                                            <CardItem card=card on_delete=Callback::new(on_delete)/>
                                        }
                                    }
                                }
                            />
                        </div>
                    }.into_view()
                }}
            </main>
        </div>
    }
}
