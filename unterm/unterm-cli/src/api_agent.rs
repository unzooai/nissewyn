//! Built-in API Agent runner (`unterm-cli api-agent`).
//!
//! Speaks the same newline-delimited `stream-json` host protocol as Claude Code
//! (`--input-format stream-json --output-format stream-json --permission-prompt-tool stdio`),
//! so Nissewyn's `unterm-brain` runtime drives it with full approval governance,
//! MCP tool mounting (Unterm terminal, Unzoo Browser, enabled plugins), and
//! multi-turn / `--resume` support.
//!
//! Supports both OpenAI-compatible (`/chat/completions`) and Anthropic-compatible
//! (`/messages`) APIs — covering DeepSeek, Qwen, Kimi, GLM, MiniMax, Doubao/Ark,
//! SiliconFlow, OpenAI, Anthropic, OpenRouter, Ollama, and custom gateways.

use anyhow::{anyhow, Context, Result};
use clap::Args;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::time::Duration;
use unterm_settings::api_agent::{load_api_key, load_config, ApiAgentConfig};

const MAX_TOOL_STEPS: usize = 25;

#[derive(Debug, Args)]
pub struct ApiAgentCommand {
    /// JSON MCP server configuration (`{"mcpServers": {...}}`).
    #[arg(long = "mcp-config")]
    pub mcp_config: Option<String>,

    /// System prompt appended to the built-in instructions.
    #[arg(long = "append-system-prompt")]
    pub append_system_prompt: Option<String>,

    /// Resume a previous conversation session by id.
    #[arg(long = "resume")]
    pub resume: Option<String>,

    /// Accepted for ClaudeHost compatibility.
    #[arg(long = "input-format")]
    pub input_format: Option<String>,

    /// Accepted for ClaudeHost compatibility.
    #[arg(long = "output-format")]
    pub output_format: Option<String>,

    /// Accepted for ClaudeHost compatibility.
    #[arg(long = "verbose")]
    pub verbose: bool,

    /// Accepted for ClaudeHost compatibility.
    #[arg(long = "permission-prompt-tool")]
    pub permission_prompt_tool: Option<String>,
}

struct McpClient {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
}

impl McpClient {
    fn spawn(command: &str, args: &[String], env: &HashMap<String, String>) -> Result<Self> {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        for (k, v) in env {
            cmd.env(k, v);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        let mut child = cmd.spawn().with_context(|| format!("spawn MCP server {command}"))?;
        let stdin = child.stdin.take().ok_or_else(|| anyhow!("missing MCP stdin"))?;
        let stdout = BufReader::new(child.stdout.take().ok_or_else(|| anyhow!("missing MCP stdout"))?);
        let mut client = Self { child, stdin, stdout, next_id: 1 };
        let _ = client.request(
            "initialize",
            json!({
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "nissewyn-api-agent", "version": "0.1.6"}
            }),
        )?;
        let _ = writeln!(client.stdin, "{}", json!({"jsonrpc": "2.0", "method": "notifications/initialized"}));
        let _ = client.stdin.flush();
        Ok(client)
    }

    fn request(&mut self, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id;
        self.next_id += 1;
        let msg = json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params});
        writeln!(self.stdin, "{msg}")?;
        self.stdin.flush()?;
        let mut line = String::new();
        loop {
            line.clear();
            let n = self.stdout.read_line(&mut line)?;
            if n == 0 {
                return Err(anyhow!("MCP server closed stdout while waiting for {method}"));
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let Ok(val) = serde_json::from_str::<Value>(trimmed) else {
                continue;
            };
            if val.get("id").and_then(Value::as_u64) != Some(id) {
                continue;
            }
            if let Some(err) = val.get("error") {
                return Err(anyhow!("{}", err.get("message").and_then(Value::as_str).unwrap_or("MCP error")));
            }
            return Ok(val.get("result").cloned().unwrap_or(Value::Null));
        }
    }

    fn list_tools(&mut self) -> Result<Vec<Value>> {
        let res = self.request("tools/list", json!({}))?;
        Ok(res.get("tools").and_then(Value::as_array).cloned().unwrap_or_default())
    }

    fn call_tool(&mut self, name: &str, arguments: Value) -> Result<(String, bool)> {
        let res = self.request("tools/call", json!({"name": name, "arguments": arguments}))?;
        let is_error = res.get("isError").and_then(Value::as_bool).unwrap_or(false);
        let text = res
            .get("content")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| res.to_string());
        Ok((text, is_error))
    }
}

impl Drop for McpClient {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Clone)]
struct ToolBinding {
    llm_name: String,
    mcp_name: String,
    server: String,
    raw_name: String,
    description: String,
    schema: Value,
}

fn sanitize_tool_name(server: &str, raw: &str) -> String {
    let mut out = format!("mcp__{server}__");
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.len() > 64 {
        out.truncate(64);
    }
    out
}

fn load_mcp_servers(mcp_config: Option<&str>) -> (HashMap<String, McpClient>, Vec<ToolBinding>) {
    let mut clients = HashMap::new();
    let mut bindings = Vec::new();
    let Some(raw) = mcp_config else {
        return (clients, bindings);
    };
    let Ok(val) = serde_json::from_str::<Value>(raw) else {
        return (clients, bindings);
    };
    let Some(servers) = val.get("mcpServers").and_then(Value::as_object) else {
        return (clients, bindings);
    };
    for (server_name, spec) in servers {
        let Some(command) = spec.get("command").and_then(Value::as_str) else {
            continue;
        };
        let args: Vec<String> = spec
            .get("args")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
            .unwrap_or_default();
        let env: HashMap<String, String> = spec
            .get("env")
            .and_then(Value::as_object)
            .map(|m| {
                m.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect()
            })
            .unwrap_or_default();
        match McpClient::spawn(command, &args, &env) {
            Ok(mut client) => {
                if let Ok(tools) = client.list_tools() {
                    for tool in tools {
                        let Some(raw_name) = tool.get("name").and_then(Value::as_str) else {
                            continue;
                        };
                        let description = tool
                            .get("description")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string();
                        let schema = tool
                            .get("inputSchema")
                            .cloned()
                            .unwrap_or_else(|| json!({"type": "object", "properties": {}}));
                        let llm_name = sanitize_tool_name(server_name, raw_name);
                        let mcp_name = format!("mcp__{server_name}__{raw_name}");
                        bindings.push(ToolBinding {
                            llm_name,
                            mcp_name,
                            server: server_name.clone(),
                            raw_name: raw_name.to_string(),
                            description,
                            schema,
                        });
                    }
                }
                clients.insert(server_name.clone(), client);
            }
            Err(e) => {
                eprintln!("api-agent: failed to mount MCP server {server_name}: {e:#}");
            }
        }
    }
    (clients, bindings)
}

fn emit(val: &Value) {
    let mut stdout = io::stdout().lock();
    let _ = writeln!(stdout, "{val}");
    let _ = stdout.flush();
}

fn session_file(session_id: &str) -> PathBuf {
    unterm_protocol::state_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("api-sessions")
        .join(format!("{session_id}.json"))
}

fn load_history(session_id: &str) -> Vec<Value> {
    std::fs::read_to_string(session_file(session_id))
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Value>>(&s).ok())
        .unwrap_or_default()
}

fn save_history(session_id: &str, messages: &[Value]) {
    let path = session_file(session_id);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(text) = serde_json::to_string(messages) {
        let _ = std::fs::write(path, text);
    }
}

enum PermDecision {
    Allow(Value),
    Deny { message: String, interrupt: bool },
}

fn ask_permission(
    stdin_lines: &mut impl Iterator<Item = io::Result<String>>,
    req_counter: &mut u64,
    tool_name: &str,
    input: &Value,
) -> PermDecision {
    *req_counter += 1;
    let request_id = format!("req_{}", *req_counter);
    emit(&json!({
        "type": "control_request",
        "request_id": request_id,
        "request": {
            "subtype": "can_use_tool",
            "tool_name": tool_name,
            "input": input,
        }
    }));

    for line in stdin_lines.by_ref() {
        let Ok(line) = line else { break };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(val) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if val.get("type").and_then(Value::as_str) != Some("control_response") {
            continue;
        }
        let Some(resp) = val.get("response") else {
            continue;
        };
        if resp.get("request_id").and_then(Value::as_str) != Some(request_id.as_str()) {
            continue;
        }
        let inner = resp.get("response").cloned().unwrap_or(Value::Null);
        let behavior = inner.get("behavior").and_then(Value::as_str).unwrap_or("deny");
        if behavior == "allow" {
            let updated = inner.get("updatedInput").cloned().unwrap_or_else(|| input.clone());
            return PermDecision::Allow(updated);
        }
        let message = inner
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Denied by user")
            .to_string();
        let interrupt = inner.get("interrupt").and_then(Value::as_bool).unwrap_or(false);
        return PermDecision::Deny { message, interrupt };
    }
    PermDecision::Deny { message: "stdin closed while waiting for permission".into(), interrupt: true }
}

struct LlmTurn {
    text: String,
    tool_calls: Vec<(String, String, Value)>,
    input_tokens: u64,
    output_tokens: u64,
}

fn call_llm(
    cfg: &ApiAgentConfig,
    api_key: Option<&str>,
    system_prompt: &str,
    messages: &[Value],
    tools: &[ToolBinding],
) -> Result<LlmTurn> {
    if cfg.protocol == "anthropic" {
        call_anthropic(cfg, api_key, system_prompt, messages, tools)
    } else {
        call_openai(cfg, api_key, system_prompt, messages, tools)
    }
}

fn post_json(url: &str, headers: &[(&str, &str)], body: &Value) -> Result<Value> {
    use http_req::request::{Method, Request};
    use http_req::uri::Uri;
    use std::convert::TryFrom;

    let uri = Uri::try_from(url).map_err(|e| anyhow!("invalid URL {url}: {e}"))?;
    let bytes = body.to_string().into_bytes();
    let mut out = Vec::new();
    let mut req = Request::new(&uri);
    req.method(Method::POST)
        .header("Content-Type", "application/json")
        .header("Content-Length", &bytes.len())
        .connect_timeout(Some(Duration::from_secs(15)))
        .read_timeout(Some(Duration::from_secs(120)))
        .timeout(Duration::from_secs(130))
        .body(&bytes);
    for (k, v) in headers {
        req.header(k, v);
    }
    let resp = req.send(&mut out).map_err(|e| anyhow!("LLM HTTP error: {e}"))?;
    let status = u16::from(resp.status_code());
    if status >= 400 {
        let snippet: String = String::from_utf8_lossy(&out).chars().take(400).collect();
        return Err(anyhow!("LLM API HTTP {status}: {snippet}"));
    }
    serde_json::from_slice(&out).context("LLM API returned non-JSON body")
}

fn call_openai(
    cfg: &ApiAgentConfig,
    api_key: Option<&str>,
    system_prompt: &str,
    messages: &[Value],
    tools: &[ToolBinding],
) -> Result<LlmTurn> {
    let base = cfg.base_url.trim_end_matches('/');
    let url = if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{base}/chat/completions")
    };

    let mut wire_msgs = Vec::new();
    if !system_prompt.trim().is_empty() {
        wire_msgs.push(json!({"role": "system", "content": system_prompt}));
    }
    wire_msgs.extend(messages.iter().cloned());

    let mut payload = json!({
        "model": cfg.model,
        "messages": wire_msgs,
    });
    if !tools.is_empty() {
        let wire_tools: Vec<Value> = tools
            .iter()
            .map(|t| {
                json!({
                    "type": "function",
                    "function": {
                        "name": t.llm_name,
                        "description": t.description,
                        "parameters": t.schema,
                    }
                })
            })
            .collect();
        payload["tools"] = Value::Array(wire_tools);
    }

    let auth_val = api_key.map(|k| format!("Bearer {k}"));
    let mut headers: Vec<(&str, &str)> = Vec::new();
    if let Some(ref a) = auth_val {
        headers.push(("Authorization", a.as_str()));
    }

    let val = post_json(&url, &headers, &payload)?;
    let msg = val
        .pointer("/choices/0/message")
        .ok_or_else(|| anyhow!("OpenAI response missing choices[0].message"))?;
    let text = msg.get("content").and_then(Value::as_str).unwrap_or("").to_string();
    let mut tool_calls = Vec::new();
    if let Some(calls) = msg.get("tool_calls").and_then(Value::as_array) {
        for (idx, call) in calls.iter().enumerate() {
            let id = call
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("call_{idx}"));
            let name = call
                .pointer("/function/name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let raw_args = call
                .pointer("/function/arguments")
                .and_then(Value::as_str)
                .unwrap_or("{}");
            let args = serde_json::from_str::<Value>(raw_args).unwrap_or_else(|_| json!({}));
            if !name.is_empty() {
                tool_calls.push((id, name, args));
            }
        }
    }
    let input_tokens = val.pointer("/usage/prompt_tokens").and_then(Value::as_u64).unwrap_or(0);
    let output_tokens = val.pointer("/usage/completion_tokens").and_then(Value::as_u64).unwrap_or(0);
    Ok(LlmTurn { text, tool_calls, input_tokens, output_tokens })
}

fn call_anthropic(
    cfg: &ApiAgentConfig,
    api_key: Option<&str>,
    system_prompt: &str,
    messages: &[Value],
    tools: &[ToolBinding],
) -> Result<LlmTurn> {
    let base = cfg.base_url.trim_end_matches('/');
    let url = if base.ends_with("/messages") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/messages")
    } else {
        format!("{base}/v1/messages")
    };

    // Convert OpenAI-shaped internal history into Anthropic Messages format.
    let mut wire_msgs: Vec<Value> = Vec::new();
    for m in messages {
        let role = m.get("role").and_then(Value::as_str).unwrap_or("user");
        if role == "tool" {
            let tool_use_id = m.get("tool_call_id").and_then(Value::as_str).unwrap_or("");
            let content = m.get("content").and_then(Value::as_str).unwrap_or("");
            let block = json!({"type": "tool_result", "tool_use_id": tool_use_id, "content": content});
            if let Some(last) = wire_msgs.last_mut().filter(|l| l.get("role").and_then(Value::as_str) == Some("user")) {
                if let Some(arr) = last.get_mut("content").and_then(Value::as_array_mut) {
                    arr.push(block);
                    continue;
                }
            }
            wire_msgs.push(json!({"role": "user", "content": [block]}));
        } else if role == "assistant" {
            let mut blocks = Vec::new();
            if let Some(text) = m.get("content").and_then(Value::as_str).filter(|s| !s.is_empty()) {
                blocks.push(json!({"type": "text", "text": text}));
            }
            if let Some(calls) = m.get("tool_calls").and_then(Value::as_array) {
                for c in calls {
                    let id = c.get("id").and_then(Value::as_str).unwrap_or("");
                    let name = c.pointer("/function/name").and_then(Value::as_str).unwrap_or("");
                    let raw_args = c.pointer("/function/arguments").and_then(Value::as_str).unwrap_or("{}");
                    let input = serde_json::from_str::<Value>(raw_args).unwrap_or_else(|_| json!({}));
                    blocks.push(json!({"type": "tool_use", "id": id, "name": name, "input": input}));
                }
            }
            if !blocks.is_empty() {
                wire_msgs.push(json!({"role": "assistant", "content": blocks}));
            }
        } else {
            let content = m.get("content").cloned().unwrap_or_else(|| json!(""));
            wire_msgs.push(json!({"role": "user", "content": content}));
        }
    }

    let mut payload = json!({
        "model": cfg.model,
        "max_tokens": 4096,
        "messages": wire_msgs,
    });
    if !system_prompt.trim().is_empty() {
        payload["system"] = json!(system_prompt);
    }
    if !tools.is_empty() {
        let wire_tools: Vec<Value> = tools
            .iter()
            .map(|t| {
                json!({
                    "name": t.llm_name,
                    "description": t.description,
                    "input_schema": t.schema,
                })
            })
            .collect();
        payload["tools"] = Value::Array(wire_tools);
    }

    let mut headers: Vec<(&str, &str)> = vec![("anthropic-version", "2023-06-01")];
    if let Some(k) = api_key {
        headers.push(("x-api-key", k));
    }

    let val = post_json(&url, &headers, &payload)?;
    let mut text_parts = Vec::new();
    let mut tool_calls = Vec::new();
    if let Some(blocks) = val.get("content").and_then(Value::as_array) {
        for block in blocks {
            match block.get("type").and_then(Value::as_str) {
                Some("text") => {
                    if let Some(t) = block.get("text").and_then(Value::as_str) {
                        text_parts.push(t.to_string());
                    }
                }
                Some("tool_use") => {
                    let id = block.get("id").and_then(Value::as_str).unwrap_or("").to_string();
                    let name = block.get("name").and_then(Value::as_str).unwrap_or("").to_string();
                    let input = block.get("input").cloned().unwrap_or_else(|| json!({}));
                    if !name.is_empty() {
                        tool_calls.push((id, name, input));
                    }
                }
                _ => {}
            }
        }
    }
    let input_tokens = val.pointer("/usage/input_tokens").and_then(Value::as_u64).unwrap_or(0);
    let output_tokens = val.pointer("/usage/output_tokens").and_then(Value::as_u64).unwrap_or(0);
    Ok(LlmTurn {
        text: text_parts.join("\n"),
        tool_calls,
        input_tokens,
        output_tokens,
    })
}

pub fn run(cmd: ApiAgentCommand) -> Result<()> {
    let cfg = load_config();
    let api_key = load_api_key();
    let session_id = cmd
        .resume
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("api-{}", chrono::Utc::now().timestamp_millis()));

    let (mut mcp_clients, tools) = load_mcp_servers(cmd.mcp_config.as_deref());
    let tool_map: HashMap<String, ToolBinding> =
        tools.iter().map(|t| (t.llm_name.clone(), t.clone())).collect();

    let system_prompt = cmd.append_system_prompt.clone().unwrap_or_default();
    let mut history = if cmd.resume.is_some() {
        load_history(&session_id)
    } else {
        Vec::new()
    };

    emit(&json!({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
        "model": cfg.model,
        "tools": tools.iter().map(|t| t.mcp_name.clone()).collect::<Vec<_>>(),
    }));

    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();
    let mut req_counter: u64 = 0;

    while let Some(Ok(line)) = lines.next() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(msg) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if msg.get("type").and_then(Value::as_str) != Some("user") {
            continue;
        }
        let user_text = msg
            .pointer("/message/content")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        if user_text.trim().is_empty() {
            continue;
        }

        history.push(json!({"role": "user", "content": user_text}));
        let mut total_in: u64 = 0;
        let mut total_out: u64 = 0;
        let mut final_text = String::new();
        let mut turn_error: Option<String> = None;

        for _step in 0..MAX_TOOL_STEPS {
            let turn = match call_llm(&cfg, api_key.as_deref(), &system_prompt, &history, &tools) {
                Ok(t) => t,
                Err(e) => {
                    turn_error = Some(format!("{e:#}"));
                    break;
                }
            };
            total_in += turn.input_tokens;
            total_out += turn.output_tokens;
            if !turn.text.is_empty() {
                final_text = turn.text.clone();
            }

            // Build assistant event blocks + internal history entry.
            let mut content_blocks: Vec<Value> = Vec::new();
            if !turn.text.is_empty() {
                content_blocks.push(json!({"type": "text", "text": turn.text}));
            }
            let mut hist_calls: Vec<Value> = Vec::new();
            for (id, llm_name, args) in &turn.tool_calls {
                let display_name = tool_map
                    .get(llm_name)
                    .map(|b| b.mcp_name.as_str())
                    .unwrap_or(llm_name.as_str());
                content_blocks.push(json!({
                    "type": "tool_use",
                    "id": id,
                    "name": display_name,
                    "input": args,
                }));
                hist_calls.push(json!({
                    "id": id,
                    "type": "function",
                    "function": {
                        "name": llm_name,
                        "arguments": args.to_string(),
                    }
                }));
            }

            emit(&json!({
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "model": cfg.model,
                    "content": content_blocks,
                    "usage": {
                        "input_tokens": turn.input_tokens,
                        "output_tokens": turn.output_tokens,
                    }
                }
            }));

            let mut hist_msg = Map::new();
            hist_msg.insert("role".into(), json!("assistant"));
            hist_msg.insert("content".into(), json!(turn.text));
            if !hist_calls.is_empty() {
                hist_msg.insert("tool_calls".into(), Value::Array(hist_calls));
            }
            history.push(Value::Object(hist_msg));

            if turn.tool_calls.is_empty() {
                break;
            }

            let mut interrupted = false;
            for (call_id, llm_name, args) in turn.tool_calls {
                let binding = tool_map.get(&llm_name);
                let mcp_name = binding
                    .map(|b| b.mcp_name.as_str())
                    .unwrap_or(llm_name.as_str());

                let (output_text, is_error) = match ask_permission(&mut lines, &mut req_counter, mcp_name, &args) {
                    PermDecision::Allow(approved_input) => {
                        if let Some(b) = binding {
                            if let Some(client) = mcp_clients.get_mut(&b.server) {
                                match client.call_tool(&b.raw_name, approved_input) {
                                    Ok(res) => res,
                                    Err(e) => (format!("Tool error: {e:#}"), true),
                                }
                            } else {
                                (format!("MCP server {} is not running", b.server), true)
                            }
                        } else {
                            (format!("Unknown tool: {llm_name}"), true)
                        }
                    }
                    PermDecision::Deny { message, interrupt } => {
                        interrupted = interrupt;
                        (message, true)
                    }
                };

                emit(&json!({
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": call_id,
                            "content": output_text,
                            "is_error": is_error,
                        }]
                    }
                }));

                history.push(json!({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": output_text,
                }));

                if interrupted {
                    break;
                }
            }
            if interrupted {
                break;
            }
        }

        save_history(&session_id, &history);

        if let Some(err) = turn_error {
            emit(&json!({
                "type": "result",
                "subtype": "error",
                "is_error": true,
                "session_id": session_id,
                "result": err,
                "usage": { "input_tokens": total_in, "output_tokens": total_out }
            }));
        } else {
            emit(&json!({
                "type": "result",
                "subtype": "success",
                "is_error": false,
                "session_id": session_id,
                "result": final_text,
                "usage": { "input_tokens": total_in, "output_tokens": total_out }
            }));
        }
    }

    Ok(())
}
