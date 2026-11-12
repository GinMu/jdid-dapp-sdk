import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

/**
 * 当前包名。改名(如再次换 scope)必须显式改这里 + 下面的旧名清单,
 * 否则 `npm publish` 会发出一个和引用方不一致的名字。
 */
const PACKAGE_NAME = "@jccdex/jdid-dapp-sdk";

test("package.json 的 name 就是约定的包名(改名必须显式改测试)", () => {
  assert.equal(pkg.name, PACKAGE_NAME);
});

/** 仓库里除 package.json 外不该再出现任何"别的包名"。 */
test("包名只有 package.json 一份:代码与文档都引用它", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "*.mjs", "*.js", "*.md", "*.yml", "*.json"],
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter((f) => f && f !== "package.json");

  const stale = [];
  for (const file of files) {
    const text = readFileSync(resolve(ROOT, file), "utf8");
    // 旧名字:曾经用过、但已经不该再出现。
    // 用拼接构造而不是字面量 —— 否则 `git ls-files` 扫到本文件自己,
    // 会把这个"检测清单"误判成"还在引用旧包名"(守卫自指,永远红)。
    // 再改名前,把"当时用的名字"追加到这个清单里(与 PACKAGE_NAME 是一对)。
    const staleName = ["@jdid", "dapp-sdk"].join("/");
    for (const old of [staleName]) {
      if (text.includes(old)) stale.push(`${file}: ${old}`);
    }
  }
  assert.deepEqual(stale, [], `这些文件还在引用旧包名:\n${stale.join("\n")}`);
});
