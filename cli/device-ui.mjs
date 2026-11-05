/**
 * 设备 UI 小工具 —— 只做 `--auto-open` 需要的那一点:读 uiautomator dump、找节点、点、输入。
 *
 * 为什么不引依赖:uiautomator 的 dump 是结构化 XML,正则取 `text/content-desc/class/bounds`
 * 足够用;真正的导航逻辑仍放在 conformance 里,找不到元素时给明确报错而不是瞎点。
 */
import { spawnSync } from "node:child_process";

/** 把 uiautomator dump 的 XML 解析成节点数组(text / desc / cls / bounds)。 */
export function parseUiNodes(xml) {
  const nodes = [];
  const nodeRe = /<node\b([^>]*)\/?>/g;
  let match;
  while ((match = nodeRe.exec(xml)) !== null) {
    const attrs = match[1];
    const pick = (name) => {
      const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : "";
    };
    nodes.push({
      text: pick("text"),
      desc: pick("content-desc"),
      cls: pick("class"),
      resourceId: pick("resource-id"),
      bounds: pick("bounds"),
      clickable: pick("clickable") === "true",
    });
  }
  return nodes;
}

/** 找第一个 text 或 content-desc 命中候选词的节点(精确匹配优先,其次包含)。 */
export function findByText(nodes, candidates) {
  const list = candidates.filter(Boolean);
  for (const want of list) {
    const exact = nodes.find((n) => n.text === want || n.desc === want);
    if (exact) return exact;
  }
  for (const want of list) {
    const partial = nodes.find((n) => (n.text && n.text.includes(want)) || (n.desc && n.desc.includes(want)));
    if (partial) return partial;
  }
  return null;
}

/**
 * 找输入框。
 *
 * ①有 `EditText` 就优先用它(按提示词命中 > 第一个);②Compose 的输入框常被渲染成
 * `TextView`/`View`(实测 Explore 的搜索框就是 `android.widget.TextView` + 占位文本),
 * 所以在没有 EditText 时退化为"提示词命中的节点",并优先可点击的那个。
 */
export function findInput(nodes, candidates = []) {
  const edits = nodes.filter((n) => /EditText/i.test(n.cls));
  if (edits.length > 0) {
    const hinted = edits.find(
      (n) => candidates.some((c) => (n.text && n.text.includes(c)) || (n.desc && n.desc.includes(c))),
    );
    return hinted ?? edits[0];
  }
  const hinted = nodes.filter((n) =>
    candidates.some((c) => (n.text && n.text.includes(c)) || (n.desc && n.desc.includes(c))),
  );
  return hinted.find((n) => n.clickable) ?? hinted[0] ?? null;
}

/** `[x1,y1][x2,y2]` → 中心点坐标。 */
export function boundsCenter(bounds) {
  const m = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(bounds ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}

const run = (device, args) => spawnSync("adb", ["-s", device, ...args], { encoding: "utf8" });
const adbShell = run;

/** 抓一次 UI 层级并解析。 */
export function dumpUi(device) {
  run(device, ["shell", "uiautomator", "dump", "/sdcard/jdid-ui.xml"]);
  const out = run(device, ["shell", "cat", "/sdcard/jdid-ui.xml"]);
  return parseUiNodes(out.stdout ?? "");
}

export function tapBounds(device, bounds) {
  const center = boundsCenter(bounds);
  if (!center) return false;
  run(device, ["shell", "input", "tap", String(center.x), String(center.y)]);
  return true;
}

export function typeText(device, text) {
  // adb input text 不支持空格与部分符号;URL 里常见字符需转义。
  const escaped = text.replace(/[()&<>|;*`$!"'\\]/g, "\\$&").replace(/ /g, "%s");
  run(device, ["shell", "input", "text", escaped]);
}

export function pressEnter(device) {
  run(device, ["shell", "input", "keyevent", "66"]);
}


/**
 * `--auto-open`:拉起 App → 进 Explore → 用「最近访问」打开地址。
 *
 * **为什么优先点最近访问而不是打字**:实测中文输入法会把 `http://` 改写成全角
 * `HTTP：／／`、吞掉点号(`127.0.0.1:59721` → `12700.：／159721`),地址必然打错。
 * 因此只要 App 里已经有这个地址(用固定 `--port` 跑过一次就会有),就点它;
 * 只有找不到时才退化为打字,并在日志里明确提示"地址可能被输入法改写"。
 */
export async function openDappInWallet(device, packageName, url, { log, attempts = 8, intervalMs = 500 } = {}) {
  const say = (message) => log?.(message);
  const port = (url.match(/:(\d+)\//) ?? [])[1] ?? null;

  const tapRecent = () => {
    const nodes = dumpUi(device);
    const hit =
      nodes.find((n) => n.text === url) ??
      nodes.find((n) => port && n.text.includes(`:${port}`) && n.text.endsWith("/index.html"));
    if (!hit) return false;
    tapBounds(device, hit.bounds);
    say(`已点击「最近访问」里的 ${hit.text}`);
    return true;
  };

  adbShell(device, ["shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"]);
  say("已拉起 App,尝试进入 Explore …");
  if (tapRecent()) return true;

  const exploreEntry = findByText(dumpUi(device), ["探索", "浏览", "Explore"]);
  if (!exploreEntry) {
    say("没找到 Explore 入口(可能仍在解锁页):请手动解锁并在 Explore 里打开地址");
    return false;
  }
  tapBounds(device, exploreEntry.bounds);
  say("已点击 Explore,等待搜索页 …");

  let input = null;
  for (let i = 0; i < attempts && !input; i += 1) {
    input = findInput(dumpUi(device), ["搜索", "网址", "输入", "URL", "DApp"]);
    if (!input) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (input) {
    tapBounds(device, input.bounds);
    if (tapRecent()) return true;
  }

  if (!input) {
    say("没找到地址输入框:请手动输入地址");
    return false;
  }
  say("最近访问里没有这个地址,尝试直接输入(输入法可能改写 URL,失败请用固定 --port 复跑)");
  typeText(device, url);
  const submit = dumpUi(device).find((n) => ["打开", "前往", "访问", "Go"].includes(n.text));
  if (submit) tapBounds(device, submit.bounds);
  else pressEnter(device);
  return true;
}
