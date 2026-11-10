import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

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
    // 旧名字:曾经用过、但已经不该再出现
    for (const old of ["@jdid/dapp-sdk"]) {
      if (text.includes(old)) stale.push(`${file}: ${old}`);
    }
  }
  assert.deepEqual(stale, [], `这些文件还在引用旧包名:\n${stale.join("\n")}`);
});
