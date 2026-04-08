#pragma once

#include "desktop/types.h"

#include <filesystem>
#include <memory>
#include <optional>

namespace en_learner::desktop {

std::optional<std::filesystem::path> resolve_frontend_dist_dir();
std::unique_ptr<FrontendServer> start_frontend_server(const std::filesystem::path& root_dir);
void stop_frontend_server(FrontendServer& server);

}  // namespace en_learner::desktop
