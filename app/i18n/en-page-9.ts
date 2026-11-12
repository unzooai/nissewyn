/** English for the conversation page and the autonomy setting. Keys: see ./index.ts. */
export const enPage9: Record<string, string> = {
  // Settings › agents › autonomy
  "关掉 Claude Code 自带的 Bash、PowerShell 和联网工具，命令只能经 Unzoo One 的终端执行，网页只能经 Unzoo 浏览器打开。目前只有 Claude Code 支持；其它智能体用自己的工具。哪些操作要先问你，由下面的自主程度决定。":
    "Turns off Claude Code's own Bash, PowerShell and web tools, so commands run only in the Unzoo One terminal and web pages open only in Unzoo Browser. Only Claude Code supports this for now; other agents use their own tools. What they ask you first is set by the autonomy level below.",
  "自主程度": "Autonomy",
  "智能体不问你就能做多少。删除、读取账号或密钥、花钱，任何一档都会先问你；下面的常设规则优先。":
    "How much the agent may do without asking. Deleting, reading accounts or secrets, and spending money are always asked about, at every level; standing rules below take precedence.",
  "自主程度已改为“{level}”": "Autonomy set to “{level}”",
  "还没有规则。": "No rules yet.",
  "谨慎": "Cautious",
  "放手": "Hands-off",
  "平衡": "Balanced",
  "只有看文件、看网页不问；改文件、运行命令、打开网页都先问你。":
    "Only looking at files and pages goes unasked; changing files, running commands and opening pages are asked first.",
  "除了删除、账号密钥和花钱，都不问；包括推送、上传、改工作文件夹以外的文件。":
    "Asks only about deleting, accounts and secrets, and money — pushing, uploading and editing files outside the work folder go ahead.",
  "看、在工作文件夹里改文件、运行普通命令、在它自己的浏览器里操作都不问；推送、上传、发请求、改工作文件夹以外的文件会问。":
    "Looking, editing files in the work folder, running ordinary commands and using its own browser go ahead; pushing, uploading, sending requests and editing files outside the work folder are asked.",

  // Navigation and page title
  "对话": "Conversations",
  "说一句话，智能体用这台电脑的终端和浏览器替你去做。":
    "Say what you need; the agent does it with this computer's terminal and browser.",

  // Conversation list
  "对话列表": "Conversation list",
  "还没有对话。": "No conversations yet.",
  "正在做": "Working",
  "出错了": "Failed",
  "定时": "Scheduled",
  "未开始": "Not started",

  // New conversation
  "想让智能体做什么？": "What should the agent do?",
  "{agent} 会用这台电脑上的终端和浏览器去做，有风险的操作会先问你。":
    "{agent} will use this computer's terminal and browser, and asks you before anything risky.",
  "智能体会用这台电脑上的终端和浏览器去做，有风险的操作会先问你。":
    "The agent will use this computer's terminal and browser, and asks you before anything risky.",
  "比如：打开我们官网，检查每个页面有没有失效的链接，整理成一张表":
    "For example: open our website, check every page for broken links and put them in a table",
  "示例": "Examples",
  "打开 news.ycombinator.com，把今天排名前 10 的文章整理成一份带链接的摘要":
    "Open news.ycombinator.com and write a summary of today's top 10 stories, with links",
  "把这个文件夹里的 CSV 合并成一张表，算出每个月的合计，存成 summary.xlsx":
    "Merge the CSV files in this folder into one table, add monthly totals and save it as summary.xlsx",
  "用 Python 写一个脚本，检查我列的这几个网址是否能打开，把结果写进 report.md":
    "Write a Python script that checks whether the URLs I list load, and put the results in report.md",
  "每天早上 9 点看一下这几个竞品网站的更新，有变化就告诉我":
    "Every morning at 9, check these competitors' websites and tell me what changed",
  "这台电脑上还没有可用的智能体": "No agent is ready on this computer",
  "Unzoo One 让智能体替你干活，需要先装一个，比如 Claude Code 或 Codex。装好后点“重新检查”。":
    "Unzoo One has an agent do the work, so install one first — Claude Code or Codex, for example. Then click “Check again”.",
  "查看智能体": "View agents",

  // Composer
  "回车发送，Shift + 回车换行": "Enter to send, Shift + Enter for a new line",
  "它还在做这一轮。等它做完再发，或者先停下。": "It's still working on this turn. Send when it's done, or stop it first.",
  "没发出去：{message}": "Not sent: {message}",
  "它在做的时候也可以先写下一句，做完再发": "You can write your next message while it works and send it when it's done",
  "接着说：追问、纠正，或者让它继续": "Reply: ask more, correct it, or tell it to continue",

  // Thread
  "读不到这段对话：{message}": "Could not load this conversation: {message}",
  "正在读取对话": "Loading the conversation",
  "还没有运行过。": "Hasn't run yet.",
  "正在交给智能体": "Handing it to the agent",
  "返回对话列表": "Back to conversations",
  "对话名称": "Conversation name",
  "点击改名": "Click to rename",
  "文件夹": "Folder",
  "重复": "Repeat",
  "更多": "More",
  "重复运行": "Repeat",
  "按时把第一句需求再交给智能体做一次，结果接在这段对话后面。":
    "On schedule, hands the first request to the agent again; the results are added to this conversation.",
  "不重复": "Don't repeat",
  "改名": "Rename",
  "确定删除这段对话": "Yes, delete this conversation",
  "定时运行": "Scheduled run",
  "上一段对话接不上了，这一句开始了新的对话。": "The earlier conversation couldn't be resumed, so this message started a new one.",
  "正在思考": "Thinking",
  "产出的文件": "Files it made",
  "还有 {count} 个文件": "{count} more files",
  "已停下。": "Stopped.",
  "十分钟没有任何进展，已经停下。": "No progress for ten minutes, so it was stopped.",
  "智能体的进程不见了。": "The agent's process disappeared.",
  "后台服务重启过，这一轮没做完。": "The background service restarted before this turn finished.",
  "智能体没能启动：{message}": "The agent couldn't start: {message}",
  "出错了：{message}": "Something went wrong: {message}",
  "这一轮没有做完。": "This turn didn't finish.",
  "它想运行一条命令": "It wants to run a command",
  "它想修改文件": "It wants to change a file",
  "它想删除文件": "It wants to delete a file",
  "它想打开一个终端": "It wants to open a terminal",
  "它想打开一个网页": "It wants to open a web page",
  "它想在网页上操作": "It wants to act on a web page",
  "它想下载文件": "It wants to download a file",
  "它想上传文件": "It wants to upload a file",
  "它想查看内容": "It wants to look at something",
  "它想使用 {tool}": "It wants to use {tool}",
  "新对话": "New conversation",
  "总是允许这条命令": "Always allow this command",
  "在对话里拒绝": "Declined in the conversation",

  // What the agent did
  "运行 {target}": "Run {target}",
  "运行了一条命令": "Ran a command",
  "查看 {target}": "Read {target}",
  "查看了文件": "Read a file",
  "搜索 {target}": "Search {target}",
  "搜索了一下": "Searched",
  "写入 {target}": "Write {target}",
  "改了文件": "Changed a file",
  "删除 {target}": "Delete {target}",
  "删除了文件": "Deleted a file",
  "打开了一个终端": "Opened a terminal",
  "查看终端输出": "Read the terminal output",
  "打开 {target}": "Open {target}",
  "打开了一个网页": "Opened a page",
  "查看网页内容": "Read the page",
  "在网页上点击": "Clicked on the page",
  "在网页上输入": "Typed on the page",
  "下载 {target}": "Download {target}",
  "下载了文件": "Downloaded a file",
  "上传 {target}": "Upload {target}",
  "上传了文件": "Uploaded a file",
  "更新了计划": "Updated its plan",
  "使用 {target}": "Use {target}",
  "使用工具 {tool}": "Use the {tool} tool",
  "规则拒绝": "Refused by rule",
  "自动": "Auto",
  "按规则": "By rule",
  "你批准了": "You allowed",
  "只读": "Read-only",
  "改动本机": "Changes this computer",
  "运行程序": "Runs a program",
  "对外发送": "Sends data out",
  "读取账号或密钥": "Reads accounts or secrets",
  "涉及付款": "Involves payment",
  "无法撤销": "Can't be undone",
  "未知操作": "Unknown action",
  "做了 {count} 件事，{denied} 件被拒绝": "{count} actions, {denied} declined",
  "做了 {count} 件事": "{count} actions",

  // Page actions
  "这段对话已经不在了": "This conversation no longer exists",
  "没能停下：{message}": "Couldn't stop it: {message}",
  "已删除对话“{title}”": "Deleted “{title}”",
  "不再重复运行": "No longer repeats",
  "已设为{schedule}自动运行": "Set to run {schedule}",
  "打不开文件夹：{message}": "Couldn't open the folder: {message}",

  // Settings › agents › browser profile, and the card on a new conversation
  "浏览器身份": "Browser profile",
  "智能体用哪个浏览器身份": "Which browser profile the agent uses",
  "智能体改用浏览器身份“{name}”": "The agent now browses as “{name}”",
  "智能体改用 Unzoo One 的专用身份": "The agent now uses its own Unzoo One profile",
  "Unzoo One 专用身份": "Unzoo One's own profile",
  "Unzoo One 专用身份（还没有建）": "Unzoo One's own profile (not created yet)",
  "{name}（已不在）": "{name} (no longer exists)",
  "智能体会用这个身份里已登录的账号。它只在自己新开的标签页里操作，不碰你开着的页面。":
    "The agent will use the accounts signed in to this profile. It works only in tabs it opens itself and leaves yours alone.",
  "升级 Unzoo": "Upgrade Unzoo",
  "读不到浏览器的情况：{error}": "Couldn't check the browser: {error}",
  "这台电脑没有装 Unzoo 浏览器，智能体打不开网页。": "Unzoo Browser isn't installed on this computer, so the agent can't open web pages.",
  "Unzoo 浏览器没有在运行。打开它后点“重新检查”。": "Unzoo Browser isn't running. Open it, then click “Check again”.",
  "Unzoo {plan} 版，身份 {used}/{max}。": "Unzoo {plan} plan, {used}/{max} profiles. ",
  "{plan}指定的身份已经不在了，换一个。": "{plan}The chosen profile no longer exists; pick another.",
  "{plan}智能体用你指定的身份上网。": "{plan}The agent browses in the profile you chose.",
  "{plan}智能体有自己的专用身份，和你的浏览器互不干扰。": "{plan}The agent has its own profile and stays out of your browsing.",
  "{plan}身份已用满，建不了智能体的专用身份。选一个现有身份给它用，或者升级 Unzoo。":
    "{plan}All profiles are in use, so the agent's own can't be created. Choose an existing profile for it, or upgrade Unzoo.",
  "智能体还没有浏览器身份": "The agent has no browser profile yet",
  "设置里指定的浏览器身份已经不在了。换一个，智能体才能打开网页。":
    "The browser profile chosen in Settings no longer exists. Choose another so the agent can open web pages.",
  "Unzoo {plan} 版的 {max} 个身份已经用满，建不了智能体的专用身份。可以选一个现有身份给它用（它会用里面已登录的账号），或者升级 Unzoo。不用浏览器的事照样能做。":
    "All {max} profiles of your Unzoo {plan} plan are in use, so the agent's own profile can't be created. Choose an existing profile for it (it will use the accounts signed in there), or upgrade Unzoo. Work that doesn't need a browser still runs.",
  "选一个身份": "Choose a profile",

  // The agent's computer
  "智能体的电脑": "Agent's computer",
  "实时": "Live",
  "收起": "Hide",
  "这段对话里智能体还没有用过终端或浏览器。它一用，就会出现在这里。":
    "The agent hasn't used a terminal or browser in this conversation yet. When it does, you'll see it here.",
  "它用过的终端和网页": "Terminals and pages it used",
  "终端 {n}": "Terminal {n}",
  "网页 {n}": "Page {n}",
  "网页": "Page",
  "读不到这个终端：{message}": "Couldn't read this terminal: {message}",
  "正在读取": "Loading",
  "终端画面": "Terminal screen",
  "（屏幕是空的）": "(the screen is empty)",
  "在终端里打开": "Open in terminal",
  "在终端窗口里可以直接输入，接手它正在做的事。": "Type in the terminal window to take over what it's doing.",
  "（没有标题）": "(no title)",
  "读不到这个网页：{message}": "Couldn't read this page: {message}",
  "智能体看到的网页": "The page the agent sees",
  "这个网页没有截到图。": "No screenshot of this page.",
  "在浏览器里打开": "Open in browser",
  "要登录、过验证码或自己点几下，就在浏览器里接手。": "To sign in, solve a captcha or click around yourself, take over in the browser.",
  "电脑 · {count}": "Computer · {count}",
  "电脑": "Computer",
  "先打开 Unzoo One 的终端窗口，再点一次。({message})": "Open the Unzoo One terminal window first, then click again. ({message})",
};
