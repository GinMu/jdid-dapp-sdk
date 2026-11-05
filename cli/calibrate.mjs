#!/usr/bin/env node
/**
 * 真机校准 —— 逐条在**已打开的 DApp 页面**里调用 RPC,把结果打出来,用于回填契约 `status`/`note`。
 *
 * 与 conformance 的区别:它不做 URL 匹配、不需要静态服务器,直接 attach 当前页面,
 * 适合"页面已经打开了,我想一次性看清哪些方法真能用"。
 *
 * 安全:默认只跑 **只读/无资金风险** 的方法;`sendTransaction`/`multiSign`/`batchTransactions`
 * 这类会动钱的**永远不跑**,除非显式 `--unsafe`(它们也会真正发交易)。
 *
 * 用法:
 *   node cli/calibrate.mjs [--device <serial>] [--package <id>] [--timeout 8] [--json] [--undo-warning]
 */
import { listTargets, evaluate, forwardDevtools, pickDevice, pickPageTarget, waitForPid } from "./cdp.mjs";

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const asJson = args.includes("--json");
const unsafe = args.includes("--unsafe");
const timeoutMs = Number(argValue("--timeout", "8")) * 1000;
const packageName = argValue("--package", "com.android.jdid");
const address = argValue("--address", "");
const devtoolsPort = Number(argValue("--port", "9222"));

/** 只读/无资金风险;会动钱的方法不在默认列表里。 */
const SAFE = [
  "web3_clientVersion",
  "eth_chainId",
  "eth_accounts",
  "eth_blockNumber",
  "eth_requestNfts",
  "eth_requestAccounts",
  "swtc_requestAccounts",
  "swtc_requestNfts",
  "swtc_getPublicKey",
  "did_requestAccountName",
  "did_getBase58PublicKey",
  "ipfs_getPublicKey",
  "personal_ecRecover",
  "personal_sign",
  "swtc_signMessage",
  "did_issueCredential",
  "ipfs_personalSign",
  "eth_getEncryptionPublicKey",
  "eth_decrypt",
];
const DANGEROUS = ["swtc_sendTransaction", "swtc_multiSign", "swtc_batchTransactions", "eth_sendTransaction", "eth_signTransaction", "wallet_switchEthereumChain"];

function callExpression(method) {
  // 参数尽量给"无害的占位";签名类方法由钱包自己弹确认,用户在设备上点。
  // 需要地址的方法:统一用 --address 传真实地址(授权后用 eth_accounts 拿到的那个)。
  const needsAddress = new Set([
    "swtc_getPublicKey",
    "did_requestAccountName",
    "did_getBase58PublicKey",
    "ipfs_getPublicKey",
    "eth_getEncryptionPublicKey",
  ]);
  const paramsByMethod = {
    personal_sign: ["0x68656c6c6f", address],
    swtc_signMessage: [address, "hello"],
    personal_ecRecover: ["0x00", address],
    did_issueCredential: [{ keyDoc: { address } }],
    ipfs_personalSign: [[1, 2, 3], address],
    eth_decrypt: ["0x00", address],
  };
  const params = paramsByMethod[method] ?? (needsAddress.has(method) ? [address] : []);
  return `(async () => {
    try {
      const value = await window.ethereum.request({ method: ${JSON.stringify(method)}, params: ${JSON.stringify(params)} });
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error), code: error?.code ?? null };
    }
  })()`;
}

const device = pickDevice(argValue("--device", undefined));
const pid = await waitForPid(device, packageName, { timeoutMs: 30_000 });
const unforward = forwardDevtools(device, pid, devtoolsPort);
try {
  const targets = await listTargets(devtoolsPort);
  // 优先真正的 dApp 页面:WebView 里还可能有一个内部桥页面
  // (`file:///android_asset/unified-bridge.html`),它没有 window.ethereum。
  const page =
    (targets ?? []).find((t) => t.type === "page" && /^https?:/.test(t.url ?? "")) ?? pickPageTarget(targets);
  if (!page) {
    console.error(`没找到页面 target(共 ${targets.length} 个);先把 DApp 页打开`);
    process.exit(2);
  }
  if (!asJson) console.log(`attach: ${device} · ${page.url}`);
  const only = argValue("--only", "");
  const methods = only
    ? only.split(",").map((m) => m.trim()).filter(Boolean)
    : unsafe
      ? [...SAFE, ...DANGEROUS]
      : SAFE;
  const rows = [];
  for (const method of methods) {
    const started = Date.now();
    let result;
    try {
      result = await evaluate(page, callExpression(method), { timeoutMs });
    } catch (error) {
      result = { ok: false, error: `${error.code}: ${error.message}` };
    }
    const elapsed = Date.now() - started;
    rows.push({ method, elapsed, ...result });
    if (!asJson) {
      const status = result.ok ? "OK  " : "FAIL";
      const shown = result.ok ? JSON.stringify(result.value).slice(0, 90) : `${result.error}`.slice(0, 110);
      console.log(`${status} ${method.padEnd(26)} ${String(elapsed).padStart(5)}ms  ${shown}`);
    }
  }
  if (asJson) console.log(JSON.stringify(rows, null, 2));
} finally {
  unforward();
}
