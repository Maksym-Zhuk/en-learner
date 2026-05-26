use leptos::*;
use leptos_router::*;
use crate::api::{Deck, LookupResult};
use crate::state::AuthState;
use crate::components::{navbar::Navbar, toast::{ToastKind, ToastState}};

#[component]
pub fn HomePage() -> impl IntoView {
    let auth = use_context::<AuthState>().expect("AuthState not provided");
    let toast = use_context::<ToastState>().expect("ToastState not provided");
    let navigate = use_navigate();

    if !auth.is_authenticated() {
        navigate("/login", Default::default());
    }

    let decks: RwSignal<Vec<Deck>> = create_rw_signal(vec![]);
    let loading = create_rw_signal(true);
    let new_deck_name = create_rw_signal(String::new());
    let show_new_deck = create_rw_signal(false);

    let search_word = create_rw_signal(String::new());
    let lookup_result: RwSignal<Option<LookupResult>> = create_rw_signal(None);
    let lookup_loading = create_rw_signal(false);
    let lookup_error = create_rw_signal(Option::<String>::None);
    let selected_deck_id = create_rw_signal(String::new());

    {
        let auth = auth.clone();
        spawn_local(async move {
            if let Some(token) = auth.token() {
                match crate::api::get_decks(&token).await {
                    Ok(d) => { decks.set(d); loading.set(false); }
                    Err(_) => loading.set(false),
                }
            }
        });
    }

    let on_create_deck = {
        let auth = auth.clone();
        let toast = toast.clone();
        move |ev: web_sys::SubmitEvent| {
            ev.prevent_default();
            let name = new_deck_name.get();
            if name.trim().is_empty() { return; }
            let auth = auth.clone();
            let toast = toast.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    match crate::api::create_deck(&token, &name).await {
                        Ok(deck) => {
                            decks.update(|d| d.insert(0, deck));
                            new_deck_name.set(String::new());
                            show_new_deck.set(false);
                            toast.show("Колоду створено!", ToastKind::Success);
                        }
                        Err(e) => toast.show(e, ToastKind::Error),
                    }
                }
            });
        }
    };

    let on_delete_deck = {
        let auth = auth.clone();
        let toast = toast.clone();
        move |id: String| {
            let auth = auth.clone();
            let toast = toast.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    match crate::api::delete_deck(&token, &id).await {
                        Ok(_) => {
                            decks.update(|d| d.retain(|deck| deck.id != id));
                            toast.show("Колоду видалено", ToastKind::Info);
                        }
                        Err(e) => toast.show(e, ToastKind::Error),
                    }
                }
            });
        }
    };

    let on_lookup = {
        let auth = auth.clone();
        move |ev: web_sys::SubmitEvent| {
            ev.prevent_default();
            let word = search_word.get();
            if word.trim().is_empty() { return; }
            let auth = auth.clone();
            lookup_loading.set(true);
            lookup_result.set(None);
            lookup_error.set(None);
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    match crate::api::lookup_word(&token, &word).await {
                        Ok(res) => { lookup_result.set(Some(res)); lookup_loading.set(false); }
                        Err(e) => { lookup_error.set(Some(e)); lookup_loading.set(false); }
                    }
                }
            });
        }
    };

    let on_add_to_deck = {
        let auth = auth.clone();
        let toast = toast.clone();
        move |_: web_sys::MouseEvent| {
            let deck_id = selected_deck_id.get();
            if deck_id.is_empty() {
                toast.show("Виберіть колоду", ToastKind::Error);
                return;
            }
            let result = lookup_result.get();
            if let Some(card) = result {
                let auth = auth.clone();
                let toast = toast.clone();
                spawn_local(async move {
                    if let Some(token) = auth.token() {
                        match crate::api::create_card(&token, &deck_id, &card).await {
                            Ok(_) => {
                                lookup_result.set(None);
                                search_word.set(String::new());
                                toast.show("Картку додано до колоди!", ToastKind::Success);
                                if let Ok(d) = crate::api::get_decks(&token).await {
                                    decks.set(d);
                                }
                            }
                            Err(e) => toast.show(e, ToastKind::Error),
                        }
                    }
                });
            }
        }
    };

    view! {
        <div class="app-layout">
            <Navbar/>
            <main class="main-content">
                <section class="lookup-section">
                    <div class="section-header">
                        <div>
                            <h2>"Знайти слово"</h2>
                            <p>"Введіть англійське слово для пошуку визначення та перекладу"</p>
                        </div>
                    </div>
                    <form on:submit=on_lookup class="lookup-form">
                        <div class="search-bar">
                            <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="9" cy="9" r="6" stroke="#6366F1" stroke-width="2"/>
                                <path d="M13.5 13.5L17 17" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            <input
                                type="text"
                                class="search-input"
                                placeholder="Введіть слово англійською..."
                                prop:value=search_word
                                on:input=move |ev| search_word.set(event_target_value(&ev))
                            />
                            <button type="submit" class="btn-primary"
                                    disabled=move || lookup_loading.get()>
                                {move || if lookup_loading.get() {
                                    view! { <span class="spinner"></span> }.into_view()
                                } else {
                                    view! { <span>"Пошук"</span> }.into_view()
                                }}
                            </button>
                        </div>
                    </form>

                    {move || lookup_error.get().map(|e| view! {
                        <div class="lookup-error">{e}</div>
                    })}

                    {move || lookup_result.get().map(|r| {
                        let on_add = on_add_to_deck.clone();
                        view! {
                            <div class="lookup-result slide-in">
                                <div class="result-word">{r.word.clone()}</div>
                                <div class="result-grid">
                                    <div class="result-col">
                                        <span class="result-label">"Визначення"</span>
                                        <p class="result-text">{r.definition_en.clone()}</p>
                                        {(!r.example_en.is_empty()).then(|| view! {
                                            <p class="result-example">
                                                <em>"\u{201C}"</em>{r.example_en.clone()}<em>"\u{201D}"</em>
                                            </p>
                                        })}
                                    </div>
                                    <div class="result-col">
                                        <span class="result-label">"Переклад"</span>
                                        <p class="result-text result-translation">{r.translation_uk.clone()}</p>
                                        {(!r.example_uk.is_empty()).then(|| view! {
                                            <p class="result-example">
                                                <em>"\u{201C}"</em>{r.example_uk.clone()}<em>"\u{201D}"</em>
                                            </p>
                                        })}
                                    </div>
                                </div>
                                <div class="result-actions">
                                    <select class="select-deck"
                                            on:change=move |ev| selected_deck_id.set(event_target_value(&ev))>
                                        <option value="">"— Виберіть колоду —"</option>
                                        <For
                                            each=move || decks.get()
                                            key=|d| d.id.clone()
                                            children=|deck| view! {
                                                <option value={deck.id.clone()}>{deck.name.clone()}</option>
                                            }
                                        />
                                    </select>
                                    <button class="btn-primary" on:click=on_add>
                                        "Додати до колоди"
                                    </button>
                                </div>
                            </div>
                        }
                    })}
                </section>

                <section class="decks-section">
                    <div class="section-header">
                        <h2>"Мої колоди"</h2>
                        <button class="btn-primary"
                                on:click=move |_| show_new_deck.update(|v| *v = !*v)>
                            {move || if show_new_deck.get() { "Скасувати" } else { "Нова колода" }}
                        </button>
                    </div>

                    {move || show_new_deck.get().then(|| {
                        let on_create = on_create_deck.clone();
                        view! {
                            <form on:submit=on_create class="new-deck-form">
                                <input
                                    type="text"
                                    class="input-field"
                                    placeholder="Назва колоди..."
                                    prop:value=new_deck_name
                                    on:input=move |ev| new_deck_name.set(event_target_value(&ev))
                                    autofocus
                                />
                                <button type="submit" class="btn-primary">"Створити"</button>
                            </form>
                        }
                    })}

                    {move || if loading.get() {
                        view! {
                            <div class="loading-grid">
                                <div class="skeleton-card"></div>
                                <div class="skeleton-card"></div>
                                <div class="skeleton-card"></div>
                            </div>
                        }.into_view()
                    } else if decks.get().is_empty() {
                        view! {
                            <div class="empty-state">
                                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                                    <rect x="20" y="30" width="80" height="60" rx="12" fill="#1e2a4a"
                                          stroke="#6366F1" stroke-width="2"/>
                                    <rect x="30" y="20" width="80" height="60" rx="12" fill="#162035"
                                          stroke="#4f52c0" stroke-width="1.5"/>
                                    <line x1="45" y1="42" x2="95" y2="42" stroke="#6366F1" stroke-width="2"
                                          stroke-linecap="round"/>
                                    <line x1="45" y1="52" x2="80" y2="52" stroke="#4f52c0"
                                          stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                                <h3>"У вас ще немає колод"</h3>
                                <p>"Створіть першу колоду, щоб почати вивчення"</p>
                                <button class="btn-primary"
                                        on:click=move |_| show_new_deck.set(true)>
                                    "Створити колоду"
                                </button>
                            </div>
                        }.into_view()
                    } else {
                        let on_delete = on_delete_deck.clone();
                        view! {
                            <div class="deck-grid">
                                <For
                                    each=move || decks.get()
                                    key=|d| d.id.clone()
                                    children={
                                        let on_delete = on_delete.clone();
                                        move |deck| {
                                            let deck_id_del = deck.id.clone();
                                            let on_delete = on_delete.clone();
                                            let has_cards = deck.card_count > 0;
                                            view! {
                                                <div class="deck-card">
                                                    <div class="deck-card-header">
                                                        <div class="deck-icon">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                                <rect x="2" y="6" width="20" height="14" rx="3" fill="#6366F1" opacity="0.3"/>
                                                                <rect x="4" y="4" width="20" height="14" rx="3" fill="#6366F1" opacity="0.6"/>
                                                                <rect x="6" y="2" width="20" height="14" rx="3" fill="#6366F1"/>
                                                            </svg>
                                                        </div>
                                                        <button class="btn-icon btn-danger"
                                                                on:click=move |_| on_delete(deck_id_del.clone())>
                                                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                                <path d="M1 3h12M4 3V1.5h6V3M5 6v5M9 6v5M2 3l.875 8.75A1 1 0 003.87 13h6.26a1 1 0 00.995-.25L12 3H2z"
                                                                      stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <h3 class="deck-name">{deck.name.clone()}</h3>
                                                    <div class="deck-meta">
                                                        <span class="card-count">{deck.card_count}" карток"</span>
                                                    </div>
                                                    <div class="deck-actions">
                                                        <A href=format!("/deck/{}", deck.id) class="btn-ghost btn-sm">
                                                            "Переглянути"
                                                        </A>
                                                        {has_cards.then(|| view! {
                                                            <A href=format!("/deck/{}/study", deck.id) class="btn-primary btn-sm">
                                                                "Вивчати"
                                                            </A>
                                                        })}
                                                    </div>
                                                </div>
                                            }
                                        }
                                    }
                                />
                            </div>
                        }.into_view()
                    }}
                </section>
            </main>
        </div>
    }
}
