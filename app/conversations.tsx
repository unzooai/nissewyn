"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  LoaderCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Repeat,
  ShieldAlert,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TaskItem, TaskSchedule, Weekday } from "./types";
import { dateLocale, t } from "./i18n";
import type { ApprovalDecision } from "./lib/provider";
import type { RuntimeActivity, RuntimeThread, RuntimeTurn } from "./lib/runtime-tasks";
import {
  activityLine,
  activitySummary,
  conversationExamples,
  conversationStatus,
  conversationStatusLabel,
  decisionLabel,
  inlinePieces,
  intentLine,
  pendingQuestions,
  replyBlocks,
  riskLabel,
  riskTone,
  sortConversations,
  turnLive,
} from "./lib/conversation";

const weekdays: Weekday[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const maxRequest = 8000;

export type ConversationsProps = {
  tasks: TaskItem[];
  selectedId: string | null;
  onSelect: (taskId: string | null) => void;
  /** 每变一次就开一段新对话（顶栏的“新建”）。 */
  newNonce: number;
  onStart: (request: string) => Promise<string | null>;
  onFollowUp: (taskId: string, text: string) => Promise<void>;
  onStop: (taskId: string) => Promise<void>;
  onRename: (taskId: string, title: string) => void;
  onDelete: (taskId: string) => void;
  onSchedule: (taskId: string, schedule: TaskSchedule, time: string, day: Weekday) => void;
  onOpenOutput: (taskId: string, path: string) => void;
  onRevealFolder?: (path: string) => void;
  onDecide: (sessionId: string, requestId: string, decision: ApprovalDecision) => Promise<void>;
  loadThread: (taskId: string) => Promise<RuntimeThread>;
  scheduleLabel: (task: TaskItem) => string;
  /** 智能体还没准备好时的提示（没装、没登录）。 */
  notice?: ReactNode;
  agentName?: string;
};

export function Conversations(props: ConversationsProps) {
  const { tasks, selectedId, onSelect } = props;
  const sorted = useMemo(() => sortConversations(tasks), [tasks]);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;

  return (
    <section className={`conversations${selected ? " has-selection" : ""}`} aria-label={t("对话")}>
      <aside className="conversation-list" aria-label={t("对话列表")}>
        <button className="conversation-new" type="button" onClick={() => onSelect(null)}>
          <MessageSquarePlus size={16} aria-hidden="true" />
          {t("新对话")}
        </button>
        {sorted.length === 0 ? (
          <p className="conversation-list-empty">{t("还没有对话。")}</p>
        ) : (
          <ul>
            {sorted.map((task) => {
              const status = conversationStatus(task);
              const latest = task.runs?.[0];
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    className={task.id === selectedId ? "active" : ""}
                    aria-current={task.id === selectedId ? "true" : undefined}
                    onClick={() => onSelect(task.id)}
                  >
                    <span className={`conversation-dot is-${status}`} aria-hidden="true" />
                    <span className="conversation-list-copy">
                      <strong>{task.title}</strong>
                      <small>
                        {conversationStatusLabel(status)}
                        {latest?.startedAt ? ` · ${shortTime(latest.startedAt)}` : ""}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="conversation-main">
        {selected ? (
          <ConversationThread key={selected.id} {...props} task={selected} />
        ) : (
          <NewConversation {...props} />
        )}
      </div>
    </section>
  );
}

function shortTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const today = new Date();
  const sameDay = at.toDateString() === today.toDateString();
  return sameDay
    ? at.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false })
    : at.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}

// ---- a new conversation -------------------------------------------------

function NewConversation({ onStart, onSelect, newNonce, notice, agentName }: ConversationsProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, [newNonce]);

  async function send() {
    const request = text.trim();
    if (!request || busy) {
      if (!request) setError(t("写下你想让智能体做什么"));
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await onStart(request);
      if (id) {
        setText("");
        onSelect(id);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="conversation-start">
      <h2>{t("想让智能体做什么？")}</h2>
      <p>
        {agentName
          ? t("{agent} 会用这台电脑上的终端和浏览器去做，有风险的操作会先问你。", { agent: agentName })
          : t("智能体会用这台电脑上的终端和浏览器去做，有风险的操作会先问你。")}
      </p>
      {notice}
      <Composer
        value={text}
        onChange={(value) => {
          setText(value);
          if (error) setError(null);
        }}
        onSend={send}
        busy={busy}
        inputRef={input}
        placeholder={t("比如：打开我们官网，检查每个页面有没有失效的链接，整理成一张表")}
        large
      />
      {error && (
        <p className="conversation-error" role="alert">
          {error}
        </p>
      )}
      <div className="conversation-examples" aria-label={t("示例")}>
        {conversationExamples().map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setText(example);
              input.current?.focus();
            }}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  running,
  inputRef,
  placeholder,
  large,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  busy?: boolean;
  running?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  large?: boolean;
}) {
  return (
    <div className={`conversation-composer${large ? " is-large" : ""}`}>
      <textarea
        ref={inputRef}
        value={value}
        maxLength={maxRequest}
        rows={large ? 4 : 2}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // 回车发送，Shift + 回车换行；输入法正在选字时的回车不算。
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <div className="conversation-composer-actions">
        <small>{t("回车发送，Shift + 回车换行")}</small>
        {running && onStop ? (
          <button className="conversation-stop" type="button" onClick={onStop} aria-label={t("停下")} title={t("停下")}>
            <Square size={14} aria-hidden="true" />
            {t("停下")}
          </button>
        ) : (
          <button
            className="conversation-send"
            type="button"
            onClick={onSend}
            disabled={busy}
            aria-label={t("发送")}
            title={t("发送")}
          >
            {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <ArrowUp size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- one conversation ---------------------------------------------------

function ConversationThread(props: ConversationsProps & { task: TaskItem }) {
  const { task, loadThread, onFollowUp, onStop, onSelect } = props;
  const [thread, setThread] = useState<RuntimeThread | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);

  const live = thread?.turns.some(turnLive) ?? false;
  const running = live || task.status === "运行中";
  // 列表那边看到的变化（新的一轮、状态变了）也要重新读一次。
  const signature = `${task.runs?.length ?? 0}:${task.runs?.[0]?.id ?? ""}:${task.runs?.[0]?.status ?? ""}:${task.status}`;

  useEffect(() => {
    let alive = true;
    const load = () =>
      loadThread(task.id).then(
        (value) => {
          if (!alive) return;
          setThread(value);
          setLoadError(null);
        },
        (error: unknown) => {
          if (alive) setLoadError(error instanceof Error ? error.message : String(error));
        },
      );
    void load();
    const timer = running ? window.setInterval(() => void load(), 1000) : undefined;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [task.id, loadThread, running, signature]);

  // 发出去的话出现在对话里了，就不再单独显示。
  useEffect(() => {
    if (sending && thread?.turns.some((turn) => turn.prompt === sending)) setSending(null);
  }, [thread, sending]);

  // 新内容来了就跟到底，除非人往上翻了。
  useEffect(() => {
    const box = scroller.current;
    if (box && stick.current) box.scrollTop = box.scrollHeight;
  }, [thread, sending]);

  async function send() {
    const message = text.trim();
    if (!message) {
      input.current?.focus();
      return;
    }
    if (running) {
      setSendError(t("它还在做这一轮。等它做完再发，或者先停下。"));
      return;
    }
    setSendError(null);
    setSending(message);
    setText("");
    stick.current = true;
    try {
      await onFollowUp(task.id, message);
    } catch (error) {
      setSending(null);
      setText(message);
      setSendError(t("没发出去：{message}", { message: error instanceof Error ? error.message : String(error) }));
    }
  }

  const turns = thread?.turns ?? [];
  return (
    <div className="conversation-thread">
      <ThreadHeader {...props} thread={thread} onBack={() => onSelect(null)} />
      <div
        className="conversation-scroll"
        ref={scroller}
        onScroll={(event) => {
          const box = event.currentTarget;
          stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
        }}
      >
        {loadError && !thread && (
          <p className="conversation-error" role="alert">
            {t("读不到这段对话：{message}", { message: loadError })}
          </p>
        )}
        {!thread && !loadError && (
          <p className="conversation-loading">
            <LoaderCircle size={16} className="spin" aria-hidden="true" /> {t("正在读取对话")}
          </p>
        )}
        {thread && turns.length === 0 && !sending && (
          <div className="conversation-turn">
            <UserMessage text={task.description || task.title} note={props.scheduleLabel(task)} />
            <p className="conversation-quiet">{t("还没有运行过。")}</p>
          </div>
        )}
        {turns.map((turn, index) => (
          <Turn key={turn.id} {...props} turn={turn} first={index === 0} />
        ))}
        {sending && (
          <div className="conversation-turn">
            <UserMessage text={sending} />
            <p className="conversation-working">
              <LoaderCircle size={15} className="spin" aria-hidden="true" /> {t("正在交给智能体")}
            </p>
          </div>
        )}
      </div>
      <div className="conversation-footer">
        {sendError && (
          <p className="conversation-error" role="alert">
            {sendError}
          </p>
        )}
        <Composer
          value={text}
          onChange={setText}
          onSend={send}
          onStop={() => void onStop(task.id)}
          running={running && !sending}
          busy={Boolean(sending)}
          inputRef={input}
          placeholder={running ? t("它在做的时候也可以先写下一句，做完再发") : t("接着说：追问、纠正，或者让它继续")}
        />
      </div>
    </div>
  );
}

function ThreadHeader({
  task,
  thread,
  onBack,
  onRename,
  onDelete,
  onSchedule,
  onRevealFolder,
  scheduleLabel,
}: ConversationsProps & { task: TaskItem; thread: RuntimeThread | null; onBack: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [menu, setMenu] = useState<null | "repeat" | "more">(null);
  const [schedule, setSchedule] = useState<TaskSchedule>(task.schedule ?? "仅运行一次");
  const [time, setTime] = useState(task.scheduleTime ?? "09:00");
  const [day, setDay] = useState<Weekday>(task.scheduleDay ?? "周一");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const folder = thread?.workdir ?? thread?.turns.at(-1)?.workdir ?? null;
  const repeating = task.schedule && task.schedule !== "仅运行一次";

  useEffect(() => setTitle(task.title), [task.title]);

  function saveTitle() {
    const next = title.trim();
    setRenaming(false);
    if (next && next !== task.title) onRename(task.id, next);
    else setTitle(task.title);
  }

  return (
    <header className="conversation-header">
      <button className="conversation-back" type="button" onClick={onBack} aria-label={t("返回对话列表")}>
        <ArrowLeft size={16} aria-hidden="true" />
      </button>
      {renaming ? (
        <input
          className="conversation-title-input"
          value={title}
          autoFocus
          maxLength={120}
          aria-label={t("对话名称")}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveTitle();
            if (event.key === "Escape") {
              setTitle(task.title);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <button className="conversation-title" type="button" onClick={() => setRenaming(true)} title={t("点击改名")}>
          {task.title}
        </button>
      )}
      <div className="conversation-header-actions">
        {folder && onRevealFolder && (
          <button type="button" onClick={() => onRevealFolder(folder)} title={folder}>
            <FolderOpen size={15} aria-hidden="true" />
            <span>{t("文件夹")}</span>
          </button>
        )}
        <button
          type="button"
          className={repeating ? "is-on" : ""}
          aria-expanded={menu === "repeat"}
          onClick={() => setMenu(menu === "repeat" ? null : "repeat")}
        >
          <Repeat size={15} aria-hidden="true" />
          <span>{repeating ? scheduleLabel(task) : t("重复")}</span>
        </button>
        <button
          type="button"
          aria-label={t("更多")}
          aria-expanded={menu === "more"}
          onClick={() => setMenu(menu === "more" ? null : "more")}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </div>

      {menu === "repeat" && (
        <div className="conversation-popover" role="dialog" aria-label={t("重复运行")}>
          <p>{t("按时把第一句需求再交给智能体做一次，结果接在这段对话后面。")}</p>
          <div className="conversation-segmented" role="radiogroup" aria-label={t("运行频率")}>
            {(["仅运行一次", "每天", "每周"] as TaskSchedule[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={schedule === option}
                className={schedule === option ? "active" : ""}
                onClick={() => setSchedule(option)}
              >
                {option === "仅运行一次" ? t("不重复") : t(option)}
              </button>
            ))}
          </div>
          {schedule !== "仅运行一次" && (
            <div className="conversation-popover-row">
              {schedule === "每周" && (
                <select value={day} aria-label={t("星期")} onChange={(event) => setDay(event.target.value as Weekday)}>
                  {weekdays.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {t(weekday)}
                    </option>
                  ))}
                </select>
              )}
              <input type="time" value={time} aria-label={t("时间")} onChange={(event) => setTime(event.target.value || "09:00")} />
            </div>
          )}
          <footer>
            <button type="button" onClick={() => setMenu(null)}>
              {t("取消")}
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                onSchedule(task.id, schedule, time, day);
                setMenu(null);
              }}
            >
              {t("保存")}
            </button>
          </footer>
        </div>
      )}

      {menu === "more" && (
        <div className="conversation-popover is-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setRenaming(true); setMenu(null); }}>
            {t("改名")}
          </button>
          {confirmDelete ? (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                setMenu(null);
                onDelete(task.id);
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t("确定删除这段对话")}
            </button>
          ) : (
            <button type="button" role="menuitem" className="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden="true" />
              {t("删除")}
            </button>
          )}
        </div>
      )}
    </header>
  );
}

function UserMessage({ text, note }: { text: string; note?: string }) {
  return (
    <div className="conversation-user">
      {note && (
        <small>
          <Clock3 size={12} aria-hidden="true" /> {note}
        </small>
      )}
      <p>{text}</p>
    </div>
  );
}

function Turn({
  task,
  turn,
  first,
  onDecide,
  onOpenOutput,
  onFollowUp,
}: ConversationsProps & { task: TaskItem; turn: RuntimeTurn; first: boolean }) {
  const live = turnLive(turn);
  const questions = pendingQuestions(turn);
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? (live || questions.length > 0);
  const scheduled = turn.trigger === "schedule";
  const prompt = turn.prompt ?? (first ? task.description : "");
  const reply = turn.reply?.trim() || (turn.state === "succeeded" ? turn.summary?.trim() : "") || "";

  return (
    <div className="conversation-turn">
      {prompt && <UserMessage text={prompt} note={scheduled ? t("定时运行") : undefined} />}
      {turn.continued === false && (
        <p className="conversation-quiet">{t("上一段对话接不上了，这一句开始了新的对话。")}</p>
      )}

      {turn.activity.length > 0 && (
        <div className={`conversation-activity${expanded ? " is-open" : ""}`}>
          <button type="button" className="conversation-activity-toggle" aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
            {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            {activitySummary(turn.activity)}
          </button>
          {expanded && (
            <ol>
              {turn.activity.map((item, index) => (
                <ActivityRow key={`${item.call_id ?? item.request_id ?? ""}-${index}`} item={item} />
              ))}
            </ol>
          )}
        </div>
      )}

      {questions.map((item) => (
        <Question
          key={item.request_id}
          item={item}
          onDecide={(decision) =>
            turn.session_id ? onDecide(turn.session_id, item.request_id!, decision) : Promise.resolve()
          }
        />
      ))}

      {reply && <Reply text={reply} />}

      {live && !reply && questions.length === 0 && (
        <p className="conversation-working">
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
          {turn.activity.length ? t("正在做") : t("正在思考")}
        </p>
      )}

      {(turn.outputs?.length ?? 0) > 0 && (
        <div className="conversation-files" aria-label={t("产出的文件")}>
          {turn.outputs!.slice(0, 8).map((output) => (
            <button key={output.path} type="button" onClick={() => onOpenOutput(task.id, output.path)} title={output.path}>
              <FileText size={15} aria-hidden="true" />
              <span>{output.path}</span>
              <small>{formatSize(output.size)}</small>
            </button>
          ))}
          {turn.outputs!.length > 8 && (
            <small>{t("还有 {count} 个文件", { count: turn.outputs!.length - 8 })}</small>
          )}
        </div>
      )}

      {(turn.state === "failed" || turn.state === "interrupted") && (
        <div className="conversation-failed" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{turnError(turn)}</span>
          {prompt && (
            <button type="button" onClick={() => void onFollowUp(task.id, prompt)}>
              {t("重试")}
            </button>
          )}
        </div>
      )}
      {turn.state === "cancelled" && <p className="conversation-quiet">{t("已停下。")}</p>}
    </div>
  );
}

function turnError(turn: RuntimeTurn): string {
  switch (turn.error_code) {
    case "idle_timeout":
      return t("十分钟没有任何进展，已经停下。");
    case "session_lost":
      return t("智能体的进程不见了。");
    case "service_restarted":
      return t("后台服务重启过，这一轮没做完。");
    case "start_failed":
      return t("智能体没能启动：{message}", { message: turn.error ?? "" });
    default:
      return turn.error ? t("出错了：{message}", { message: turn.error }) : t("这一轮没有做完。");
  }
}

function ActivityRow({ item }: { item: RuntimeActivity }) {
  const label = decisionLabel(item);
  const tone = riskTone(item.risk);
  return (
    <li className={`is-${tone}${item.decision === "deny" ? " is-denied" : ""}${item.ok === false ? " is-failed" : ""}`}>
      <span className="conversation-activity-line">{activityLine(item)}</span>
      {label && <em className={item.decision === "deny" ? "is-denied" : item.decided_by === "autonomy" ? "is-auto" : ""}>{label}</em>}
    </li>
  );
}

function Question({ item, onDecide }: { item: RuntimeActivity; onDecide: (decision: ApprovalDecision) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = riskTone(item.risk);
  const canRemember = item.verb === "run";

  async function answer(decision: ApprovalDecision) {
    setBusy(true);
    setError(null);
    try {
      await onDecide(decision);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  }

  return (
    <div className={`conversation-question is-${tone}`} role="group" aria-label={t("等你确认")}>
      <header>
        <ShieldAlert size={16} aria-hidden="true" />
        <strong>{intentLine(item)}</strong>
        <em>{riskLabel(item.risk)}</em>
      </header>
      {item.target && <code>{item.target}</code>}
      <footer>
        <button className="primary" type="button" disabled={busy} onClick={() => void answer({ kind: "approve" })}>
          <Check size={14} aria-hidden="true" />
          {t("允许")}
        </button>
        {canRemember && (
          <button type="button" disabled={busy} onClick={() => void answer({ kind: "approve", remember: true })}>
            {t("总是允许这条命令")}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void answer({ kind: "reject", reason: t("在对话里拒绝") })}>
          <X size={14} aria-hidden="true" />
          {t("拒绝")}
        </button>
      </footer>
      {error && (
        <p className="conversation-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Reply({ text }: { text: string }) {
  const blocks = useMemo(() => replyBlocks(text), [text]);
  return (
    <div className="conversation-reply">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "code":
            return (
              <pre key={index}>
                <code>{block.text}</code>
              </pre>
            );
          case "heading":
            return (
              <h3 key={index}>
                <Inline text={block.text} />
              </h3>
            );
          case "list": {
            const items = block.items.map((item, at) => (
              <li key={at}>
                <Inline text={item} />
              </li>
            ));
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
          default:
            return (
              <p key={index}>
                <Inline text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlinePieces(text).map((piece, index) =>
        piece.kind === "code" ? (
          <code key={index}>{piece.text}</code>
        ) : piece.kind === "strong" ? (
          <strong key={index}>{piece.text}</strong>
        ) : (
          <Fragment key={index}>{piece.text}</Fragment>
        ),
      )}
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
