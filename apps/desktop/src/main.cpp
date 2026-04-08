/**
 * en-learner Desktop Shell
 *
 * Responsibilities:
 *   1. Optionally spawn the Rust backend process
 *   2. Wait until the backend is accepting connections
 *   3. Open a webview window with the configured frontend entrypoint
 *   4. Shut down the backend when the window closes
 */

#include "webview/webview.h"
#include <sqlite3.h>

#include <atomic>
#include <array>
#include <chrono>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iomanip>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
  #include <shellapi.h>
  #include <windows.h>
  #include <winsock2.h>
  #pragma comment(lib, "Ws2_32.lib")
  using pid_t = DWORD;
#else
  #include <arpa/inet.h>
  #include <csignal>
  #include <netinet/in.h>
  #include <sys/socket.h>
  #include <sys/types.h>
  #include <sys/wait.h>
  #include <unistd.h>
#endif

#ifdef __APPLE__
  #include <mach-o/dyld.h>
#endif

#ifdef _WIN32
using socket_handle_t = SOCKET;
static constexpr socket_handle_t INVALID_SOCKET_HANDLE = INVALID_SOCKET;
#else
using socket_handle_t = int;
static constexpr socket_handle_t INVALID_SOCKET_HANDLE = -1;
#endif

// ---- Configuration -------------------------------------------------------

static constexpr int DEFAULT_BACKEND_PORT = 3001;
static constexpr int FRONTEND_DEV_PORT = 5173;
static constexpr const char* APP_VERSION = "1.0.0";

#ifdef PRODUCTION_BUILD
static constexpr bool IS_PRODUCTION = true;
#else
static constexpr bool IS_PRODUCTION = false;
#endif

// ---- Cross-platform process management -----------------------------------

#ifdef _WIN32

struct BackendProcess {
    HANDLE handle = INVALID_HANDLE_VALUE;
    DWORD pid = 0;
};

BackendProcess start_backend(const std::string& exe_path) {
    STARTUPINFOA si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};

    std::string cmd = "\"" + exe_path + "\"";
    if (!CreateProcessA(nullptr, &cmd[0], nullptr, nullptr, FALSE,
                        CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi)) {
        throw std::runtime_error("Failed to start backend process");
    }
    CloseHandle(pi.hThread);

    BackendProcess bp;
    bp.handle = pi.hProcess;
    bp.pid = pi.dwProcessId;
    return bp;
}

void stop_backend(BackendProcess& bp) {
    if (bp.handle != INVALID_HANDLE_VALUE) {
        TerminateProcess(bp.handle, 0);
        WaitForSingleObject(bp.handle, 3000);
        CloseHandle(bp.handle);
        bp.handle = INVALID_HANDLE_VALUE;
        bp.pid = 0;
    }
}

#else

struct BackendProcess {
    pid_t pid = -1;
};

BackendProcess start_backend(const std::string& exe_path) {
    pid_t pid = fork();
    if (pid < 0) {
        throw std::runtime_error("fork() failed");
    }
    if (pid == 0) {
        execl(exe_path.c_str(), exe_path.c_str(), nullptr);
        std::cerr << "Failed to exec backend: " << exe_path << "\n";
        _exit(1);
    }

    BackendProcess bp;
    bp.pid = pid;
    return bp;
}

void stop_backend(BackendProcess& bp) {
    if (bp.pid <= 0) {
        return;
    }

    kill(bp.pid, SIGTERM);

    int status = 0;
    bool exited = false;
    for (int i = 0; i < 30; ++i) {
        pid_t result = waitpid(bp.pid, &status, WNOHANG);
        if (result == bp.pid || result == -1) {
            exited = true;
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    if (!exited) {
        kill(bp.pid, SIGKILL);
        waitpid(bp.pid, &status, 0);
    }

    bp.pid = -1;
}

#endif

// ---- Helpers --------------------------------------------------------------

struct LocalEndpoint {
    std::string host;
    int port;
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
    bool owns_backend = false;
    bool production_build = IS_PRODUCTION;
    std::atomic<bool> shutting_down{false};
    mutable std::mutex state_mutex;
    std::mutex workers_mutex;
    std::vector<std::thread> workers;
    std::shared_ptr<struct DesktopStorage> storage;
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

struct DesktopStorage {
    sqlite3* db = nullptr;
    std::filesystem::path db_path;
    std::mutex mutex;
};

std::optional<LocalEndpoint> parse_local_backend_endpoint(const std::string& url);
bool is_port_open(const std::string& host, int port);

std::optional<std::string> env_value(const char* name) {
    const char* value = std::getenv(name);
    if (value == nullptr || value[0] == '\0') {
        return std::nullopt;
    }
    return std::string(value);
}

std::string to_lower(std::string value) {
    for (char& ch : value) {
        ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
    }
    return value;
}

std::string platform_name() {
#ifdef _WIN32
    return "windows";
#elif defined(__APPLE__)
    return "macos";
#else
    return "linux";
#endif
}

bool starts_with(const std::string& value, const std::string& prefix) {
    return value.rfind(prefix, 0) == 0;
}

std::optional<bool> env_bool(const char* name) {
    auto value = env_value(name);
    if (!value.has_value()) {
        return std::nullopt;
    }

    const std::string normalized = to_lower(*value);
    if (normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on") {
        return true;
    }
    if (normalized == "0" || normalized == "false" || normalized == "no" || normalized == "off") {
        return false;
    }

    throw std::runtime_error(std::string("Invalid boolean value for ") + name + ": " + *value);
}

int env_int(const char* name) {
    auto value = env_value(name);
    if (!value.has_value()) {
        throw std::runtime_error(std::string("Missing integer value for ") + name);
    }

    try {
        return std::stoi(*value);
    } catch (...) {
        throw std::runtime_error(std::string("Invalid integer value for ") + name + ": " + *value);
    }
}

std::optional<int> env_optional_int(const char* name) {
    auto value = env_value(name);
    if (!value.has_value()) {
        return std::nullopt;
    }

    try {
        return std::stoi(*value);
    } catch (...) {
        throw std::runtime_error(std::string("Invalid integer value for ") + name + ": " + *value);
    }
}

void close_socket_handle(socket_handle_t socket_handle) {
    if (socket_handle == INVALID_SOCKET_HANDLE) {
        return;
    }

#ifdef _WIN32
    closesocket(socket_handle);
#else
    close(socket_handle);
#endif
}

std::filesystem::path executable_path() {
    namespace fs = std::filesystem;

#ifdef _WIN32
    char buf[MAX_PATH];
    GetModuleFileNameA(nullptr, buf, MAX_PATH);
    return fs::path(buf);
#elif defined(__APPLE__)
    char buf[4096] = {};
    uint32_t size = sizeof(buf);
    if (_NSGetExecutablePath(buf, &size) == 0) {
        return fs::path(buf);
    }
    throw std::runtime_error("Unable to resolve executable path");
#else
    char buf[4096] = {};
    ssize_t n = readlink("/proc/self/exe", buf, sizeof(buf) - 1);
    if (n > 0) {
        return fs::path(std::string(buf, static_cast<std::size_t>(n)));
    }
    throw std::runtime_error("Unable to resolve executable path");
#endif
}

std::string url_encode(const std::string& value) {
    std::ostringstream encoded;
    encoded << std::uppercase << std::hex;

    for (unsigned char ch : value) {
        if (std::isalnum(ch) || ch == '/' || ch == '.' || ch == '-' || ch == '_' || ch == '~' || ch == ':') {
            encoded << static_cast<char>(ch);
        } else {
            encoded << '%' << std::setw(2) << std::setfill('0') << static_cast<int>(ch);
        }
    }

    return encoded.str();
}

std::string file_url_from_path(const std::filesystem::path& path) {
    namespace fs = std::filesystem;

    fs::path absolute = fs::weakly_canonical(path);
    std::string generic = absolute.generic_string();

#ifdef _WIN32
    if (!generic.empty() && generic[0] != '/') {
        generic = "/" + generic;
    }
#endif

    return "file://" + url_encode(generic);
}

std::string js_escape(const std::string& value) {
    std::ostringstream escaped;

    for (char ch : value) {
        switch (ch) {
            case '\\':
                escaped << "\\\\";
                break;
            case '\'':
                escaped << "\\'";
                break;
            case '\n':
                escaped << "\\n";
                break;
            case '\r':
                escaped << "\\r";
                break;
            default:
                escaped << ch;
                break;
        }
    }

    return escaped.str();
}

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

bool is_valid_connectivity_mode(const std::string& value) {
    return value == "auto" || value == "offline" || value == "online";
}

bool is_valid_auth_mode(const std::string& value) {
    return value == "none" || value == "guest" || value == "remote";
}

void open_external_url(const std::string& url) {
    if (!(starts_with(url, "http://") || starts_with(url, "https://"))) {
        throw std::runtime_error("External URLs must start with http:// or https://");
    }

#ifdef _WIN32
    HINSTANCE result = ShellExecuteA(nullptr, "open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    auto code = reinterpret_cast<std::intptr_t>(result);
    if (code <= 32) {
        throw std::runtime_error("Failed to open the system browser");
    }
#else
    pid_t pid = fork();
    if (pid < 0) {
        throw std::runtime_error("Failed to fork the browser launcher");
    }

    if (pid == 0) {
#ifdef __APPLE__
        execlp("open", "open", url.c_str(), nullptr);
#else
        execlp("xdg-open", "xdg-open", url.c_str(), nullptr);
#endif
        _exit(1);
    }
#endif
}

std::filesystem::path resolve_desktop_data_dir() {
    namespace fs = std::filesystem;

    if (auto explicit_dir = env_value("EN_LEARNER_DATA_DIR")) {
        return fs::path(*explicit_dir);
    }

#ifdef _WIN32
    if (auto local_app_data = env_value("LOCALAPPDATA")) {
        return fs::path(*local_app_data) / "en-learner";
    }
    if (auto app_data = env_value("APPDATA")) {
        return fs::path(*app_data) / "en-learner";
    }
#elif defined(__APPLE__)
    if (auto home = env_value("HOME")) {
        return fs::path(*home) / "Library" / "Application Support" / "en-learner";
    }
#else
    if (auto xdg_data_home = env_value("XDG_DATA_HOME")) {
        return fs::path(*xdg_data_home) / "en-learner";
    }
    if (auto home = env_value("HOME")) {
        return fs::path(*home) / ".local" / "share" / "en-learner";
    }
#endif

    return fs::temp_directory_path() / "en-learner";
}

std::filesystem::path resolve_desktop_db_path() {
    if (auto db_path = env_value("EN_LEARNER_NATIVE_DB_PATH")) {
        return std::filesystem::path(*db_path);
    }

    return resolve_desktop_data_dir() / "desktop.db";
}

void ensure_sqlite_ok(int rc, sqlite3* db, const std::string& context) {
    if (rc == SQLITE_OK || rc == SQLITE_DONE || rc == SQLITE_ROW) {
        return;
    }

    const char* message = db == nullptr ? nullptr : sqlite3_errmsg(db);
    throw std::runtime_error(context + ": " + (message == nullptr ? "sqlite error" : message));
}

std::shared_ptr<DesktopStorage> open_desktop_storage() {
    auto storage = std::make_shared<DesktopStorage>();
    storage->db_path = resolve_desktop_db_path();

    if (!storage->db_path.parent_path().empty()) {
        std::filesystem::create_directories(storage->db_path.parent_path());
    }

    sqlite3* db = nullptr;
    const int open_rc = sqlite3_open_v2(
        storage->db_path.string().c_str(),
        &db,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
        nullptr
    );
    if (open_rc != SQLITE_OK) {
        std::string message = db == nullptr ? "sqlite open failed" : sqlite3_errmsg(db);
        if (db != nullptr) {
            sqlite3_close_v2(db);
        }
        throw std::runtime_error("Failed to open desktop SQLite storage: " + message);
    }

    storage->db = db;

    const char* bootstrap_sql =
        "PRAGMA journal_mode=WAL;"
        "PRAGMA synchronous=NORMAL;"
        "PRAGMA busy_timeout=5000;"
        "CREATE TABLE IF NOT EXISTS desktop_settings ("
        "  key TEXT PRIMARY KEY,"
        "  value TEXT NOT NULL,"
        "  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))"
        ");";

    char* error_message = nullptr;
    const int exec_rc = sqlite3_exec(storage->db, bootstrap_sql, nullptr, nullptr, &error_message);
    if (exec_rc != SQLITE_OK) {
        const std::string message = error_message == nullptr ? "sqlite bootstrap failed" : error_message;
        sqlite3_free(error_message);
        sqlite3_close_v2(storage->db);
        storage->db = nullptr;
        throw std::runtime_error("Failed to initialize desktop SQLite storage: " + message);
    }

    return storage;
}

std::optional<std::string> load_desktop_setting(
    const std::shared_ptr<DesktopStorage>& storage,
    const std::string& key
) {
    std::lock_guard<std::mutex> lock(storage->mutex);

    sqlite3_stmt* statement = nullptr;
    ensure_sqlite_ok(
        sqlite3_prepare_v2(
            storage->db,
            "SELECT value FROM desktop_settings WHERE key = ?1",
            -1,
            &statement,
            nullptr
        ),
        storage->db,
        "Failed to prepare desktop setting query"
    );

    std::optional<std::string> value;
    sqlite3_bind_text(statement, 1, key.c_str(), -1, SQLITE_TRANSIENT);

    const int step_rc = sqlite3_step(statement);
    if (step_rc == SQLITE_ROW) {
        const unsigned char* raw_value = sqlite3_column_text(statement, 0);
        if (raw_value != nullptr) {
            value = std::string(reinterpret_cast<const char*>(raw_value));
        }
    } else if (step_rc != SQLITE_DONE) {
        sqlite3_finalize(statement);
        ensure_sqlite_ok(step_rc, storage->db, "Failed to read desktop setting");
    }

    sqlite3_finalize(statement);
    return value;
}

void save_desktop_setting(
    const std::shared_ptr<DesktopStorage>& storage,
    const std::string& key,
    const std::optional<std::string>& value
) {
    std::lock_guard<std::mutex> lock(storage->mutex);

    sqlite3_stmt* statement = nullptr;

    if (value.has_value()) {
        ensure_sqlite_ok(
            sqlite3_prepare_v2(
                storage->db,
                "INSERT INTO desktop_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ','now')) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                -1,
                &statement,
                nullptr
            ),
            storage->db,
            "Failed to prepare desktop setting upsert"
        );
        sqlite3_bind_text(statement, 1, key.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(statement, 2, value->c_str(), -1, SQLITE_TRANSIENT);
    } else {
        ensure_sqlite_ok(
            sqlite3_prepare_v2(
                storage->db,
                "DELETE FROM desktop_settings WHERE key = ?1",
                -1,
                &statement,
                nullptr
            ),
            storage->db,
            "Failed to prepare desktop setting delete"
        );
        sqlite3_bind_text(statement, 1, key.c_str(), -1, SQLITE_TRANSIENT);
    }

    const int step_rc = sqlite3_step(statement);
    sqlite3_finalize(statement);
    ensure_sqlite_ok(step_rc, storage->db, "Failed to persist desktop setting");
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
         << "\"managesBackend\":" << json_bool(owns_backend) << ","
         << "\"productionBuild\":" << json_bool(production_build) << ","
         << "\"backendCheckable\":" << json_bool(backend_checkable) << ","
         << "\"backendReachable\":" << json_optional_bool(backend_reachable)
         << "}";

    return json.str();
}

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
void queue_native_worker(
    const std::shared_ptr<DesktopRuntimeContext>& context,
    Fn&& task
) {
    std::lock_guard<std::mutex> lock(context->workers_mutex);
    context->workers.emplace_back([context, task = std::forward<Fn>(task)]() mutable {
        task();
    });
}

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

std::optional<LocalEndpoint> parse_local_backend_endpoint(const std::string& url) {
    if (!starts_with(url, "http://")) {
        return std::nullopt;
    }

    std::string rest = url.substr(std::strlen("http://"));
    std::size_t slash_pos = rest.find('/');
    std::string host_port = rest.substr(0, slash_pos);

    if (host_port.empty()) {
        return std::nullopt;
    }

    std::string host = host_port;
    int port = 80;

    std::size_t colon_pos = host_port.rfind(':');
    if (colon_pos != std::string::npos) {
        host = host_port.substr(0, colon_pos);
        const std::string port_str = host_port.substr(colon_pos + 1);
        try {
            port = std::stoi(port_str);
        } catch (...) {
            throw std::runtime_error("Invalid backend URL port: " + url);
        }
    }

    if (host == "localhost") {
        host = "127.0.0.1";
    }

    if (host != "127.0.0.1") {
        return std::nullopt;
    }

    return LocalEndpoint{host, port};
}

// ---- TCP health check ----------------------------------------------------

bool is_port_open(const std::string& host, int port) {
#ifdef _WIN32
    WSADATA wsa{};
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif

    int sock = static_cast<int>(socket(AF_INET, SOCK_STREAM, 0));
    if (sock < 0) {
        return false;
    }

    struct sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<uint16_t>(port));
    addr.sin_addr.s_addr = inet_addr(host.c_str());

#ifdef _WIN32
    DWORD timeout = 500;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
#else
    struct timeval timeout{};
    timeout.tv_sec = 0;
    timeout.tv_usec = 500000;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
#endif

    int result = connect(sock, reinterpret_cast<struct sockaddr*>(&addr), sizeof(addr));

#ifdef _WIN32
    closesocket(sock);
    WSACleanup();
#else
    close(sock);
#endif

    return result == 0;
}

bool wait_for_backend(const LocalEndpoint& endpoint, int timeout_ms = 10000) {
    auto start = std::chrono::steady_clock::now();
    while (true) {
        if (is_port_open(endpoint.host, endpoint.port)) {
            return true;
        }

        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start
        ).count();
        if (elapsed >= timeout_ms) {
            return false;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }
}

// ---- Path resolution -----------------------------------------------------

std::optional<std::filesystem::path> resolve_frontend_dist_dir() {
    namespace fs = std::filesystem;

    std::vector<fs::path> candidates;

    if (auto frontend_dist_dir = env_value("EN_LEARNER_FRONTEND_DIST_DIR")) {
        candidates.push_back(fs::path(*frontend_dist_dir));
    }

#ifdef FRONTEND_DIST_PATH
    candidates.push_back(fs::path(FRONTEND_DIST_PATH));
#endif

    const fs::path exe_dir = executable_path().parent_path();
    candidates.push_back(exe_dir / "dist");
    candidates.push_back(exe_dir / "../dist");
    candidates.push_back(exe_dir / "../frontend/dist");
    candidates.push_back(exe_dir / "../../frontend/dist");

    for (const auto& candidate : candidates) {
        if (fs::exists(candidate / "index.html")) {
            return fs::weakly_canonical(candidate);
        }
    }

    return std::nullopt;
}

bool path_has_prefix(
    const std::filesystem::path& full_path,
    const std::filesystem::path& prefix
) {
    auto full_it = full_path.begin();
    auto prefix_it = prefix.begin();

    for (; prefix_it != prefix.end(); ++prefix_it, ++full_it) {
        if (full_it == full_path.end() || *full_it != *prefix_it) {
            return false;
        }
    }

    return true;
}

std::string content_type_for_path(const std::filesystem::path& path) {
    const std::string ext = to_lower(path.extension().string());

    if (ext == ".html") return "text/html; charset=utf-8";
    if (ext == ".js" || ext == ".mjs") return "application/javascript; charset=utf-8";
    if (ext == ".css") return "text/css; charset=utf-8";
    if (ext == ".json") return "application/json; charset=utf-8";
    if (ext == ".svg") return "image/svg+xml";
    if (ext == ".png") return "image/png";
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".woff") return "font/woff";
    if (ext == ".woff2") return "font/woff2";

    return "application/octet-stream";
}

std::string build_http_response(
    int status_code,
    const std::string& status_text,
    const std::string& content_type,
    const std::string& body,
    bool head_only = false
) {
    std::ostringstream response;
    response << "HTTP/1.1 " << status_code << ' ' << status_text << "\r\n"
             << "Content-Type: " << content_type << "\r\n"
             << "Content-Length: " << body.size() << "\r\n"
             << "Connection: close\r\n\r\n";

    if (!head_only) {
        response << body;
    }

    return response.str();
}

void send_all(socket_handle_t client_socket, const std::string& payload) {
    const char* data = payload.data();
    std::size_t total_sent = 0;

    while (total_sent < payload.size()) {
#ifdef _WIN32
        const int sent = send(
            client_socket,
            data + total_sent,
            static_cast<int>(payload.size() - total_sent),
            0
        );
#else
        const ssize_t sent = send(
            client_socket,
            data + total_sent,
            payload.size() - total_sent,
            0
        );
#endif

        if (sent <= 0) {
            return;
        }

        total_sent += static_cast<std::size_t>(sent);
    }
}

void handle_frontend_request(socket_handle_t client_socket, const std::filesystem::path& root_dir) {
    std::array<char, 8192> buffer{};
#ifdef _WIN32
    const int received = recv(client_socket, buffer.data(), static_cast<int>(buffer.size() - 1), 0);
#else
    const ssize_t received = recv(client_socket, buffer.data(), buffer.size() - 1, 0);
#endif

    if (received <= 0) {
        return;
    }

    const std::string request(buffer.data(), static_cast<std::size_t>(received));
    const std::size_t line_end = request.find("\r\n");
    const std::string request_line = request.substr(0, line_end);
    std::istringstream line_stream(request_line);
    std::string method;
    std::string raw_path;
    std::string http_version;
    line_stream >> method >> raw_path >> http_version;

    if (method != "GET" && method != "HEAD") {
        send_all(
            client_socket,
            build_http_response(405, "Method Not Allowed", "text/plain; charset=utf-8", "Method Not Allowed")
        );
        return;
    }

    std::size_t query_pos = raw_path.find('?');
    if (query_pos != std::string::npos) {
        raw_path = raw_path.substr(0, query_pos);
    }

    std::filesystem::path relative_path;
    if (raw_path.empty() || raw_path == "/") {
        relative_path = "index.html";
    } else {
        std::string normalized = raw_path;
        while (!normalized.empty() && normalized.front() == '/') {
            normalized.erase(normalized.begin());
        }
        relative_path = normalized;
    }

    const auto canonical_root = std::filesystem::weakly_canonical(root_dir);
    auto requested_path = std::filesystem::weakly_canonical(root_dir / relative_path);

    if (!std::filesystem::exists(requested_path) || !path_has_prefix(requested_path, canonical_root)) {
        if (relative_path.extension().empty()) {
            requested_path = canonical_root / "index.html";
        } else {
            send_all(
                client_socket,
                build_http_response(404, "Not Found", "text/plain; charset=utf-8", "Not Found")
            );
            return;
        }
    }

    if (!std::filesystem::exists(requested_path) || !std::filesystem::is_regular_file(requested_path)) {
        send_all(
            client_socket,
            build_http_response(404, "Not Found", "text/plain; charset=utf-8", "Not Found")
        );
        return;
    }

    std::ifstream file(requested_path, std::ios::binary);
    if (!file) {
        send_all(
            client_socket,
            build_http_response(500, "Internal Server Error", "text/plain; charset=utf-8", "Failed to open file")
        );
        return;
    }

    std::string body(
        (std::istreambuf_iterator<char>(file)),
        std::istreambuf_iterator<char>()
    );

    send_all(
        client_socket,
        build_http_response(
            200,
            "OK",
            content_type_for_path(requested_path),
            body,
            method == "HEAD"
        )
    );
}

std::unique_ptr<FrontendServer> start_frontend_server(const std::filesystem::path& root_dir) {
    auto server = std::make_unique<FrontendServer>();
    server->root_dir = root_dir;

#ifdef _WIN32
    WSADATA wsa{};
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        throw std::runtime_error("WSAStartup failed for frontend server");
    }
    server->winsock_started = true;
#endif

    const int preferred_port = env_optional_int("EN_LEARNER_FRONTEND_PORT").value_or(4173);

    for (int port = preferred_port; port < preferred_port + 50; ++port) {
        socket_handle_t listen_socket = socket(AF_INET, SOCK_STREAM, 0);
        if (listen_socket == INVALID_SOCKET_HANDLE) {
            continue;
        }

        int opt = 1;
#ifdef _WIN32
        setsockopt(listen_socket, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));
#else
        setsockopt(listen_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

        struct sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = inet_addr("127.0.0.1");
        addr.sin_port = htons(static_cast<std::uint16_t>(port));

        if (bind(listen_socket, reinterpret_cast<struct sockaddr*>(&addr), sizeof(addr)) != 0) {
            close_socket_handle(listen_socket);
            continue;
        }

        if (listen(listen_socket, 16) != 0) {
            close_socket_handle(listen_socket);
            continue;
        }

        server->listen_socket = listen_socket;
        server->port = static_cast<std::uint16_t>(port);
        break;
    }

    if (server->listen_socket == INVALID_SOCKET_HANDLE) {
#ifdef _WIN32
        if (server->winsock_started) {
            WSACleanup();
        }
#endif
        throw std::runtime_error("Failed to start local frontend server");
    }

    FrontendServer* server_ptr = server.get();
    server->thread = std::thread([server_ptr]() {
        while (!server_ptr->stop_requested.load()) {
            fd_set read_fds;
            FD_ZERO(&read_fds);
            FD_SET(server_ptr->listen_socket, &read_fds);

            struct timeval timeout{};
            timeout.tv_sec = 0;
            timeout.tv_usec = 200000;

#ifdef _WIN32
            const int ready = select(0, &read_fds, nullptr, nullptr, &timeout);
#else
            const int ready = select(server_ptr->listen_socket + 1, &read_fds, nullptr, nullptr, &timeout);
#endif
            if (ready <= 0 || !FD_ISSET(server_ptr->listen_socket, &read_fds)) {
                continue;
            }

            socket_handle_t client_socket = accept(server_ptr->listen_socket, nullptr, nullptr);
            if (client_socket == INVALID_SOCKET_HANDLE) {
                continue;
            }

            handle_frontend_request(client_socket, server_ptr->root_dir);
            close_socket_handle(client_socket);
        }
    });

    return server;
}

void stop_frontend_server(FrontendServer& server) {
    server.stop_requested.store(true);

    if (server.listen_socket != INVALID_SOCKET_HANDLE) {
        close_socket_handle(server.listen_socket);
        server.listen_socket = INVALID_SOCKET_HANDLE;
    }

    if (server.thread.joinable()) {
        server.thread.join();
    }

#ifdef _WIN32
    if (server.winsock_started) {
        WSACleanup();
        server.winsock_started = false;
    }
#endif
}

void close_desktop_storage(const std::shared_ptr<DesktopStorage>& storage) {
    if (!storage) {
        return;
    }

    std::lock_guard<std::mutex> lock(storage->mutex);
    if (storage->db != nullptr) {
        sqlite3_close_v2(storage->db);
        storage->db = nullptr;
    }
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

void bind_native_bridge(
    webview::webview& view,
    const std::shared_ptr<DesktopRuntimeContext>& context
) {
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

// ---- Main ----------------------------------------------------------------

int main() {
    std::cout << "en-learner starting...\n";

    BackendProcess backend_process{};
    bool owns_backend = false;
    std::unique_ptr<FrontendServer> frontend_server;
    std::shared_ptr<DesktopStorage> desktop_storage;
    auto runtime_context = std::make_shared<DesktopRuntimeContext>();
    runtime_context->platform = platform_name();

    try {
        desktop_storage = open_desktop_storage();
        runtime_context->storage = desktop_storage;
        runtime_context->storage_path = desktop_storage->db_path.string();
        runtime_context->persisted_backend_url = load_desktop_setting(desktop_storage, "backend_url");
        if (auto stored_connectivity_mode = load_desktop_setting(desktop_storage, "connectivity_mode")) {
            if (is_valid_connectivity_mode(*stored_connectivity_mode)) {
                runtime_context->connectivity_mode = *stored_connectivity_mode;
            }
        }
        if (auto stored_auth_mode = load_desktop_setting(desktop_storage, "auth_mode")) {
            if (is_valid_auth_mode(*stored_auth_mode)) {
                runtime_context->auth_mode = *stored_auth_mode;
            }
        }
        runtime_context->auth_session_json = load_desktop_setting(desktop_storage, "auth_session_json");
        if (auto stored_local_profile_name = load_desktop_setting(desktop_storage, "local_profile_name")) {
            if (!stored_local_profile_name->empty()) {
                runtime_context->local_profile_name = *stored_local_profile_name;
            }
        }

        if (runtime_context->auth_mode == "remote" && !runtime_context->auth_session_json.has_value()) {
            runtime_context->auth_mode = "none";
        }
        if (runtime_context->auth_mode != "remote") {
            runtime_context->auth_session_json = std::nullopt;
        }
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }

    const std::string backend_url = resolve_backend_url(runtime_context->persisted_backend_url);
    const auto local_backend = parse_local_backend_endpoint(backend_url);
    runtime_context->backend_url = backend_url;

    if (should_spawn_backend(backend_url)) {
        if (!local_backend.has_value()) {
            std::cerr << "EN_LEARNER_SPAWN_BACKEND requires a local http backend URL.\n";
            return 1;
        }

        if (is_port_open(local_backend->host, local_backend->port)) {
            std::cout << "Backend already reachable at " << backend_url << ". Reusing it.\n";
        } else {
            try {
                const std::string backend_exe = find_backend_exe();
                std::cout << "Starting backend: " << backend_exe << "\n";
                backend_process = start_backend(backend_exe);
                owns_backend = true;
                runtime_context->owns_backend = true;
            } catch (const std::exception& e) {
                std::cerr << "Error: " << e.what() << "\n";
                close_desktop_storage(desktop_storage);
                return 1;
            }

            std::cout << "Waiting for backend at " << backend_url << "...\n";
            if (!wait_for_backend(*local_backend, 15000)) {
                std::cerr << "Backend did not start in time. Check logs.\n";
                stop_backend(backend_process);
                close_desktop_storage(desktop_storage);
                return 1;
            }
            std::cout << "Backend ready.\n";
        }
    } else {
        std::cout << "Backend auto-start disabled. Expecting API at " << backend_url << ".\n";
    }

    std::string frontend_url;
    try {
        if (auto configured_frontend_url = env_value("EN_LEARNER_FRONTEND_URL")) {
            frontend_url = *configured_frontend_url;
        } else if (!IS_PRODUCTION) {
            frontend_url = "http://127.0.0.1:" + std::to_string(FRONTEND_DEV_PORT);
        } else {
            const auto frontend_dist_dir = resolve_frontend_dist_dir();
            if (!frontend_dist_dir.has_value()) {
                throw std::runtime_error(
                    "Frontend dist not found. Build the frontend first or set EN_LEARNER_FRONTEND_URL."
                );
            }

            frontend_server = start_frontend_server(*frontend_dist_dir);
            frontend_url = "http://127.0.0.1:" + std::to_string(frontend_server->port);
            std::cout << "Serving desktop frontend from " << frontend_url << "\n";
        }
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        if (frontend_server) {
            stop_frontend_server(*frontend_server);
        }
        if (owns_backend) {
            stop_backend(backend_process);
        }
        close_desktop_storage(desktop_storage);
        return 1;
    }

    runtime_context->frontend_url = frontend_url;
    std::cout << "Opening webview: " << frontend_url << "\n";

    try {
        webview::webview w(false, nullptr);
        w.set_title("en-learner");
        w.set_size(1200, 800, WEBVIEW_HINT_NONE);
        w.set_size(900, 600, WEBVIEW_HINT_MIN);
        bind_native_bridge(w, runtime_context);

        w.init(R"(
            window.__enLearner = Object.assign({}, window.__enLearner || {}, {
                version: ')" + std::string(APP_VERSION) + R"(',
                platform: ')" + platform_name() + R"(',
                nativeBridge: {
                    available: true
                }
            });
            window.__EN_LEARNER_RUNTIME_CONFIG = Object.assign(
                {},
                window.__EN_LEARNER_RUNTIME_CONFIG || {},
                {
                    apiBaseUrl: ')" + js_escape(backend_url) + R"(',
                    publicAppUrl: ')" + js_escape(env_value("EN_LEARNER_PUBLIC_APP_URL").value_or("")) + R"('
                }
            );
        )");

        w.navigate(frontend_url);
        w.run();
        runtime_context->shutting_down.store(true);
        join_native_workers(runtime_context);
    } catch (const std::exception& e) {
        runtime_context->shutting_down.store(true);
        join_native_workers(runtime_context);
        if (frontend_server) {
            stop_frontend_server(*frontend_server);
        }
        std::cerr << "Webview error: " << e.what() << "\n";
        if (owns_backend) {
            stop_backend(backend_process);
        }
        close_desktop_storage(desktop_storage);
        return 1;
    }

    std::cout << "Window closed. Shutting down backend...\n";
    if (frontend_server) {
        stop_frontend_server(*frontend_server);
    }
    if (owns_backend) {
        stop_backend(backend_process);
    }
    close_desktop_storage(desktop_storage);
    std::cout << "Done.\n";
    return 0;
}
