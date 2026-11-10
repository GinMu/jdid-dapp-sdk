#!/usr/bin/env node
/**
 * jdid-wallet-mcp —— 让 agent 自己驱动 JDID 钱包(装包/开 dApp/调 provider/看日志/截图)。
 *
 * 传输:stdio,每行一个 JSON-RPC 消息(MCP 的 stdio 帧格式)。
 * 依赖:零 npm 包 —— 复用本仓 `cli/cdp.mjs`(CDP)与 `cli/device-ui.mjs`(uiautomator)。
 *
 * 注册(以 DeepSeek Harness 为例,写进 dsh 的 MCP 配置):
 *   { "mcpServers": { "jdid-wallet": { "command": "node",
 *       "args": ["/abs/path/jdid-dapp-sdk/mcp/server.mjs"] } } }
 */
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluate,
  forwardDevtools,
  listDevices,
  listTargets,
  pickDevice,
  probeExpression,
  waitForPid,
} from "../cli/cdp.mjs";
import { dumpUi, findByText, openDappInWallet, typeText } from "../cli/device-ui.mjs";
import { didFor } from "../cli/calibrate-params.mjs";
import { loadContract } from "../scripts/gen.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEVTOOLS_PORT = 9222;

const sh = (device, args) => spawnSync("adb", ["-s", device, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

/** 连上当前 dApp 页面(只认 http(s) 页面,内部桥页没有 provider),返回 { device, page }。 */
async function attach({ device: wanted, packageName = "com.android.jdid", urlHint } = {}) {
  const device = pickDevice(wanted);
  const pid = await waitForPid(device, packageName, { timeoutMs: 20_000 });
  forwardDevtools(device, pid, DEVTOOLS_PORT);

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    let pages = [];
    try {
      const targets = await listTargets(DEVTOOLS_PORT);
      pages = (targets ?? []).filter((t) => t.type === "page" && /^https?:/.test(t.url ?? ""));
    } catch {
      pages = [];
    }
    const match = urlHint ? pages.find((t) => (t.url ?? "").includes(urlHint)) : pages[0];
    if (match) return { device, page: match };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("没有可用的 dApp 页面:先用 jdid_open_dapp 打开一个地址(内部桥页 file:///android_asset/unified-bridge.html 不算)");
}

const CONTRACT = loadContract();
const CONTRACT_METHODS = new Set(CONTRACT.methods.map((m) => m.name));

/**
 * 工具里用到的方法名一律从契约取,契约里没有就直接报错 ——
 * 这样工具不会和契约漂移(加/删方法时这里会自动跟上或大声失败)。
 */
function requireMethod(name) {
  if (!CONTRACT_METHODS.has(name)) {
    throw new Error(`契约(contract ${CONTRACT.contractVersion})里没有 ${name};先更新 contract/methods.json 再跑 npm run gen`);
  }
  return name;
}

/** 在页面里调 provider,把"成功/失败"都变成结构化结果(不让异常冒成 MCP 错误)。 */
async function callProvider(page, method, params, { timeoutMs = 30_000 } = {}) {
  const expression = `(async () => {
    try {
      const value = await window.ethereum.request({ method: ${JSON.stringify(method)}, params: ${JSON.stringify(params)} });
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error), code: error?.code ?? null };
    }
  })()`;
  return evaluate(page, expression, { timeoutMs });
}

/** 把 did/address 归一成 DID:带 did 直接用,否则按地址形状推导。 */
function targetDid({ did, address }) {
  if (did) return did;
  if (address) return didFor(address);
  throw new Error("需要 did 或 address");
}

const TOOLS = [
  {
    name: "jdid_devices",
    description: "列出通过 adb 连接、可用于调试 JDID 的设备/模拟器。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const devices = listDevices();
      return devices.length ? devices.join("\n") : "(没有设备;先启动模拟器或连上手机)";
    },
  },
  {
    name: "jdid_open_dapp",
    description: "拉起 JDID、在 Explore 里打开一个 dApp 地址(优先点「最近访问」,避免输入法改写 URL),等页面就绪。",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "要打开的地址,如 http://127.0.0.1:5173/index.html" },
        device: { type: "string" },
        packageName: { type: "string", default: "com.android.jdid" },
      },
      required: ["url"],
    },
    async run({ url, device, packageName }) {
      const serial = pickDevice(device);
      const opened = await openDappInWallet(serial, packageName ?? "com.android.jdid", url, {});
      if (!opened) return "没能在 UI 上打开地址(可能停在解锁页);请先解锁,或手动在 Explore 里粘贴地址";
      const { page } = await attach({ device: serial, packageName, urlHint: url.replace(/^https?:\/\//, "") });
      return `已打开:${page.url}`;
    },
  },
  {
    name: "jdid_probe",
    description: "读 dApp 页面里钱包注入的 provider 状态:eth_accounts / eth_chainId / web3_clientVersion / selectedAddress。",
    inputSchema: {
      type: "object",
      properties: { device: { type: "string" }, packageName: { type: "string", default: "com.android.jdid" } },
    },
    async run({ device, packageName }) {
      const { page } = await attach({ device, packageName });
      const probe = await evaluate(page, probeExpression());
      return JSON.stringify(probe, null, 2);
    },
  },
  {
    name: "jdid_eval",
    description: "在 dApp 页面里执行一段 JS 并取回结果(可 await)。用于调试、驱动页面上的交互。",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "要执行的表达式,例如 window.ethereum.request({method:'eth_chainId'})" },
        device: { type: "string" },
        url: { type: "string", description: "可选:只匹配包含该片段的页面" },
        timeoutMs: { type: "number", default: 30000 },
      },
      required: ["expression"],
    },
    async run({ expression, device, url, timeoutMs }) {
      const { page } = await attach({ device, urlHint: url });
      // 允许在表达式里直接写 await(包一层 async 箭头函数再求值)。
      const value = await evaluate(page, `(async () => (${expression}))()`, { timeoutMs: timeoutMs ?? 30_000 });
      return typeof value === "string" ? value : JSON.stringify(value, null, 2);
    },
  },
  {
    name: "jdid_tap",
    description: "按可见文本点一下(dApp 页面或 App UI 都行)。",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, device: { type: "string" } },
      required: ["text"],
    },
    async run({ text, device }) {
      const serial = pickDevice(device);
      const node = findByText(dumpUi(serial), [text]);
      if (!node) return `没找到文本为「${text}」的控件`;
      const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(node.bounds ?? "");
      if (!m) return "控件没有可用坐标";
      const x = Math.round((Number(m[1]) + Number(m[3])) / 2);
      const y = Math.round((Number(m[2]) + Number(m[4])) / 2);
      sh(serial, ["shell", "input", "tap", String(x), String(y)]);
      return `已点击「${text}」@ (${x},${y})`;
    },
  },
  {
    name: "jdid_type",
    description: "向当前焦点输入文本(注意:中文输入法可能改写标点,优先点最近访问而不是打字)。",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, device: { type: "string" } },
      required: ["text"],
    },
    async run({ text, device }) {
      const serial = pickDevice(device);
      typeText(serial, text);
      return "已输入";
    },
  },
  {
    name: "jdid_logcat",
    description: "读最近的 logcat(可按关键字过滤),用于看钱包/WebView 的报错。",
    inputSchema: {
      type: "object",
      properties: {
        grep: { type: "string", description: "只保留包含该关键字的行(可选)" },
        lines: { type: "number", default: 200 },
        device: { type: "string" },
      },
    },
    async run({ grep, lines, device }) {
      const serial = pickDevice(device);
      const out = sh(serial, ["logcat", "-d", "-t", String(lines ?? 200)]).stdout ?? "";
      const rows = grep ? out.split("\n").filter((l) => l.includes(grep)) : out.split("\n");
      return rows.slice(-(lines ?? 200)).join("\n").trim() || "(没有匹配的日志)";
    },
  },
  {
    name: "jdid_screenshot",
    description: "截屏并保存到宿主文件,返回路径。",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, device: { type: "string" } },
    },
    async run({ path, device }) {
      const serial = pickDevice(device);
      const target = resolve(path ?? `/tmp/jdid-${Date.now()}.png`);
      const png = spawnSync("adb", ["-s", serial, "exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
      if (png.status !== 0) return `截屏失败:${png.stderr?.toString() ?? ""}`;
      writeFileSync(target, png.stdout);
      return target;
    },
  },
  {
    name: "jdid_did_inspect",
    description:
      "只读检查一个 DID:did_resolve + did_stat,可选 did_generateDidDoc。不会弹确认、不写链。",
    inputSchema: {
      type: "object",
      properties: {
        did: { type: "string", description: "完整 DID,例如 did:swtc:jw…" },
        address: { type: "string", description: "没给 did 时按地址推导:0x… → did:ethr:,其它 → did:swtc:" },
        includeDocument: { type: "boolean", default: false, description: "同时用 did_generateDidDoc 拼装文档" },
        device: { type: "string" },
        url: { type: "string", description: "可选:只匹配包含该片段的页面" },
      },
    },
    async run({ did, address, includeDocument, device, url }) {
      const target = targetDid({ did, address });
      const { page } = await attach({ device, urlHint: url });
      const resolved = await callProvider(page, requireMethod("did_resolve"), [target]);
      const stat = await callProvider(page, requireMethod("did_stat"), [target]);
      const generated = includeDocument
        ? await callProvider(page, requireMethod("did_generateDidDoc"), [{ did: target, version: "1.0" }])
        : null;
      return JSON.stringify({ did: target, resolved, stat, generated }, null, 2);
    },
  },
  {
    name: "jdid_did_verify",
    description: "只读验证凭证(did_verifyCredential),返回 { ok, value: { verified, unknown, results } }。",
    inputSchema: {
      type: "object",
      properties: {
        credential: { type: "string", description: "凭证 JSON 字符串" },
        device: { type: "string" },
        url: { type: "string" },
      },
      required: ["credential"],
    },
    async run({ credential, device, url }) {
      const { page } = await attach({ device, urlHint: url });
      const result = await callProvider(page, requireMethod("did_verifyCredential"), [credential]);
      return JSON.stringify(result, null, 2);
    },
  },
  {
    name: "jdid_did_publish",
    description:
      "写操作,默认关闭:发布 DID 文档(did_publish)或生成 VC(did_generateVC)。必须显式 allowWrite=true,执行时钱包会弹宿主确认。",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "钱包按它取私钥(页面不传 privateKey)" },
        did: { type: "string", description: "did_publish 用" },
        didDocument: { type: "string", description: "did_publish 用;对象会被序列化" },
        generateVC: { type: "object", description: "给了它就走 did_generateVC(generateVC 载荷,address 会并入)" },
        allowWrite: { type: "boolean", default: false, description: "必须显式为 true 才会真正调用" },
        device: { type: "string" },
        url: { type: "string" },
      },
      required: ["address"],
    },
    async run({ address, did, didDocument, generateVC, allowWrite, device, url }) {
      const method = generateVC ? requireMethod("did_generateVC") : requireMethod("did_publish");
      if (!allowWrite) {
        // 未授权时不碰设备:直接返回可执行提示,避免 agent 误写链/卡在确认弹窗。
        return JSON.stringify(
          {
            ok: false,
            state: "blocked",
            method,
            hint: "写操作(发布 DID / 签发 VC)默认关闭。确认要写链/签发后,带 allowWrite=true 重新调用;执行时钱包会弹宿主确认,可能需要用户在设备上点。",
          },
          null,
          2,
        );
      }
      const { page } = await attach({ device, urlHint: url });
      const payload = generateVC ? { ...generateVC, address } : { did, didDocument, address };
      const result = await callProvider(page, method, [payload], { timeoutMs: 120_000 });
      return JSON.stringify({ method, result }, null, 2);
    },
  },
  {
    name: "jdid_conformance",
    description: "对一个 dApp 目录跑 conformance(契约/生成物/manifest/声明覆盖/冒烟),返回摘要。",
    inputSchema: {
      type: "object",
      properties: { dappDir: { type: "string" }, json: { type: "boolean", default: false } },
      required: ["dappDir"],
    },
    async run({ dappDir }) {
      const result = spawnSync(process.execPath, ["cli/conformance.mjs", "--dapp", dappDir, "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      });
      const text = result.stdout?.trim();
      try {
        const report = JSON.parse(text);
        return JSON.stringify(
          { ok: report.ok, results: report.results.map((r) => ({ id: r.id, ok: r.ok, title: r.title })) },
          null,
          2,
        );
      } catch {
        return (result.stdout || result.stderr || "conformance 没有输出").slice(0, 4000);
      }
    },
  },
];

// ── JSON-RPC over stdio ──
function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

async function dispatch(message) {
  const { id, method, params } = message;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "jdid-wallet-mcp", version: "0.1.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") return;
  if (method === "tools/list") {
    reply(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      replyError(id, -32602, `未知工具:${name}`);
      return;
    }
    try {
      const text = await tool.run(params?.arguments ?? {});
      reply(id, { content: [{ type: "text", text: String(text) }], isError: false });
    } catch (error) {
      reply(id, { content: [{ type: "text", text: `工具执行失败:${error?.message ?? error}` }], isError: true });
    }
    return;
  }
  if (id !== undefined) replyError(id, -32601, `不支持的方法:${method}`);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    replyError(null, -32700, "JSON 解析失败");
    return;
  }
  dispatch(message).catch((error) => replyError(message.id ?? null, -32603, String(error?.message ?? error)));
});
