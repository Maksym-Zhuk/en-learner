#include "desktop/application.h"

#include <iostream>

using namespace en_learner::desktop;

int main() {
    const int exit_code = run_desktop_application();
    if (exit_code == 0) {
        std::cout << "Done.\n";
    }
    return exit_code;
}
