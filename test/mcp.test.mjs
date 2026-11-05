import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/** 起一个 MCP server 进程,并按 JSON-RPC id 收发。 */
function startServer() {
  const child = spawn(process.execPath, ["mcp/server.mjs"], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter(message);
    }
  });
  let nextId = 1;
  const call = (method, params) =>
    new Promise((resolvePromise, reject) => {
      const id = nextId++;
      pending.set(id, resolvePromise);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`超时:${method}`));
      }, 15_000).unref?.();
    });
  const stop = () => child.kill();
  return { call, stop };
}

test("initialize 返回 serverInfo 与 tools 能力", async () => {
  const { call, stop } = startServer();
  try {
    const response = await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } });
    assert.equal(response.result.serverInfo.name, "jdid-wallet-mcp");
    assert.ok(response.result.capabilities.tools);
  } finally {
    stop();
  }
});

test("tools/list 暴露驱动钱包所需的工具", async () => {
  const { call, stop } = startServer();
  try {
    const response = await call("tools/list", {});
    const names = response.result.tools.map((t) => t.name);
    for (const expected of ["jdid_devices", "jdid_open_dapp", "jdid_probe", "jdid_eval", "jdid_logcat", "jdid_screenshot", "jdid_conformance"]) {
      assert.ok(names.includes(expected), `缺少工具 ${expected}`);
    }
    for (const tool of response.result.tools) {
      assert.equal(tool.inputSchema.type, "object");
    }
  } finally {
    stop();
  }
});

test("tools/call 未知工具返回 JSON-RPC 错误,进程仍可用", async () => {
  const { call, stop } = startServer();
  try {
    const response = await call("tools/call", { name: "jdid_not_a_tool", arguments: {} });
    assert.equal(response.error.code, -32602);
    assert.match(response.error.message, /未知工具/);
    // 出错之后 server 不能挂:还能继续响应
    const after = await call("tools/list", {});
    assert.ok(Array.isArray(after.result.tools));
  } finally {
    stop();
  }
});

test("tools/call jdid_devices 在没有设备时也返回可读文本", async () => {
  const { call, stop } = startServer();
  try {
    const response = await call("tools/call", { name: "jdid_devices", arguments: {} });
    assert.equal(response.result.isError, false);
    assert.equal(typeof response.result.content[0].text, "string");
    assert.ok(response.result.content[0].text.length > 0);
  } finally {
    stop();
  }
});

test("未知方法返回 JSON-RPC 错误码 -32601", async () => {
  const { call, stop } = startServer();
  try {
    const response = await call("does/notExist", {});
    assert.equal(response.error.code, -32601);
  } finally {
    stop();
  }
});
