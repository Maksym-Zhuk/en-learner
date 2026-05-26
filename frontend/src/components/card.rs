use leptos::*;
use crate::api::Card;

#[component]
pub fn CardItem(
    card: Card,
    on_delete: Callback<String>,
) -> impl IntoView {
    let card_id = card.id.clone();
    view! {
        <div class="card-item">
            <div class="card-item-front">
                <span class="word">{card.word.clone()}</span>
                <span class="example">{card.example_en.clone()}</span>
            </div>
            <div class="card-item-back">
                <span class="translation">{card.translation_uk.clone()}</span>
                <span class="example">{card.example_uk.clone()}</span>
            </div>
            <button
                class="btn-icon btn-danger"
                on:click=move |_| on_delete.call(card_id.clone())
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10H3z"
                          stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                          fill="none"/>
                </svg>
            </button>
        </div>
    }
}
