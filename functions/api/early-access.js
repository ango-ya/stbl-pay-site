// Cloudflare Pages Functions: 先行案内フォーム受信 → Slack チャンネル通知
// （docs/marketing/lead-form-connection.md 選択肢A・通知先をSlack Incoming Webhookにしたもの）
//
// 事前準備:
//   Cloudflare Pages のダッシュボードで環境変数（Secret）SLACK_WEBHOOK_URL に
//   Slack Incoming Webhook のURL（通知したいチャンネルに紐づくもの）を設定する。
//   Webhook URL は公開リポジトリ・クライアントJSに置かない（スパム送信の的になるため）。
//
// CSPへの影響: なし。ブラウザからの fetch 先は同一オリジン /api/early-access のままで、
// Slack への送信はサーバーサイド（この関数内）で行うため connect-src 'self' に抵触しない。

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 120;

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const clip = (value, max = MAX_FIELD_LEN) =>
  typeof value === "string" ? value.slice(0, max) : "";

export async function onRequestPost(context) {
  const { request, env } = context;

  if ((request.headers.get("content-type") || "").indexOf("application/json") === -1) {
    return json({ error: "invalid content-type" }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const { email, company, contact, message, source, website } = body;

  // honeypot: 非表示フィールド（website）に値があればボットとみなし、
  // 検知させないため成功扱いで応答しつつ通知はしない。
  if (website) {
    return json({ ok: true }, 200);
  }

  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: "invalid email" }, 400);
  }

  if (!env.SLACK_WEBHOOK_URL) {
    // 未設定のまま本番に出た場合に無言で握りつぶさない（クライアントは「失敗」表示に落ちる）
    return json({ error: "notify unconfigured" }, 500);
  }

  const lines = [
    ":inbox_tray: *すてぶるペイ LP お問い合わせ*",
    `会社名: ${clip(company) || "-"}`,
    `担当者: ${clip(contact) || "-"}`,
    `メール: ${clip(email)}`,
    `お問い合わせ内容: ${clip(message, 1500) || "-"}`,
    `送信元: ${clip(source) || "-"}`,
  ];

  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
  });

  if (!res.ok) {
    return json({ error: "notify failed" }, 502);
  }

  return json({ ok: true }, 200);
}
