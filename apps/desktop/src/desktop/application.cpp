#include "desktop/application.h"

#include "desktop/bridge.h"
#include "desktop/env.h"
#include "desktop/frontend_server.h"
#include "desktop/network.h"
#include "desktop/platform.h"
#include "desktop/runtime.h"
#include "desktop/storage.h"
#include "desktop/types.h"

#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

namespace en_learner::desktop {

namespace {

class DesktopApplication {
public:
    DesktopApplication()
        : runtime_context_(std::make_shared<DesktopRuntimeContext>()) {
        runtime_context_->platform = platform_name();
        runtime_context_->audio_playback_issue = detect_audio_playback_issue();
        runtime_context_->audio_playback_available =
            !runtime_context_->audio_playback_issue.has_value();
    }

    ~DesktopApplication() {
        shutdown();
    }

    int run() {
        std::cout << "en-learner starting...\n";

        initialize_storage();
        const std::string backend_url = prepare_backend();
        const std::string frontend_url = prepare_frontend();
        runtime_context_->frontend_url = frontend_url;

        std::cout << "Opening webview: " << frontend_url << "\n";
        run_window(backend_url, frontend_url);

        std::cout << "Window closed. Shutting down backend...\n";
        return 0;
    }

private:
    void initialize_storage() {
        try {
            desktop_storage_ = open_desktop_storage();
            hydrate_runtime_context(runtime_context_, desktop_storage_);
        } catch (const std::exception& e) {
            throw std::runtime_error(std::string("Error: ") + e.what());
        }
    }

    std::string prepare_backend() {
        const std::string backend_url =
            resolve_backend_url(runtime_context_->persisted_backend_url);
        const auto local_backend = parse_local_backend_endpoint(backend_url);
        runtime_context_->backend_url = backend_url;

        if (!should_spawn_backend(backend_url)) {
            std::cout << "Backend auto-start disabled. Expecting API at " << backend_url << ".\n";
            return backend_url;
        }

        if (!local_backend.has_value()) {
            throw std::runtime_error(
                "Error: EN_LEARNER_SPAWN_BACKEND requires a local http backend URL."
            );
        }

        if (is_port_open(local_backend->host, local_backend->port)) {
            std::cout << "Backend already reachable at " << backend_url << ". Reusing it.\n";
            return backend_url;
        }

        try {
            const std::string backend_exe = find_backend_exe();
            std::cout << "Starting backend: " << backend_exe << "\n";
            backend_process_ = start_backend(backend_exe);
            owns_backend_ = true;
            runtime_context_->owns_backend = true;
        } catch (const std::exception& e) {
            throw std::runtime_error(std::string("Error: ") + e.what());
        }

        std::cout << "Waiting for backend at " << backend_url << "...\n";
        if (!wait_for_backend(*local_backend, 15000)) {
            throw std::runtime_error("Error: Backend did not start in time. Check logs.");
        }

        std::cout << "Backend ready.\n";
        return backend_url;
    }

    std::string prepare_frontend() {
        try {
            if (auto configured_frontend_url = env_value("EN_LEARNER_FRONTEND_URL")) {
                return *configured_frontend_url;
            }

            if (!IS_PRODUCTION) {
                return "http://127.0.0.1:" + std::to_string(FRONTEND_DEV_PORT);
            }

            const auto frontend_dist_dir = resolve_frontend_dist_dir();
            if (!frontend_dist_dir.has_value()) {
                throw std::runtime_error(
                    "Frontend dist not found. Build the frontend first or set EN_LEARNER_FRONTEND_URL."
                );
            }

            frontend_server_ = start_frontend_server(*frontend_dist_dir);
            const std::string frontend_url =
                "http://127.0.0.1:" + std::to_string(frontend_server_->port);
            std::cout << "Serving desktop frontend from " << frontend_url << "\n";
            return frontend_url;
        } catch (const std::exception& e) {
            throw std::runtime_error(std::string("Error: ") + e.what());
        }
    }

    void run_window(const std::string& backend_url, const std::string& frontend_url) {
        try {
            webview::webview view(false, nullptr);
            view.set_title("en-learner");
            view.set_size(1200, 800, WEBVIEW_HINT_NONE);
            view.set_size(900, 600, WEBVIEW_HINT_MIN);
            bind_native_bridge(view, runtime_context_);
            view.init(build_webview_init_script(backend_url));
            view.navigate(frontend_url);
            view.run();
            stop_runtime_workers();
        } catch (const std::exception& e) {
            stop_runtime_workers();
            throw std::runtime_error(std::string("Webview error: ") + e.what());
        }
    }

    void stop_runtime_workers() noexcept {
        runtime_context_->shutting_down.store(true);
        join_native_workers(runtime_context_);
    }

    void shutdown() noexcept {
        stop_runtime_workers();

        if (frontend_server_) {
            stop_frontend_server(*frontend_server_);
            frontend_server_.reset();
        }

        if (owns_backend_) {
            stop_backend(backend_process_);
            owns_backend_ = false;
            runtime_context_->owns_backend = false;
        }

        close_desktop_storage(desktop_storage_);
        desktop_storage_.reset();
    }

    BackendProcess backend_process_{};
    bool owns_backend_ = false;
    std::unique_ptr<FrontendServer> frontend_server_;
    std::shared_ptr<DesktopStorage> desktop_storage_;
    std::shared_ptr<DesktopRuntimeContext> runtime_context_;
};

}  // namespace

int run_desktop_application() {
    try {
        DesktopApplication app;
        return app.run();
    } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
        return 1;
    }
}

}  // namespace en_learner::desktop
