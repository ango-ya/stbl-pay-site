import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// カテゴリ名は言語ごとに書き分ける（docusaurus.config.ts と同じく DOCUSAURUS_CURRENT_LOCALE を見る）。
// ページの名前は各ページの sidebar_label から取る
const en = process.env.DOCUSAURUS_CURRENT_LOCALE === 'en';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'overview',
    {
      type: 'category',
      label: en ? 'Getting started' : 'はじめに',
      collapsed: false,
      items: [
        'getting-started/payment-flow',
        'getting-started/money-flow',
        'getting-started/responsibilities',
        'getting-started/prerequisites',
        'getting-started/quickstart',
      ],
    },
    {
      type: 'category',
      label: en ? 'Add to your store' : 'EC サイトへの組み込み',
      items: [
        'client/install',
        'client/start-payment',
        'client/handle-result',
        'client/integrate-existing-ec',
      ],
    },
    {
      type: 'category',
      label: en ? 'Server side' : 'サーバー実装',
      items: [
        'server/authentication',
        'server/create-payment',
        'server/retrieve-payment',
      ],
    },
    {
      type: 'category',
      label: 'Webhooks',
      items: [
        'webhooks/events',
        'webhooks/signature',
        'webhooks/retry',
        'webhooks/idempotency',
      ],
    },
    {
      type: 'category',
      label: en ? 'Payment lifecycle' : '決済ライフサイクル',
      items: [
        'lifecycle/statuses',
        'lifecycle/transitions',
        'lifecycle/completion',
        'lifecycle/edge-cases',
      ],
    },
    {
      type: 'category',
      label: en ? 'Refunds' : '返金',
      items: [
        'refunds/overview',
        'refunds/execute',
        'refunds/funding',
        'refunds/errors',
      ],
    },
    {
      type: 'category',
      label: en ? 'Security' : 'セキュリティ',
      items: [
        'security/api-keys',
        'security/boundaries',
        'security/signature-verification',
        'security/domain',
      ],
    },
    {
      type: 'category',
      label: en ? 'Testing' : 'テスト',
      items: ['testing/sandbox', 'testing/scenarios'],
    },
    {
      type: 'category',
      label: en ? 'Reference' : 'リファレンス',
      items: ['reference/rest', 'reference/webhook-events', 'reference/glossary'],
    },
    {
      type: 'category',
      label: en ? 'Support' : 'サポート',
      items: ['support/faq', 'support/troubleshooting', 'support/limitations', 'support/roadmap'],
    },
  ],
};

export default sidebars;
