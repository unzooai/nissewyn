/** Settings › Preferences › Network proxy. */
export const enPage12: Record<string, string> = {
  "网络代理": "Network proxy",
  "Nissewyn 怎么上网": "How Nissewyn reaches the internet",
  "这是整个应用的代理：终端、智能体、插件，以及它们启动的 git、npm、pip、模型命令行都走它。本机地址（localhost、127.0.0.1）始终直连。Unzoo 浏览器有自己的线路，在它的账号环境里设置。":
    "This proxy is for the whole app: terminals, agents, plugins, and the git, npm, pip and model CLIs they start all go through it. Addresses on this computer (localhost, 127.0.0.1) always connect directly. Unzoo Browser has its own route, set in its profiles.",
  "不用代理": "No proxy",
  "跟随系统代理": "Use the system proxy",
  "手动填写": "Enter manually",
  "程序直接上网。": "Programs connect directly.",
  "用这台电脑开着的代理（Clash、V2Ray 等设的系统代理），它换了这里也跟着换。":
    "Use the proxy this computer has on (the system proxy set by Clash, V2Ray and the like); when it changes, this follows.",
  "用你填的地址，例如公司给的代理。": "Use the addresses you enter, such as a proxy from your company.",
  "http://主机:端口": "http://host:port",
  "socks5://主机:端口": "socks5://host:port",
  "“{value}”不像代理地址，应该是 {kinds}": "“{value}” doesn't look like a proxy address; it should be {kinds}",
  "至少填一个代理地址。": "Enter at least one proxy address.",
  "代理已改为“{mode}”。新开的终端、智能体和重启后的插件会用上。":
    "Proxy changed to “{mode}”. New terminals, agents and restarted plugins will use it.",
  "现在不用代理，程序直接上网。": "No proxy now; programs connect directly.",
  "现在启动的程序走 {url}。": "Programs started now go through {url}.",
  "没找到开着的代理：这台电脑没设系统代理，常用端口（7890、7897 等）上也没有代理软件。程序先直接上网，代理软件开了以后会自动用上。":
    "No proxy is on: this computer has no system proxy, and no proxy software answers on the usual ports (7890, 7897 and so on). Programs connect directly for now and pick the proxy up once it's running.",
  "填的代理现在连不上，程序先直接上网，免得断网。代理软件开了以后会自动用上。":
    "The proxy you entered isn't answering, so programs connect directly for now rather than losing the network. They pick it up once it's running.",
  "读不到代理设置：{error}": "Couldn't read the proxy setting: {error}",
  "这台电脑现在的代理：{url}": "This computer's proxy now: {url}",
  "这台电脑现在没有开代理。": "This computer has no proxy on right now.",
  "HTTP 代理": "HTTP proxy",
  "SOCKS5 代理（可不填）": "SOCKS5 proxy (optional)",
  "这些地址不走代理（可不填）": "Don't use the proxy for (optional)",
  "例如 .corp.example, intranet": "e.g. .corp.example, intranet",
  "已经开着的终端和插件不受影响：新开的终端会用上，插件在“插件”页重启一下。":
    "Terminals and plugins already running aren't affected: new terminals use it, and plugins need a restart on the Plugins page.",
  // Terminal › command blocks
  "命令没有成功（退出码 {code}）": "Command failed (exit code {code})",
  "交给智能体看看": "Ask the agent",
  "关闭": "Close",
  "上一条命令": "Previous command",
  "下一条命令": "Next command",
  "上一条命令（Ctrl+↑）": "Previous command (Ctrl+↑)",
  "下一条命令（Ctrl+↓）": "Next command (Ctrl+↓)",
  "上一条失败的命令": "Previous failed command",
  "上一条失败的命令（共 {count} 条）": "Previous failed command ({count} in all)",
  "这条命令在终端里没有成功（退出码 {code}），帮我找出原因并修好。":
    "This command failed in the terminal (exit code {code}). Find out why and fix it.",
  "文件夹：{cwd}": "Folder: {cwd}",
  "命令：{command}": "Command: {command}",
  "输出（最后一部分）：": "Output (the last part):",
};
