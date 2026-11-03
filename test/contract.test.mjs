import test from "node:test";
import assert from "node:assert/strict";
import { loadContract, validateContract } from "../scripts/gen.mjs";
import { METHOD_INDEX, METHOD_NAMES, WALLET, NEEDS, isKnownMethod, methodsRequiring } from "../src/methods.js";

const contract = loadContract();

/** 与 kotlin-toolkits/dapp-connect 的 `DAppMethod.kt` 一一对应;改契约必须显式改这里。 */
const EXPECTED_METHODS = [
  "swtc_requestAccounts",
  "swtc_sendTransaction",
  "swtc_multiSign",
  "swtc_signMessage",
  "swtc_getPublicKey",
  "swtc_batchTransactions",
  "swtc_requestNfts",
  "eth_accounts",
  "eth_requestAccounts",
  "eth_chainId",
  "eth_blockNumber",
  "personal_sign",
  "personal_ecRecover",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_getEncryptionPublicKey",
  "eth_decrypt",
  "eth_requestNfts",
  "wallet_switchEthereumChain",
  "did_requestAccountName",
  "did_getBase58PublicKey",
  "did_issueCredential",
  "ipfs_personalSign",
  "ipfs_getPublicKey",
  "web3_clientVersion",
];

test("契约合法(validateContract 无问题)", () => {
  assert.deepEqual(validateContract(contract), []);
});

test("方法集合与 DAppMethod.kt 的 28 个方法一致", () => {
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

test("已知风险在契约里如实标注(stub/partial 有 note)", () => {
  assert.equal(METHOD_INDEX.eth_blockNumber.status, "stub");
  assert.equal(METHOD_INDEX.eth_requestNfts.status, "stub");
  assert.equal(METHOD_INDEX.personal_sign.status, "partial");
  for (const m of contract.methods) {
    if (m.status !== "verified") assert.ok(m.note, `${m.name} 标了 ${m.status} 但没写 note`);
  }
});
