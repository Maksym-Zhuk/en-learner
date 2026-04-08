#pragma once

#include "desktop/types.h"

#include <filesystem>
#include <optional>
#include <string>

#ifdef _WIN32
#include <windows.h>
using pid_t = DWORD;
#endif

namespace en_learner::desktop {

#ifdef _WIN32
struct BackendProcess {
    HANDLE handle = INVALID_HANDLE_VALUE;
    DWORD pid = 0;
};
#else
struct BackendProcess {
    pid_t pid = -1;
};
#endif

BackendProcess start_backend(const std::string& exe_path);
void stop_backend(BackendProcess& process);
void close_socket_handle(socket_handle_t socket_handle);
std::filesystem::path executable_path();
std::string platform_name();
void open_external_url(const std::string& url);
std::optional<std::string> detect_audio_playback_issue();

}  // namespace en_learner::desktop
