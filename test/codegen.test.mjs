import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generate, loadContract } from "../scripts/gen.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const gen = (argv) => spawnSync(process.execPath, ["scripts/gen.mjs", ...argv], { cwd: ROOT, encoding: "utf8" });

/** 把生成链路拷到临时目录里跑,避免测试并发时手改仓库文件(也不要求工作区可写)。 */
function sandboxCopy(t) {
  for (const base of ["/tmp", tmpdir(), ROOT]) {
    let dir;
    try {
      dir = mkdtempSync(join(base, "jdid-dapp-sdk-"));
      // package.json 也要拷:gen.mjs 会校验 package version === contractVersion。
      for (const sub of ["contract", "scripts", "src", "docs"]) {
        cpSync(join(ROOT, sub), join(dir, sub), { recursive: true });
      }
      cpSync(join(ROOT, "package.json"), join(dir, "package.json"));
    } catch (error) {
      if (dir) rmSync(dir, { recursive: true, force: true });
      if (["EPERM", "EACCES", "EROFS", "ENOENT"].includes(error?.code)) continue;
      throw error;
    }
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
  }
  return undefined;
}

const checkIn = (dir) =>
  spawnSync(process.execPath, ["scripts/gen.mjs", "--check"], { cwd: dir, encoding: "utf8" });

test("生成物与契约同步(gen --check 通过)", () => {
  const result = gen(["--check"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /gen:check OK/);
});

test("契约变更而生成物未重生成 → 判据必然报不一致(不写盘)", () => {
  const mutated = structuredClone(loadContract());
  mutated.methods.push({
    name: "eth_probeAddedOnly",
    family: "eth",
    returns: "string",
    needs: [],
    status: "verified",
    source: "dispatch",
  });
  const regenerated = generate(mutated);
  const onDisk = readFileSync(join(ROOT, "src", "methods.js"), "utf8");
  assert.notEqual(regenerated.methods, onDisk, "生成物应与新契约不同");
  assert.match(regenerated.methods, /eth_probeAddedOnly/);
  assert.doesNotMatch(onDisk, /eth_probeAddedOnly/);
});

test("反向证明:手改生成物后 gen --check 必须报红(在临时副本里做)", (t) => {
  const dir = sandboxCopy(t);
  if (!dir) {
    t.skip("当前环境没有可写的临时目录");
    return;
  }

  const clean = checkIn(dir);
  assert.equal(clean.status, 0, `未改动的副本应通过:${clean.stderr}`);

  const target = join(dir, "src", "methods.js");
  writeFileSync(target, `${readFileSync(target, "utf8")}\n// 手改一行,模拟有人绕过 contract 改生成物\n`, "utf8");
  const drift = checkIn(dir);
  assert.equal(drift.status, 1, "漂移必须让 gen --check 失败");
  assert.match(drift.stderr, /不一致/);
  assert.match(drift.stderr, /src\/methods\.js/);
});
