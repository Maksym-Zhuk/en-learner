#pragma once

#include "desktop/types.h"

#include <optional>
#include <string>

namespace en_learner::desktop {

std::optional<LocalEndpoint> parse_local_backend_endpoint(const std::string& url);
bool is_port_open(const std::string& host, int port);
bool wait_for_backend(const LocalEndpoint& endpoint, int timeout_ms = 10000);

}  // namespace en_learner::desktop
