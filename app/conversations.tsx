"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  LoaderCircle,
  MessageSquarePlus,
  Monitor,
  MoreHorizontal,
  Repeat,
  ShieldAlert,
  Square,
  Trash2,
  ExternalLink,
  Hand,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TaskItem, TaskSchedule, Weekday } from "./types";
import { dateLocale, t } from "./i18n";
import type { ApprovalDecision, TabView, TerminalScreen } from "./lib/provider";
import { ComputerPanel } from "./computer-panel";
import type { RuntimeActivity, RuntimeHandover, RuntimeHelper, RuntimeThread, RuntimeTurn } from "./lib/runtime-tasks";
import {
  activityLine,
  activitySummary,
  computerOf,
  conversationExamples,
  conversationStatus,
  conversationStatusLabel,
  decisionLabel,
  helperName,
  helperQuestions,
  helperStateLabel,
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
  /** 智能体的电脑：它用过的终端画面、网页截图，以及去真正的窗口里接手。 */
  loadScreen: (sessionId: string, fromLine?: number) => Promise<TerminalScreen>;
  sendKeys: (sessionId: string, input: string) => Promise<void>;
  loadTab: (tabId: string) => Promise<TabView>;
  onOpenTerminal: (sessionId: string) => Promise<void>;
  onShowTab: (tabId: string) => Promise<void>;
  /** 人做完了智能体请他接手的事（或者做不了）。 */
  onHandover: (sessionId: string, handoverId: string, done: boolean, note?: string) => Promise<void>;
  /** 让智能体把这段对话做过的事写成技能。 */
  onSaveSkill: (taskId: string) => Promise<void>;
  /** 打开设置里的技能。 */
  onOpenSkills: () => void;
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
  /** 人开关过“电脑”面板就照人的来；null 是还没动过。 */
  const [computerOpen, setComputerOpen] = useState<boolean | null>(null);

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
  const computer = computerOf(turns);
  const hasComputer = computer.terminals.length + computer.tabs.length > 0;
  // 没人动过开关时：智能体一用终端或浏览器就打开，让人看得见它在做什么；
  // 打开了就留着，不在这一轮结束时突然收起。
  const autoOpen = computerOpen === null && hasComputer && live;
  useEffect(() => {
    if (autoOpen) setComputerOpen(true);
  }, [autoOpen]);
  const showComputer = computerOpen ?? autoOpen;
  return (
    <div className="conversation-thread">
      <ThreadHeader
        {...props}
        thread={thread}
        onBack={() => onSelect(null)}
        computerOpen={showComputer}
        computerCount={computer.terminals.length + computer.tabs.length}
        onToggleComputer={() => setComputerOpen(!showComputer)}
        canSaveSkill={!running && turns.some((turn) => turn.state === "succeeded")}
      />
      <div className={`conversation-columns${showComputer ? " with-computer" : ""}`}>
      <div className="conversation-column">
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
      {showComputer && (
        <ComputerPanel
          terminals={computer.terminals}
          tabs={computer.tabs}
          live={live}
          loadScreen={props.loadScreen}
          sendKeys={props.sendKeys}
          loadTab={props.loadTab}
          onOpenTerminal={props.onOpenTerminal}
          onShowTab={props.onShowTab}
          onClose={() => setComputerOpen(false)}
        />
      )}
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
  computerOpen,
  computerCount,
  onToggleComputer,
  canSaveSkill,
  onSaveSkill,
}: ConversationsProps & {
  task: TaskItem;
  thread: RuntimeThread | null;
  onBack: () => void;
  computerOpen: boolean;
  computerCount: number;
  onToggleComputer: () => void;
  canSaveSkill: boolean;
}) {
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
          className={computerOpen ? "is-on" : ""}
          aria-pressed={computerOpen}
          onClick={onToggleComputer}
          title={t("智能体的电脑")}
        >
          <Monitor size={15} aria-hidden="true" />
          <span>{computerCount ? t("电脑 · {count}", { count: computerCount }) : t("电脑")}</span>
        </button>
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
          <button
            type="button"
            role="menuitem"
            disabled={!canSaveSkill}
            title={canSaveSkill ? undefined : t("等这段对话做成一次、而且没有在做的时候才能存")}
            onClick={() => {
              setMenu(null);
              void onSaveSkill(task.id);
            }}
          >
            <BookOpen size={14} aria-hidden="true" />
            {t("存为技能")}
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
  onOpenSkills,
  onHandover,
  onShowTab,
}: ConversationsProps & { task: TaskItem; turn: RuntimeTurn; first: boolean }) {
  const live = turnLive(turn);
  const questions = pendingQuestions(turn);
  const handovers = turn.handovers ?? [];
  const handingOver = live && handovers.some((handover) => handover.state === "waiting");
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? (live || questions.length > 0);
  const scheduled = turn.trigger === "schedule";
  const savingSkill = turn.purpose === "save_skill";
  // 存为技能那一轮，交给智能体的是一大段说明；对话里只说做了什么。
  const prompt = savingSkill ? t("把这段对话存为技能") : (turn.prompt ?? (first ? task.description : ""));
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

      {handovers.map((handover) => (
        <HandoverCard
          key={handover.id}
          handover={handover}
          live={live}
          onShowTab={onShowTab}
          onAnswer={(done, note) =>
            turn.session_id ? onHandover(turn.session_id, handover.id, done, note) : Promise.resolve()
          }
        />
      ))}

      {(turn.helpers ?? []).map((helper) => (
        <HelperCard key={helper.session_id} turn={turn} helper={helper} onDecide={onDecide} />
      ))}

      {reply && <Reply text={reply} />}

      {savingSkill && (turn.saved_skills?.length ?? 0) > 0 && (
        <div className="conversation-skill-saved" role="status">
          <BookOpen size={15} aria-hidden="true" />
          <span>{t("已存为技能：{names}。以后一句话就能让智能体照着做。", { names: turn.saved_skills!.join(", ") })}</span>
          <button type="button" onClick={onOpenSkills}>
            {t("查看技能")}
          </button>
        </div>
      )}
      {savingSkill && turn.skill_error && (
        <div className="conversation-failed" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{t("没能存成技能：{message}", { message: turn.skill_error })}</span>
        </div>
      )}

      {live && !reply && questions.length === 0 && !handingOver && (
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

/** 智能体交出去的一段活：谁在做、做到哪、要你确认什么、它怎么回的。 */
function HelperCard({
  turn,
  helper,
  onDecide,
}: {
  turn: RuntimeTurn;
  helper: RuntimeHelper;
  onDecide: ConversationsProps["onDecide"];
}) {
  const questions = helperQuestions(turn, helper);
  const [open, setOpen] = useState(false);
  const busy = helper.state === "working" || helper.state === "waiting";
  const name = helperName(helper.agent);
  const task = helper.prompt.length > 240 ? `${helper.prompt.slice(0, 240)}…` : helper.prompt;
  const reply = helper.reply?.trim() ?? "";
  const activity = helper.activity ?? [];
  const hasMore = activity.length > 0 || reply.length > 0;

  return (
    <section className={`conversation-helper is-${helper.state}`} aria-label={t("帮手 {name}", { name })}>
      <header>
        <Bot size={15} aria-hidden="true" />
        <strong>{name}</strong>
        <span className="conversation-helper-state">
          {busy && <LoaderCircle size={12} className="spin" aria-hidden="true" />}
          {helperStateLabel(helper.state)}
        </span>
      </header>
      <p className="conversation-helper-task">{task}</p>
      {hasMore && (
        <div className={`conversation-activity${open ? " is-open" : ""}`}>
          <button type="button" className="conversation-activity-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            {activity.length > 0 ? activitySummary(activity) : t("它的回复")}
          </button>
          {open && activity.length > 0 && (
            <ol>
              {activity.map((item, index) => (
                <ActivityRow key={`${item.call_id ?? item.request_id ?? ""}-${index}`} item={item} />
              ))}
            </ol>
          )}
        </div>
      )}
      {open && reply && <Reply text={reply} />}
      {questions.map((item) => (
        <Question
          key={item.request_id}
          item={item}
          onDecide={(decision) => onDecide(helper.session_id, item.request_id!, decision)}
        />
      ))}
      {helper.state === "failed" && helper.error && <p className="conversation-helper-error">{helper.error}</p>}
    </section>
  );
}

/**
 * 智能体请你亲自做的事：登录、验证码、手机上确认。它在等；你在真的浏览器或
 * 终端里做完，点“好了，继续”。密码和验证码不经过对话。
 */
function HandoverCard({
  handover,
  live,
  onShowTab,
  onAnswer,
}: {
  handover: RuntimeHandover;
  live: boolean;
  onShowTab: ConversationsProps["onShowTab"];
  onAnswer: (done: boolean, note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = handover.state === "waiting" && live;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!waiting) {
    const label =
      handover.state === "done"
        ? t("你接手做完了：{what}", { what: handover.what })
        : handover.state === "cannot"
          ? t("你说做不了：{what}", { what: handover.what })
          : t("它请你接手过：{what}", { what: handover.what });
    return (
      <p className="conversation-quiet conversation-handover-done">
        <Hand size={14} aria-hidden="true" /> {label}
        {handover.note ? ` (${handover.note})` : ""}
      </p>
    );
  }

  return (
    <section className="conversation-handover" role="group" aria-label={t("它在等你接手")}>
      <header>
        <Hand size={16} aria-hidden="true" />
        <strong>{t("它在等你接手")}</strong>
      </header>
      <p>{handover.what}</p>
      <small>{t("在浏览器或终端里亲自做完，再点“好了，继续”。密码和验证码不要发在对话里。")}</small>
      <input
        type="text"
        value={note}
        maxLength={500}
        placeholder={t("想告诉它什么（可不填）")}
        onChange={(event) => setNote(event.target.value)}
        disabled={busy}
      />
      <footer>
        {handover.tab_id && (
          <button type="button" disabled={busy} onClick={() => void run(() => onShowTab(handover.tab_id!))}>
            <ExternalLink size={14} aria-hidden="true" />
            {t("在浏览器里打开")}
          </button>
        )}
        <button className="primary" type="button" disabled={busy} onClick={() => void run(() => onAnswer(true, note))}>
          <Check size={14} aria-hidden="true" />
          {t("好了，继续")}
        </button>
        <button type="button" disabled={busy} onClick={() => void run(() => onAnswer(false, note))}>
          <X size={14} aria-hidden="true" />
          {t("做不了")}
        </button>
      </footer>
      {error && (
        <p className="conversation-error" role="alert">
          {error}
        </p>
      )}
    </section>
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
