cmake_minimum_required(VERSION 3.20)
project(en-learner VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ---- Platform configuration -------------------------------------------

if(APPLE)
    set(PLATFORM "macos")
elseif(UNIX)
    set(PLATFORM "linux")
elseif(WIN32)
    set(PLATFORM "windows")
endif()

# ---- Source files ---------------------------------------------------------

add_executable(en-learner
    src/main.cpp
)

find_path(SQLITE3_INCLUDE_DIR sqlite3.h)
find_library(SQLITE3_LIBRARY NAMES sqlite3)

if(NOT SQLITE3_INCLUDE_DIR OR NOT SQLITE3_LIBRARY)
    message(FATAL_ERROR "sqlite3 development files not found")
endif()

target_include_directories(en-learner PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${SQLITE3_INCLUDE_DIR}
)

# ---- Platform-specific dependencies ---------------------------------------

if(APPLE)
    # WebKit / WebView on macOS
    find_library(WEBKIT_LIB WebKit)
    find_library(COCOA_LIB Cocoa)
    target_link_libraries(en-learner PRIVATE ${WEBKIT_LIB} ${COCOA_LIB} ${SQLITE3_LIBRARY})
    set_target_properties(en-learner PROPERTIES
        MACOSX_BUNDLE TRUE
        MACOSX_BUNDLE_BUNDLE_NAME "en-learner"
    )

elseif(UNIX AND NOT APPLE)
    # GTK3 + WebKitGTK on Linux
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
    pkg_check_modules(WEBKIT REQUIRED webkit2gtk-4.1)

    target_include_directories(en-learner PRIVATE
        ${GTK3_INCLUDE_DIRS}
        ${WEBKIT_INCLUDE_DIRS}
    )
    target_link_libraries(en-learner PRIVATE
        ${GTK3_LIBRARIES}
        ${WEBKIT_LIBRARIES}
        ${SQLITE3_LIBRARY}
    )
    target_compile_options(en-learner PRIVATE
        ${GTK3_CFLAGS_OTHER}
        ${WEBKIT_CFLAGS_OTHER}
    )

elseif(WIN32)
    target_link_libraries(en-learner PRIVATE
        advapi32 ole32 shell32 shlwapi version
        ${SQLITE3_LIBRARY}
    )
    set_target_properties(en-learner PROPERTIES
        WIN32_EXECUTABLE TRUE
    )
endif()

# ---- Build config ---------------------------------------------------------

# In release builds, embed the frontend dist path
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(FRONTEND_DIST_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../frontend/dist"
        CACHE PATH "Path to built frontend dist")
    target_compile_definitions(en-learner PRIVATE
        PRODUCTION_BUILD=1
        FRONTEND_DIST_PATH="${FRONTEND_DIST_PATH}"
    )
endif()

# Backend port and frontend dev port are defined in src/main.cpp

# ---- Install --------------------------------------------------------------

install(TARGETS en-learner
    RUNTIME DESTINATION bin
    BUNDLE DESTINATION .
)
