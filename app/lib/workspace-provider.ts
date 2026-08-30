/**
 * 控制台用哪个 provider，在这里决定。
 *
 * 组件只认 WorkspaceProvider 契约，换后端只改这一个文件。
 *
 * 现在的组合：真实实现包着内存实现。能接本机 unzoo 的方法走真实数据，
 * 接不了或本机服务没起来的落回内存数据，所以云端 demo 和本地真机跑的
 * 是同一份代码，区别只在于有多少数据是真的。
 */

import { createLiveProvider } from "./provider-live";
import { createMockProvider } from "./provider-mock";
import type { WorkspaceProvider } from "./provider";

let current: WorkspaceProvider | null = null;

export function getWorkspaceProvider(): WorkspaceProvider {
  if (!current) current = createLiveProvider(createMockProvider());
  return current;
}

/** 测试用：换掉实现或重置内存状态。 */
export function setWorkspaceProvider(provider: WorkspaceProvider | null): void {
  current = provider;
}
