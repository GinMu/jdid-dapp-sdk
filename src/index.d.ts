// AUTO-GENERATED from contract/methods.json by scripts/gen.mjs — 不要手改。
// 类型面与 src/index.js 的运行时 API 一一对应;改 API 要同时改 src/index.js 与本模板。

export type MethodName =
  | "swtc_requestAccounts"
  | "swtc_sendTransaction"
  | "swtc_multiSign"
  | "swtc_signMessage"
  | "swtc_getPublicKey"
  | "swtc_batchTransactions"
  | "swtc_requestNfts"
  | "eth_accounts"
  | "eth_requestAccounts"
  | "eth_chainId"
  | "eth_blockNumber"
  | "personal_sign"
  | "personal_ecRecover"
  | "eth_signTypedData"
  | "eth_signTypedData_v3"
  | "eth_signTypedData_v4"
  | "eth_sendTransaction"
  | "eth_signTransaction"
  | "eth_getEncryptionPublicKey"
  | "eth_decrypt"
  | "eth_requestNfts"
  | "wallet_switchEthereumChain"
  | "did_requestAccountName"
  | "did_getBase58PublicKey"
  | "did_issueCredential"
  | "ipfs_personalSign"
  | "ipfs_getPublicKey"
  | "web3_clientVersion";

export type MethodFamily = "eth" | "swtc" | "wallet" | "did" | "ipfs" | "web3";
export type MethodNeed = "account" | "secret" | "confirm" | "chain";
export type MethodStatus = "verified" | "partial" | "stub" | "unknown";
export type MethodSource = "methodEnum" | "dispatch" | "protocol" | "providers" | "hostCapabilities" | "securityDebt";

export interface MethodMeta {
  readonly name: MethodName;
  readonly family: MethodFamily;
  readonly returns: string;
  readonly needs: readonly MethodNeed[];
  readonly status: MethodStatus;
  readonly note?: string;
  readonly source: MethodSource;
}

export declare const CONTRACT_VERSION: string;
export declare const NEEDS: Readonly<Record<"ACCOUNT" | "SECRET" | "CONFIRM" | "CHAIN", MethodNeed>>;
export declare const STATUS: Readonly<Record<"VERIFIED" | "PARTIAL" | "STUB" | "UNKNOWN", MethodStatus>>;
export declare const WALLET: {
  readonly name: string;
  readonly nativeBridge: string;
  readonly providerGlobals: readonly string[];
  readonly envelope: readonly string[];
  readonly responseApi: string;
  readonly errorApi: string;
  readonly events: readonly string[];
  readonly defaultChain: string | null;
};
export declare const METHODS: readonly MethodMeta[];
export declare const METHOD_NAMES: readonly MethodName[];
export declare const METHOD_INDEX: Readonly<Record<MethodName, MethodMeta>>;
export declare function isKnownMethod(name: string): name is MethodName;
export declare function methodsRequiring(need: MethodNeed): readonly MethodMeta[];

export interface WalletRequestArgs {
  method: string;
  params?: unknown;
}
export interface WalletLike {
  request(args: WalletRequestArgs): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
}

export type JdidErrorCode =
  | "wallet_missing"
  | "unknown_method"
  | "timeout"
  | "wallet_rejected"
  | "jdid_dapp_error";

export declare class JdidDappError extends Error {
  readonly code: JdidErrorCode;
  constructor(message: string, options?: { code?: JdidErrorCode; cause?: unknown });
}

export declare const DEFAULT_TIMEOUT_MS: number;

export interface ClientOptions {
  wallet?: WalletLike;
  timeoutMs?: number;
}

export interface MethodPermission {
  readonly name: MethodName;
  readonly needs: readonly MethodNeed[];
  readonly status: MethodStatus;
}

export interface JdidClient {
  readonly wallet: WalletLike;
  request<T = unknown>(name: MethodName, params?: unknown): Promise<T>;
  accounts(): Promise<string[]>;
  connect(): Promise<string[]>;
  connectSwtc(): Promise<string[]>;
  swtcSignMessage(input: { from: string; data: string }): Promise<string>;
  chainId(): Promise<string>;
  blockNumber(): Promise<string>;
  personalSign(args: { message: string; address?: string }): Promise<string>;
  signTypedData(version: "v3" | "v4", payload: unknown): Promise<string>;
  sendTransaction(tx: unknown): Promise<string>;
  signTransaction(tx: unknown): Promise<string>;
  requestNfts(): Promise<unknown[]>;
  switchChain(chainId: string): Promise<null>;
  issueCredential(payload: unknown): Promise<Record<string, unknown>>;
  ipfsSign(args: { message: string }): Promise<string>;
  permissions(): readonly MethodPermission[];
  requiresConfirmation(name: MethodName): boolean;
  on(event: string, listener: (...args: unknown[]) => void): () => void;
}

export declare function createClient(options?: ClientOptions): JdidClient;

export interface NativeTransportOptions {
  postMessage: (payload: string) => void;
  timeoutMs?: number;
}
export interface NativeTransport {
  request<T = unknown>(name: MethodName, params?: unknown, options?: { network?: string }): Promise<T>;
  handleResponse(id: string | number, result: unknown): boolean;
  handleError(id: string | number, error: unknown): boolean;
  readonly pendingCount: number;
}
export declare function createNativeTransport(options: NativeTransportOptions): NativeTransport;
