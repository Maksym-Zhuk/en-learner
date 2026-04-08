#include "desktop/runtime.h"

#include "desktop/env.h"
#include "desktop/network.h"
#include "desktop/platform.h"
#include "desktop/storage.h"

#include <filesystem>
#include <sstream>
#include <stdexcept>

namespace en_learner::desktop {

namespace {

std::string json_bool(bool value) {
    return value ? "true" : "false";
}

std::string json_optional_bool(const std::optional<bool>& value) {
    if (!value.has_value()) {
        return "null";
    }

    return json_bool(*value);
}

std::string json_optional_string(const std::optional<std::string>& value) {
    if (!value.has_value()) {
        return "null";
    }

    return webview::detail::json_escape(*value);
}

}  // namespace

bool is_valid_connectivity_mode(const std::string& value) {
    return value == "auto" || value == "offline" || value == "online";
}

bool is_valid_auth_mode(const std::string& value) {
    return value == "none" || value == "guest" || value == "remote";
}

bool is_valid_backend_url(const std::string& url) {
    if (!(starts_with(url, "http://") || starts_with(url, "https://"))) {
        return false;
    }

    return url.find(' ') == std::string::npos;
}

std::string json_error_message(const std::string& message) {
    return std::string("{\"message\":") + webview::detail::json_escape(message) + "}";
}

std::string build_runtime_info_json(const DesktopRuntimeContext& context) {
    std::string backend_url;
    std::string frontend_url;
    std::string storage_path;
    std::string connectivity_mode;
    std::string auth_mode;
    std::string local_profile_name;
    std::optional<std::string> auth_session_json;
    std::optional<std::string> persisted_backend_url;
    bool audio_playback_available = true;
    std::optional<std::string> audio_playback_issue;
    bool owns_backend = false;
    bool production_build = false;

    {
        std::lock_guard<std::mutex> lock(context.state_mutex);
        backend_url = context.backend_url;
        frontend_url = context.frontend_url;
        storage_path = context.storage_path;
        connectivity_mode = context.connectivity_mode;
        auth_mode = context.auth_mode;
        auth_session_json = context.auth_session_json;
        local_profile_name = context.local_profile_name;
        persisted_backend_url = context.persisted_backend_url;
        audio_playback_available = context.audio_playback_available;
        audio_playback_issue = context.audio_playback_issue;
        owns_backend = context.owns_backend;
        production_build = context.production_build;
    }

    const auto local_backend = parse_local_backend_endpoint(backend_url);
    const bool backend_checkable = local_backend.has_value();
    std::optional<bool> backend_reachable;

    if (local_backend.has_value()) {
        backend_reachable = is_port_open(local_backend->host, local_backend->port);
    }

    std::ostringstream json;
    json << "{"
         << "\"version\":" << webview::detail::json_escape(context.version) << ","
         << "\"platform\":" << webview::detail::json_escape(context.platform) << ","
         << "\"backendUrl\":" << webview::detail::json_escape(backend_url) << ","
         << "\"frontendUrl\":" << webview::detail::json_escape(frontend_url) << ","
         << "\"storagePath\":" << webview::detail::json_escape(storage_path) << ","
         << "\"connectivityMode\":" << webview::detail::json_escape(connectivity_mode) << ","
         << "\"authMode\":" << webview::detail::json_escape(auth_mode) << ","
         << "\"authSessionJson\":" << json_optional_string(auth_session_json) << ","
         << "\"localProfileName\":" << webview::detail::json_escape(local_profile_name) << ","
         << "\"persistedBackendUrl\":" << json_optional_string(persisted_backend_url) << ","
         << "\"audioPlaybackAvailable\":" << json_bool(audio_playback_available) << ","
         << "\"audioPlaybackIssue\":" << json_optional_string(audio_playback_issue) << ","
         << "\"managesBackend\":" << json_bool(owns_backend) << ","
         << "\"productionBuild\":" << json_bool(production_build) << ","
         << "\"backendCheckable\":" << json_bool(backend_checkable) << ","
         << "\"backendReachable\":" << json_optional_bool(backend_reachable)
         << "}";

    return json.str();
}

void hydrate_runtime_context(
    const std::shared_ptr<DesktopRuntimeContext>& context,
    const std::shared_ptr<DesktopStorage>& storage
) {
    context->storage = storage;
    context->storage_path = storage->db_path.string();
    context->persisted_backend_url = load_desktop_setting(storage, "backend_url");

    if (auto stored_connectivity_mode = load_desktop_setting(storage, "connectivity_mode")) {
        if (is_valid_connectivity_mode(*stored_connectivity_mode)) {
            context->connectivity_mode = *stored_connectivity_mode;
        }
    }

    if (auto stored_auth_mode = load_desktop_setting(storage, "auth_mode")) {
        if (is_valid_auth_mode(*stored_auth_mode)) {
            context->auth_mode = *stored_auth_mode;
        }
    }

    context->auth_session_json = load_desktop_setting(storage, "auth_session_json");

    if (auto stored_local_profile_name = load_desktop_setting(storage, "local_profile_name")) {
        if (!stored_local_profile_name->empty()) {
            context->local_profile_name = *stored_local_profile_name;
        }
    }

    if (context->auth_mode == "remote" && !context->auth_session_json.has_value()) {
        context->auth_mode = "none";
    }
    if (context->auth_mode != "remote") {
        context->auth_session_json = std::nullopt;
    }
}

std::string build_webview_init_script(const std::string& backend_url) {
    std::ostringstream script;
    script << "window.__enLearner = Object.assign({}, window.__enLearner || {}, {"
           << "version: '" << js_escape(APP_VERSION) << "',"
           << "platform: '" << js_escape(platform_name()) << "',"
           << "nativeBridge: { available: true }"
           << "});"
           << "window.__EN_LEARNER_RUNTIME_CONFIG = Object.assign({}, window.__EN_LEARNER_RUNTIME_CONFIG || {}, {"
           << "apiBaseUrl: '" << js_escape(backend_url) << "',"
           << "publicAppUrl: '" << js_escape(env_value("EN_LEARNER_PUBLIC_APP_URL").value_or("")) << "'"
           << "});";
    return script.str();
}

std::string resolve_backend_url(const std::optional<std::string>& persisted_backend_url) {
    if (auto backend_url = env_value("EN_LEARNER_BACKEND_URL")) {
        return *backend_url;
    }

    if (persisted_backend_url.has_value() && !persisted_backend_url->empty()) {
        return *persisted_backend_url;
    }

    auto host = env_value("BACKEND_HOST");
    if (!host.has_value()) {
        host = env_value("HOST");
    }

    std::string resolved_host = host.value_or("127.0.0.1");
    if (
        resolved_host == "0.0.0.0" ||
        resolved_host == "::" ||
        resolved_host == "[::]" ||
        resolved_host == "localhost"
    ) {
        resolved_host = "127.0.0.1";
    }

    int port = DEFAULT_BACKEND_PORT;
    if (env_value("BACKEND_PORT").has_value()) {
        port = env_int("BACKEND_PORT");
    } else if (env_value("PORT").has_value()) {
        port = env_int("PORT");
    }

    return "http://" + resolved_host + ":" + std::to_string(port);
}

bool should_spawn_backend(const std::string& backend_url) {
    if (auto configured = env_bool("EN_LEARNER_SPAWN_BACKEND")) {
        return *configured;
    }

    return parse_local_backend_endpoint(backend_url).has_value();
}

std::string find_backend_exe() {
    namespace fs = std::filesystem;

    if (auto backend_exe = env_value("EN_LEARNER_BACKEND_EXE")) {
        return *backend_exe;
    }

    const fs::path self = executable_path();

    std::string ext;
#ifdef _WIN32
    ext = ".exe";
#endif

    auto candidate = self.parent_path() / ("en-learner-backend" + ext);
    if (fs::exists(candidate)) {
        return candidate.string();
    }

    auto dev = self.parent_path() / ".." / ".." / "backend" / "target" / "debug" /
               ("en-learner-backend" + ext);
    dev = fs::weakly_canonical(dev);
    if (fs::exists(dev)) {
        return dev.string();
    }

    auto rel = self.parent_path() / ".." / ".." / "backend" / "target" / "release" /
               ("en-learner-backend" + ext);
    rel = fs::weakly_canonical(rel);
    if (fs::exists(rel)) {
        return rel.string();
    }

    throw std::runtime_error(
        "Backend executable not found. Build it first or set EN_LEARNER_BACKEND_EXE."
    );
}

}  // namespace en_learner::desktop
