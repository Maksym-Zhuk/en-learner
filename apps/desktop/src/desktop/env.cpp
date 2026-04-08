#include "desktop/env.h"

#include <cctype>
#include <cstdlib>
#include <sstream>
#include <stdexcept>

namespace en_learner::desktop {

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

}  // namespace en_learner::desktop
