#pragma once

#include "desktop/types.h"

#include <filesystem>
#include <memory>
#include <optional>
#include <string>

namespace en_learner::desktop {

std::filesystem::path resolve_desktop_data_dir();
std::filesystem::path resolve_desktop_db_path();
std::shared_ptr<DesktopStorage> open_desktop_storage();
std::optional<std::string> load_desktop_setting(
    const std::shared_ptr<DesktopStorage>& storage,
    const std::string& key
);
void save_desktop_setting(
    const std::shared_ptr<DesktopStorage>& storage,
    const std::string& key,
    const std::optional<std::string>& value
);
void close_desktop_storage(const std::shared_ptr<DesktopStorage>& storage);

}  // namespace en_learner::desktop
