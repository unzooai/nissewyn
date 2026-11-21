"""Writing with the agent the person picked for the "writer" role in Unzoo One.

Text only: the agent's own tools are off (no files, no web, no commands); the prompt
goes on stdin and the answer is the text. It runs on the person's own CLI and plan."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time

from . import env

IS_WIN = sys.platform == 'win32'
_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if IS_WIN else 0
_TIMEOUT = 300
_ONE_AT_A_TIME = threading.Lock()


class WriterError(RuntimeError):
    pass


def _which(name):
    if IS_WIN:
        return shutil.which(name + '.cmd') or shutil.which(name + '.exe') or shutil.which(name)
    return shutil.which(name)


def _workdir():
    d = os.path.join(env.data_dir(), 'writer')
    os.makedirs(d, exist_ok=True)
    return d


def agent():
    w = env.role('writer')
    return w if w.get('agent') else {'agent': 'claude-code', 'model': 'sonnet'}


def _command(w, out_file):
    name, model, effort = w.get('agent'), (w.get('model') or '').strip(), (w.get('effort') or '').strip()
    if name == 'claude-code':
        exe = _which('claude')
        if not exe:
            raise WriterError('没找到 Claude Code CLI')
        argv = [exe, '-p', '--output-format', 'text', '--strict-mcp-config',
                '--disallowedTools', 'Bash,PowerShell,Edit,Write,MultiEdit,NotebookEdit,WebFetch,WebSearch,Task']
        return argv + (['--model', model] if model else [])
    if name == 'codex-cli':
        exe = _which('codex')
        if not exe:
            raise WriterError('没找到 Codex CLI')
        argv = [exe, 'exec', '--skip-git-repo-check', '-s', 'read-only', '--color', 'never',
                '-c', 'mcp_servers={}', '-o', out_file]
        if model:
            argv += ['-m', model]
        if effort:
            argv += ['-c', 'model_reasoning_effort="%s"' % effort]
        return argv + ['-']
    if name == 'opencode':
        exe = _which('opencode')
        if not exe:
            raise WriterError('没找到 OpenCode CLI')
        return [exe, 'run'] + (['-m', model] if model else [])
    if name == 'agy':
        exe = _which('agy')
        if not exe:
            raise WriterError('没找到 Antigravity CLI')
        argv = [exe, '-p']
        if model:
            argv += ['--model', model]
        if effort:
            argv += ['--effort', effort]
        return argv
    raise WriterError('不支持的智能体:%s' % name)


RULES = """写作要求(每次都遵守):
- 像这个账号本人写的:用下面给的样例的语气、长度、用词;不像 AI。
- 不用套话和假洞察:不是A而是B、说白了、本质上、归根结底、值得注意的是、让我们、总之;不用口号式结尾。
- 写具体的东西:经历、数字、例子、做法。不编造经历、数据和引用。
- 不加 hashtag,除非样例里本人常用。不加表情符号,除非本人常用。
- 只输出要发的正文本身,不要解释、标题、引号或"以下是"。"""


def write(prompt, redlines=None):
    """The agent's answer to the prompt, as plain text."""
    w = agent()
    rules = RULES
    if redlines:
        rules += '\n- 不碰这些话题:' + '、'.join(redlines) + '。'
    with _ONE_AT_A_TIME:
        fd, out_file = tempfile.mkstemp(prefix='xtools-', suffix='.txt', dir=_workdir())
        os.close(fd)
        try:
            argv = _command(w, out_file)
            try:
                p = subprocess.run(argv, input=rules + '\n\n' + prompt, capture_output=True, text=True,
                                   encoding='utf-8', errors='replace', cwd=_workdir(), timeout=_TIMEOUT,
                                   creationflags=_NO_WINDOW)
            except subprocess.TimeoutExpired:
                raise WriterError('写稿超过 %d 秒' % _TIMEOUT)
            except OSError as e:
                raise WriterError('写稿的智能体没能启动:%s' % e)
            text = ''
            if w.get('agent') == 'codex-cli':
                try:
                    with open(out_file, encoding='utf-8', errors='replace') as f:
                        text = f.read()
                except OSError:
                    pass
            text = (text or p.stdout or '').strip()
            if p.returncode != 0 or not text:
                tail = ' | '.join((p.stderr or p.stdout or '').strip().splitlines()[-3:])
                raise WriterError('写稿失败(退出码 %s):%s' % (p.returncode, tail[:300]))
            return _clean(text)
        finally:
            try:
                os.remove(out_file)
            except OSError:
                pass


def _clean(text):
    text = text.strip()
    if len(text) > 1 and text[0] in '"“「' and text[-1] in '"”」':
        text = text[1:-1].strip()
    return text


def write_json(prompt, redlines=None):
    """Ask for JSON and parse it (the first {...} or [...] in the answer)."""
    text = write(prompt + '\n\n只输出 JSON,不要别的文字,不要代码块标记。', redlines)
    m = re.search(r'(\{.*\}|\[.*\])', text, re.S)
    if not m:
        raise WriterError('写稿的智能体没有给出 JSON:%s' % text[:200])
    try:
        return json.loads(m.group(1))
    except ValueError as e:
        raise WriterError('JSON 解析失败:%s' % e)


def weighted_len(text):
    """X's length: CJK, emoji and full-width characters count 2, a link counts 23."""
    text = re.sub(r'https?://\S+', 'x' * 23, text or '')
    n = 0
    for ch in text:
        o = ord(ch)
        n += 1 if (o < 0x1100 or 0x2000 <= o <= 0x200D or 0x2010 <= o <= 0x201F or 0x2032 <= o <= 0x2037) else 2
    return n


def split_thread(text, limit=280):
    """Parts separated by blank-line markers like '1/' or '---'; long parts cut at sentence ends."""
    chunks = [c.strip() for c in re.split(r'\n\s*(?:---+|\d+/\d*)\s*\n', text) if c.strip()]
    out = []
    for c in chunks or [text]:
        while weighted_len(c) > limit:
            cut = _cut_point(c, limit)
            out.append(c[:cut].strip())
            c = c[cut:].strip()
        if c:
            out.append(c)
    return out


def _cut_point(text, limit):
    best = 0
    for i, ch in enumerate(text):
        if weighted_len(text[:i + 1]) > limit:
            break
        if ch in '。！？.!?\n':
            best = i + 1
    if best:
        return best
    i = 0
    while i < len(text) and weighted_len(text[:i + 1]) <= limit:
        i += 1
    return i
