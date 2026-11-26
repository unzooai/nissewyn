//! Settings › Organization: this computer joins a company's own Nissewyn
//! Server (the enterprise edition, which the company runs itself).
//!
//! Joining takes the server's address and a join code from an admin. The
//! computer makes an ed25519 key of its own; the private half goes into the
//! system's key store (Credential Manager, Keychain, Secret Service) and never
//! leaves it, the server keeps only the public half. Every later request is
//! signed with it (`METHOD\nPATH?QUERY\nUNIX-SECONDS\nsha256-hex(body)`).
//! The protocol is described in the server's repository; the two share no
//! code, so both test the same signing vector.
//!
//! What it is a member of is kept in `<state dir>/organization.json`, which
//! holds no secret. A computer an admin removes goes back to "not joined" and
//! says so once; nothing else on it changes.

use std::path::PathBuf;
use std::time::Duration;

use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// The desktop-to-server protocol this build speaks.
pub const PROTOCOL_VERSION: u32 = 1;

const KEY_SERVICE: &str = "Nissewyn";
const KEY_ACCOUNT: &str = "organization-device-key";

// ---- what the page sees -------------------------------------------------------

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Organization {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Membership {
    /// `https://nissewyn.acme.example`, no trailing slash.
    pub server: String,
    pub device_id: String,
    pub device_name: String,
    pub organization: Organization,
    /// Unix seconds.
    pub joined_at: i64,
    /// When the server last said this computer is in, unix seconds.
    pub last_contact: Option<i64>,
    /// Why the last check did not get through, when it did not.
    pub problem: Option<OrgError>,
}

/// Said once after an admin took this computer out (or the server forgot it).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Removed {
    pub organization: String,
    pub at: i64,
    pub message: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct OrgStatus {
    pub membership: Option<Membership>,
    pub removed: Option<Removed>,
}

/// A failure the page can put into words in the person's language: a stable
/// `code` and, where there is one, the server's or the system's own `detail`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct OrgError {
    pub code: String,
    pub detail: String,
}

impl OrgError {
    fn new(code: &str, detail: impl Into<String>) -> Self {
        OrgError { code: code.into(), detail: detail.into() }
    }
}

pub type OrgResult<T> = Result<T, OrgError>;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ServerInfo {
    pub server: String,
    pub version: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Left {
    pub status: OrgStatus,
    /// The server could not be told; an admin should remove the computer there.
    pub server_not_told: bool,
}

// ---- where the key lives -------------------------------------------------------

pub trait KeyStore: Send + Sync {
    fn save(&self, secret: &str) -> Result<(), String>;
    fn load(&self) -> Result<Option<String>, String>;
    fn delete(&self) -> Result<(), String>;
}

/// The system's own key store, through the same `keyring` crate the runtime
/// uses for profile secrets.
pub struct SystemKeyStore;

impl SystemKeyStore {
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEY_SERVICE, KEY_ACCOUNT).map_err(|e| e.to_string())
    }
}

impl KeyStore for SystemKeyStore {
    fn save(&self, secret: &str) -> Result<(), String> {
        Self::entry()?.set_password(secret).map_err(|e| e.to_string())
    }
    fn load(&self) -> Result<Option<String>, String> {
        match Self::entry()?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    fn delete(&self) -> Result<(), String> {
        match Self::entry()?.delete_password() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

// ---- pure parts ----------------------------------------------------------------

/// What a person typed as the server's address, as a base URL. `https://` is
/// assumed; plain `http://` is only for a server on this same computer.
pub fn server_url(typed: &str) -> OrgResult<String> {
    let typed = typed.trim();
    if typed.is_empty() {
        return Err(OrgError::new("server_missing", ""));
    }
    let with_scheme = if typed.contains("://") { typed.to_string() } else { format!("https://{typed}") };
    let url = reqwest::Url::parse(&with_scheme).map_err(|e| OrgError::new("server_unreadable", e.to_string()))?;
    let host = url.host_str().unwrap_or_default();
    match url.scheme() {
        "https" => {}
        "http" if matches!(host, "localhost" | "127.0.0.1" | "[::1]" | "::1") => {}
        "http" => return Err(OrgError::new("https_required", "")),
        other => return Err(OrgError::new("server_unreadable", other)),
    }
    if host.is_empty() {
        return Err(OrgError::new("server_unreadable", typed));
    }
    let mut base = url.clone();
    base.set_query(None);
    base.set_fragment(None);
    Ok(base.as_str().trim_end_matches('/').to_string())
}

/// What this computer signs for one request; the server checks the same.
pub fn signing_string(method: &str, path_and_query: &str, unix_secs: i64, body: &[u8]) -> String {
    format!("{method}\n{path_and_query}\n{unix_secs}\n{}", hex::encode(Sha256::digest(body)))
}

fn sign(key: &SigningKey, method: &str, path: &str, at: i64, body: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(key.sign(signing_string(method, path, at, body).as_bytes()).to_bytes())
}

fn now() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

/// The name an admin sees for this computer.
pub fn device_name() -> String {
    for var in ["COMPUTERNAME", "HOSTNAME"] {
        if let Ok(name) = std::env::var(var) {
            if !name.trim().is_empty() {
                return name.trim().to_string();
            }
        }
    }
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "computer".into())
}

/// A server's `{error, message}` answer as an [`OrgError`].
fn refusal(status: u16, body: &serde_json::Value) -> OrgError {
    let code = body["error"].as_str().unwrap_or_default();
    let message = body["message"].as_str().unwrap_or_default().to_string();
    match (status, code) {
        (426, _) => OrgError::new("protocol_mismatch", message),
        (_, "bad_join_code") => OrgError::new("bad_join_code", message),
        (_, "key_in_use") => OrgError::new("key_in_use", message),
        (_, "device_removed") => OrgError::new("device_removed", message),
        (_, "device_refused") => OrgError::new("device_refused", message),
        _ if message.is_empty() => OrgError::new("server_error", format!("HTTP {status}")),
        _ => OrgError::new("server_error", message),
    }
}

// ---- the membership ------------------------------------------------------------

#[derive(Default, Serialize, Deserialize)]
struct Saved {
    membership: Option<Membership>,
    removed: Option<Removed>,
}

pub struct Org {
    file: PathBuf,
    keys: Box<dyn KeyStore>,
    http: reqwest::Client,
}

impl Org {
    pub fn new(state_dir: PathBuf, keys: Box<dyn KeyStore>) -> Self {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(8))
            .timeout(Duration::from_secs(20))
            .user_agent(concat!("Nissewyn/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("an HTTP client");
        Org { file: state_dir.join("organization.json"), keys, http }
    }

    fn read(&self) -> Saved {
        std::fs::read(&self.file).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
    }

    fn write(&self, saved: &Saved) -> OrgResult<()> {
        let fail = |e: std::io::Error| OrgError::new("not_saved", e.to_string());
        if let Some(dir) = self.file.parent() {
            std::fs::create_dir_all(dir).map_err(fail)?;
        }
        let tmp = self.file.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(saved).unwrap_or_default()).map_err(fail)?;
        std::fs::rename(&tmp, &self.file).map_err(fail)
    }

    pub fn status(&self) -> OrgStatus {
        let saved = self.read();
        OrgStatus { membership: saved.membership, removed: saved.removed }
    }

    fn key(&self) -> OrgResult<SigningKey> {
        let secret = self
            .keys
            .load()
            .map_err(|e| OrgError::new("key_store", e))?
            .ok_or_else(|| OrgError::new("key_missing", ""))?;
        let raw = base64::engine::general_purpose::STANDARD
            .decode(secret.trim())
            .ok()
            .and_then(|b| <[u8; 32]>::try_from(b).ok())
            .ok_or_else(|| OrgError::new("key_missing", "unreadable"))?;
        Ok(SigningKey::from_bytes(&raw))
    }

    fn unreachable(e: reqwest::Error) -> OrgError {
        // The chain says why: name not found, refused, certificate not trusted.
        let mut detail = e.to_string();
        let mut source = std::error::Error::source(&e);
        while let Some(s) = source {
            detail = format!("{detail}: {s}");
            source = s.source();
        }
        OrgError::new("unreachable", detail)
    }

    async fn answer(res: reqwest::Response) -> (u16, serde_json::Value) {
        let status = res.status().as_u16();
        let body = res.json::<serde_json::Value>().await.unwrap_or(serde_json::Value::Null);
        (status, body)
    }

    /// Whether `typed` is a Nissewyn Server this build can talk to.
    pub async fn check(&self, typed: &str) -> OrgResult<ServerInfo> {
        let server = server_url(typed)?;
        let res = self.http.get(format!("{server}/healthz")).send().await.map_err(Self::unreachable)?;
        let (status, body) = Self::answer(res).await;
        let Some(protocol) = body["protocol"].as_u64() else {
            return Err(OrgError::new("not_nissewyn", format!("HTTP {status}")));
        };
        if protocol as u32 != PROTOCOL_VERSION {
            let older = if (protocol as u32) < PROTOCOL_VERSION { "server" } else { "desktop" };
            return Err(OrgError::new("protocol_mismatch", older));
        }
        if body["database"] != "ok" {
            return Err(OrgError::new("server_degraded", body["database"].as_str().unwrap_or_default()));
        }
        Ok(ServerInfo { server, version: body["version"].as_str().unwrap_or_default().to_string() })
    }

    /// Join with a code from an admin.
    pub async fn join(&self, typed_server: &str, code: &str) -> OrgResult<OrgStatus> {
        if self.read().membership.is_some() {
            return Err(OrgError::new("already_joined", ""));
        }
        if code.trim().is_empty() {
            return Err(OrgError::new("code_missing", ""));
        }
        let info = self.check(typed_server).await?;
        let key = SigningKey::generate(&mut rand_core::OsRng);
        let engine = base64::engine::general_purpose::STANDARD;
        // Into the key store first: a computer that joined must be able to prove it.
        self.keys.save(&engine.encode(key.to_bytes())).map_err(|e| OrgError::new("key_store", e))?;
        let name = device_name();
        let body = serde_json::json!({
            "code": code.trim(),
            "public_key": engine.encode(key.verifying_key().to_bytes()),
            "name": name,
            "os": std::env::consts::OS,
            "app_version": env!("CARGO_PKG_VERSION"),
            "protocol": PROTOCOL_VERSION,
        });
        let sent = self.http.post(format!("{}/api/v1/devices/enroll", info.server)).json(&body).send().await;
        let (status, answer) = match sent {
            Ok(res) => Self::answer(res).await,
            Err(e) => {
                let _ = self.keys.delete();
                return Err(Self::unreachable(e));
            }
        };
        if status != 200 {
            let _ = self.keys.delete();
            return Err(refusal(status, &answer));
        }
        let membership = Membership {
            server: info.server,
            device_id: answer["device_id"].as_str().unwrap_or_default().to_string(),
            device_name: name,
            organization: Organization {
                id: answer["organization"]["id"].as_str().unwrap_or_default().to_string(),
                name: answer["organization"]["name"].as_str().unwrap_or_default().to_string(),
            },
            joined_at: now(),
            last_contact: Some(now()),
            problem: None,
        };
        self.write(&Saved { membership: Some(membership), removed: None })?;
        Ok(self.status())
    }

    async fn signed(&self, m: &Membership, method: reqwest::Method, path: &str) -> OrgResult<(u16, serde_json::Value)> {
        let key = self.key()?;
        let at = now();
        let res = self
            .http
            .request(method.clone(), format!("{}{path}", m.server))
            .header("x-nissewyn-device", &m.device_id)
            .header("x-nissewyn-time", at.to_string())
            .header("x-nissewyn-signature", sign(&key, method.as_str(), path, at, b""))
            .send()
            .await
            .map_err(Self::unreachable)?;
        Ok(Self::answer(res).await)
    }

    /// Ask the server whether this computer is still in. A removal makes it
    /// "not joined"; anything else (offline, clock, key) is kept as a problem
    /// to show, and the membership stays.
    pub async fn refresh(&self) -> OrgStatus {
        let mut saved = self.read();
        let Some(mut m) = saved.membership.clone() else { return self.status() };
        let outcome = match self.signed(&m, reqwest::Method::GET, "/api/v1/devices/me").await {
            Ok((200, body)) => Ok(body),
            Ok((status, body)) => Err(refusal(status, &body)),
            Err(e) => Err(e),
        };
        match outcome {
            Ok(body) => {
                if let Some(name) = body["organization"]["name"].as_str() {
                    m.organization.name = name.to_string();
                }
                m.last_contact = Some(now());
                m.problem = None;
                saved.membership = Some(m);
            }
            Err(e) if e.code == "device_removed" => {
                let _ = self.keys.delete();
                saved.removed = Some(Removed { organization: m.organization.name.clone(), at: now(), message: e.detail });
                saved.membership = None;
            }
            Err(e) => {
                m.problem = Some(e);
                saved.membership = Some(m);
            }
        }
        let _ = self.write(&saved);
        self.status()
    }

    /// Leave the organization. The server is told when it can be; this
    /// computer leaves either way.
    pub async fn leave(&self) -> OrgResult<Left> {
        let saved = self.read();
        let Some(m) = saved.membership else {
            return Ok(Left { status: self.status(), server_not_told: false });
        };
        // Already out on the server counts as told; a refused signature does not.
        let told = match self.signed(&m, reqwest::Method::POST, "/api/v1/devices/leave").await {
            Ok((200, _)) => true,
            Ok((status, body)) => refusal(status, &body).code == "device_removed",
            Err(_) => false,
        };
        self.keys.delete().map_err(|e| OrgError::new("key_store", e))?;
        self.write(&Saved::default())?;
        Ok(Left { status: self.status(), server_not_told: !told })
    }

    /// The "you were removed" note has been read.
    pub fn dismiss_removed(&self) -> OrgResult<OrgStatus> {
        let mut saved = self.read();
        saved.removed = None;
        self.write(&saved)?;
        Ok(self.status())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    pub struct MemoryKeys(Mutex<Option<String>>);
    impl KeyStore for MemoryKeys {
        fn save(&self, s: &str) -> Result<(), String> {
            *self.0.lock().unwrap() = Some(s.into());
            Ok(())
        }
        fn load(&self) -> Result<Option<String>, String> {
            Ok(self.0.lock().unwrap().clone())
        }
        fn delete(&self) -> Result<(), String> {
            *self.0.lock().unwrap() = None;
            Ok(())
        }
    }

    /// The vector the server tests too (nissewyn-enterprise, `auth.rs`).
    #[test]
    fn the_shared_signing_vector() {
        let s = signing_string("POST", "/api/v1/devices/leave?x=1", 1_700_000_000, b"{\"a\":1}");
        assert_eq!(
            s,
            "POST\n/api/v1/devices/leave?x=1\n1700000000\n015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862"
        );
        let key = SigningKey::from_bytes(&[7u8; 32]);
        assert_eq!(
            sign(&key, "POST", "/api/v1/devices/leave?x=1", 1_700_000_000, b"{\"a\":1}"),
            "lNb3zWqriQNWvaUTXfLTd+YyyNMnCSL0DuQB42Apgb5WsoAYRzLoMBu1MVzLOW/7FgtItJ/b5N1/GYMkKBFqAQ=="
        );
    }

    #[test]
    fn a_server_address_the_way_people_type_it() {
        assert_eq!(server_url(" nissewyn.acme.example/ ").unwrap(), "https://nissewyn.acme.example");
        assert_eq!(server_url("https://acme.example/nissewyn/?x#y").unwrap(), "https://acme.example/nissewyn");
        assert_eq!(server_url("http://127.0.0.1:8443").unwrap(), "http://127.0.0.1:8443");
        assert_eq!(server_url("http://localhost:8443/").unwrap(), "http://localhost:8443");
        assert_eq!(server_url("http://acme.example").unwrap_err().code, "https_required");
        assert_eq!(server_url("").unwrap_err().code, "server_missing");
        assert_eq!(server_url("ftp://acme.example").unwrap_err().code, "server_unreadable");
    }

    #[test]
    fn a_removal_is_told_apart_from_a_bad_clock() {
        let body = |e: &str| serde_json::json!({"error": e, "message": "why"});
        assert_eq!(refusal(401, &body("device_removed")).code, "device_removed");
        assert_eq!(refusal(401, &body("device_refused")).code, "device_refused");
        assert_eq!(refusal(426, &body("protocol_mismatch")).code, "protocol_mismatch");
        assert_eq!(refusal(400, &body("bad_join_code")).detail, "why");
        assert_eq!(refusal(502, &serde_json::Value::Null), OrgError::new("server_error", "HTTP 502"));
    }

    fn scratch() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("nissewyn-org-test-{}", rand_core::RngCore::next_u64(&mut rand_core::OsRng)));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn an_unreachable_server_keeps_the_membership() {
        let dir = scratch();
        let org = Org::new(dir.clone(), Box::new(MemoryKeys::default()));
        let m = Membership {
            server: "http://127.0.0.1:9".into(),
            device_id: "d".into(),
            organization: Organization { id: "o".into(), name: "Acme".into() },
            ..Default::default()
        };
        org.write(&Saved { membership: Some(m), removed: None }).unwrap();
        org.keys.save(&base64::engine::general_purpose::STANDARD.encode([1u8; 32])).unwrap();
        let status = org.refresh().await;
        let m = status.membership.expect("still joined");
        assert_eq!(m.problem.unwrap().code, "unreachable");

        // Leaving offline still leaves, and says the server was not told.
        let left = org.leave().await.unwrap();
        assert!(left.server_not_told);
        assert!(left.status.membership.is_none());
        assert_eq!(org.keys.load().unwrap(), None);
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Against a real Nissewyn Server: `NISSEWYN_TEST_SERVER=http://127.0.0.1:8443`
    /// and `NISSEWYN_TEST_ADMIN=nwa_...`, then `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn joins_a_real_server_and_is_removed() {
        let server = std::env::var("NISSEWYN_TEST_SERVER").expect("NISSEWYN_TEST_SERVER");
        let admin = std::env::var("NISSEWYN_TEST_ADMIN").expect("NISSEWYN_TEST_ADMIN");
        let http = reqwest::Client::new();
        let code = || async {
            let v: serde_json::Value = http
                .post(format!("{server}/api/admin/join-codes"))
                .bearer_auth(&admin)
                .json(&serde_json::json!({"note": "desktop test"}))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
            v["code"].as_str().unwrap().to_string()
        };
        let dir = scratch();
        let org = Org::new(dir.clone(), Box::new(MemoryKeys::default()));

        assert_eq!(org.join(&server, "AAAA-BBBB-CCCC-DDDD").await.unwrap_err().code, "bad_join_code");
        assert_eq!(org.keys.load().unwrap(), None, "a refused join leaves no key behind");

        let joined = org.join(&server, &code().await.to_lowercase()).await.unwrap();
        let m = joined.membership.unwrap();
        assert!(!m.organization.name.is_empty());
        assert_eq!(org.join(&server, &code().await).await.unwrap_err().code, "already_joined");
        let checked = org.refresh().await.membership.unwrap();
        assert!(checked.problem.is_none(), "{:?}", checked.problem);

        // The admin removes it: back to not joined, told once.
        http.post(format!("{server}/api/admin/devices/{}/revoke", m.device_id)).bearer_auth(&admin).send().await.unwrap();
        let after = org.refresh().await;
        assert!(after.membership.is_none());
        assert_eq!(after.removed.as_ref().unwrap().organization, m.organization.name);
        assert_eq!(org.keys.load().unwrap(), None);
        assert!(org.dismiss_removed().unwrap().removed.is_none());

        // Join again and leave by itself: the server is told.
        org.join(&server, &code().await).await.unwrap();
        let left = org.leave().await.unwrap();
        assert!(!left.server_not_told);
        let _ = std::fs::remove_dir_all(dir);
    }
}
