#!/usr/bin/env node
/**
 * JDID dApp SDK codegen —— 契约单一来源:`contract/methods.json`
 *
 *   生成物(全部提交进仓库,不要手改):
 *     src/methods.js        运行时常量与索引
 *     src/index.d.ts        方法名联合类型 + SDK 公开 API 的类型面
 *     docs/capabilities.md  能力矩阵(给人看的表)
 *
 *   用法:
 *     node scripts/gen.mjs           # 重写三份生成物
 *     node scripts/gen.mjs --check   # 只校验(漂移 → exit 1),CI/守卫用
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = join(ROOT, "contract", "methods.json");

export const FAMILIES = Object.freeze(["eth", "swtc", "wallet", "did", "ipfs", "web3"]);
export const STATUSES = Object.freeze(["verified", "partial", "stub", "unknown"]);
export const NEED_LIST = Object.freeze(["account", "secret", "confirm", "chain"]);

const TARGETS = {
  methods: join(ROOT, "src", "methods.js"),
  types: join(ROOT, "src", "index.d.ts"),
  capabilities: join(ROOT, "docs", "capabilities.md"),
};

export function loadContract(path = CONTRACT_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 返回问题列表(空数组 = 合法)。所有问题一次性报出,不 early-return。 */
export function validateContract(contract) {
  const problems = [];
  const need = (cond, msg) => {
    if (!cond) problems.push(msg);
  };

  need(contract && typeof contract === "object", "contract 必须是对象");
  if (!contract || typeof contract !== "object") return problems;

  need(contract.schemaVersion === 1, `schemaVersion 必须是 1(实际 ${JSON.stringify(contract.schemaVersion)})`);
  need(
    typeof contract.contractVersion === "string" && /^\d+\.\d+\.\d+/.test(contract.contractVersion),
    "contractVersion 必须是语义化版本",
  );

  const wallet = contract.wallet ?? {};
  for (const key of ["name", "nativeBridge", "providerGlobals", "envelope", "responseApi", "errorApi", "events"]) {
    need(wallet[key] !== undefined, `wallet.${key} 缺失`);
  }
  for (const key of ["name", "id", "params"]) {
    need(Array.isArray(wallet.envelope) && wallet.envelope.includes(key), `wallet.envelope 必须含 "${key}"`);
  }
  need(Array.isArray(wallet.providerGlobals) && wallet.providerGlobals.length > 0, "wallet.providerGlobals 不能为空");

  const sources = contract.sources ?? {};
  const sourceKeys = Object.keys(sources);
  need(sourceKeys.length > 0, "sources 不能为空");

  need(Array.isArray(contract.methods) && contract.methods.length > 0, "methods 不能为空");
  const seen = new Set();
  for (const [i, m] of (contract.methods ?? []).entries()) {
    const where = `methods[${i}]${m && m.name ? `(${m.name})` : ""}`;
    need(typeof m?.name === "string" && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(m.name), `${where}.name 非法`);
    need(!seen.has(m?.name), `${where}.name 重复`);
    seen.add(m?.name);
    need(FAMILIES.includes(m?.family), `${where}.family 必须是 ${FAMILIES.join("/")}`);
    need(STATUSES.includes(m?.status), `${where}.status 必须是 ${STATUSES.join("/")}`);
    need(typeof m?.returns === "string" && m.returns.length > 0, `${where}.returns 不能为空`);
    need(Array.isArray(m?.needs), `${where}.needs 必须是数组`);
    if (Array.isArray(m?.needs)) {
      for (const n of m.needs) need(NEED_LIST.includes(n), `${where}.needs 含未知项 ${n}`);
      need(new Set(m.needs).size === m.needs.length, `${where}.needs 有重复`);
      // 不变量:要用户确认的调用一定也要签名材料
      if (m.needs.includes("confirm")) need(m.needs.includes("secret"), `${where}: needs 含 confirm 时必须也含 secret`);
    }
    need(sourceKeys.includes(m?.source), `${where}.source 必须是 sources 里的键(${sourceKeys.join("/")})`);
    if (m?.note !== undefined) need(typeof m.note === "string" && m.note.length > 0, `${where}.note 不能为空串`);
  }

  return problems;
}

const q = (value) => JSON.stringify(value);

function renderMethods(contract) {
  const out = [];
  out.push("// AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。");
  out.push("// 改动流程:改 contract/methods.json → npm run gen → 把三份生成物一起提交。");
  out.push("");
  out.push(`export const CONTRACT_VERSION = ${q(contract.contractVersion)};`);
  out.push("");
  out.push("export const NEEDS = Object.freeze({");
  out.push('  ACCOUNT: "account",');
  out.push('  SECRET: "secret",');
  out.push('  CONFIRM: "confirm",');
  out.push('  CHAIN: "chain",');
  out.push("});");
  out.push("");
  out.push("export const STATUS = Object.freeze({");
  out.push('  VERIFIED: "verified",');
  out.push('  PARTIAL: "partial",');
  out.push('  STUB: "stub",');
  out.push('  UNKNOWN: "unknown",');
  out.push("});");
  out.push("");
  out.push("export const WALLET = Object.freeze({");
  out.push(`  name: ${q(contract.wallet.name)},`);
  out.push(`  nativeBridge: ${q(contract.wallet.nativeBridge)},`);
  out.push(`  providerGlobals: Object.freeze(${q(contract.wallet.providerGlobals)}),`);
  out.push(`  envelope: Object.freeze(${q(contract.wallet.envelope)}),`);
  out.push(`  responseApi: ${q(contract.wallet.responseApi)},`);
  out.push(`  errorApi: ${q(contract.wallet.errorApi)},`);
  out.push(`  events: Object.freeze(${q(contract.wallet.events)}),`);
  out.push(`  defaultChain: ${q(contract.wallet.defaultChain ?? null)},`);
  out.push("});");
  out.push("");
  out.push("export const METHODS = Object.freeze([");
  for (const m of contract.methods) {
    out.push("  Object.freeze({");
    out.push(`    name: ${q(m.name)},`);
    out.push(`    family: ${q(m.family)},`);
    out.push(`    returns: ${q(m.returns)},`);
    out.push(`    needs: Object.freeze(${q(m.needs)}),`);
    out.push(`    status: ${q(m.status)},`);
    if (m.note !== undefined) out.push(`    note: ${q(m.note)},`);
    out.push(`    source: ${q(m.source)},`);
    out.push("  }),");
  }
  out.push("]);");
  out.push("");
  out.push("export const METHOD_NAMES = Object.freeze(METHODS.map((m) => m.name));");
  out.push("");
  out.push("export const METHOD_INDEX = Object.freeze(");
  out.push("  Object.fromEntries(METHODS.map((m) => [m.name, m])),");
  out.push(");");
  out.push("");
  out.push("export function isKnownMethod(name) {");
  out.push("  return typeof name === \"string\" && Object.prototype.hasOwnProperty.call(METHOD_INDEX, name);");
  out.push("}");
  out.push("");
  out.push("export function methodsRequiring(need) {");
  out.push("  return METHODS.filter((m) => m.needs.includes(need));");
  out.push("}");
  out.push("");
  return out.join("\n");
}

function renderTypes(contract) {
  const out = [];
  const names = contract.methods.map((m) => m.name);
  out.push("// AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。");
  out.push("// 类型面与 src/index.js 的运行时 API 一一对应;改 API 要同时改 src/index.js 与本模板。");
  out.push("");
  out.push("export type MethodName =");
  out.push(names.map((n) => `  | ${q(n)}`).join("\n") + ";");
  out.push("");
  out.push(`export type MethodFamily = ${FAMILIES.map(q).join(" | ")};`);
  out.push(`export type MethodNeed = ${NEED_LIST.map(q).join(" | ")};`);
  out.push(`export type MethodStatus = ${STATUSES.map(q).join(" | ")};`);
  out.push(`export type MethodSource = ${Object.keys(contract.sources).map(q).join(" | ")};`);
  out.push("");
  out.push("export interface MethodMeta {");
  out.push("  readonly name: MethodName;");
  out.push("  readonly family: MethodFamily;");
  out.push("  readonly returns: string;");
  out.push("  readonly needs: readonly MethodNeed[];");
  out.push("  readonly status: MethodStatus;");
  out.push("  readonly note?: string;");
  out.push("  readonly source: MethodSource;");
  out.push("}");
  out.push("");
  out.push("export declare const CONTRACT_VERSION: string;");
  out.push("export declare const NEEDS: Readonly<Record<\"ACCOUNT\" | \"SECRET\" | \"CONFIRM\" | \"CHAIN\", MethodNeed>>;");
  out.push("export declare const STATUS: Readonly<Record<\"VERIFIED\" | \"PARTIAL\" | \"STUB\" | \"UNKNOWN\", MethodStatus>>;");
  out.push("export declare const WALLET: {");
  out.push("  readonly name: string;");
  out.push("  readonly nativeBridge: string;");
  out.push("  readonly providerGlobals: readonly string[];");
  out.push("  readonly envelope: readonly string[];");
  out.push("  readonly responseApi: string;");
  out.push("  readonly errorApi: string;");
  out.push("  readonly events: readonly string[];");
  out.push("  readonly defaultChain: string | null;");
  out.push("};");
  out.push("export declare const METHODS: readonly MethodMeta[];");
  out.push("export declare const METHOD_NAMES: readonly MethodName[];");
  out.push("export declare const METHOD_INDEX: Readonly<Record<MethodName, MethodMeta>>;");
  out.push("export declare function isKnownMethod(name: string): name is MethodName;");
  out.push("export declare function methodsRequiring(need: MethodNeed): readonly MethodMeta[];");
  out.push("");
  out.push("export interface WalletRequestArgs {");
  out.push("  method: string;");
  out.push("  params?: unknown;");
  out.push("}");
  out.push("export interface WalletLike {");
  out.push("  request(args: WalletRequestArgs): Promise<unknown>;");
  out.push("  on?(event: string, listener: (...args: unknown[]) => void): unknown;");
  out.push("}");
  out.push("");
  out.push("export type JdidErrorCode =");
  out.push('  | "wallet_missing"');
  out.push('  | "unknown_method"');
  out.push('  | "timeout"');
  out.push('  | "wallet_rejected"');
  out.push('  | "jdid_dapp_error";');
  out.push("");
  out.push("export declare class JdidDappError extends Error {");
  out.push("  readonly code: JdidErrorCode;");
  out.push("  constructor(message: string, options?: { code?: JdidErrorCode; cause?: unknown });");
  out.push("}");
  out.push("");
  out.push("export declare const DEFAULT_TIMEOUT_MS: number;");
  out.push("");
  out.push("export interface ClientOptions {");
  out.push("  wallet?: WalletLike;");
  out.push("  timeoutMs?: number;");
  out.push("}");
  out.push("");
  out.push("export interface MethodPermission {");
  out.push("  readonly name: MethodName;");
  out.push("  readonly needs: readonly MethodNeed[];");
  out.push("  readonly status: MethodStatus;");
  out.push("}");
  out.push("");
  out.push("export interface JdidClient {");
  out.push("  readonly wallet: WalletLike;");
  out.push("  request<T = unknown>(name: MethodName, params?: unknown): Promise<T>;");
  out.push("  accounts(): Promise<string[]>;");
  out.push("  chainId(): Promise<string>;");
  out.push("  blockNumber(): Promise<string>;");
  out.push("  personalSign(args: { message: string; address?: string }): Promise<string>;");
  out.push('  signTypedData(version: "v3" | "v4", payload: unknown): Promise<string>;');
  out.push("  sendTransaction(tx: unknown): Promise<string>;");
  out.push("  signTransaction(tx: unknown): Promise<string>;");
  out.push("  requestNfts(): Promise<unknown[]>;");
  out.push("  switchChain(chainId: string): Promise<null>;");
  out.push("  issueCredential(payload: unknown): Promise<Record<string, unknown>>;");
  out.push("  ipfsSign(args: { message: string }): Promise<string>;");
  out.push("  permissions(): readonly MethodPermission[];");
  out.push("  requiresConfirmation(name: MethodName): boolean;");
  out.push("  on(event: string, listener: (...args: unknown[]) => void): () => void;");
  out.push("}");
  out.push("");
  out.push("export declare function createClient(options?: ClientOptions): JdidClient;");
  out.push("");
  out.push("export interface NativeTransportOptions {");
  out.push("  postMessage: (payload: string) => void;");
  out.push("  timeoutMs?: number;");
  out.push("}");
  out.push("export interface NativeTransport {");
  out.push("  request<T = unknown>(name: MethodName, params?: unknown, options?: { network?: string }): Promise<T>;");
  out.push("  handleResponse(id: string | number, result: unknown): boolean;");
  out.push("  handleError(id: string | number, error: unknown): boolean;");
  out.push("  readonly pendingCount: number;");
  out.push("}");
  out.push("export declare function createNativeTransport(options: NativeTransportOptions): NativeTransport;");
  out.push("");
  return out.join("\n");
}

function renderCapabilities(contract) {
  const counts = {};
  for (const s of STATUSES) counts[s] = contract.methods.filter((m) => m.status === s).length;
  const out = [];
  out.push("# JDID dApp 能力矩阵");
  out.push("");
  out.push("<!-- AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。 -->");
  out.push("");
  out.push(`契约版本 **${contract.contractVersion}** · 方法 **${contract.methods.length}** 个:`);
  out.push(
    STATUSES.map((s) => `${s} ${counts[s]}`).join(" · "),
  );
  out.push("");
  out.push("> `status` 含义见 `contract/methods.json` 的 `statusCatalog`;`needs` 里的 `confirm`/`secret`");
  out.push("> 就是钱包会向用户弹出的授权/确认面,`jdid-manifest.json` 必须如实声明。");
  out.push("");
  out.push("| 方法 | 族 | 返回 | needs | status | 说明 |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const m of contract.methods) {
    const needs = m.needs.length ? m.needs.join(", ") : "—";
    out.push(`| \`${m.name}\` | ${m.family} | \`${m.returns}\` | ${needs} | **${m.status}** | ${m.note ?? "—"} |`);
  }
  out.push("");
  out.push("## 数据来源");
  out.push("");
  for (const [key, value] of Object.entries(contract.sources)) {
    out.push(`- \`${key}\`: ${value}`);
  }
  out.push("");
  return out.join("\n");
}

export function generate(contract) {
  return {
    methods: renderMethods(contract),
    types: renderTypes(contract),
    capabilities: renderCapabilities(contract),
  };
}

function main() {
  const check = process.argv.includes("--check");
  const contract = loadContract();
  const problems = validateContract(contract);
  if (problems.length > 0) {
    console.error("contract/methods.json 不合法:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const outputs = generate(contract);
  const drifted = [];
  for (const [key, content] of Object.entries(outputs)) {
    const path = TARGETS[key];
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (current === content) continue;
    drifted.push(path);
    if (!check) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf8");
    }
  }

  if (check) {
    if (drifted.length > 0) {
      console.error("生成物与 contract/methods.json 不一致(跑 `npm run gen` 后一起提交):");
      for (const p of drifted) console.error(`  - ${p.replace(`${ROOT}/`, "")}`);
      process.exit(1);
    }
    console.log(`gen:check OK — ${contract.methods.length} 个方法,3 份生成物与契约一致`);
    return;
  }

  console.log(
    `生成完成:${contract.methods.length} 个方法 → ${drifted.length === 0 ? "无变化" : drifted.map((p) => p.replace(`${ROOT}/`, "")).join(", ")}`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
