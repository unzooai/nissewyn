/** English for when a task runs by itself: schedules, watches, standing helpers. Keys: see ./index.ts. */
export const enPage10: Record<string, string> = {
  // Schedule kinds (TaskSchedule)
  "工作日": "Weekdays",
  "每隔": "Every…",
  "定时一次": "Once at",
  "每 {count} 分钟": "Every {count} min",
  "每小时": "Every hour",
  "每 {count} 天": "Every {count} days",
  "每 {count} 小时": "Every {count} hours",
  "工作日 {time}": "Weekdays at {time}",
  "{at} 运行一次": "Once at {at}",
  "下一个工作日 {value}": "Next weekday at {value}",
  "间隔": "Interval",
  // Watches
  "按时、或者有变化时，把第一句需求再交给智能体做一次，结果接在这个任务后面。":
    "On a schedule, or when something changes, hand the first request to the agent again. Results are added to this task.",
  "有变化时也运行": "Also run when something changes",
  "不监视": "Don't watch anything",
  "网页内容变了": "A web page changes",
  "文件夹里有新文件": "New files in a folder",
  "多久看一次": "How often to check",
  "每 {count} 分钟看一次": "Check every {count} min",
  "每小时看一次": "Check every hour",
  "每天看一次": "Check once a day",
  "每 {count} 小时看一次": "Check every {count} hours",
  "要看的网页": "Page to watch",
  "文件夹路径": "Folder path",
  "要看的文件夹": "Folder to watch",
  "用智能体的浏览器身份打开，要登录才能看的页面也行。":
    "Opened with the agents' browser identity, so pages that need a sign-in work too.",
  "上次查看出错：{error}": "Last check failed: {error}",
  "网页变化时": "when the page changes",
  "有新文件时": "when new files arrive",
  "有变化时运行": "Run on change",
  // Standing helpers
  "交给": "Hand to",
  "默认智能体": "Default agent",
  "长期负责：每次接着上一次的对话，记得之前做过什么": "Standing helper: each run continues the last conversation and remembers what was done",
};
