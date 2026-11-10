import test from "node:test";
import assert from "node:assert/strict";
import { didFor, paramsFor } from "../cli/calibrate-params.mjs";

test("地址推导 DID:SWTC 前缀 / EVM 前缀 / 缺省", () => {
  assert.equal(didFor("jwWmuiTest"), "did:swtc:jwWmuiTest");
  assert.equal(didFor("0xabc"), "did:ethr:0xabc");
  assert.equal(didFor(""), "did:swtc:");
  assert.equal(didFor(undefined), "did:swtc:");
});

test("DID bridge 的只读方法带真实 DID", () => {
  const did = "did:swtc:jwWmuiTest";
  assert.deepEqual(paramsFor("did_generateDidDoc", "jwWmuiTest"), [{ did, version: "1.0" }]);
  assert.deepEqual(paramsFor("did_resolve", "jwWmuiTest"), [did]);
  assert.deepEqual(paramsFor("did_stat", "jwWmuiTest"), [did]);
  assert.deepEqual(paramsFor("did_verifyCredential", "jwWmuiTest"), [JSON.stringify({ id: `${did}#vc-1` })]);
});

test("写链/签发的方法只给空对象(只验路由,不写链、不弹确认)", () => {
  assert.deepEqual(paramsFor("did_publish", "jwWmuiTest"), [{}]);
  assert.deepEqual(paramsFor("did_generateVC", "jwWmuiTest"), [{}]);
});

test("既有方法与未知方法的参数保持原样", () => {
  assert.deepEqual(paramsFor("personal_sign", "0xabc"), ["0x68656c6c6f", "0xabc"]);
  assert.deepEqual(paramsFor("ipfs_getPublicKey", "jwWmuiTest"), ["jwWmuiTest"]);
  assert.deepEqual(paramsFor("did_requestAccountName", "jwWmuiTest"), ["jwWmuiTest"]);
  assert.deepEqual(paramsFor("web3_clientVersion", "jwWmuiTest"), []);
});
