use leptos::*;
use crate::api::Card;

#[component]
pub fn FlipCard(card: Card, flipped: ReadSignal<bool>) -> impl IntoView {
    view! {
        <div class="flip-card-wrapper" class:flipped=move || flipped.get()>
            <div class="flip-card-inner">
                <div class="flip-card-front">
                    <div class="card-content">
                        <span class="card-label">"Слово"</span>
                        <h2 class="card-word">{card.word.clone()}</h2>
                        <p class="card-example">{card.example_en.clone()}</p>
                    </div>
                </div>
                <div class="flip-card-back">
                    <div class="card-content">
                        <span class="card-label">"Переклад"</span>
                        <h2 class="card-word">{card.translation_uk.clone()}</h2>
                        <p class="card-example">{card.example_uk.clone()}</p>
                        <p class="card-definition">{card.definition_en.clone()}</p>
                    </div>
                </div>
            </div>
        </div>
    }
}
