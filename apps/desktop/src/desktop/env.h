#pragma once

#include <optional>
#include <string>

namespace en_learner::desktop {

std::optional<std::string> env_value(const char* name);
std::string to_lower(std::string value);
bool starts_with(const std::string& value, const std::string& prefix);
std::optional<bool> env_bool(const char* name);
int env_int(const char* name);
std::optional<int> env_optional_int(const char* name);
std::string js_escape(const std::string& value);

}  // namespace en_learner::desktop
