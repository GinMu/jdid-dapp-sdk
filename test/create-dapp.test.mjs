import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const run = (args, cwd) =>
  spawnSync(process.execPath, [join(ROOT, "cli/create-dapp.mjs"), ...args], { cwd, encoding: "utf8" });

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "jdid-create-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("create-jdid-dapp 从示例生成一个可自检的 dApp", () => {
  withTempDir((dir) => {
    const result = run(["my-first-dapp"], dir);
    assert.equal(result.status, 0, result.stderr);
    for (const file of ["index.html", "main.js", "jdid-manifest.json"]) {
      assert.ok(existsSync(join(dir, "my-first-dapp", file)), `缺 ${file}`);
    }
    const manifest = JSON.parse(readFileSync(join(dir, "my-first-dapp", "jdid-manifest.json"), "utf8"));
    assert.equal(manifest.name, "my-first-dapp");
    assert.ok(manifest.methods.length > 0);

    // 生成物 import 的是包名;离线环境下用 node_modules 软链指向本仓,模拟"装好包"后的状态
    const modules = join(dir, "my-first-dapp", "node_modules", "@jdid");
    mkdirSync(modules, { recursive: true });
    symlinkSync(ROOT, join(modules, "dapp-sdk"), "dir");

    // 生成出来的骨架必须能直接过 conformance(否则"脚手架"就是坏的)
    const conformance = spawnSync(
      process.execPath,
      ["cli/conformance.mjs", "--dapp", join(dir, "my-first-dapp")],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(conformance.status, 0, conformance.stdout + conformance.stderr);
  });
});

test("目录已存在时拒绝覆盖,--force 才覆盖", () => {
  withTempDir((dir) => {
    assert.equal(run(["dup"], dir).status, 0);
    const second = run(["dup"], dir);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /--force/);
    assert.equal(run(["dup", "--force"], dir).status, 0);
  });
});

test("目录名会被规整成合法的 manifest name", () => {
  withTempDir((dir) => {
    assert.equal(run(["My DApp!!"], dir).status, 0);
    const manifest = JSON.parse(readFileSync(join(dir, "My DApp!!", "jdid-manifest.json"), "utf8"));
    assert.match(manifest.name, /^[a-z][a-z0-9-]{1,63}$/);
  });
});
