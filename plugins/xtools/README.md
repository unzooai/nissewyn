# Xtools

An Unzoo One plugin that runs one X account for growth, for any niche.

- **Learns the account.** Reads the profile and recent posts: voice, what performed, when.
- **Proposes a playbook.** Content pillars, keywords, accounts to watch. You can edit all of it.
- **Posts.** Originals in the account's voice, spread over the hours its audience is awake. Formats: single, thread, long post. Optionally links to what you promote.
- **Front row.** When a watched account posts, it replies early with something concrete.
- **Readers first.** Answers questions in mentions and likes thanks.
- **Sessions.** Acts in bursts the way a person checks X, at a person's pace, within daily caps. New accounts warm up gradually.
- **Learns weekly.** Pillars that earn more engagement get written more. Every change appears in the weekly report.

Design and reasoning: [docs/research/plugins/x-growth.md](../../docs/research/plugins/x-growth.md).

## Use it in Unzoo One

1. **Add the plugin.** Go to **Plugins › Add** and enter this folder.
2. **Set it up.** In **Settings**:
   - **X account:** the browser identity signed in to X.
   - **Writer:** an agent and model.
   - **Your audience's time zones.**
   - **Automation:** each kind is `auto`, `approve` or `off`.
3. **Turn it on.** On its page, say who you are, who you want to reach and your goal. It reads the account and writes the playbook.

Automation defaults to `auto`. X's automation rules do not allow automated replies, follows or likes driven by keyword search or done in bulk. If the account is limited or suspended, that is on the account owner. Anything can be switched to `approve`, so it waits in the queue until you approve it.

## How it works

| Part | File |
|---|---|
| X pages: read timelines, mentions, search and profiles; post, thread, reply, quote, like, follow; account health | `xt/x.py` |
| The Unzoo browser: one tab of its own in the bound profile | `xt/browser.py` |
| Writing with the bound agent's CLI (tools off, text only) | `xt/writer.py` |
| Learning the account, the playbook | `xt/playbook.py` |
| Daily work: plan, radar, front row, mentions, quotes, follows, sessions, measure, learn | `xt/engine.py` |
| When things run | `xt/scheduler.py` |
| Control page and its API | `server.py`, `web/index.html` |
| Tools for agents in conversations | `mcp_server.py` |

Data lives in one SQLite file in the plugin's data folder and stays on this computer. Standard-library Python only.

## Run it on its own

```
XTOOLS_PROFILE=<unzoo profile id> python server.py    # http://127.0.0.1:8792/
```

Set `XTOOLS_NO_SCHEDULER=1` to get only the page, with nothing running on a clock.
