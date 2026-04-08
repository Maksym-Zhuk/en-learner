#pragma once

#include "desktop/types.h"

#include <memory>

namespace en_learner::desktop {

void bind_native_bridge(webview::webview& view, const std::shared_ptr<DesktopRuntimeContext>& context);
void join_native_workers(const std::shared_ptr<DesktopRuntimeContext>& context);

}  // namespace en_learner::desktop
