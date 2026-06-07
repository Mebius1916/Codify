import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { convertHtmlCssToTailwind } from "../converters/index.js";
import { simplifyRawFigmaObjectWithImages } from "./core/extractors/pipeline/design-extractor.js";
import codegen from "./core/codegen/index.js";
import { GENERATED_PAGE_RESET_CSS } from "./core/codegen/html/resetCss.js";

const inputFile = "test.json";
const rootDir = "./test";
const d2cDir = `${rootDir}/d2c`;
const figmatocodeDir = `${rootDir}/figmatocode`;
const metaFile = `${rootDir}/meta.json`;
const d2cPng = `${rootDir}/d2c.png`;
const figmatocodePng = `${rootDir}/figmatocode.png`;
const tailwindFragmentFile = `${d2cDir}/tailwind-fragment.html`;
const scale = 2;

void main();

async function main() {
  await fsp.rm(d2cDir, { recursive: true, force: true });
  await fsp.rm(metaFile, { force: true });
  await fsp.rm(d2cPng, { force: true });
  await fsp.rm(figmatocodePng, { force: true });
  await fsp.rm(tailwindFragmentFile, { force: true });
  await fsp.rm(`${rootDir}/test.json`, { force: true });

  const data = normalizeFigmaJson(inputFile);
  const design = await simplifyRawFigmaObjectWithImages(data, {
    fileKey: "",
    token: "",
    skipAssetFetch: true,
  });

  await fsp.copyFile(
    path.resolve(process.cwd(), inputFile),
    path.resolve(process.cwd(), `${rootDir}/test.json`),
  );

  const result = codegen(design);
  await fsp.mkdir(d2cDir, { recursive: true });
  fs.writeFileSync(`${d2cDir}/index.html`, result.html, "utf8");
  fs.writeFileSync(`${d2cDir}/style.css`, result.css, "utf8");
  const htmlFragment = extractBodyFragment(result.html);
  const tailwindFragment = await convertHtmlCssToTailwind(htmlFragment, result.css);
  await fsp.writeFile(tailwindFragmentFile, `${tailwindFragment}\n`, "utf8");

  const viewport = result.size!;
  await fsp.writeFile(
    metaFile,
    JSON.stringify(
      {
        id: "S01",
        figmaUrl: "",
        complexity: "Medium",
        viewport: `${viewport.width}x${viewport.height}`,
        assetFreeMask: true,
        notes: "AutoLayout较少",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  await writeResetCss();

  const browser = await chromium.launch();
  try {
    await renderPageToPng(browser, `${d2cDir}/index.html`, d2cPng, viewport);
    await renderPageToPng(browser, `${figmatocodeDir}/index.html`, figmatocodePng, viewport);
  } finally {
    await browser.close();
  }

  console.log("done:", rootDir);
}

function normalizeFigmaJson(filePath: string) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (raw && typeof raw === "object" && "body" in raw) {
    const body = (raw as any).body;
    const next = typeof body === "string" ? JSON.parse(body) : body;
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
    return next;
  }
  return raw;
}

function extractBodyFragment(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1].trim() ?? html.trim();
}

async function writeResetCss() {
  const dst = path.resolve(process.cwd(), `${d2cDir}/reset.css`);
  await fsp.writeFile(dst, `${GENERATED_PAGE_RESET_CSS}\n`, "utf8");
}

async function renderPageToPng(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  htmlRelPath: string,
  outRelPath: string,
  viewport: { width: number; height: number },
) {
  const htmlPath = path.resolve(process.cwd(), htmlRelPath);
  const outPath = path.resolve(process.cwd(), outRelPath);
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: scale,
  });

  try {
    await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.every((l) => (l as HTMLLinkElement).sheet);
    });
    await page.waitForTimeout(50);
    await page.screenshot({ path: outPath, type: "png" });
  } finally {
    await page.close();
  }
}
