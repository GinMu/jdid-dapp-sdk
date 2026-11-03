import test from "node:test";
import assert from "node:assert/strict";
import { createClient, createNativeTransport, JdidDappError, resolveInjectedWallet } from "../src/index.js";
import { createMockWallet } from "../src/mock.js";

test("typed helper 走 mock 并记录调用", async () => {
  const wallet = createMockWallet();
  const jdid = createClient({ wallet });

  assert.deepEqual(await jdid.accounts(), ["0x000000000000000000000000000000000000dEaD"]);
  assert.equal(await jdid.chainId(), "0x3d");
  assert.equal(await jdid.personalSign({ message: "hi" }), "0xMOCKSIGNATURE");

  assert.deepEqual(
    wallet.calls.map((c) => c.method),
    ["eth_accounts", "eth_chainId", "personal_sign"],
  );
  assert.deepEqual(wallet.calls[2].params, ["hi"]);
});

test("personalSign 带地址时按 EIP-1193 顺序传 [message, address]", async () => {
  const wallet = createMockWallet();
  await createClient({ wallet }).personalSign({ message: "hi", address: "0xabc" });
  assert.deepEqual(wallet.calls[0].params, ["hi", "0xabc"]);
});

test("未知方法在发出去之前就被拒(白名单)", async () => {
  const wallet = createMockWallet();
  const jdid = createClient({ wallet });
  await assert.rejects(
    () => jdid.request("eth_foo"),
    (error) => error instanceof JdidDappError && error.code === "unknown_method",
  );
  assert.equal(wallet.calls.length, 0, "不该把未知方法发给钱包");
});

test("没有注入 provider 时给出可执行的报错(wallet_missing)", () => {
  assert.throws(
    () => createClient({}),
    (error) => error instanceof JdidDappError && error.code === "wallet_missing" && /Explore\/DApp/.test(error.message),
  );
});

test("钱包拒绝时归一化成 wallet_rejected,并保留原始 code", async () => {
  const wallet = createMockWallet({ failOn: ["personal_sign"] });
  const jdid = createClient({ wallet });
  await assert.rejects(
    () => jdid.personalSign({ message: "hi" }),
    (error) =>
      error instanceof JdidDappError &&
      error.code === "wallet_rejected" &&
      /钱包 code 4001/.test(error.message) &&
      error.cause?.code === 4001,
  );
});

test("钱包不响应时超时,而不是永远挂着", async () => {
  const wallet = { request: () => new Promise(() => {}) };
  const jdid = createClient({ wallet, timeoutMs: 20 });
  await assert.rejects(
    () => jdid.accounts(),
    (error) => error instanceof JdidDappError && error.code === "timeout",
  );
});

test("requiresConfirmation 与契约一致", () => {
  const jdid = createClient({ wallet: createMockWallet() });
  assert.equal(jdid.requiresConfirmation("eth_sendTransaction"), true);
  assert.equal(jdid.requiresConfirmation("did_issueCredential"), true);
  assert.equal(jdid.requiresConfirmation("eth_accounts"), false);
  assert.equal(jdid.requiresConfirmation("nope"), false);
});

test("permissions() 覆盖契约里全部方法", () => {
  const jdid = createClient({ wallet: createMockWallet() });
  const permissions = jdid.permissions();
  assert.equal(permissions.length, 28);
  assert.ok(permissions.every((p) => Array.isArray(p.needs)));
});

test("_tw_ transport:envelope 只含 name/network/id/params,响应按 id 结算", async () => {
  const sent = [];
  const transport = createNativeTransport({
    postMessage: (payload) => sent.push(JSON.parse(payload)),
    timeoutMs: 1_000,
  });

  const pending = transport.request("eth_chainId");
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]), ["name", "network", "id", "params"]);
  assert.equal(sent[0].name, "eth_chainId");
  assert.equal(sent[0].network, "swtc");
  assert.equal(transport.pendingCount, 1);

  assert.equal(transport.handleResponse(sent[0].id, "0x3d"), true);
  assert.equal(await pending, "0x3d");
  assert.equal(transport.pendingCount, 0);
  // 同一个 id 只允许结算一次
  assert.equal(transport.handleResponse(sent[0].id, "0x99"), false);
});

test("_tw_ transport:未知方法直接 reject,不发 postMessage", async () => {
  let posted = 0;
  const transport = createNativeTransport({ postMessage: () => (posted += 1), timeoutMs: 100 });
  await assert.rejects(() => transport.request("eth_nope"), (error) => error.code === "unknown_method");
  assert.equal(posted, 0);
});

test("resolveInjectedWallet 只认带 request 的对象", () => {
  assert.equal(resolveInjectedWallet({}), undefined);
  assert.equal(resolveInjectedWallet({ ethereum: {} }), undefined);
  const fake = { request: async () => null };
  assert.equal(resolveInjectedWallet({ ethereum: fake }), fake);
  assert.equal(resolveInjectedWallet({ ccdao: fake }), fake);
});
