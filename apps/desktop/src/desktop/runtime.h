#pragma once

#include "desktop/types.h"

#include <memory>
#include <optional>
#include <string>

namespace en_learner::desktop {

bool is_valid_connectivity_mode(const std::string& value);
bool is_valid_auth_mode(const std::string& value);
bool is_valid_backend_url(const std::string& url);
std::string json_error_message(const std::string& message);
std::string build_runtime_info_json(const DesktopRuntimeContext& context);
void hydrate_runtime_context(
    const std::shared_ptr<DesktopRuntimeContext>& context,
    const std::shared_ptr<DesktopStorage>& storage
);
std::string build_webview_init_script(const std::string& backend_url);
std::string resolve_backend_url(const std::optional<std::string>& persisted_backend_url);
bool should_spawn_backend(const std::string& backend_url);
std::string find_backend_exe();

}  // namespace en_learner::desktop
