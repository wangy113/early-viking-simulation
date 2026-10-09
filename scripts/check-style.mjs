// Checks student-facing text against the house writing style:
// no em or en dashes, no semicolons, no middle dots, and no "not X, it is Y" constructions.
import fs from "node:fs";

const RULES = [
  [/[—–]/, "em or en dash"],
  [/;/, "semicolon"],
  [/·/, "middle dot"],
  [/\bnot\b[^.!?]*,\s*(it|this|that|they)\s+(is|was|are|were)\b/i, "\"not X, it is Y\" construction"],
];

const decode = (s) => s.replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, " ");
const visibleText = (html) => decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, "\n"));

const sources = [];
for (const s of JSON.parse(fs.readFileSync("src/content/stops.json", "utf8"))) {
  for (const [field, value] of Object.entries({ title: s.title, notice: s.notice, ...Object.fromEntries(s.body.map((p, i) => [`body[${i}]`, p])) })) {
    sources.push([`stops.json ${s.id}.${field}`, visibleText(value)]);
  }
}
visibleText(fs.readFileSync("index.html", "utf8")).split("\n").forEach((line, i) => sources.push([`index.html text ${i}`, line]));

let bad = 0;
for (const [where, text] of sources) for (const [re, name] of RULES) {
  const m = text.match(re);
  if (m) { bad++; console.error(`${where}: ${name}: "${text.trim().slice(Math.max(0, m.index - 30), m.index + 40)}"`); }
}
if (bad) { console.error(`\n${bad} style problem(s) found.`); process.exit(1); }
console.log(`Style check passed (${sources.length} text items).`);
