import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome";
const URL = process.env.APP_URL || "http://127.0.0.1:4173/";

const seed = JSON.parse(fs.readFileSync("/home/claude/pl/src/data/properties.json", "utf8"));
const properties = seed.properties || [];

const consoleErrors = [];
const pageErrors = [];
const failed = [];
const stubbed = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("requestfailed", (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));

// Stand in for Supabase so the test exercises the app, not the network.
await page.setRequestInterception(true);
page.on("request", (req) => {
  const url = req.url();
  if (!/supabase\.co/.test(url)) return req.continue();
  stubbed.push(url);
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Expose-Headers": "*",
  };
  if (req.method() === "OPTIONS") {
    return req.respond({ status: 204, headers: cors, body: "" });
  }
  let body = "[]";
  if (/\/rest\/v1\/properties/.test(url)) body = JSON.stringify(properties);
  return req.respond({
    status: 200,
    contentType: "application/json",
    headers: cors,
    body,
  });
});

await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
await new Promise((r) => setTimeout(r, 5000));

const result = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    visibleTextLength: text.length,
    onboardingMarkers: ["Fill in your first name", "verification code", "Create account"].filter((s) => text.includes(s)),
    stillOnSplash: text.includes("CONNECTING SPACES"),
    appLayoutPresent: !!document.querySelector(".app-layout"),
    listingCards: document.querySelectorAll("[class*='rounded'][class*='overflow']").length,
    firstLines: text.split("\n").filter(Boolean).slice(0, 15),
  };
});

await page.screenshot({ path: "/home/claude/testrig/boot.png" });

// Tab-by-tab click-through.
const tabs = ["Explore", "Messages", "Profile", "Home"];
const tabResults = [];
for (const label of tabs) {
  const clicked = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll("button, a")).find((n) => n.innerText.trim() === l);
    if (!el) return false;
    el.click();
    return true;
  }, label);
  await new Promise((r) => setTimeout(r, 1200));
  const snap = await page.evaluate(() => document.body.innerText.split("\n").filter(Boolean).slice(0, 6));
  tabResults.push({ tab: label, clicked, errorsSoFar: pageErrorCount(), sample: snap });
  function pageErrorCount() { return null; }
  await page.screenshot({ path: `/home/claude/testrig/tab-${label.toLowerCase()}.png` });
}

console.log(JSON.stringify({ result, tabResults, pageErrors, consoleErrors, failed, stubbedCount: stubbed.length }, null, 2));
await browser.close();
