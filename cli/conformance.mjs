#!/usr/bin/env node
/**
 * JDID dApp conformance —— 最小骨架(纯 Node,零依赖,不需要模拟器)
 *
 * 这一步查的是"**dApp 与契约是否对得上**",不是"钱包是否真的能签":
 *   1. contract      契约本身合法(唯一方法名、枚举、不变量)
 *   2. codegen       生成物与契约同步(漂移守卫)
 *   3. manifest      jdid-manifest.json 合法,且 methods ⊆ 契约
 *   4. dapp-source   dApp 实际调用(静态字面量 ∪ Mock 跑出来的调用)都在 manifest 里声明过
 *   5. smoke         用 Mock 钱包把 dApp 的 run(wallet) 跑一遍
 *
 * 真机/真钱包的跑法(后续加 --cdp):同一份用例改为打到 debug WebView 的 CDP 上。
 *
 * 用法:
 *   node cli/conformance.mjs [--dapp <dir>] [--json]
 * 退出码:0 = 全过;1 = 有失败项。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadContract, validateContract, generate } from "../scripts/gen.mjs";
import { createMockWallet } from "../src/mock.js";
import { isKnownMethod, METHOD_INDEX, NEEDS } from "../src/methods.js";
import { openDappInWallet } from "./device-ui.mjs";
import {
  CdpError,
  dappExpression,
  evaluate,
  forwardDevtools,
  forwardPort,
  hasAdb,
  pickDevice,
  probeExpression,
  startStaticServer,
  waitForPageTarget,
  waitForPid,
} from "./cdp.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const argValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback;
};
const dappDir = resolve(ROOT, argValue("--dapp", "examples/minimal-dapp"));
const cdpEnabled = args.includes("--cdp");
const cdpRequire = args.includes("--require-cdp");
const cdpRunDapp = args.includes("--run-dapp");
const cdpDevice = argValue("--device", undefined);
const cdpPackage = argValue("--package", "com.android.jdid");
const cdpWaitSeconds = Number(argValue("--wait", "120"));
const cdpRequireAccounts = args.includes("--require-accounts");
const cdpAutoOpen = args.includes("--auto-open");
const cdpPort = Number(argValue("--port", "0"));

const TARGETS = {
  methods: join(ROOT, "src", "methods.js"),
  types: join(ROOT, "src", "index.d.ts"),
  capabilities: join(ROOT, "docs", "capabilities.md"),
};

/** @type {{id: string, title: string, ok: boolean, details: string[]}[]} */
const results = [];
function record(id, title, details = []) {
  results.push({ id, title, ok: details.length === 0, details });
}

const readText = (path) => readFileSync(path, "utf8");

function collectFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) acc.push(...collectFiles(full, acc));
    else if (/\.(m?js|html)$/.test(name)) acc.push(full);
  }
  return acc;
}

// ---------------------------------------------------------------- 1. contract
const contract = loadContract();
record("contract", `contract/methods.json 合法(${contract.methods?.length ?? 0} 个方法)`, validateContract(contract));

// ---------------------------------------------------------------- 2. codegen
const generated = generate(contract);
const drift = Object.entries(generated)
  .filter(([key, content]) => {
    const path = TARGETS[key];
    return !existsSync(path) || readText(path) !== content;
  })
  .map(([key]) => relative(ROOT, TARGETS[key]));
record("codegen", "生成物与契约同步", drift.map((p) => `${p} 与 contract/methods.json 不一致,跑 \`npm run gen\``));

// ---------------------------------------------------------------- 3. manifest
const manifestPath = join(dappDir, "jdid-manifest.json");
let manifest = null;
const manifestDetails = [];
if (!existsSync(manifestPath)) {
  manifestDetails.push(`缺少 ${relative(ROOT, manifestPath)}`);
} else {
  try {
    manifest = JSON.parse(readText(manifestPath));
  } catch (error) {
    manifestDetails.push(`jdid-manifest.json 不是合法 JSON:${error.message}`);
  }
  if (manifest) {
    for (const field of ["name", "version", "entry", "methods"]) {
      if (manifest[field] === undefined) manifestDetails.push(`缺少必填字段 ${field}`);
    }
    if (typeof manifest.name === "string" && !/^[a-z][a-z0-9-]{1,63}$/.test(manifest.name)) {
      manifestDetails.push(`name 必须是 kebab-case(实际 ${JSON.stringify(manifest.name)})`);
    }
    if (typeof manifest.entry === "string" && !existsSync(join(dappDir, manifest.entry))) {
      manifestDetails.push(`entry 指向的文件不存在:${manifest.entry}`);
    }
    if (manifest.methods !== undefined && !Array.isArray(manifest.methods)) {
      manifestDetails.push("methods 必须是数组");
    } else {
      for (const name of manifest.methods ?? []) {
        if (!isKnownMethod(name)) manifestDetails.push(`methods 里的 ${name} 不在 contract/methods.json`);
      }
    }
  }
}
record("manifest", "jdid-manifest.json 合法且 methods ⊆ 契约", manifestDetails);
const declared = new Set(manifest?.methods ?? []);

// ---------------------------------------------------------------- 5. smoke(先跑,拿到"实际调用"的真源)
let smokeDetails = [];
let smokeResult = null;
let smokeCalls = [];
const entryModule = join(dappDir, "main.js");
if (!existsSync(entryModule)) {
  smokeDetails.push(`缺少 ${relative(ROOT, entryModule)}(约定导出 run(wallet))`);
} else {
  try {
    const module = await import(pathToFileURL(entryModule).href);
    if (typeof module.run !== "function") {
      smokeDetails.push(`${relative(ROOT, entryModule)} 必须导出 run(wallet)`);
    } else {
      const wallet = createMockWallet();
      smokeResult = await module.run(wallet);
      smokeCalls = wallet.calls.map((call) => call.method);
      if (smokeCalls.length === 0) smokeDetails.push("run(wallet) 没有发出任何 RPC 调用");
      for (const name of smokeCalls) {
        if (!isKnownMethod(name)) smokeDetails.push(`run 调用了契约外的方法 ${name}`);
      }
    }
  } catch (error) {
    smokeDetails.push(`run(wallet) 抛错:${error?.message ?? error}`);
  }
}

// ---------------------------------------------------------------- 4. dapp-source(静态字面量 ∪ 实际调用)
const used = new Map(); // method -> 首次见到它的位置
for (const file of collectFiles(dappDir)) {
  const text = readText(file);
  for (const pattern of [
    /\brequest\s*\(\s*["'`]([a-zA-Z][a-zA-Z0-9_]*)["'`]/g,
    /\bmethod\s*:\s*["'`]([a-zA-Z][a-zA-Z0-9_]*)["'`]/g,
  ]) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1];
      if (isKnownMethod(name) && !used.has(name)) used.set(name, relative(ROOT, file));
    }
  }
}
for (const name of smokeCalls) {
  if (!used.has(name)) used.set(name, "run(wallet)");
}
const sourceDetails = [];
for (const [name, where] of used) {
  if (!declared.has(name)) sourceDetails.push(`${where} 调用了 ${name},但 jdid-manifest.json 没有声明`);
}
record("dapp-source", `dApp 用到的 ${used.size} 个方法都已声明`, sourceDetails);
record("smoke", "用 Mock 钱包跑通 run(wallet)", smokeDetails);

// ---------------------------------------------------------------- 授权/确认面
const permissionNeeds = new Set();
for (const name of declared) {
  for (const need of METHOD_INDEX[name]?.needs ?? []) permissionNeeds.add(need);
}
const promptSurface = [...permissionNeeds].filter((n) => n === NEEDS.SECRET || n === NEEDS.CONFIRM);


// ---------------------------------------------------------------- 6. cdp(真钱包)
if (cdpEnabled) {
  const details = [];
  const warnings = [];
  let info = null;
  let skipped = null;
  let unforward = null;
  let server = null;
  try {
    if (!hasAdb()) throw new CdpError("找不到 adb:请把 platform-tools 加入 PATH", { code: "no_adb" });
    const device = pickDevice(cdpDevice);
    server = await startStaticServer(dappDir, cdpPort);
    unforward = forwardPort(device, server.port);
    const pageUrl = new URL("index.html", server.url).href;
    if (!asJson) {
      console.log("");
      console.log(`[cdp] 设备 ${device} · dApp 已就绪:${pageUrl}`);
      console.log(`[cdp] 请在 JDID 里打开上面的地址(Explore 输入 URL),最多等 ${cdpWaitSeconds}s …`);
    }
    if (cdpAutoOpen) {
      await openDappInWallet(device, cdpPackage, pageUrl, {
        log: asJson ? null : (m) => console.log(`[cdp] ${m}`),
      });
    }
    const pid = await waitForPid(device, cdpPackage, { timeoutMs: 60_000 });
    const devtoolsPort = 9222;
    const unforwardDevtools = forwardDevtools(device, pid, devtoolsPort);
    try {
      const { target, targets } = await waitForPageTarget(devtoolsPort, {
        urlHint: `:${server.port}`,
        timeoutMs: cdpWaitSeconds * 1000,
      });
      if (!target) {
        throw new CdpError(
          `等不到页面:没看到打开 ${pageUrl} 的 WebView(target 数 ${targets.length})`,
          { code: "no_page" },
        );
      }
      const probe = await evaluate(target, probeExpression());
      info = { device, pageUrl, targetUrl: target.url, probe };
      if (!probe?.ok) details.push(`探针失败:${probe?.reason ?? "未知"}`);
      const accountsEmpty = !Array.isArray(probe?.accounts) || probe.accounts.length === 0;
      if (accountsEmpty) {
        const reason =
          "eth_accounts 返回空(M-R7:未授权 origin 不注入 selectedAddress;dApp 应先走 eth_requestAccounts 授权)";
        if (cdpRequireAccounts) details.push(reason);
        else warnings.push(`${reason} —— 按设计如此,未计入失败`);
      }
      if (typeof probe?.chainId !== "string" || !probe.chainId.startsWith("0x")) {
        details.push(`eth_chainId 异常:${JSON.stringify(probe?.chainId)}`);
      }
      if (typeof probe?.clientVersion !== "string") details.push("web3_clientVersion 不是字符串");
      const expectedPort = `:${server.port}`;
      if (typeof probe?.href === "string" && !probe.href.includes(expectedPort)) {
        details.push(`挂到的页面不是本次的 dApp:${probe.href}(期望含 ${expectedPort})`);
      }

      if (details.length === 0 && cdpRunDapp) {
        const moduleUrl = new URL("main.js", server.url).href;
        const run = await evaluate(target, dappExpression(moduleUrl), { timeoutMs: 120_000 });
        info.dapp = run;
        if (!run?.ok) details.push(`dApp run() 失败:${run?.reason ?? "未知"}`);
        else if (!run.result?.signature) details.push("dApp 没拿到签名(可能未解锁,或 personal_sign 被拒)");
      }
    } finally {
      unforwardDevtools();
    }
  } catch (error) {
    const code = error?.code ?? "cdp_error";
    if (["no_adb", "no_device", "multiple_devices", "no_package"].includes(code) && !cdpRequire) {
      skipped = error.message;
    } else {
      details.push(`${code}: ${error.message}`);
    }
  } finally {
    unforward?.();
    await server?.close();
  }

  if (skipped) {
    results.push({ id: "cdp", title: `真钱包 CDP(跳过:${skipped})`, ok: true, skipped: true, details: [] });
  } else {
    const summary = info?.probe?.ok
      ? `${info.device} · ${info.probe.accounts?.length ?? 0} 个账户 · ${info.probe.chainId} · ${info.probe.clientVersion}`
      : "真钱包 CDP 检查";
    results.push({ id: "cdp", title: `真钱包 CDP:${summary}`, ok: details.length === 0, details, warnings });
  }
}

// ---------------------------------------------------------------- 报告
const ok = results.every((r) => r.ok || r.skipped);
if (asJson) {
  console.log(
    JSON.stringify(
      {
        dapp: relative(ROOT, dappDir),
        contractVersion: contract.contractVersion,
        declaredMethods: [...declared],
        usedMethods: [...used.keys()],
        promptSurface,
        results,
        ok,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`JDID dApp conformance —— ${relative(ROOT, dappDir)}  (contract ${contract.contractVersion})`);
  console.log("");
  for (const r of results) {
    const badge = r.skipped ? "~" : r.ok ? "✓" : "✗";
    console.log(`${badge} ${r.id.padEnd(12)} ${r.title}`);
    for (const detail of r.details) console.log(`    - ${detail}`);
    for (const warning of r.warnings ?? []) console.log(`    ~ ${warning}`);
  }
  console.log("");
  console.log(`声明的方法(${declared.size}):${declared.size ? [...declared].join(", ") : "—"}`);
  console.log(`实际调用(${used.size}):${used.size ? [...used.keys()].join(", ") : "—"}`);
  console.log(
    `用户授权/确认面:${promptSurface.length ? promptSurface.join(" + ") : "无(不碰签名与确认)"}` +
      (smokeResult && typeof smokeResult === "object" ? `   smoke 返回键:${Object.keys(smokeResult).join(", ")}` : ""),
  );
  const failed = results.filter((r) => !r.ok && !r.skipped);
  console.log("");
  console.log(failed.length === 0 ? "结果:全部通过" : `结果:${failed.length} 项失败`);
}
process.exitCode = ok ? 0 : 1;
