// Скачивает 78 карт Райдер–Уэйт 1909 (Wikimedia Commons, общественное достояние) и шрифты в папку сайта.
// Запуск из корня сайта: node tools/fetch-assets.mjs
import { mkdir, writeFile, access } from "node:fs/promises";

const UA = "AuroraTarotLocalSite/1.0 (personal offline site; contact: none)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

const MAJOR = ["Fool","Magician","High Priestess","Empress","Emperor","Hierophant","Lovers","Chariot","Strength",
  "Hermit","Wheel of Fortune","Justice","Hanged Man","Death","Temperance","Devil","Tower","Star","Moon","Sun","Judgement","World"];
const SUITS = { wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" };

const cards = [];
MAJOR.forEach((n, i) => cards.push(["m" + i, `RWS1909 - ${String(i).padStart(2, "0")} ${n}.jpeg`]));
for (const [id, en] of Object.entries(SUITS))
  for (let r = 1; r <= 14; r++) cards.push([id + r, `RWS1909 - ${en} ${String(r).padStart(2, "0")}.jpeg`]);

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const ua = url.includes("fonts.googleapis.com") ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" : UA;
    const res = await fetch(url, { headers: { "User-Agent": ua }, redirect: "follow" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (i + 1)); continue; }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`retries exhausted ${url}`);
}

await mkdir("img/cards", { recursive: true });
let fetched = 0;
for (const [id, file] of cards) {
  const out = `img/cards/${id}.jpg`;
  if (await exists(out)) continue;
  const url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file.replace(/ /g, "_")) + "?width=480";
  await writeFile(out, await get(url));
  fetched++;
  await sleep(250);
}
console.log(`cards: ${cards.length} total, ${fetched} downloaded`);

// Шрифты: только кириллица и латиница, woff2.
const CSS_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600" +
  "&family=Alegreya:ital,wght@0,400;0,500;0,700;1,400&family=Alegreya+SC:wght@500;700&display=swap";
const css = (await get(CSS_URL, 3)).toString("utf8");
await mkdir("fonts", { recursive: true });
const blocks = css.split("/* ").slice(1);
let local = "/* Шрифты скачаны tools/fetch-assets.mjs (Google Fonts, SIL Open Font License). */\n";
let n = 0;
for (const block of blocks) {
  const subset = block.slice(0, block.indexOf(" */"));
  if (subset !== "cyrillic" && subset !== "latin") continue;
  const face = block.slice(block.indexOf("@font-face"));
  const fam = /font-family: '([^']+)'/.exec(face)[1];
  const style = /font-style: (\w+)/.exec(face)[1];
  const weight = /font-weight: (\d+)/.exec(face)[1];
  const url = /url\((https:[^)]+)\)/.exec(face)[1];
  const name = `${fam.replace(/ /g, "")}-${weight}${style === "italic" ? "i" : ""}-${subset}.woff2`;
  if (!(await exists("fonts/" + name))) { await writeFile("fonts/" + name, await get(url)); n++; }
  local += "/* " + subset + " */\n" + face.replace(url, "../fonts/" + name).trim() + "\n";
}
await writeFile("css/fonts.css", local);
console.log(`fonts: ${n} files downloaded`);
