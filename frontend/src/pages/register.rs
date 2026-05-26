use leptos::*;
use leptos_router::*;
use crate::state::AuthState;
use crate::components::toast::{ToastKind, ToastState};

#[component]
pub fn RegisterPage() -> impl IntoView {
    let auth = use_context::<AuthState>().expect("AuthState not provided");
    let toast = use_context::<ToastState>().expect("ToastState not provided");
    let navigate = use_navigate();

    if auth.is_authenticated() {
        navigate("/", Default::default());
    }

    let email = create_rw_signal(String::new());
    let password = create_rw_signal(String::new());
    let loading = create_rw_signal(false);
    let error = create_rw_signal(Option::<String>::None);

    let on_submit = move |ev: web_sys::SubmitEvent| {
        ev.prevent_default();
        let auth = auth.clone();
        let toast = toast.clone();
        let navigate = navigate.clone();
        let e = email.get();
        let p = password.get();

        if p.len() < 6 {
            error.set(Some("Пароль має містити мінімум 6 символів".into()));
            return;
        }

        loading.set(true);
        error.set(None);

        spawn_local(async move {
            match crate::api::register(&e, &p).await {
                Ok(resp) => {
                    auth.login(crate::state::UserInfo {
                        user_id: resp.user_id,
                        email: resp.email,
                        token: resp.token,
                    });
                    toast.show("Акаунт створено!", ToastKind::Success);
                    navigate("/", Default::default());
                }
                Err(msg) => {
                    error.set(Some(msg));
                    loading.set(false);
                }
            }
        });
    };

    view! {
        <div class="auth-page">
            <div class="auth-card fade-in">
                <div class="auth-logo">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect width="48" height="48" rx="14" fill="#6366F1"/>
                        <text x="10" y="34" font-size="24" fill="white" font-weight="bold">"E"</text>
                    </svg>
                    <h1>"en-learner"</h1>
                    <p>"Почніть вивчати англійську сьогодні"</p>
                </div>

                <form on:submit=on_submit class="auth-form">
                    <div class="field-group">
                        <div class="floating-label">
                            <input
                                type="email"
                                id="email"
                                placeholder=" "
                                class="input-field"
                                prop:value=email
                                on:input=move |ev| email.set(event_target_value(&ev))
                                required
                            />
                            <label for="email">"Email"</label>
                        </div>
                    </div>

                    <div class="field-group">
                        <div class="floating-label">
                            <input
                                type="password"
                                id="password"
                                placeholder=" "
                                class="input-field"
                                prop:value=password
                                on:input=move |ev| password.set(event_target_value(&ev))
                                required
                                minlength="6"
                            />
                            <label for="password">"Пароль (мін. 6 символів)"</label>
                        </div>
                    </div>

                    {move || error.get().map(|e| view! {
                        <div class="form-error">{e}</div>
                    })}

                    <button
                        type="submit"
                        class="btn-primary btn-full"
                        disabled=move || loading.get()
                    >
                        {move || if loading.get() {
                            view! { <span class="spinner"></span> }.into_view()
                        } else {
                            view! { <span>"Зареєструватися"</span> }.into_view()
                        }}
                    </button>
                </form>

                <div class="auth-footer">
                    "Вже є акаунт? "
                    <A href="/login">"Увійти"</A>
                </div>
            </div>
        </div>
    }
}
