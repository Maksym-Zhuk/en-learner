use leptos::*;

#[derive(Clone, Debug)]
pub struct Toast {
    pub id: u32,
    pub message: String,
    pub kind: ToastKind,
}

#[derive(Clone, Debug)]
pub enum ToastKind {
    Success,
    Error,
    Info,
}

#[derive(Clone)]
pub struct ToastState {
    pub toasts: RwSignal<Vec<Toast>>,
    pub counter: RwSignal<u32>,
}

impl ToastState {
    pub fn new() -> Self {
        Self {
            toasts: create_rw_signal(vec![]),
            counter: create_rw_signal(0),
        }
    }

    pub fn show(&self, message: impl Into<String>, kind: ToastKind) {
        let id = self.counter.get() + 1;
        self.counter.set(id);
        let toast = Toast { id, message: message.into(), kind };
        self.toasts.update(|v| v.push(toast));

        let toasts = self.toasts;
        set_timeout(
            move || toasts.update(|v| v.retain(|t| t.id != id)),
            std::time::Duration::from_millis(3500),
        );
    }
}

#[component]
pub fn ToastContainer() -> impl IntoView {
    let state = use_context::<ToastState>().expect("ToastState not provided");

    view! {
        <div class="toast-container">
            <For
                each=move || state.toasts.get()
                key=|t| t.id
                children=|toast| {
                    let cls = match toast.kind {
                        ToastKind::Success => "toast toast-success",
                        ToastKind::Error => "toast toast-error",
                        ToastKind::Info => "toast toast-info",
                    };
                    view! {
                        <div class=cls>
                            <span>{toast.message}</span>
                        </div>
                    }
                }
            />
        </div>
    }
}
