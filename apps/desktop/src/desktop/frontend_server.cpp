#include "desktop/frontend_server.h"

#include "desktop/env.h"
#include "desktop/platform.h"

#include <array>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <sstream>

#ifdef _WIN32
#include <windows.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace en_learner::desktop {

namespace {

bool path_has_prefix(
    const std::filesystem::path& full_path,
    const std::filesystem::path& prefix
) {
    auto full_it = full_path.begin();
    auto prefix_it = prefix.begin();

    for (; prefix_it != prefix.end(); ++prefix_it, ++full_it) {
        if (full_it == full_path.end() || *full_it != *prefix_it) {
            return false;
        }
    }

    return true;
}

std::string content_type_for_path(const std::filesystem::path& path) {
    const std::string ext = to_lower(path.extension().string());

    if (ext == ".html") return "text/html; charset=utf-8";
    if (ext == ".js" || ext == ".mjs") return "application/javascript; charset=utf-8";
    if (ext == ".css") return "text/css; charset=utf-8";
    if (ext == ".json") return "application/json; charset=utf-8";
    if (ext == ".svg") return "image/svg+xml";
    if (ext == ".png") return "image/png";
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".woff") return "font/woff";
    if (ext == ".woff2") return "font/woff2";

    return "application/octet-stream";
}

std::string build_http_response(
    int status_code,
    const std::string& status_text,
    const std::string& content_type,
    const std::string& body,
    bool head_only = false
) {
    std::ostringstream response;
    response << "HTTP/1.1 " << status_code << ' ' << status_text << "\r\n"
             << "Content-Type: " << content_type << "\r\n"
             << "Content-Length: " << body.size() << "\r\n"
             << "Connection: close\r\n\r\n";

    if (!head_only) {
        response << body;
    }

    return response.str();
}

void send_all(socket_handle_t client_socket, const std::string& payload) {
    const char* data = payload.data();
    std::size_t total_sent = 0;

    while (total_sent < payload.size()) {
#ifdef _WIN32
        const int sent = send(
            client_socket,
            data + total_sent,
            static_cast<int>(payload.size() - total_sent),
            0
        );
#else
        const ssize_t sent = send(
            client_socket,
            data + total_sent,
            payload.size() - total_sent,
            0
        );
#endif

        if (sent <= 0) {
            return;
        }

        total_sent += static_cast<std::size_t>(sent);
    }
}

void handle_frontend_request(socket_handle_t client_socket, const std::filesystem::path& root_dir) {
    std::array<char, 8192> buffer{};
#ifdef _WIN32
    const int received = recv(client_socket, buffer.data(), static_cast<int>(buffer.size() - 1), 0);
#else
    const ssize_t received = recv(client_socket, buffer.data(), buffer.size() - 1, 0);
#endif

    if (received <= 0) {
        return;
    }

    const std::string request(buffer.data(), static_cast<std::size_t>(received));
    const std::size_t line_end = request.find("\r\n");
    const std::string request_line = request.substr(0, line_end);
    std::istringstream line_stream(request_line);
    std::string method;
    std::string raw_path;
    std::string http_version;
    line_stream >> method >> raw_path >> http_version;

    if (method != "GET" && method != "HEAD") {
        send_all(
            client_socket,
            build_http_response(405, "Method Not Allowed", "text/plain; charset=utf-8", "Method Not Allowed")
        );
        return;
    }

    std::size_t query_pos = raw_path.find('?');
    if (query_pos != std::string::npos) {
        raw_path = raw_path.substr(0, query_pos);
    }

    std::filesystem::path relative_path;
    if (raw_path.empty() || raw_path == "/") {
        relative_path = "index.html";
    } else {
        std::string normalized = raw_path;
        while (!normalized.empty() && normalized.front() == '/') {
            normalized.erase(normalized.begin());
        }
        relative_path = normalized;
    }

    const auto canonical_root = std::filesystem::weakly_canonical(root_dir);
    auto requested_path = std::filesystem::weakly_canonical(root_dir / relative_path);

    if (!std::filesystem::exists(requested_path) || !path_has_prefix(requested_path, canonical_root)) {
        if (relative_path.extension().empty()) {
            requested_path = canonical_root / "index.html";
        } else {
            send_all(
                client_socket,
                build_http_response(404, "Not Found", "text/plain; charset=utf-8", "Not Found")
            );
            return;
        }
    }

    if (!std::filesystem::exists(requested_path) || !std::filesystem::is_regular_file(requested_path)) {
        send_all(
            client_socket,
            build_http_response(404, "Not Found", "text/plain; charset=utf-8", "Not Found")
        );
        return;
    }

    std::ifstream file(requested_path, std::ios::binary);
    if (!file) {
        send_all(
            client_socket,
            build_http_response(
                500,
                "Internal Server Error",
                "text/plain; charset=utf-8",
                "Failed to open file"
            )
        );
        return;
    }

    std::string body(
        (std::istreambuf_iterator<char>(file)),
        std::istreambuf_iterator<char>()
    );

    send_all(
        client_socket,
        build_http_response(
            200,
            "OK",
            content_type_for_path(requested_path),
            body,
            method == "HEAD"
        )
    );
}

}  // namespace

std::optional<std::filesystem::path> resolve_frontend_dist_dir() {
    namespace fs = std::filesystem;

    std::vector<fs::path> candidates;

    if (auto frontend_dist_dir = env_value("EN_LEARNER_FRONTEND_DIST_DIR")) {
        candidates.push_back(fs::path(*frontend_dist_dir));
    }

#ifdef FRONTEND_DIST_PATH
    candidates.push_back(fs::path(FRONTEND_DIST_PATH));
#endif

    const fs::path exe_dir = executable_path().parent_path();
    candidates.push_back(exe_dir / "dist");
    candidates.push_back(exe_dir / "../dist");
    candidates.push_back(exe_dir / "../frontend/dist");
    candidates.push_back(exe_dir / "../../frontend/dist");

    for (const auto& candidate : candidates) {
        if (fs::exists(candidate / "index.html")) {
            return fs::weakly_canonical(candidate);
        }
    }

    return std::nullopt;
}

std::unique_ptr<FrontendServer> start_frontend_server(const std::filesystem::path& root_dir) {
    auto server = std::make_unique<FrontendServer>();
    server->root_dir = root_dir;

#ifdef _WIN32
    WSADATA wsa{};
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        throw std::runtime_error("WSAStartup failed for frontend server");
    }
    server->winsock_started = true;
#endif

    const int preferred_port = env_optional_int("EN_LEARNER_FRONTEND_PORT").value_or(4173);

    for (int port = preferred_port; port < preferred_port + 50; ++port) {
        socket_handle_t listen_socket = socket(AF_INET, SOCK_STREAM, 0);
        if (listen_socket == INVALID_SOCKET_HANDLE) {
            continue;
        }

        int opt = 1;
#ifdef _WIN32
        setsockopt(listen_socket, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));
#else
        setsockopt(listen_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

        struct sockaddr_in address{};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = inet_addr("127.0.0.1");
        address.sin_port = htons(static_cast<std::uint16_t>(port));

        if (bind(listen_socket, reinterpret_cast<struct sockaddr*>(&address), sizeof(address)) != 0) {
            close_socket_handle(listen_socket);
            continue;
        }

        if (listen(listen_socket, 16) != 0) {
            close_socket_handle(listen_socket);
            continue;
        }

        server->listen_socket = listen_socket;
        server->port = static_cast<std::uint16_t>(port);
        break;
    }

    if (server->listen_socket == INVALID_SOCKET_HANDLE) {
#ifdef _WIN32
        if (server->winsock_started) {
            WSACleanup();
        }
#endif
        throw std::runtime_error("Failed to start local frontend server");
    }

    FrontendServer* server_ptr = server.get();
    server->thread = std::thread([server_ptr]() {
        while (!server_ptr->stop_requested.load()) {
            fd_set read_fds;
            FD_ZERO(&read_fds);
            FD_SET(server_ptr->listen_socket, &read_fds);

            struct timeval timeout{};
            timeout.tv_sec = 0;
            timeout.tv_usec = 200000;

#ifdef _WIN32
            const int ready = select(0, &read_fds, nullptr, nullptr, &timeout);
#else
            const int ready = select(server_ptr->listen_socket + 1, &read_fds, nullptr, nullptr, &timeout);
#endif
            if (ready <= 0 || !FD_ISSET(server_ptr->listen_socket, &read_fds)) {
                continue;
            }

            socket_handle_t client_socket = accept(server_ptr->listen_socket, nullptr, nullptr);
            if (client_socket == INVALID_SOCKET_HANDLE) {
                continue;
            }

            handle_frontend_request(client_socket, server_ptr->root_dir);
            close_socket_handle(client_socket);
        }
    });

    return server;
}

void stop_frontend_server(FrontendServer& server) {
    server.stop_requested.store(true);

    if (server.listen_socket != INVALID_SOCKET_HANDLE) {
        close_socket_handle(server.listen_socket);
        server.listen_socket = INVALID_SOCKET_HANDLE;
    }

    if (server.thread.joinable()) {
        server.thread.join();
    }

#ifdef _WIN32
    if (server.winsock_started) {
        WSACleanup();
        server.winsock_started = false;
    }
#endif
}

}  // namespace en_learner::desktop
