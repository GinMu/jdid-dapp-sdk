/**
 * CDP 传输 —— 把 conformance 的检查打到**真实钱包**的 WebView 上。
 *
 * 原理(全部零依赖,只用 Node 内置能力):
 *   1. debug 包默认允许 WebView 调试(Android 对 `android:debuggable="true"` 的应用默认开启,
 *      所以**不需要**改钱包代码;release/上架包绝不具备这个能力);
 *   2. `adb reverse tcp:<port> tcp:<port>` 让设备访问宿主上的静态服务器;
 *   3. 在设备的 JDID Explore 页打开 `http://127.0.0.1:<port>/`,页面里就有钱包注入的
 *      `window.ethereum` / `window.ccdao`;
 *   4. 通过 `http://127.0.0.1:<port>/json/list` 发现页面 target,连它的
 *      `webSocketDebuggerUrl`,用 `Runtime.evaluate` 在页面里**真实调用** provider。
 *
 * 为什么不做全自动打开页面:进 DApp 页前通常要解锁钱包、再在 Explore 输入 URL。
 * 那两步涉及用户密码与导航,本工具只做到"attach + 执行 + 断言",打开页面留给操作者
 * (或后续用 `--auto-open` 接 UI 自动化)。
 */
import { spawnSync } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";

export class CdpError extends Error {
  constructor(message, { code = "cdp_error", cause } = {}) {
    super(message);
    this.name = "CdpError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export function hasAdb() {
  const result = spawnSync("adb", ["version"], { encoding: "utf8" });
  return result.status === 0;
}

export function listDevices() {
  const result = spawnSync("adb", ["devices"], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === "device")
    .map((parts) => parts[0]);
}

export function pickDevice(preferred) {
  const devices = listDevices();
  if (preferred) {
    if (!devices.includes(preferred)) {
      throw new CdpError(`指定设备 ${preferred} 不在线(在线:${devices.join(", ") || "无"})`, { code: "no_device" });
    }
    return preferred;
  }
  if (devices.length === 0) throw new CdpError("没有在线设备(adb devices 为空)", { code: "no_device" });
  if (devices.length > 1) {
    throw new CdpError(`检测到多个设备,请用 --device 指定:${devices.join(", ")}`, { code: "multiple_devices" });
  }
  return devices[0];
}

export function adb(device, args) {
  const result = spawnSync("adb", ["-s", device, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new CdpError(`adb ${args.join(" ")} 失败:${(result.stderr || result.stdout).trim()}`, { code: "adb_failed" });
  }
  return result.stdout;
}

/** 让设备上的 127.0.0.1:<port> 指向宿主同端口;返回取消函数。 */
export function forwardPort(device, port) {
  adb(device, ["reverse", `tcp:${port}`, `tcp:${port}`]);
  return () => {
    spawnSync("adb", ["-s", device, "reverse", "--remove", `tcp:${port}`], { encoding: "utf8" });
  };
}

/** 取应用进程号(WebView 的调试 socket 名是 `webview_devtools_remote_<pid>`)。 */
export function packagePid(device, packageName) {
  const output = adb(device, ["shell", "pidof", packageName]).trim();
  if (!output) throw new CdpError(`进程未运行:${packageName}(先把 App 打开并进入 DApp 页)`, { code: "no_package" });
  return output.split(/\s+/)[0];
}

/** 轮询等应用进程起来(用户可能还没打开 App)。 */
export async function waitForPid(device, packageName, { timeoutMs = 60_000, intervalMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return packagePid(device, packageName);
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new CdpError(`等不到进程 ${packageName} 启动(${timeoutMs}ms)`, { code: "no_package" });
}

/** 把设备的 WebView 调试 socket 转发到本机端口;返回取消函数。 */
export function forwardDevtools(device, pid, localPort = 9222) {
  const socketName = `webview_devtools_remote_${pid}`;
  const result = spawnSync("adb", ["-s", device, "forward", `tcp:${localPort}`, `localabstract:${socketName}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new CdpError(`adb forward 失败:${(result.stderr || result.stdout).trim()}`, { code: "adb_failed" });
  }
  return () => {
    spawnSync("adb", ["-s", device, "forward", "--remove", `tcp:${localPort}`], { encoding: "utf8" });
  };
}

/** 起一个只读静态服务器(默认听 127.0.0.1,随机端口),用于把 dApp 喂给设备。 */
export function startStaticServer(root, port = 0) {
  const rootDir = resolve(root);
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(rootDir, normalize(relativePath));
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
      response.writeHead(403).end("forbidden");
      return;
    }
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      response.writeHead(404).end("not found");
      return;
    }
    if (!stat.isFile()) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "content-length": stat.size,
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolvePromise, reject) => {
    server.once("error", (error) =>
      reject(new CdpError(`静态服务器启动失败:${error.message}`, { code: "server_failed", cause: error })),
    );
    server.listen(port, "127.0.0.1", () => {
      const actual = server.address().port;
      resolvePromise({
        port: actual,
        url: `http://127.0.0.1:${actual}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/** 读 WebView 的调试 target 列表(webview_devtools_remote 也走这套 HTTP 端点)。 */
export async function listTargets(port, { timeoutMs = 2_000 } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new CdpError(`/json/list 返回 ${response.status}`, { code: "cdp_failed" });
  return response.json();
}

/** 在 target 列表里挑页面:优先 URL 含 hint 的 page,否则第一个 page。 */
export function pickPageTarget(targets, urlHint) {
  const pages = (targets ?? []).filter((target) => target.type === "page" && typeof target.webSocketDebuggerUrl === "string");
  if (urlHint) return pages.find((target) => (target.url ?? "").includes(urlHint)) ?? null;
  return pages[0] ?? null;
}

/** 轮询 target 列表直到出现页面(或超时),返回 { target, targets }。 */
export async function waitForPageTarget(port, { urlHint, timeoutMs = 120_000, intervalMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastTargets = [];
  while (Date.now() < deadline) {
    try {
      lastTargets = await listTargets(port);
      const target = pickPageTarget(lastTargets, urlHint);
      if (target) return { target, targets: lastTargets };
    } catch {
      // 调试端口还没起来:继续等
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { target: null, targets: lastTargets };
}

/** 连上页面 target,执行一段返回 Promise 的表达式并取回值。 */
export function evaluate(target, expression, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const messageId = 1;
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // 忽略关闭异常
      }
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new CdpError(`CDP evaluate 超时(${timeoutMs}ms)`, { code: "cdp_timeout" }))),
      timeoutMs,
    );
    if (typeof timer.unref === "function") timer.unref();

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: messageId,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true, userGesture: true },
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      let payload;
      try {
        payload = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      } catch {
        return;
      }
      if (payload.id !== messageId) return;
      if (payload.error) {
        finish(() => reject(new CdpError(`Runtime.evaluate 失败:${payload.error.message}`, { code: "cdp_failed" })));
        return;
      }
      const result = payload.result ?? {};
      if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "页面内抛异常";
        finish(() =>
          reject(new CdpError(`页面内执行失败:${detail}`, { code: "page_exception", cause: result.exceptionDetails })),
        );
        return;
      }
      finish(() => resolvePromise(result.result?.value));
    });
    socket.addEventListener("error", () => {
      finish(() => reject(new CdpError("CDP WebSocket 连接失败(调试端口没转发?)", { code: "cdp_failed" })));
    });
  });
}

/** 只读探针:确认 provider 在场,并真实取账户/链/客户端版本(不触发 secret/confirm)。 */
export function probeExpression() {
  return `(async () => {
    const provider = window.ethereum;
    if (!provider || typeof provider.request !== "function") {
      return { ok: false, reason: "window.ethereum 不存在:页面不是从 JDID 打开的,或钱包未注入" };
    }
    const out = { ok: true, href: location.href, hasCcpp: typeof window.ccdao === "object" };
    out.selectedAddress = provider.selectedAddress ?? null;
    out.isConnected = typeof provider.isConnected === "boolean" ? provider.isConnected : null;
    out.accounts = await provider.request({ method: "eth_accounts" });
    out.chainId = await provider.request({ method: "eth_chainId" });
    out.clientVersion = await provider.request({ method: "web3_clientVersion" });
    return out;
  })()`;
}

/** 在页面里加载 dApp 的入口模块并跑 run(wallet)。 */
export function dappExpression(moduleUrl) {
  return `(async () => {
    const module = await import(${JSON.stringify(moduleUrl)});
    if (typeof module.run !== "function") return { ok: false, reason: "入口模块没有导出 run(wallet)" };
    const result = await module.run(window.ethereum);
    return { ok: true, result };
  })()`;
}
