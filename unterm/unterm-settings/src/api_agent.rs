//! Built-in API Agent configuration (OpenAI-compatible & Anthropic-compatible).
//!
//! Stores non-secret settings (`protocol`, `preset`, `base_url`, `model`) in
//! `<state_dir>/api_agent.json` and the API key in `<state_dir>/api_agent.secret`
//! (0600 on Unix). Secret values are NEVER returned by GET endpoints.

use crate::server::Response;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiAgentConfig {
    /// `"openai"` (Chat Completions) or `"anthropic"` (Messages API).
    #[serde(default = "default_protocol")]
    pub protocol: String,
    /// Preset id (`deepseek`, `qwen`, `kimi`, `glm`, `minimax`, `doubao`,
    /// `siliconflow`, `openai`, `anthropic`, `openrouter`, `ollama`, `custom`).
    #[serde(default = "default_preset")]
    pub preset: String,
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[serde(default = "default_model")]
    pub model: String,
}

fn default_protocol() -> String {
    "openai".to_string()
}
fn default_preset() -> String {
    "deepseek".to_string()
}
fn default_base_url() -> String {
    "https://api.deepseek.com/v1".to_string()
}
fn default_model() -> String {
    "deepseek-chat".to_string()
}

impl Default for ApiAgentConfig {
    fn default() -> Self {
        Self {
            protocol: default_protocol(),
            preset: default_preset(),
            base_url: default_base_url(),
            model: default_model(),
        }
    }
}

fn config_path() -> PathBuf {
    unterm_protocol::state_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("api_agent.json")
}

fn secret_path() -> PathBuf {
    unterm_protocol::state_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("api_agent.secret")
}

pub fn load_config() -> ApiAgentConfig {
    let path = config_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ApiAgentConfig>(&raw).ok())
        .unwrap_or_default()
}

pub fn load_api_key() -> Option<String> {
    if let Ok(env_key) = std::env::var("UNTERM_API_AGENT_KEY") {
        let trimmed = env_key.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    std::fs::read_to_string(secret_path())
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Local providers like Ollama do not require an API key.
fn key_optional(cfg: &ApiAgentConfig) -> bool {
    cfg.preset == "ollama"
        || cfg.base_url.starts_with("http://127.0.0.1")
        || cfg.base_url.starts_with("http://localhost")
}

pub fn is_configured() -> bool {
    let cfg = load_config();
    !cfg.base_url.trim().is_empty()
        && !cfg.model.trim().is_empty()
        && (key_optional(&cfg) || load_api_key().is_some())
}

fn save_config(cfg: &ApiAgentConfig) -> std::io::Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let body = serde_json::to_string_pretty(cfg).unwrap_or_else(|_| "{}".to_string());
    std::fs::write(path, body)
}

fn save_api_key(key: &str) -> std::io::Result<()> {
    let path = secret_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let trimmed = key.trim();
    if trimmed.is_empty() {
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    std::fs::write(&path, trimmed)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn public_json(cfg: &ApiAgentConfig) -> Value {
    let key_set = load_api_key().is_some();
    json!({
        "protocol": cfg.protocol,
        "preset": cfg.preset,
        "base_url": cfg.base_url,
        "model": cfg.model,
        "api_key_set": key_set,
        "configured": !cfg.base_url.trim().is_empty()
            && !cfg.model.trim().is_empty()
            && (key_optional(cfg) || key_set),
    })
}

/// GET /api/console/api-agent
pub(crate) fn api_get() -> Response {
    Response::ok_json(public_json(&load_config()))
}

/// POST /api/console/api-agent
pub(crate) fn api_set(body: &[u8]) -> Response {
    let raw: Value = serde_json::from_slice(body).unwrap_or(Value::Null);
    let mut cfg = load_config();
    if let Some(v) = raw.get("protocol").and_then(Value::as_str) {
        if matches!(v, "openai" | "anthropic") {
            cfg.protocol = v.to_string();
        }
    }
    if let Some(v) = raw.get("preset").and_then(Value::as_str) {
        cfg.preset = v.trim().to_string();
    }
    if let Some(v) = raw.get("base_url").and_then(Value::as_str) {
        cfg.base_url = v.trim().trim_end_matches('/').to_string();
    }
    if let Some(v) = raw.get("model").and_then(Value::as_str) {
        cfg.model = v.trim().to_string();
    }
    if let Err(e) = save_config(&cfg) {
        return Response::err(500, "Internal Server Error", &format!("failed to save api_agent.json: {e}"));
    }
    if raw.get("clear_key").and_then(Value::as_bool) == Some(true) {
        if let Err(e) = save_api_key("") {
            return Response::err(500, "Internal Server Error", &format!("failed to clear API key: {e}"));
        }
    } else if let Some(key) = raw.get("api_key").and_then(Value::as_str) {
        if !key.trim().is_empty() {
            if let Err(e) = save_api_key(key) {
                return Response::err(500, "Internal Server Error", &format!("failed to save API key: {e}"));
            }
        }
    }
    Response::ok_json(public_json(&cfg))
}

/// POST /api/console/api-agent/test — verify connectivity & credentials.
pub(crate) fn api_test(body: &[u8]) -> Response {
    let raw: Value = serde_json::from_slice(body).unwrap_or(Value::Null);
    let mut cfg = load_config();
    if let Some(v) = raw.get("protocol").and_then(Value::as_str) {
        if matches!(v, "openai" | "anthropic") {
            cfg.protocol = v.to_string();
        }
    }
    if let Some(v) = raw.get("base_url").and_then(Value::as_str).filter(|s| !s.trim().is_empty()) {
        cfg.base_url = v.trim().trim_end_matches('/').to_string();
    }
    if let Some(v) = raw.get("model").and_then(Value::as_str).filter(|s| !s.trim().is_empty()) {
        cfg.model = v.trim().to_string();
    }
    let key = raw
        .get("api_key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(load_api_key);

    if cfg.base_url.trim().is_empty() || cfg.model.trim().is_empty() {
        return Response::err(400, "Bad Request", "base_url and model are required");
    }
    if !key_optional(&cfg) && key.is_none() {
        return Response::err(400, "Bad Request", "API key is required");
    }

    let started = Instant::now();
    match probe_endpoint(&cfg, key.as_deref()) {
        Ok(reply) => Response::ok_json(json!({
            "ok": true,
            "latency_ms": started.elapsed().as_millis() as u64,
            "reply": reply,
        })),
        Err(err) => Response::err(400, "Bad Request", &err),
    }
}

fn probe_endpoint(cfg: &ApiAgentConfig, api_key: Option<&str>) -> Result<String, String> {
    use http_req::request::{Method, Request};
    use http_req::uri::Uri;
    use std::convert::TryFrom;

    let base = cfg.base_url.trim_end_matches('/');
    let (url, payload) = if cfg.protocol == "anthropic" {
        let u = if base.ends_with("/messages") {
            base.to_string()
        } else if base.ends_with("/v1") {
            format!("{base}/messages")
        } else {
            format!("{base}/v1/messages")
        };
        let body = json!({
            "model": cfg.model,
            "max_tokens": 16,
            "messages": [{"role": "user", "content": "Reply with OK"}]
        });
        (u, body)
    } else {
        let u = if base.ends_with("/chat/completions") {
            base.to_string()
        } else {
            format!("{base}/chat/completions")
        };
        let body = json!({
            "model": cfg.model,
            "max_tokens": 16,
            "messages": [{"role": "user", "content": "Reply with OK"}]
        });
        (u, body)
    };

    let uri = Uri::try_from(url.as_str()).map_err(|e| format!("invalid URL {url}: {e}"))?;
    let bytes = payload.to_string().into_bytes();
    let mut out = Vec::new();
    let mut req = Request::new(&uri);
    req.method(Method::POST)
        .header("Content-Type", "application/json")
        .header("Content-Length", &bytes.len())
        .connect_timeout(Some(Duration::from_secs(10)))
        .read_timeout(Some(Duration::from_secs(20)))
        .timeout(Duration::from_secs(25))
        .body(&bytes);
    if cfg.protocol == "anthropic" {
        req.header("anthropic-version", "2023-06-01");
        if let Some(k) = api_key {
            req.header("x-api-key", k);
        }
    } else if let Some(k) = api_key {
        let auth = format!("Bearer {k}");
        req.header("Authorization", &auth);
    }

    let resp = req.send(&mut out).map_err(|e| format!("request failed: {e}"))?;
    let status = u16::from(resp.status_code());
    let text = String::from_utf8_lossy(&out).to_string();
    if status >= 400 {
        let snippet: String = text.chars().take(240).collect();
        return Err(format!("HTTP {status}: {snippet}"));
    }
    let val: Value = serde_json::from_slice(&out).unwrap_or(Value::Null);
    let reply = if cfg.protocol == "anthropic" {
        val.pointer("/content/0/text").and_then(Value::as_str).unwrap_or("OK").to_string()
    } else {
        val.pointer("/choices/0/message/content").and_then(Value::as_str).unwrap_or("OK").to_string()
    };
    Ok(reply.trim().chars().take(80).collect())
}
