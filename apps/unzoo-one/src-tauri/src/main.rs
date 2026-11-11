//! Unzoo One, the desktop client.
//!
//! Unzoo One is a client of its own background service, the Core: tasks,
//! schedules, agent sessions and the inbox live there and keep going with no
//! window open. This window carries the interface; on start it makes sure the
//! Core is running and tells the page where it is and which token to use.
//! The terminal is another client of the same Core, opened from here.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
struct CoreConnection {
    base: String,
    token: String,
}

/// What the Core wrote about itself.
struct Discovery {
    token: String,
    pid: u32,
    http_port: Option<u16>,
}

fn read_discovery() -> Option<Discovery> {
    let path = unterm_protocol::core_discovery_path()?;
    let value: serde_json::Value = serde_json::from_slice(&std::fs::read(path).ok()?).ok()?;
    Some(Discovery {
        token: value.get("token")?.as_str()?.to_string(),
        pid: value.get("pid").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        http_port: value.get("http_port").and_then(|v| v.as_u64()).and_then(|p| u16::try_from(p).ok()),
    })
}

/// Whether a Core answers at this port with this token: one authenticated
/// request to the console's API, so a stale record or another program on a
/// recycled port is not mistaken for it.
fn answers(port: u16, token: &str) -> bool {
    let Ok(mut stream) = TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_millis(800))
    else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let request = format!(
        "GET /api/console/run-settings HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut head = [0u8; 16];
    let read = stream.read(&mut head).unwrap_or(0);
    head[..read].starts_with(b"HTTP/1.1 200")
}

fn live(discovery: &Discovery) -> Option<CoreConnection> {
    let port = discovery.http_port?;
    answers(port, &discovery.token).then(|| CoreConnection {
        base: format!("http://127.0.0.1:{port}"),
        token: discovery.token.clone(),
    })
}

/// The Core's program: named explicitly, next to this one (an install), or
/// the runtime's own build (developing).
fn core_program() -> Option<PathBuf> {
    sibling_program("unterm-core", "UNZOO_CORE_EXE")
}

fn start_core(program: &PathBuf) -> std::io::Result<()> {
    let mut command = Command::new(program);
    command.arg("--headless");
    // Its folders and messages are Unzoo One's: tasks work in
    // Documents\Unzoo One\<task>, not in a folder named after the runtime.
    command.env("UNTERM_PRODUCT_NAME", "Unzoo One");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // No console window, and not tied to this window's life: the Core
        // keeps running schedules after the window closes.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        command.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }
    command.spawn().map(|_| ())
}

fn ensure_core() -> Result<CoreConnection, String> {
    // One at a time: the window's start-up and the page's first request both
    // get here, and two would each start a Core (the second then exits on
    // the single-instance lock, but only after a confusing log line).
    static STARTING: Mutex<()> = Mutex::new(());
    let _one = STARTING.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(found) = read_discovery() {
        if let Some(connection) = live(&found) {
            return Ok(connection);
        }
        if found.http_port.is_none() && found.pid != 0 && pid_alive(found.pid) {
            return Err(
                "An older background service is running that does not offer what Unzoo One needs. Quit it (or restart your computer), then open Unzoo One again."
                    .into(),
            );
        }
    }
    let program = core_program().ok_or("The Unzoo One background service is missing. Please reinstall Unzoo One.")?;
    start_core(&program).map_err(|e| format!("The background service could not start: {e}"))?;
    let deadline = Instant::now() + Duration::from_secs(20);
    while Instant::now() < deadline {
        if let Some(connection) = read_discovery().as_ref().and_then(live) {
            return Ok(connection);
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err("The background service did not become ready within 20 seconds.".into())
}

#[cfg(windows)]
fn pid_alive(pid: u32) -> bool {
    // tasklist is slow but this runs once, and only on the unusual path.
    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn pid_alive(pid: u32) -> bool {
    std::path::Path::new(&format!("/proc/{pid}")).exists()
        || Command::new("kill").args(["-0", &pid.to_string()]).status().map(|s| s.success()).unwrap_or(false)
}

/// A program that ships next to this one (an install), or the runtime's own
/// build (developing). `env` names an override.
fn sibling_program(stem: &str, env: &str) -> Option<PathBuf> {
    let name = if cfg!(windows) { format!("{stem}.exe") } else { stem.to_string() };
    if let Some(path) = std::env::var_os(env).map(PathBuf::from) {
        return path.is_file().then_some(path);
    }
    let beside = std::env::current_exe().ok()?.parent()?.join(&name);
    if beside.is_file() {
        return Some(beside);
    }
    let runtime = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../unterm/target");
    ["release", "debug"]
        .iter()
        .map(|profile| runtime.join(profile).join(&name))
        .find(|path| path.is_file())
}

/// Open the terminal: another client of the same Core, so its sessions and
/// the agent runs it shows are the ones Unzoo One knows about.
#[tauri::command]
fn open_terminal() -> Result<(), String> {
    let program = sibling_program("unterm", "UNZOO_TERMINAL_EXE")
        .ok_or("The terminal is missing. Please reinstall Unzoo One.")?;
    Command::new(&program)
        // Its windows are Unzoo One's: the terminal is a feature of this app.
        .env("UNTERM_PRODUCT_NAME", "Unzoo One")
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("The terminal could not start: {e}"))
}

/// Show a file a task made in the system's file manager, selected. Only an
/// existing file or folder; nothing is run but the file manager itself.
#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("{path} is no longer there"));
    }
    #[cfg(windows)]
    let spawned = {
        use std::os::windows::process::CommandExt;
        // Explorer parses its own command line: `/select,"C:\a b\c.md"`.
        // Quoting the whole argument, as `arg` would for a path with a
        // space, makes it fall back to opening Documents.
        let quoted = format!("\"{}\"", target.display());
        if target.is_dir() {
            Command::new("explorer.exe").raw_arg(&quoted).spawn()
        } else {
            Command::new("explorer.exe").raw_arg(format!("/select,{quoted}")).spawn()
        }
    };
    #[cfg(target_os = "macos")]
    let spawned = Command::new("open").arg("-R").arg(&target).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let spawned = Command::new("xdg-open")
        .arg(if target.is_dir() { target.as_path() } else { target.parent().unwrap_or(&target) })
        .spawn();
    spawned.map(|_| ()).map_err(|e| format!("The folder could not be opened: {e}"))
}

/// The connection, found once and kept; asked again only after a failure,
/// so a Core that is still starting is waited for rather than given up on.
struct Connection(Mutex<Option<CoreConnection>>);

#[tauri::command]
async fn core_connection(state: tauri::State<'_, Connection>) -> Result<CoreConnection, String> {
    if let Some(known) = state.0.lock().unwrap().clone() {
        if answers(port_of(&known.base), &known.token) {
            return Ok(known);
        }
    }
    let found = tauri::async_runtime::spawn_blocking(ensure_core)
        .await
        .map_err(|e| e.to_string())??;
    *state.0.lock().unwrap() = Some(found.clone());
    Ok(found)
}

fn port_of(base: &str) -> u16 {
    base.rsplit(':').next().and_then(|p| p.parse().ok()).unwrap_or(0)
}

fn main() {
    tauri::Builder::default()
        .manage(Connection(Mutex::new(None)))
        .setup(|_| {
            // Start the Core while the window is still painting.
            std::thread::spawn(|| {
                if let Err(error) = ensure_core() {
                    eprintln!("unzoo-one: {error}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_connection, open_terminal, reveal_path])
        .run(tauri::generate_context!())
        .expect("Unzoo One could not start");
}
