# Nissewyn Plugin Guide & Development Reference

A **Skill** teaches an agent how to do a job (`SKILL.md`). A **Plugin** is a local program that runs beside Nissewyn with its own control page, persistent state, settings form, logs, and MCP tools governed by the same safety rules.

Any local folder containing an `unzoo-plugin.json` manifest is a valid Nissewyn plugin.

---

## 1. Using Plugins

### Adding a plugin
1. Open **Nissewyn → Plugins**.
2. Click **Add plugin** at the bottom of the left sidebar.
3. Paste the absolute path to a plugin folder (for example `/Volumes/Dev/nissewyn/plugins/xtools` or `/Volumes/Dev/nissewyn/examples/plugins/notes`) and click **Add**.
4. Open the **Settings** tab to bind required roles (Unzoo Browser identity and/or AI agent + model) and adjust settings.
5. Toggle the switch in the top-right corner to **Enabled**. Nissewyn starts the plugin process, waits for its health check, and mounts its control page and MCP tools.

### Built-in & example plugins
- **Xtools** (`plugins/xtools`): X/Twitter growth assistant with human-like browsing, style learning, scheduled posting, replies, and 8 MCP tools.
- **Notes** (`examples/plugins/notes`): Minimal zero-dependency Python template with a local web page and 2 MCP tools (`list_notes`, `add_note`).

---

## 2. Quickstart: Build a Plugin in 5 Minutes

Copy `examples/plugins/notes/` to a new folder, edit `unzoo-plugin.json`, and add that folder in Nissewyn.

```text
my-plugin/
├── unzoo-plugin.json   # Manifest (required)
├── server.py           # Control page + HTTP API (optional, any language)
├── mcp_server.py       # MCP stdio tool server (optional, any language)
└── i18n/
    └── en.json         # Optional translations for manifest text
```

Plugins are **language-agnostic**: Python, Node.js, Go, Rust, or any executable works as long as it speaks HTTP (for `run` / `page`) and/or JSON-RPC over stdio (for `mcp`).

---

## 3. Manifest Reference (`unzoo-plugin.json`)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Short summary shown under the plugin header.",
  "run": {
    "command": ["python3", "{dir}/server.py", "--port", "{port}"],
    "health": "/api/ping",
    "env": {
      "MY_FLAG": "1"
    }
  },
  "page": "/",
  "mcp": {
    "command": ["python3", "{dir}/mcp_server.py"],
    "tools": {
      "list_items": "read",
      "save_item": "change",
      "publish_item": "send"
    }
  },
  "roles": {
    "account": {
      "kind": "browser",
      "label": "Browser identity"
    },
    "writer": {
      "kind": "agent",
      "label": "Writer agent",
      "default": { "agent": "claude-code", "model": "sonnet" }
    }
  },
  "settings": [
    {
      "key": "paused",
      "group": "Automation",
      "label": "Pause all jobs",
      "type": "bool",
      "default": false,
      "help": "Keeps data intact while pausing background work."
    }
  ],
  "permissions": {
    "domains": ["example.com"]
  },
  "i18n": {
    "en": "i18n/en.json"
  }
}
```

### Field-by-field breakdown

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique plugin identifier (lowercase letters, digits, `-`, `_`). |
| `name` | Yes | Display name shown in the sidebar and header. |
| `version` | No | Semver string shown next to the name. |
| `description` | No | One-line description displayed below the header. |
| `run` | No | Long-running background process managed by Nissewyn (`command`, optional `health` path polled for up to 30s, optional `env` map). Crashed processes auto-restart up to 3 times within 10 minutes. |
| `page` | No | Relative URL path (e.g. `"/"`) rendered inside Nissewyn's **Control Page** iframe on `http://127.0.0.1:{port}{page}?lang={locale}`. |
| `mcp` | No | Stdio MCP server mounted for governed agents alongside terminal and browser tools. |
| `mcp.tools` | No | Map of `tool_name -> risk_word`. Supported risk words: `read`, `change`, `run`, `send`, `pay`, `delete`. Undeclared tools default to `send` (asks for approval). |
| `roles` | No | User-configurable bindings. `kind: "browser"` lets the user pick an Unzoo Browser profile; `kind: "agent"` lets the user pick an AI agent, model, and effort level. |
| `settings` | No | Declarative settings rendered as a native form in the **Settings** tab. Supported `type` values: `bool`, `number`, `text`, `textarea`, `choice` (`choices: [["val", "Label"], ...]`), `list`, `range` (`[minVal, maxVal]`). Optional `group`, `help`, `min`, `max`. |
| `permissions.domains` | No | Informational list of external domains the plugin accesses, shown in the **About** card. |
| `i18n` | No | Map of language code (`"en"`, `"zh-CN"`, etc.) to either an inline translation dictionary or a relative JSON file path (e.g. `"i18n/en.json"`). Keys are the original manifest strings. |

---

## 4. Runtime Placeholders & Environment Variables

### Command placeholders
In `run.command` and `mcp.command`, Nissewyn expands:
- `{dir}` — Absolute path to the plugin folder.
- `{port}` — Local TCP port allocated by Nissewyn (only for `run`).
- `{data}` — Persistent per-plugin data directory managed by Nissewyn.

### Injected environment variables
Both the `run` process and the `mcp` server receive:

| Variable | Value |
|---|---|
| `UNZOO_PLUGIN_ID` | Plugin `id` |
| `UNZOO_PLUGIN_DIR` | Absolute path to the plugin folder |
| `UNZOO_PLUGIN_DATA` | Persistent data directory for SQLite / JSON / logs |
| `UNZOO_PLUGIN_PORT` | Allocated localhost port (bind to `127.0.0.1` only) |
| `UNZOO_PLUGIN_ROLES` | JSON object of resolved role bindings (user binding or `default`) |
| `UNZOO_PLUGIN_SETTINGS` | JSON object of resolved setting key/value pairs |

Whenever a user edits settings or role bindings while the plugin is enabled, Nissewyn restarts the plugin automatically so it picks up the new environment values.

---

## 5. Prompt Template: Ask Your AI Agent to Build a Plugin

You can hand this document to Claude Code, Codex, Antigravity CLI, or OpenCode inside Nissewyn:

> Read `docs/plugin-development.md` and `examples/plugins/notes/`. Create a new Nissewyn plugin in `~/my-plugins/<name>` with `unzoo-plugin.json`, a local control page on `UNZOO_PLUGIN_PORT`, persistent storage in `UNZOO_PLUGIN_DATA`, and a stdio MCP server exposing read/change tools. Then test `/api/ping` and `tools/list`.
