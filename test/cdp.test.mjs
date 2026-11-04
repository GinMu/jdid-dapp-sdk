import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import {
  dappExpression,
  hasAdb,
  listDevices,
  pickDevice,
  pickPageTarget,
  probeExpression,
  startStaticServer,
} from "../cli/cdp.mjs";

const ROOT = resolve(import.meta.dirname, "..");

test("pickPageTarget:按 URL 命中 page,忽略非 page 与无调试地址的 target", () => {
  const targets = [
    { type: "service_worker", url: "http://127.0.0.1:9999/main.js", webSocketDebuggerUrl: "ws://a" },
    { type: "page", url: "https://example.com/", webSocketDebuggerUrl: "ws://b" },
    { type: "page", url: "http://127.0.0.1:8123/index.html", webSocketDebuggerUrl: "ws://c" },
    { type: "page", url: "http://127.0.0.1:8124/", webSocketDebuggerUrl: undefined },
  ];
  assert.equal(pickPageTarget(targets, ":8123")?.url, "http://127.0.0.1:8123/index.html");
  assert.equal(pickPageTarget(targets)?.url, "https://example.com/");
  assert.equal(pickPageTarget(targets, ":7777"), null);
  assert.equal(pickPageTarget([], ":1"), null);
});

test("probeExpression 只碰只读方法(不触发 secret/confirm)", () => {
  const expression = probeExpression();
  for (const method of ["eth_accounts", "eth_chainId", "web3_clientVersion"]) {
    assert.ok(expression.includes(method), `探针应包含 ${method}`);
  }
  for (const forbidden of ["personal_sign", "eth_sendTransaction", "did_issueCredential"]) {
    assert.ok(!expression.includes(forbidden), `探针不应触碰 ${forbidden}`);
  }
  assert.match(expression, /window\.ethereum/);
  assert.match(expression, /selectedAddress/);
});

test("dappExpression 把入口 URL 安全地嵌进表达式", () => {
  const expression = dappExpression("http://127.0.0.1:8123/main.js");
  assert.ok(expression.includes('import("http://127.0.0.1:8123/main.js")'));
  assert.ok(expression.includes("module.run(window.ethereum)"));
});

test("静态服务器:返回 index.html、正确 content-type、挡住目录穿越", async () => {
  const server = await startStaticServer(join(ROOT, "examples", "minimal-dapp"));
  try {
    const page = await fetch(server.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await page.text(), /JDID 最小示例 dApp/);

    const module = await fetch(new URL("main.js", server.url));
    assert.equal(module.status, 200);
    assert.match(module.headers.get("content-type") ?? "", /javascript/);

    const missing = await fetch(new URL("nope.js", server.url));
    assert.equal(missing.status, 404);

    const escaped = await fetch(`${server.url}..%2f..%2fpackage.json`);
    assert.equal(escaped.status, 403);
  } finally {
    await server.close();
  }
});

test("设备发现:无 adb 不抛错,listDevices 总是数组", () => {
  assert.equal(typeof hasAdb(), "boolean");
  assert.ok(Array.isArray(listDevices()));
});

test("pickDevice:指定不存在的设备时抛 no_device", () => {
  assert.throws(
    () => pickDevice("no-such-device-42"),
    (error) => error.code === "no_device" && /no-such-device-42/.test(error.message),
  );
});

test("conformance --cdp:没有可用设备时降级为跳过(exit 0),--require-cdp 才失败", () => {
  const skipped = spawnSync(
    process.execPath,
    ["cli/conformance.mjs", "--cdp", "--device", "no-such-device-42", "--wait", "1"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(skipped.status, 0, skipped.stdout + skipped.stderr);
  assert.match(skipped.stdout, /~ cdp\s+真钱包 CDP\(跳过:/);

  const required = spawnSync(
    process.execPath,
    ["cli/conformance.mjs", "--cdp", "--require-cdp", "--device", "no-such-device-42", "--wait", "1"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(required.status, 1, "require-cdp 时缺设备必须失败");
  assert.match(required.stdout, /✗ cdp/);
});
