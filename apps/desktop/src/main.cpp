/**
 * en-learner Desktop Shell
 *
 * Responsibilities:
 *   1. Spawn the Rust backend process
 *   2. Wait until it is accepting connections (health check)
 *   3. Open a webview window with the frontend URL
 *   4. Shut down the backend when the window closes
 *
 * Uses webview.h (https://github.com/webview/webview) — a lightweight
 * header-only webview library that wraps platform native WebKit/WebView2.
 *
 * Build: see CMakeLists.txt
 * Deps:  WebKitGTK (Linux), WebKit.framework (macOS), WebView2 (Windows)
 */

#include "webview/webview.h"

#include <array>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>

#ifdef _WIN32
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

// ---- Configuration -------------------------------------------------------

static constexpr int BACKEND_PORT = 3001;
static constexpr int FRONTEND_DEV_PORT = 5173;

// In production, the frontend is served as static files by the backend.
// In dev, we load it from the Vite dev server.
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

BackendProcess g_backend;

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
    }
}

#else

struct BackendProcess {
    pid_t pid = -1;
};

BackendProcess g_backend;

BackendProcess start_backend(const std::string& exe_path) {
    pid_t pid = fork();
    if (pid < 0) {
        throw std::runtime_error("fork() failed");
    }
    if (pid == 0) {
        // Child process
        execl(exe_path.c_str(), exe_path.c_str(), nullptr);
        // execl only returns on failure
        std::cerr << "Failed to exec backend: " << exe_path << "\n";
        _exit(1);
    }
    BackendProcess bp;
    bp.pid = pid;
    return bp;
}

void stop_backend(BackendProcess& bp) {
    if (bp.pid > 0) {
        kill(bp.pid, SIGTERM);
        int status;
        // Wait up to 3 seconds for graceful shutdown
        for (int i = 0; i < 30; ++i) {
            if (waitpid(bp.pid, &status, WNOHANG) != 0) break;
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        kill(bp.pid, SIGKILL); // ensure it's gone
        waitpid(bp.pid, &status, 0);
        bp.pid = -1;
    }
}

#endif

// ---- TCP health check ----------------------------------------------------

bool is_port_open(int port) {
#ifdef _WIN32
    WSADATA wsa{};
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif

    int sock = (int)socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return false;

    struct sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons((uint16_t)port);
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");

#ifdef _WIN32
    DWORD timeout = 500;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&timeout, sizeof(timeout));
#else
    struct timeval timeout;
    timeout.tv_sec = 0;
    timeout.tv_usec = 500000;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
#endif

    int result = connect(sock, (struct sockaddr*)&addr, sizeof(addr));

#ifdef _WIN32
    closesocket(sock);
    WSACleanup();
#else
    close(sock);
#endif

    return result == 0;
}

/// Poll until the backend accepts connections or we time out.
bool wait_for_backend(int port, int timeout_ms = 10000) {
    auto start = std::chrono::steady_clock::now();
    while (true) {
        if (is_port_open(port)) return true;

        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start).count();
        if (elapsed >= timeout_ms) return false;

        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }
}

// ---- Path resolution -----------------------------------------------------

/// Find the backend executable relative to this binary.
std::string find_backend_exe() {
    namespace fs = std::filesystem;

    // 1. Check sibling "en-learner-backend" (production layout)
    fs::path self;
#ifdef _WIN32
    char buf[MAX_PATH];
    GetModuleFileNameA(nullptr, buf, MAX_PATH);
    self = buf;
#elif defined(__APPLE__)
    // Use _NSGetExecutablePath if available, fall back to /proc
    char buf[4096] = {};
    uint32_t size = sizeof(buf);
    if (_NSGetExecutablePath(buf, &size) == 0) self = buf;
    else self = "/usr/local/bin/en-learner";
#else
    char buf[4096] = {};
    ssize_t n = readlink("/proc/self/exe", buf, sizeof(buf) - 1);
    if (n > 0) self = std::string(buf, n);
#endif

    std::string ext;
#ifdef _WIN32
    ext = ".exe";
#endif

    // Look next to current binary
    auto candidate = self.parent_path() / ("en-learner-backend" + ext);
    if (fs::exists(candidate)) return candidate.string();

    // Monorepo dev layout: ../../backend/target/debug/en-learner-backend
    auto dev = self.parent_path() / ".." / ".." / "backend" / "target" / "debug" /
               ("en-learner-backend" + ext);
    dev = fs::weakly_canonical(dev);
    if (fs::exists(dev)) return dev.string();

    // Cargo release
    auto rel = self.parent_path() / ".." / ".." / "backend" / "target" / "release" /
               ("en-learner-backend" + ext);
    rel = fs::weakly_canonical(rel);
    if (fs::exists(rel)) return rel.string();

    throw std::runtime_error("Backend executable not found. Build it first with: cargo build");
}

// ---- Main ----------------------------------------------------------------

int main() {
    std::cout << "en-learner starting...\n";

    // 1. Start backend
    std::string backend_exe;
    try {
        backend_exe = find_backend_exe();
        std::cout << "Starting backend: " << backend_exe << "\n";
        g_backend = start_backend(backend_exe);
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }

    // 2. Wait for backend to be ready
    std::cout << "Waiting for backend on port " << BACKEND_PORT << "...\n";
    if (!wait_for_backend(BACKEND_PORT, 15000)) {
        std::cerr << "Backend did not start in time. Check logs.\n";
        stop_backend(g_backend);
        return 1;
    }
    std::cout << "Backend ready.\n";

    // 3. Determine frontend URL
    std::string url;
    if (IS_PRODUCTION) {
        // Production: frontend is bundled and served by the backend
        url = "http://127.0.0.1:" + std::to_string(BACKEND_PORT);
    } else {
        // Dev: Vite dev server
        url = "http://127.0.0.1:" + std::to_string(FRONTEND_DEV_PORT);
    }

    std::cout << "Opening webview: " << url << "\n";

    // 4. Create and run webview
    try {
        webview::webview w(false, nullptr);
        w.set_title("en-learner");
        w.set_size(1200, 800, WEBVIEW_HINT_NONE);
        w.set_size(900, 600, WEBVIEW_HINT_MIN);

        // Inject a JS bridge for native window controls
        w.init(R"(
            window.__enLearner = {
                version: '1.0.0',
                platform: ')" +
#ifdef _WIN32
                   std::string("windows")
#elif defined(__APPLE__)
                   std::string("macos")
#else
                   std::string("linux")
#endif
                   + R"(',
            };
        )");

        w.navigate(url);
        w.run();
    } catch (const std::exception& e) {
        std::cerr << "Webview error: " << e.what() << "\n";
        stop_backend(g_backend);
        return 1;
    }

    // 5. Window closed — stop backend
    std::cout << "Window closed. Shutting down backend...\n";
    stop_backend(g_backend);
    std::cout << "Done.\n";
    return 0;
}
