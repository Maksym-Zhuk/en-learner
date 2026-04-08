use chrono::Utc;

pub fn utc_now_string() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

pub fn utc_today_string() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}
