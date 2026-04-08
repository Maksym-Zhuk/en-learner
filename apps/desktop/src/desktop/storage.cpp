#include "desktop/storage.h"

#include "desktop/env.h"

#include <filesystem>
#include <stdexcept>

namespace en_learner::desktop {

namespace {

void ensure_sqlite_ok(int rc, sqlite3* db, const std::string& context) {
    if (rc == SQLITE_OK || rc == SQLITE_DONE || rc == SQLITE_ROW) {
        return;
    }

    const char* message = db == nullptr ? nullptr : sqlite3_errmsg(db);
    throw std::runtime_error(context + ": " + (message == nullptr ? "sqlite error" : message));
}

}  // namespace

std::filesystem::path resolve_desktop_data_dir() {
    namespace fs = std::filesystem;

    if (auto explicit_dir = env_value("EN_LEARNER_DATA_DIR")) {
        return fs::path(*explicit_dir);
    }

#ifdef _WIN32
    if (auto local_app_data = env_value("LOCALAPPDATA")) {
        return fs::path(*local_app_data) / "en-learner";
    }
    if (auto app_data = env_value("APPDATA")) {
        return fs::path(*app_data) / "en-learner";
    }
#elif defined(__APPLE__)
    if (auto home = env_value("HOME")) {
        return fs::path(*home) / "Library" / "Application Support" / "en-learner";
    }
#else
    if (auto xdg_data_home = env_value("XDG_DATA_HOME")) {
        return fs::path(*xdg_data_home) / "en-learner";
    }
    if (auto home = env_value("HOME")) {
        return fs::path(*home) / ".local" / "share" / "en-learner";
    }
#endif

    return fs::temp_directory_path() / "en-learner";
}

std::filesystem::path resolve_desktop_db_path() {
    if (auto db_path = env_value("EN_LEARNER_NATIVE_DB_PATH")) {
        return std::filesystem::path(*db_path);
    }

    return resolve_desktop_data_dir() / "desktop.db";
}

std::shared_ptr<DesktopStorage> open_desktop_storage() {
    auto storage = std::make_shared<DesktopStorage>();
    storage->db_path = resolve_desktop_db_path();

    if (!storage->db_path.parent_path().empty()) {
        std::filesystem::create_directories(storage->db_path.parent_path());
    }

    sqlite3* db = nullptr;
    const int open_rc = sqlite3_open_v2(
        storage->db_path.string().c_str(),
        &db,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
        nullptr
    );
    if (open_rc != SQLITE_OK) {
        std::string message = db == nullptr ? "sqlite open failed" : sqlite3_errmsg(db);
        if (db != nullptr) {
            sqlite3_close_v2(db);
        }
        throw std::runtime_error("Failed to open desktop SQLite storage: " + message);
    }

    storage->db = db;

    const char* bootstrap_sql =
        "PRAGMA journal_mode=WAL;"
        "PRAGMA synchronous=NORMAL;"
        "PRAGMA busy_timeout=5000;"
        "CREATE TABLE IF NOT EXISTS desktop_settings ("
        "  key TEXT PRIMARY KEY,"
        "  value TEXT NOT NULL,"
        "  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))"
        ");";

    char* error_message = nullptr;
    const int exec_rc = sqlite3_exec(storage->db, bootstrap_sql, nullptr, nullptr, &error_message);
    if (exec_rc != SQLITE_OK) {
        const std::string message = error_message == nullptr ? "sqlite bootstrap failed" : error_message;
        sqlite3_free(error_message);
        sqlite3_close_v2(storage->db);
        storage->db = nullptr;
        throw std::runtime_error("Failed to initialize desktop SQLite storage: " + message);
    }

    return storage;
}

std::optional<std::string> load_desktop_setting(
    const std::shared_ptr<DesktopStorage>& storage,
    const std::string& key
) {
    std::lock_guard<std::mutex> lock(storage->mutex);

    sqlite3_stmt* statement = nullptr;
    ensure_sqlite_ok(
        sqlite3_prepare_v2(
            storage->db,
            "SELECT value FROM desktop_settings WHERE key = ?1",
            -1,
            &statement,
            nullptr
        ),
        storage->db,
        "Failed to prepare desktop setting query"
    );

    std::optional<std::string> value;
    sqlite3_bind_text(statement, 1, key.c_str(), -1, SQLITE_TRANSIENT);

    const int step_rc = sqlite3_step(statement);
    if (step_rc == SQLITE_ROW) {
        const unsigned char* raw_value = sqlite3_column_text(statement, 0);
        if (raw_value != nullptr) {
            value = std::string(reinterpret_cast<const char*>(raw_value));
        }
    } else if (step_rc != SQLITE_DONE) {
        sqlite3_finalize(statement);
        ensure_sqlite_ok(step_rc, storage->db, "Failed to read desktop setting");
    }

    sqlite3_finalize(statement);
    return value;
}

void save_desktop_setting(
    const std::shared_ptr<DesktopStorage>& storage,
    const std::string& key,
    const std::optional<std::string>& value
) {
    std::lock_guard<std::mutex> lock(storage->mutex);

    sqlite3_stmt* statement = nullptr;

    if (value.has_value()) {
        ensure_sqlite_ok(
            sqlite3_prepare_v2(
                storage->db,
                "INSERT INTO desktop_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ','now')) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                -1,
                &statement,
                nullptr
            ),
            storage->db,
            "Failed to prepare desktop setting upsert"
        );
        sqlite3_bind_text(statement, 1, key.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(statement, 2, value->c_str(), -1, SQLITE_TRANSIENT);
    } else {
        ensure_sqlite_ok(
            sqlite3_prepare_v2(
                storage->db,
                "DELETE FROM desktop_settings WHERE key = ?1",
                -1,
                &statement,
                nullptr
            ),
            storage->db,
            "Failed to prepare desktop setting delete"
        );
        sqlite3_bind_text(statement, 1, key.c_str(), -1, SQLITE_TRANSIENT);
    }

    const int step_rc = sqlite3_step(statement);
    sqlite3_finalize(statement);
    ensure_sqlite_ok(step_rc, storage->db, "Failed to persist desktop setting");
}

void close_desktop_storage(const std::shared_ptr<DesktopStorage>& storage) {
    if (!storage) {
        return;
    }

    std::lock_guard<std::mutex> lock(storage->mutex);
    if (storage->db != nullptr) {
        sqlite3_close_v2(storage->db);
        storage->db = nullptr;
    }
}

}  // namespace en_learner::desktop
