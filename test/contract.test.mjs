import test from "node:test";
import assert from "node:assert/strict";
import { loadContract, validateContract } from "../scripts/gen.mjs";
import { METHOD_INDEX, METHOD_NAMES, WALLET, NEEDS, isKnownMethod, methodsRequiring } from "../src/methods.js";

const contract = loadContract();

/**
 * 作者可依赖的方法面(v0.2.0 起从 28 条收敛为 7 条,全部 verified)。
 * 改契约必须显式改这里 —— 这是"契约收缩"的唯一入口。
 */
const EXPECTED_METHODS = [
  "swtc_requestAccounts",
  "eth_requestAccounts",
  "did_requestAccountName",
  "did_getBase58PublicKey",
  "did_issueCredential",
  "ipfs_personalSign",
  "ipfs_getPublicKey",
  // DID bridge 能力(2026-11-09 加入;两端已实现)
  "did_publish",
  "did_resolve",
  "did_stat",
  "did_generateVC",
  "did_verifyCredential",
  "did_generateDidDoc",
];

test("契约合法(validateContract 无问题)", () => {
  assert.deepEqual(validateContract(contract), []);
});

test("方法集合就是作者可依赖的 13 条", () => {
  assert.deepEqual([...METHOD_NAMES].sort(), [...EXPECTED_METHODS].sort());
});

test("方法名唯一且都能被 isKnownMethod 认出", () => {
  assert.equal(new Set(METHOD_NAMES).size, METHOD_NAMES.length);
  for (const name of METHOD_NAMES) assert.equal(isKnownMethod(name), true);
  assert.equal(isKnownMethod("eth_doesNotExist"), false);
  assert.equal(isKnownMethod("toString"), false); // 原型链上的名字不算
});

test("线格式与审计文档一致(_tw_ + name/network/id/params)", () => {
  assert.equal(WALLET.nativeBridge, "_tw_");
  assert.deepEqual(WALLET.envelope, ["name", "network", "id", "params"]);
  assert.ok(WALLET.providerGlobals.includes("ethereum"));
  assert.ok(WALLET.events.includes("_updateSelectedAddress"));
  assert.equal(WALLET.defaultChain, "swtc");
});

test("不变量:needs 含 confirm 的方法一定也含 secret", () => {
  const confirm = methodsRequiring(NEEDS.CONFIRM);
  assert.ok(confirm.length > 0, "至少应有需要用户确认的方法");
  for (const m of confirm) assert.ok(m.needs.includes(NEEDS.SECRET), `${m.name} 缺 secret`);
});

test("13 条都带说明;核心 7 条 verified,DID bridge 6 条待实测(partial)", () => {
  assert.equal(contract.methods.length, 13);
  for (const m of contract.methods) {
    assert.ok(m.note && m.note.length > 0, `${m.name} 缺说明(note)`);
  }
  const core = contract.methods.slice(0, 7);
  for (const m of core) assert.equal(m.status, "verified", `${m.name} 应为 verified`);
  const bridge = contract.methods.slice(7);
  assert.equal(bridge.length, 6);
  const verified = bridge.filter((m) => m.status === "verified").map((m) => m.name).sort();
  assert.deepEqual(verified, ["did_generateDidDoc", "did_resolve", "did_verifyCredential"].sort());
  const pending = bridge.filter((m) => m.status === "partial").map((m) => m.name).sort();
  assert.deepEqual(pending, ["did_generateVC", "did_publish", "did_stat"].sort());
});

test("动钱方法不在契约内(自检与 agent 都不该自动调用)", () => {
  for (const name of ["swtc_sendTransaction", "eth_sendTransaction", "swtc_multiSign", "swtc_batchTransactions"]) {
    assert.equal(isKnownMethod(name), false, `${name} 不应出现在契约里`);
  }
});
