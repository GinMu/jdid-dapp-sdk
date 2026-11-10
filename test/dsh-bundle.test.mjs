import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

test("package.json 声明了 DSH bundle 补丁,且文件存在", () => {
  const patch = pkg.dsh?.bundle?.patch;
  assert.ok(patch, "缺 dsh.bundle.patch:插件页就装不出 MCP 配置");
  assert.ok(existsSync(resolve(ROOT, patch)), `补丁文件不存在:${patch}`);
});

test("bundle 补丁用 insert 注册 mcp-jdid-wallet,并走已发布的包名", () => {
  // 本包零依赖,不引 yaml 解析器:这份补丁就一个条目,按行断言足够且更直白。
  const text = readFileSync(resolve(ROOT, pkg.dsh.bundle.patch), "utf8");
  assert.match(text, /^- insert:/m, "新插件必须用 insert 列表(带 id 的条目只能覆盖已有插件)");
  assert.match(text, /^\s+- id: mcp-jdid-wallet$/m);
  assert.match(text, /name: "@deepseek-ai\/dsh-mcp-client"/);
  assert.match(text, /serverName: jdid-wallet/);
  assert.match(text, /transport: stdio/);
  // 发布后直接按包名起 bin,不写死本机绝对路径
  assert.match(text, /command: npx/);
  assert.match(text, /args: \["-y", "@jdid\/dapp-sdk", "jdid-wallet-mcp"\]/);
});

test("dsh/ 在发布白名单里,bin 里有 jdid-wallet-mcp", () => {
  assert.ok(pkg.files.includes("dsh"), "files 里缺 dsh:装上也没有补丁文件");
  assert.ok(pkg.bin["jdid-wallet-mcp"], "bin 里缺 jdid-wallet-mcp:npx 起不来");
});
