import test from "node:test";
import assert from "node:assert/strict";
import { createClient, createNativeTransport, JdidDappError, resolveInjectedWallet } from "../src/index.js";
import { createMockWallet } from "../src/mock.js";

test("typed helper 走 mock 并记录调用", async () => {
  const wallet = createMockWallet();
  const jdid = createClient({ wallet });

  const accounts = await jdid.connectSwtc();
  assert.deepEqual(accounts, ["jMOCKswtcAddressForTestingOnly1111111111"]);
  const address = accounts[0];
  assert.deepEqual(await jdid.requestAccountName(address), { name: "MOCK-NAME" });
  assert.equal(await jdid.base58PublicKey(address), "MOCK-BASE58-KEY");
  assert.deepEqual(
    wallet.calls.map((c) => c.method),
    ["swtc_requestAccounts", "did_requestAccountName", "did_getBase58PublicKey"],
  );
});

test("7 个 helper 各自带着正确的方法名与参数顺序", async () => {
  const wallet = createMockWallet();
  const jdid = createClient({ wallet });
  const address = "jMOCKswtcAddressForTestingOnly1111111111";

  await jdid.connect();
  await jdid.connectSwtc();
  await jdid.requestAccountName(address);
  await jdid.base58PublicKey(address);
  await jdid.issueCredential({ credential: { type: ["VerifiableCredential"] } });
  await jdid.ipfsSign({ data: [1, 2, 3], address });
  await jdid.ipfsPublicKey(address);

  assert.deepEqual(
    wallet.calls.map((c) => c.method),
    [
      "eth_requestAccounts",
      "swtc_requestAccounts",
      "did_requestAccountName",
      "did_getBase58PublicKey",
      "did_issueCredential",
      "ipfs_personalSign",
      "ipfs_getPublicKey",
    ],
  );
  assert.deepEqual(wallet.calls[2].params, [address]);
  assert.deepEqual(wallet.calls[3].params, [address]);
  assert.deepEqual(wallet.calls[4].params, [{ credential: { type: ["VerifiableCredential"] } }]);
  assert.deepEqual(wallet.calls[5].params, [[1, 2, 3], address]);
  assert.deepEqual(wallet.calls[6].params, [address]);
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
  const wallet = createMockWallet({ failOn: ["did_getBase58PublicKey"] });
  const jdid = createClient({ wallet });
  await assert.rejects(
    () => jdid.base58PublicKey("jMOCKswtcAddressForTestingOnly1111111111"),
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
    () => jdid.connectSwtc(),
    (error) => error instanceof JdidDappError && error.code === "timeout",
  );
});

test("requiresConfirmation 与契约一致", () => {
  const jdid = createClient({ wallet: createMockWallet() });
  // 契约里唯一要用户"确认"的是签发凭证(needs 含 confirm);其余只有 account/secret。
  assert.equal(jdid.requiresConfirmation("did_issueCredential"), true);
  assert.equal(jdid.requiresConfirmation("swtc_requestAccounts"), false);
  assert.equal(jdid.requiresConfirmation("ipfs_personalSign"), false);
  assert.equal(jdid.requiresConfirmation("nope"), false);
});

test("permissions() 覆盖契约里全部方法", () => {
  const jdid = createClient({ wallet: createMockWallet() });
  const permissions = jdid.permissions();
  assert.equal(permissions.length, 7);
  assert.ok(permissions.every((p) => Array.isArray(p.needs)));
});

test("_tw_ transport:envelope 只含 name/network/id/params,响应按 id 结算", async () => {
  const sent = [];
  const transport = createNativeTransport({
    postMessage: (payload) => sent.push(JSON.parse(payload)),
    timeoutMs: 1_000,
  });

  const pending = transport.request("did_requestAccountName", ["jMOCK"]);
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]), ["name", "network", "id", "params"]);
  assert.equal(sent[0].name, "did_requestAccountName");
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
