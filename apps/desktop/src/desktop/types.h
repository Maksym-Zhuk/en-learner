#pragma once

#include "webview/webview.h"

#include <sqlite3.h>

#include <atomic>
#include <filesystem>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <winsock2.h>
#endif

namespace en_learner::desktop {

inline constexpr int DEFAULT_BACKEND_PORT = 3001;
inline constexpr int FRONTEND_DEV_PORT = 5173;
inline constexpr const char* APP_VERSION = "1.0.0";

#ifdef PRODUCTION_BUILD
inline constexpr bool IS_PRODUCTION = true;
#else
inline constexpr bool IS_PRODUCTION = false;
#endif

#ifdef _WIN32
using socket_handle_t = SOCKET;
inline constexpr socket_handle_t INVALID_SOCKET_HANDLE = INVALID_SOCKET;
#else
using socket_handle_t = int;
inline constexpr socket_handle_t INVALID_SOCKET_HANDLE = -1;
#endif

struct LocalEndpoint {
    std::string host;
    int port = 0;
};

struct DesktopStorage {
    sqlite3* db = nullptr;
    std::filesystem::path db_path;
    std::mutex mutex;
};

struct FrontendServer {
    socket_handle_t listen_socket = INVALID_SOCKET_HANDLE;
    std::uint16_t port = 0;
    std::filesystem::path root_dir;
    std::atomic<bool> stop_requested{false};
    std::thread thread;
#ifdef _WIN32
    bool winsock_started = false;
#endif

    FrontendServer() = default;
    FrontendServer(const FrontendServer&) = delete;
    FrontendServer& operator=(const FrontendServer&) = delete;

    FrontendServer(FrontendServer&& other) noexcept
        : listen_socket(other.listen_socket),
          port(other.port),
          root_dir(std::move(other.root_dir)),
          stop_requested(other.stop_requested.load()),
          thread(std::move(other.thread))
#ifdef _WIN32
        , winsock_started(other.winsock_started)
#endif
    {
        other.listen_socket = INVALID_SOCKET_HANDLE;
        other.port = 0;
        other.stop_requested.store(true);
#ifdef _WIN32
        other.winsock_started = false;
#endif
    }

    FrontendServer& operator=(FrontendServer&& other) noexcept {
        if (this == &other) {
            return *this;
        }

        listen_socket = other.listen_socket;
        port = other.port;
        root_dir = std::move(other.root_dir);
        stop_requested.store(other.stop_requested.load());
        thread = std::move(other.thread);
#ifdef _WIN32
        winsock_started = other.winsock_started;
        other.winsock_started = false;
#endif
        other.listen_socket = INVALID_SOCKET_HANDLE;
        other.port = 0;
        other.stop_requested.store(true);
        return *this;
    }
};

struct DesktopRuntimeContext {
    webview::webview* webview = nullptr;
    std::string version = APP_VERSION;
    std::string platform;
    std::string backend_url;
    std::string frontend_url;
    std::string storage_path;
    std::string connectivity_mode = "auto";
    std::string auth_mode = "none";
    std::optional<std::string> auth_session_json;
    std::string local_profile_name = "Local user";
    std::optional<std::string> persisted_backend_url;
    bool audio_playback_available = true;
    std::optional<std::string> audio_playback_issue;
    bool owns_backend = false;
    bool production_build = IS_PRODUCTION;
    std::atomic<bool> shutting_down{false};
    mutable std::mutex state_mutex;
    std::mutex workers_mutex;
    std::vector<std::thread> workers;
    std::shared_ptr<DesktopStorage> storage;
};

}  // namespace en_learner::desktop
