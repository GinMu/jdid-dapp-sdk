import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const runCli = (dapp) =>
  spawnSync(process.execPath, ["cli/conformance.mjs", "--dapp", dapp], { cwd: ROOT, encoding: "utf8" });

test("示例 dApp 全过", () => {
  const result = runCli("examples/minimal-dapp");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /全部通过/);
  assert.match(
    result.stdout,
    /实际调用\(7\):swtc_requestAccounts, did_requestAccountName, did_getBase58PublicKey, ipfs_personalSign, did_generateDidDoc, did_resolve, ipfs_getPublicKey/,
  );
  assert.match(result.stdout, /用户授权\/确认面:secret/);
});

test("所有示例目录都能通过自检(新增示例不能烂在仓库里)", () => {
  for (const dapp of ["examples/minimal-dapp", "examples/did-lookup"]) {
    const result = runCli(dapp);
    assert.equal(result.status, 0, `${dapp} 应通过:\n${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /全部通过/, `${dapp} 应报告"全部通过"`);
  }
});

test("反向证明:用了未声明的方法必须判红", () => {
  const result = runCli("test/fixtures/undeclared-method");
  assert.equal(result.status, 1, "fixture 必须失败");
  assert.match(result.stdout, /dapp-source/);
  assert.match(result.stdout, /did_getBase58PublicKey,但 jdid-manifest\.json 没有声明/);
  assert.match(result.stdout, /结果:1 项失败/);
});

test("--json 输出可被机器消费", () => {
  const result = spawnSync(process.execPath, ["cli/conformance.mjs", "--json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.contractVersion, "0.0.1");
  assert.deepEqual(report.declaredMethods, [
    "swtc_requestAccounts",
    "did_requestAccountName",
    "did_getBase58PublicKey",
    "ipfs_getPublicKey",
    "ipfs_personalSign",
    "did_generateDidDoc",
    "did_resolve",
  ]);
  assert.deepEqual(report.promptSurface, ["secret"]);
  assert.deepEqual(
    report.results.map((r) => r.id),
    ["contract", "codegen", "manifest", "dapp-source", "smoke"],
  );
});
