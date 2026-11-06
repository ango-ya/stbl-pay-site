// 解説（learn.spec.mjs）とプレスキット（press.spec.mjs）で共通に使う、書いてはいけないことの検査と本番の CSP。
// テストのファイル（*.spec.mjs）どうしは import できないので、ここに置く
import { readFileSync } from "node:fs";

// LP と同じ使わない語に、解説で断定を避ける語を足す。英語は大文字小文字を問わない
export const BANNED = [
  "先行導入", "2026年8月", "2026.08", "SDK", "経由せず", "経由しない", "銀行振込するだけ", "同額を銀行振込",
  "JPYC建て", "誰でも受け取れる", "導入費用0円", "安全", "元本保証", "必ず", "誰でも",
];
export const BANNED_EN = /\bSDK\b|early access|top[ -]?up|recharge|just make a bank transfer/i;


// --- 自社の料率と提供開始日の検査（推測はせず、単純で厳しい決まりにする。learn.spec.mjs のユニット test で、わざと違反を入れて確かめる） ---
// 文字の取り出しはブラウザに任せる（文字参照や属性の空白はブラウザが解決する）。page.evaluate(TEXTS) で呼ぶ。
// 対象は title・すべての meta の content・JSON-LD のすべての文字列値・body の textContent（script と style の中身は除く）
export const TEXTS = () => {
  const strings = (v) => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
  const body = document.body.cloneNode(true);
  body.querySelectorAll("script, style").forEach((e) => e.remove());
  return [
    document.title,
    ...[...document.querySelectorAll("meta[content]")].map((m) => m.getAttribute("content")),
    ...[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => strings(JSON.parse(s.textContent))),
    body.textContent,
  ];
};
// 空白（改行・<br> 由来を含む）は 1 つにまとめ、文は「。．！？!?」と英語の「. 」だけで区切る
export const sentences = (texts) => texts.flatMap((t) => t.replace(/\s+/g, " ").split(/[。．！？!?]|\. /)).map((s) => s.trim()).filter(Boolean);
export const OWN = /すてぶるペイ|STBLpay|当サービス|本サービス|当社/i;

// 料率：自社名を含む文に数字の % があれば、例外なく違反。自社名の無い文の % は、許可リストに一致するときだけ許す。
// 一致は、その % の数値（m[0]）が value と完全に同じで、その直前が prefix で終わること（% ごとに、その位置で照合する）
export const PCT = /[0-9０-９][0-9０-９,.．]*\s*(?:[%％]|パーセント|percent\b)/gi;
export function rateViolations(texts, allow) {
  return sentences(texts).flatMap((s) => [...s.matchAll(PCT)].flatMap((m) => {
    if (OWN.test(s)) return [`自社名と同じ文の「${m[0]}」… ${s}`];
    const ok = allow.some((a) => a.prefix && a.value === m[0] && s.slice(0, m.index).endsWith(a.prefix));
    return ok ? [] : [`許可リストに無い「${m[0]}」… ${s}`];
  }));
}

// 提供開始日：自社名と開始の語が同じ文にあれば、日付の有無を問わず違反。例外は、同じ文に下の言い回しがそのままあるときだけ
export const LAUNCH_WORD = /開始|公開|始め|始ま|リリース|ローンチ|launch|release|go(?:es)? live|roll(?:s|ed|ing)? out|start(?:s|ed|ing)? (?:on|in)|available (?:from|in|on)/i;
export const UNDECIDED = ["提供開始日は未定", "提供開始日はまだ決まっていません", "launch date is not yet set", "launch date has not been set"];
export const launchDateClaims = (texts) => sentences(texts)
  .filter((s) => OWN.test(s) && LAUNCH_WORD.test(s) && !UNDECIDED.some((u) => s.includes(u)));

// 全ページ共通の CSP（_headers の最初の Content-Security-Policy の行。/* に掛かる）
export const CSP = readFileSync(new URL("../../_headers", import.meta.url), "utf8")
  .split("\n")
  .find((l) => /^\s*Content-Security-Policy:/.test(l))
  .replace(/^\s*Content-Security-Policy:\s*/, "")
  .trim();
