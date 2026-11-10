#!/usr/bin/env node
/**
 * `create-jdid-dapp` —— 从本包自带的示例拷一份可跑的 dApp 骨架。
 *
 * 用法:
 *   npx <package> my-dapp         # 默认拷 examples/minimal-dapp 到 ./my-dapp
 *   npx <package> my-dapp --force # 目录已存在也覆盖
 *
 * <package> 从本仓 package.json 的 name 读,不在代码里另写一份。
 *
 * 不联网、不装依赖:示例本身零依赖,`node cli/conformance.mjs --dapp my-dapp` 就能自检。
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "examples", "minimal-dapp");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const PACKAGE_NAME = PKG.name;
const PACKAGE_RANGE = `^${PKG.version}`;

function main(argv) {
  const args = argv.slice(2);
  const target = args.find((a) => !a.startsWith("-"));
  const force = args.includes("--force");

  if (!target || args.includes("-h") || args.includes("--help")) {
    console.log(`用法:create-jdid-dapp <目录> [--force]

把示例 dApp(examples/minimal-dapp)拷到 <目录>,然后把 jdid-manifest.json 的 name 改成目录名。

下一步:
  cd <目录>
  npm i                                                        # 装上 ${PACKAGE_NAME}
  node ${join(ROOT, "cli", "conformance.mjs")} --dapp .          # 静态自检(不需要设备)
  # 在 JDID App 的 Explore 里打开你的页面(真机联调需要 debug 包 + http,正式包只允许 https)
`);
    return target ? 0 : 1;
  }

  const dest = resolve(process.cwd(), target);
  if (existsSync(dest)) {
    if (!force) {
      console.error(`目录已存在:${dest}(加 --force 覆盖)`);
      return 1;
    }
    rmSync(dest, { recursive: true, force: true });
  }

  cpSync(TEMPLATE, dest, { recursive: true });

  // 示例里 import 的是仓库内的相对路径;拷出去之后要改成包名(发布后的正常用法)。
  const mainPath = join(dest, "main.js");
  if (existsSync(mainPath)) {
    const source = readFileSync(mainPath, "utf8");
    writeFileSync(mainPath, source.replace(/"\.\.\/\.\.\/src\/index\.js"/g, JSON.stringify(PACKAGE_NAME)), "utf8");
  }
  const packageName =
    target
      .split("/")
      .filter(Boolean)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "jdid-dapp";
  writeFileSync(
    join(dest, "package.json"),
    `${JSON.stringify({ name: packageName, private: true, type: "module", dependencies: { [PACKAGE_NAME]: PACKAGE_RANGE } }, null, 2)}\n`,
    "utf8",
  );

  const name =
    target
      .split("/")
      .filter(Boolean)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "jdid-dapp";

  const manifestPath = join(dest, "jdid-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.name = name;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`已创建 ${dest}`);
  console.log(`  ${readdirSync(dest).sort().map((f) => `  ${f}`).join("\n  ").trim()}`);
  console.log(`\n下一步:cd ${target} && node ${join(ROOT, "cli", "conformance.mjs")} --dapp .`);
  return 0;
}

process.exit(main(process.argv));
