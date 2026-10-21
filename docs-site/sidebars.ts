import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'overview',
    {
      type: 'category',
      label: 'はじめに',
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
      label: 'EC サイトへの組み込み',
      items: [
        'client/install',
        'client/start-payment',
        'client/handle-result',
        'client/integrate-existing-ec',
      ],
    },
    {
      type: 'category',
      label: 'サーバー実装',
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
      label: '決済ライフサイクル',
      items: [
        'lifecycle/statuses',
        'lifecycle/transitions',
        'lifecycle/completion',
        'lifecycle/edge-cases',
      ],
    },
    {
      type: 'category',
      label: '返金',
      items: [
        'refunds/overview',
        'refunds/execute',
        'refunds/funding',
        'refunds/errors',
      ],
    },
    {
      type: 'category',
      label: 'セキュリティ',
      items: [
        'security/api-keys',
        'security/boundaries',
        'security/signature-verification',
        'security/domain',
      ],
    },
    {
      type: 'category',
      label: 'テスト',
      items: ['testing/sandbox', 'testing/scenarios'],
    },
    {
      type: 'category',
      label: 'リファレンス',
      items: ['reference/rest', 'reference/webhook-events', 'reference/glossary'],
    },
    {
      type: 'category',
      label: 'サポート',
      items: ['support/faq', 'support/troubleshooting', 'support/limitations', 'support/roadmap'],
    },
  ],
};

export default sidebars;
