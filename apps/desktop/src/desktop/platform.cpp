#include "desktop/platform.h"

#include "desktop/env.h"

#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <thread>

#ifdef _WIN32
#include <shellapi.h>
#else
#include <csignal>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

namespace en_learner::desktop {

BackendProcess start_backend(const std::string& exe_path) {
#ifdef _WIN32
    STARTUPINFOA startup_info{};
    startup_info.cb = sizeof(startup_info);
    PROCESS_INFORMATION process_info{};

    std::string command = "\"" + exe_path + "\"";
    if (!CreateProcessA(
            nullptr,
            &command[0],
            nullptr,
            nullptr,
            FALSE,
            CREATE_NO_WINDOW,
            nullptr,
            nullptr,
            &startup_info,
            &process_info
        )) {
        throw std::runtime_error("Failed to start backend process");
    }

    CloseHandle(process_info.hThread);

    BackendProcess process;
    process.handle = process_info.hProcess;
    process.pid = process_info.dwProcessId;
    return process;
#else
    pid_t pid = fork();
    if (pid < 0) {
        throw std::runtime_error("fork() failed");
    }
    if (pid == 0) {
        execl(exe_path.c_str(), exe_path.c_str(), nullptr);
        std::cerr << "Failed to exec backend: " << exe_path << "\n";
        _exit(1);
    }

    BackendProcess process;
    process.pid = pid;
    return process;
#endif
}

void stop_backend(BackendProcess& process) {
#ifdef _WIN32
    if (process.handle != INVALID_HANDLE_VALUE) {
        TerminateProcess(process.handle, 0);
        WaitForSingleObject(process.handle, 3000);
        CloseHandle(process.handle);
        process.handle = INVALID_HANDLE_VALUE;
        process.pid = 0;
    }
#else
    if (process.pid <= 0) {
        return;
    }

    kill(process.pid, SIGTERM);

    int status = 0;
    bool exited = false;
    for (int i = 0; i < 30; ++i) {
        pid_t result = waitpid(process.pid, &status, WNOHANG);
        if (result == process.pid || result == -1) {
            exited = true;
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    if (!exited) {
        kill(process.pid, SIGKILL);
        waitpid(process.pid, &status, 0);
    }

    process.pid = -1;
#endif
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
    char buffer[MAX_PATH];
    GetModuleFileNameA(nullptr, buffer, MAX_PATH);
    return fs::path(buffer);
#elif defined(__APPLE__)
    char buffer[4096] = {};
    uint32_t size = sizeof(buffer);
    if (_NSGetExecutablePath(buffer, &size) == 0) {
        return fs::path(buffer);
    }
    throw std::runtime_error("Unable to resolve executable path");
#else
    char buffer[4096] = {};
    ssize_t bytes = readlink("/proc/self/exe", buffer, sizeof(buffer) - 1);
    if (bytes > 0) {
        return fs::path(std::string(buffer, static_cast<std::size_t>(bytes)));
    }
    throw std::runtime_error("Unable to resolve executable path");
#endif
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

std::optional<std::string> detect_audio_playback_issue() {
#if defined(__linux__) && !defined(__APPLE__)
    const int inspector_available = std::system("command -v gst-inspect-1.0 >/dev/null 2>&1");
    if (inspector_available != 0) {
        return std::string(
            "GStreamer runtime is missing. Install gstreamer tools and auto audio output plugins."
        );
    }

    const int sink_available = std::system("gst-inspect-1.0 autoaudiosink >/dev/null 2>&1");
    if (sink_available != 0) {
        return std::string(
            "GStreamer element autoaudiosink is missing. Install the auto audio output plugin package for your distro."
        );
    }
#endif

    return std::nullopt;
}

}  // namespace en_learner::desktop
