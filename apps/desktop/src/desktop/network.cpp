#include "desktop/network.h"

#include "desktop/env.h"

#include <chrono>
#include <cstring>
#include <stdexcept>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#endif

namespace en_learner::desktop {

std::optional<LocalEndpoint> parse_local_backend_endpoint(const std::string& url) {
    if (!starts_with(url, "http://")) {
        return std::nullopt;
    }

    std::string rest = url.substr(std::strlen("http://"));
    std::size_t slash_pos = rest.find('/');
    std::string host_port = rest.substr(0, slash_pos);

    if (host_port.empty()) {
        return std::nullopt;
    }

    std::string host = host_port;
    int port = 80;

    std::size_t colon_pos = host_port.rfind(':');
    if (colon_pos != std::string::npos) {
        host = host_port.substr(0, colon_pos);
        const std::string port_str = host_port.substr(colon_pos + 1);
        try {
            port = std::stoi(port_str);
        } catch (...) {
            throw std::runtime_error("Invalid backend URL port: " + url);
        }
    }

    if (host == "localhost") {
        host = "127.0.0.1";
    }

    if (host != "127.0.0.1") {
        return std::nullopt;
    }

    return LocalEndpoint{host, port};
}

bool is_port_open(const std::string& host, int port) {
#ifdef _WIN32
    WSADATA wsa{};
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif

    socket_handle_t sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock == INVALID_SOCKET_HANDLE) {
        return false;
    }

    struct sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(static_cast<uint16_t>(port));
    address.sin_addr.s_addr = inet_addr(host.c_str());

#ifdef _WIN32
    DWORD timeout = 500;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
#else
    struct timeval timeout{};
    timeout.tv_sec = 0;
    timeout.tv_usec = 500000;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
#endif

    int result = connect(sock, reinterpret_cast<struct sockaddr*>(&address), sizeof(address));

#ifdef _WIN32
    closesocket(sock);
    WSACleanup();
#else
    close(sock);
#endif

    return result == 0;
}

bool wait_for_backend(const LocalEndpoint& endpoint, int timeout_ms) {
    auto start = std::chrono::steady_clock::now();
    while (true) {
        if (is_port_open(endpoint.host, endpoint.port)) {
            return true;
        }

        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start
        ).count();
        if (elapsed >= timeout_ms) {
            return false;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }
}

}  // namespace en_learner::desktop
