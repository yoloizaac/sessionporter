/* Record the SessionPorter demo replay to a WebM using Playwright.
 *
 * This is the video SOURCE for the captioned demo. It records a styled terminal
 * REPLAY of real, verified SessionPorter output (demo/replay/), labelled as a
 * replay. It is NOT part of SessionPorter's runtime; run it from a separate
 * tooling directory that has `playwright` installed:
 *
 *   mkdir $tmp; cd $tmp; npm i playwright
 *   node <repo>/demo/record.mjs <repo>/demo/replay <outDir>
 *
 * Then convert with ffmpeg:
 *   ffmpeg -y -i <out>/*.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart sessionporter-demo-captioned.mp4
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const replayDir = resolve(process.argv[2] ?? 'replay');
const outDir = resolve(process.argv[3] ?? 'out');
const htmlUrl = pathToFileURL(join(replayDir, 'index.html')).href;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(htmlUrl);
await page.waitForFunction(() => window.__done === true, null, { timeout: 300000 });
await page.waitForTimeout(800);
await context.close(); // flushes the video file
await browser.close();
console.log('recorded to', outDir);
