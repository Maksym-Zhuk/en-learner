use leptos::*;
use leptos_router::*;
use crate::api::Card;
use crate::state::AuthState;
use crate::components::navbar::Navbar;

#[derive(Clone, Debug, PartialEq)]
pub enum QuizMode {
    Multiple,
    Write,
    Match,
}

#[derive(Clone, Debug)]
struct QuizItem {
    card: Card,
    options: Vec<String>,
}

#[derive(Clone, Debug)]
struct MatchItem {
    id: String,
    text: String,
    kind: MatchKind,
    matched: bool,
    selected: bool,
}

#[derive(Clone, Debug, PartialEq)]
enum MatchKind {
    Word,
    Translation,
}

#[component]
pub fn QuizPage() -> impl IntoView {
    let auth = use_context::<AuthState>().expect("AuthState not provided");
    let navigate = use_navigate();
    let params = use_params_map();

    if !auth.is_authenticated() {
        navigate("/login", Default::default());
    }

    let deck_id = move || params.with(|p| p.get("id").cloned().unwrap_or_default());
    let mode = move || {
        params.with(|p| match p.get("mode").map(|s| s.as_str()) {
            Some("write") => QuizMode::Write,
            Some("match") => QuizMode::Match,
            _ => QuizMode::Multiple,
        })
    };

    let quiz_queue: RwSignal<Vec<QuizItem>> = create_rw_signal(vec![]);
    let current_idx = create_rw_signal(0usize);
    let score = create_rw_signal(0usize);
    let total_answered = create_rw_signal(0usize);
    let session_done = create_rw_signal(false);
    let loading = create_rw_signal(true);
    let answer_feedback: RwSignal<Option<bool>> = create_rw_signal(None);
    let write_input = create_rw_signal(String::new());
    let last_correct: RwSignal<Option<String>> = create_rw_signal(None);

    let match_items: RwSignal<Vec<MatchItem>> = create_rw_signal(vec![]);
    let match_selected: RwSignal<Option<String>> = create_rw_signal(None);
    let match_score = create_rw_signal(0usize);
    let match_total = create_rw_signal(0usize);

    {
        let auth = auth.clone();
        create_effect(move |_| {
            let id = deck_id();
            let m = mode();
            let auth = auth.clone();
            spawn_local(async move {
                if let Some(token) = auth.token() {
                    if let Ok(mut cards) = crate::api::get_cards(&token, &id).await {
                        use js_sys::Math;
                        let n = cards.len();
                        for i in (1..n).rev() {
                            let j = (Math::random() * (i + 1) as f64) as usize;
                            cards.swap(i, j);
                        }
                        if m == QuizMode::Match {
                            build_match_items(&cards, match_items, match_total);
                        } else {
                            quiz_queue.set(build_quiz_items(&cards));
                        }
                        loading.set(false);
                    }
                }
            });
        });
    }

    let current_item = move || {
        let q = quiz_queue.get();
        q.get(current_idx.get()).cloned()
    };

    let progress_pct = move || {
        let q = quiz_queue.get();
        if q.is_empty() { return 0.0; }
        current_idx.get() as f64 / q.len() as f64 * 100.0
    };

    let handle_multiple_answer = move |chosen: String| {
        if answer_feedback.get().is_some() { return; }
        let item = match current_item() { Some(i) => i, None => return };
        let correct = chosen == item.card.translation_uk;
        answer_feedback.set(Some(correct));
        last_correct.set(Some(item.card.translation_uk.clone()));
        total_answered.update(|t| *t += 1);

        if correct { score.update(|s| *s += 1); }
        else {
            quiz_queue.update(|q| {
                if let Some(i) = q.get(current_idx.get()).cloned() { q.push(i); }
            });
        }

        set_timeout(move || {
            answer_feedback.set(None);
            let next = current_idx.get() + 1;
            if next >= quiz_queue.get().len() { session_done.set(true); }
            else { current_idx.set(next); }
        }, std::time::Duration::from_millis(900));
    };

    let handle_write_submit = move |ev: web_sys::SubmitEvent| {
        ev.prevent_default();
        if answer_feedback.get().is_some() { return; }
        let item = match current_item() { Some(i) => i, None => return };
        let input = write_input.get().trim().to_lowercase();
        let correct_raw = item.card.translation_uk.to_lowercase();
        let correct = input == correct_raw
            || correct_raw.contains(&input)
            || levenshtein(&input, &correct_raw) <= 2;

        answer_feedback.set(Some(correct));
        last_correct.set(Some(item.card.translation_uk.clone()));
        total_answered.update(|t| *t += 1);

        if correct { score.update(|s| *s += 1); }
        else {
            quiz_queue.update(|q| {
                if let Some(i) = q.get(current_idx.get()).cloned() { q.push(i); }
            });
        }

        set_timeout(move || {
            answer_feedback.set(None);
            write_input.set(String::new());
            let next = current_idx.get() + 1;
            if next >= quiz_queue.get().len() { session_done.set(true); }
            else { current_idx.set(next); }
        }, std::time::Duration::from_millis(1100));
    };

    let handle_match_click = move |clicked_id: String| {
        let items_snap = match_items.get();
        let clicked = match items_snap.iter().find(|i| i.id == clicked_id) {
            Some(c) => c.clone(), None => return,
        };
        if clicked.matched { return; }

        let sel = match_selected.get();
        match sel {
            None => {
                match_selected.set(Some(clicked_id.clone()));
                match_items.update(|items| {
                    if let Some(item) = items.iter_mut().find(|i| i.id == clicked_id) {
                        item.selected = true;
                    }
                });
            }
            Some(ref prev_id) if *prev_id == clicked_id => {
                match_selected.set(None);
                match_items.update(|items| {
                    if let Some(item) = items.iter_mut().find(|i| i.id == clicked_id) {
                        item.selected = false;
                    }
                });
            }
            Some(prev_id) => {
                let prev = match items_snap.iter().find(|i| i.id == prev_id) {
                    Some(p) => p.clone(), None => return,
                };
                let prev_card = prev.id.split("__").next().unwrap_or("").to_string();
                let clicked_card = clicked.id.split("__").next().unwrap_or("").to_string();
                let pair_match =
                    prev_card == clicked_card
                    && (prev.kind == MatchKind::Word && clicked.kind == MatchKind::Translation
                        || prev.kind == MatchKind::Translation && clicked.kind == MatchKind::Word);

                if pair_match {
                    match_score.update(|s| *s += 1);
                    let pid = prev_id.clone();
                    let cid = clicked_id.clone();
                    match_items.update(|items| {
                        for item in items.iter_mut() {
                            if item.id == pid || item.id == cid {
                                item.matched = true;
                                item.selected = false;
                            }
                        }
                    });
                    if match_items.get().iter().all(|i| i.matched) {
                        session_done.set(true);
                    }
                } else {
                    let pid = prev_id.clone();
                    let cid = clicked_id.clone();
                    match_items.update(|items| {
                        for item in items.iter_mut() {
                            if item.id == pid || item.id == cid {
                                item.selected = false;
                            }
                        }
                    });
                }
                match_selected.set(None);
            }
        }
    };

    view! {
        <div class="app-layout">
            <Navbar/>
            <main class="quiz-main">
                {move || if loading.get() {
                    view! { <div class="loading-spinner-center"><span class="spinner-lg"></span></div> }.into_view()
                } else if session_done.get() {
                    let s = score.get();
                    let t = total_answered.get();
                    let mt = match_total.get();
                    let ms = match_score.get();
                    let (final_score, final_total) = if mode() == QuizMode::Match {
                        (ms, mt)
                    } else {
                        (s, t)
                    };
                    let pct = if final_total > 0 { final_score * 100 / final_total } else { 100 };
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
                            <h2>"Тест завершено!"</h2>
                            <p class="summary-score">
                                "Правильно: "<strong>{final_score}</strong>" / "{final_total}
                            </p>
                            <div class="summary-actions">
                                <button class="btn-primary" on:click=move |_| {
                                    navigate1(&format!("/deck/{}", deck_id()), Default::default());
                                }>"До колоди"</button>
                                <button class="btn-ghost" on:click=move |_| {
                                    navigate2("/", Default::default());
                                }>"На головну"</button>
                            </div>
                        </div>
                    }.into_view()
                } else {
                    match mode() {
                        QuizMode::Multiple => {
                            view! {
                                <div class="quiz-session">
                                    <div class="progress-bar-wrapper">
                                        <div class="progress-bar">
                                            <div class="progress-fill"
                                                 style=move || format!("width: {}%", progress_pct())>
                                            </div>
                                        </div>
                                    </div>
                                    {move || current_item().map(|item| {
                                        let options = item.options.clone();
                                        let correct = item.card.translation_uk.clone();
                                        let fb = answer_feedback.get();
                                        view! {
                                            <div class="quiz-card">
                                                <span class="quiz-label">"Перекладіть слово:"</span>
                                                <h2 class="quiz-word">{item.card.word.clone()}</h2>
                                                <div class="options-grid">
                                                    <For
                                                        each=move || options.clone()
                                                        key=|o| o.clone()
                                                        children={
                                                            let correct = correct.clone();
                                                            move |opt| {
                                                                let opt_c = opt.clone();
                                                                let is_correct = opt == correct;
                                                                let cls = move || match fb {
                                                                    Some(true) if is_correct => "option-btn correct",
                                                                    Some(false) if is_correct => "option-btn correct",
                                                                    _ => "option-btn",
                                                                };
                                                                view! {
                                                                    <button class=cls
                                                                            disabled=move || fb.is_some()
                                                                            on:click=move |_| handle_multiple_answer(opt_c.clone())>
                                                                        {opt.clone()}
                                                                    </button>
                                                                }
                                                            }
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        }
                                    })}
                                </div>
                            }.into_view()
                        },

                        QuizMode::Write => {
                            view! {
                                <div class="quiz-session">
                                    <div class="progress-bar-wrapper">
                                        <div class="progress-bar">
                                            <div class="progress-fill"
                                                 style=move || format!("width: {}%", progress_pct())>
                                            </div>
                                        </div>
                                    </div>
                                    {move || current_item().map(|item| {
                                        let fb = answer_feedback.get();
                                        let correct_shown = last_correct.get().unwrap_or_default();
                                        view! {
                                            <div class="quiz-card">
                                                <span class="quiz-label">"Напишіть переклад:"</span>
                                                <h2 class="quiz-word">{item.card.word.clone()}</h2>
                                                <form on:submit=handle_write_submit class="write-form">
                                                    <input
                                                        type="text"
                                                        class="input-field write-input"
                                                        class:input-correct=move || fb == Some(true)
                                                        class:input-wrong=move || fb == Some(false)
                                                        placeholder="Введіть переклад..."
                                                        prop:value=write_input
                                                        on:input=move |ev| write_input.set(event_target_value(&ev))
                                                        disabled=move || fb.is_some()
                                                        autofocus
                                                    />
                                                    {move || match fb {
                                                        Some(true) => view! {
                                                            <p class="feedback-text correct-text">"✓ Правильно!"</p>
                                                        }.into_view(),
                                                        Some(false) => {
                                                            let c = correct_shown.clone();
                                                            view! {
                                                                <p class="feedback-text wrong-text">
                                                                    "✗ Правильна відповідь: "{c}
                                                                </p>
                                                            }.into_view()
                                                        },
                                                        None => view! { <span></span> }.into_view(),
                                                    }}
                                                    <button type="submit" class="btn-primary"
                                                            disabled=move || fb.is_some() || write_input.get().trim().is_empty()>
                                                        "Перевірити"
                                                    </button>
                                                </form>
                                            </div>
                                        }
                                    })}
                                </div>
                            }.into_view()
                        },

                        QuizMode::Match => {
                            view! {
                                <div class="quiz-session">
                                    <div class="section-header" style="width:100%">
                                        <h2>"Зіставте пари"</h2>
                                        <span class="match-score">
                                            {move || match_score.get()}" / "{move || match_total.get()}
                                        </span>
                                    </div>
                                    <div class="match-grid">
                                        <For
                                            each=move || match_items.get()
                                            key=|i| i.id.clone()
                                            children=move |item| {
                                                let id = item.id.clone();
                                                let matched = item.matched;
                                                let selected = item.selected;
                                                let cls = move || {
                                                    if matched { "match-item matched".to_string() }
                                                    else if selected { "match-item selected".to_string() }
                                                    else { "match-item".to_string() }
                                                };
                                                view! {
                                                    <button class=cls disabled=move || matched
                                                            on:click=move |_| handle_match_click(id.clone())>
                                                        {item.text.clone()}
                                                    </button>
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                            }.into_view()
                        },
                    }
                }}
            </main>
        </div>
    }
}

fn build_quiz_items(cards: &[Card]) -> Vec<QuizItem> {
    use js_sys::Math;
    cards.iter().map(|card| {
        let mut opts = vec![card.translation_uk.clone()];
        let mut others: Vec<String> = cards.iter()
            .filter(|c| c.id != card.id)
            .map(|c| c.translation_uk.clone())
            .collect();
        let n = others.len();
        for i in (1..n).rev() {
            let j = (Math::random() * (i + 1) as f64) as usize;
            others.swap(i, j);
        }
        opts.extend(others.into_iter().take(3));
        let n2 = opts.len();
        for i in (1..n2).rev() {
            let j = (Math::random() * (i + 1) as f64) as usize;
            opts.swap(i, j);
        }
        QuizItem { card: card.clone(), options: opts }
    }).collect()
}

fn build_match_items(cards: &[Card], match_items: RwSignal<Vec<MatchItem>>, match_total: RwSignal<usize>) {
    use js_sys::Math;
    let take = cards.len().min(6);
    let mut items: Vec<MatchItem> = vec![];
    for card in &cards[..take] {
        items.push(MatchItem {
            id: format!("{}__word", card.id),
            text: card.word.clone(),
            kind: MatchKind::Word,
            matched: false, selected: false,
        });
        items.push(MatchItem {
            id: format!("{}__trans", card.id),
            text: card.translation_uk.clone(),
            kind: MatchKind::Translation,
            matched: false, selected: false,
        });
    }
    let n = items.len();
    for i in (1..n).rev() {
        let j = (Math::random() * (i + 1) as f64) as usize;
        items.swap(i, j);
    }
    match_total.set(take);
    match_items.set(items);
}

fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (m, n) = (a.len(), b.len());
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 0..=m { dp[i][0] = i; }
    for j in 0..=n { dp[0][j] = j; }
    for i in 1..=m {
        for j in 1..=n {
            dp[i][j] = if a[i-1] == b[j-1] { dp[i-1][j-1] }
                       else { 1 + dp[i-1][j].min(dp[i][j-1]).min(dp[i-1][j-1]) };
        }
    }
    dp[m][n]
}
