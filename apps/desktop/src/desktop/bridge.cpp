#include "desktop/bridge.h"

#include "desktop/platform.h"
#include "desktop/runtime.h"
#include "desktop/storage.h"

#include <utility>

namespace en_learner::desktop {

namespace {

void resolve_native_call(
    const std::shared_ptr<DesktopRuntimeContext>& context,
    const std::string& id,
    int status,
    const std::string& payload
) {
    if (context->shutting_down.load()) {
        return;
    }

    context->webview->resolve(id, status, payload);
}

template <typename Fn>
void queue_native_worker(const std::shared_ptr<DesktopRuntimeContext>& context, Fn&& task) {
    std::lock_guard<std::mutex> lock(context->workers_mutex);
    context->workers.emplace_back([context, task = std::forward<Fn>(task)]() mutable {
        task();
    });
}

}  // namespace

void join_native_workers(const std::shared_ptr<DesktopRuntimeContext>& context) {
    std::vector<std::thread> workers;

    {
        std::lock_guard<std::mutex> lock(context->workers_mutex);
        workers.swap(context->workers);
    }

    for (auto& worker : workers) {
        if (worker.joinable()) {
            worker.join();
        }
    }
}

void bind_native_bridge(webview::webview& view, const std::shared_ptr<DesktopRuntimeContext>& context) {
    context->webview = &view;

    view.bind(
        "enLearnerNativeGetRuntimeInfo",
        [context](std::string id, std::string /*req*/, void* /*arg*/) {
            queue_native_worker(context, [context, id]() {
                try {
                    resolve_native_call(context, id, 0, build_runtime_info_json(*context));
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeSetWindowTitle",
        [context](std::string id, std::string req, void* /*arg*/) {
            const std::string title = webview::detail::json_parse(req, "", 0);

            if (title.empty()) {
                resolve_native_call(context, id, 1, json_error_message("Window title is required"));
                return;
            }

            context->webview->dispatch([context, id, title]() {
                if (context->shutting_down.load()) {
                    return;
                }

                context->webview->set_title(title);
                context->webview->resolve(
                    id,
                    0,
                    std::string("{\"title\":") + webview::detail::json_escape(title) + "}"
                );
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeSetBackendUrl",
        [context](std::string id, std::string req, void* /*arg*/) {
            const std::string requested_backend_url = webview::detail::json_parse(req, "", 0);

            queue_native_worker(context, [context, id, requested_backend_url]() {
                try {
                    std::optional<std::string> persisted_backend_url;
                    if (!requested_backend_url.empty()) {
                        if (!is_valid_backend_url(requested_backend_url)) {
                            throw std::runtime_error("Backend URL must start with http:// or https://");
                        }
                        persisted_backend_url = requested_backend_url;
                    }

                    save_desktop_setting(context->storage, "backend_url", persisted_backend_url);
                    const std::string effective_backend_url = resolve_backend_url(persisted_backend_url);

                    {
                        std::lock_guard<std::mutex> lock(context->state_mutex);
                        context->backend_url = effective_backend_url;
                        context->persisted_backend_url = persisted_backend_url;
                    }

                    resolve_native_call(context, id, 0, build_runtime_info_json(*context));
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeSetConnectivityMode",
        [context](std::string id, std::string req, void* /*arg*/) {
            const std::string requested_mode = webview::detail::json_parse(req, "", 0);

            queue_native_worker(context, [context, id, requested_mode]() {
                try {
                    if (!is_valid_connectivity_mode(requested_mode)) {
                        throw std::runtime_error("Connectivity mode must be auto, offline, or online");
                    }

                    save_desktop_setting(context->storage, "connectivity_mode", requested_mode);

                    {
                        std::lock_guard<std::mutex> lock(context->state_mutex);
                        context->connectivity_mode = requested_mode;
                    }

                    resolve_native_call(context, id, 0, build_runtime_info_json(*context));
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeSignInGuest",
        [context](std::string id, std::string req, void* /*arg*/) {
            const std::string requested_name = webview::detail::json_parse(req, "", 0);

            queue_native_worker(context, [context, id, requested_name]() {
                try {
                    const std::string profile_name =
                        requested_name.empty() ? std::string("Local user") : requested_name;

                    save_desktop_setting(context->storage, "auth_mode", std::string("guest"));
                    save_desktop_setting(context->storage, "auth_session_json", std::nullopt);
                    save_desktop_setting(context->storage, "local_profile_name", profile_name);

                    {
                        std::lock_guard<std::mutex> lock(context->state_mutex);
                        context->auth_mode = "guest";
                        context->auth_session_json = std::nullopt;
                        context->local_profile_name = profile_name;
                    }

                    resolve_native_call(context, id, 0, build_runtime_info_json(*context));
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeSetAuthSession",
        [context](std::string id, std::string req, void* /*arg*/) {
            const std::string auth_session_json = webview::detail::json_parse(req, "", 0);

            queue_native_worker(context, [context, id, auth_session_json]() {
                try {
                    if (auth_session_json.empty()) {
                        throw std::runtime_error("Auth session payload is required");
                    }

                    save_desktop_setting(context->storage, "auth_mode", std::string("remote"));
                    save_desktop_setting(context->storage, "auth_session_json", auth_session_json);

                    {
                        std::lock_guard<std::mutex> lock(context->state_mutex);
                        context->auth_mode = "remote";
                        context->auth_session_json = auth_session_json;
                    }

                    resolve_native_call(context, id, 0, build_runtime_info_json(*context));
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeClearAuthSession",
        [context](std::string id, std::string /*req*/, void* /*arg*/) {
            queue_native_worker(context, [context, id]() {
                try {
                    save_desktop_setting(context->storage, "auth_mode", std::string("none"));
                    save_desktop_setting(context->storage, "auth_session_json", std::nullopt);

                    {
                        std::lock_guard<std::mutex> lock(context->state_mutex);
                        context->auth_mode = "none";
                        context->auth_session_json = std::nullopt;
                    }

                    resolve_native_call(context, id, 0, build_runtime_info_json(*context));
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );

    view.bind(
        "enLearnerNativeOpenExternalUrl",
        [context](std::string id, std::string req, void* /*arg*/) {
            const std::string url = webview::detail::json_parse(req, "", 0);

            queue_native_worker(context, [context, id, url]() {
                try {
                    open_external_url(url);
                    resolve_native_call(context, id, 0, "{\"ok\":true}");
                } catch (const std::exception& e) {
                    resolve_native_call(context, id, 1, json_error_message(e.what()));
                }
            });
        },
        nullptr
    );
}

}  // namespace en_learner::desktop
