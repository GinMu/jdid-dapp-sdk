import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

/**
 * 运行时入口:`bin` 指向的文件、`exports` 暴露的文件,以及文档里公开的 mock。
 * 从这些文件出发沿相对 import 递归,得到"装到用户机器上后真正会被加载的文件集合"。
 */
const ENTRIES = [
  ...Object.values(pkg.bin ?? {}),
  ...Object.values(pkg.exports ?? {}),
  "src/mock.js",
];

const IMPORT_PATTERNS = [
  /(?:^|[^\w$.])from\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*["']([^"']+)["']/g,
];

/** 一个文件里所有以 "." 开头的 import 说明符(包内相对依赖)。 */
function relativeImports(file) {
  const text = readFileSync(file, "utf8");
  const specs = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of text.matchAll(pattern)) specs.add(match[1]);
  }
  return [...specs].filter((spec) => spec.startsWith("."));
}

/** 从入口出发做闭包遍历;顺带断言每个被 import 的文件真实存在。 */
function collect(entries) {
  const seen = new Set();
  const queue = entries.map((entry) => resolve(ROOT, entry));
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    assert.ok(existsSync(file), `入口或依赖文件不存在:${relative(ROOT, file)}`);
    for (const spec of relativeImports(file)) queue.push(resolve(dirname(file), spec));
  }
  return seen;
}

/** 该文件是否会被 `npm publish` 打进 tarball(`files` 条目是目录前缀或精确路径)。 */
function isPublished(file) {
  const rel = relative(ROOT, file);
  if (rel.startsWith("..")) return true; // 包外文件不归本包管
  return pkg.files.some((entry) => rel === entry || rel.startsWith(`${entry}/`));
}

test("files 覆盖所有运行时会 import 的文件", () => {
  const loaded = collect(ENTRIES);
  const missing = [...loaded]
    .filter((file) => !isPublished(file))
    .map((file) => relative(ROOT, file));
  assert.deepEqual(
    missing,
    [],
    "这些文件运行时会 import,但没进 package.json 的 files;发布后装上就是 " +
      `ERR_MODULE_NOT_FOUND:\n${missing.join("\n")}`,
  );
});

test("files 里的每个条目都真实存在", () => {
  const missing = pkg.files.filter((entry) => !existsSync(resolve(ROOT, entry)));
  assert.deepEqual(missing, [], `files 里有不存在的路径(改名后忘了同步):${missing.join(", ")}`);
});
