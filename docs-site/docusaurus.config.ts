import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'STBLpay ドキュメント',
  tagline: '円で払い、ステーブルコインで受け取る決済を EC に組み込むための加盟店向けガイド',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // stbl-pay.com の /docs/ 以下に置く（ビルド結果は scripts/build-dist.sh が dist/docs/ へ入れる）
  url: 'https://stbl-pay.com',
  baseUrl: '/docs/',

  onBrokenLinks: 'throw',
  // 既定の「baseUrl が合っていない」警告はインラインのスクリプトとスタイルを足すので外す（CSP を締めるため）
  baseUrlIssueBanner: false,

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      logo: {
        alt: 'すてぶるペイ',
        src: 'img/logo-wordmark-suteburu-black.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'ドキュメント',
        },
        {
          to: '/getting-started/quickstart',
          label: 'Quick Start',
          position: 'left',
        },
        {
          to: '/reference/rest',
          label: 'リファレンス',
          position: 'left',
        },
        // 同じサイトの LP へ戻る。Docusaurus のリンクは baseUrl（/docs/）を付けてしまうので、html で書く
        {
          type: 'html',
          position: 'right',
          value: '<a class="navbar__item navbar__link" href="/">トップ</a>',
        },
        {
          type: 'html',
          position: 'right',
          value: '<a class="navbar__item navbar__link navbar-cta" href="/#early-access">導入を相談する</a>',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'はじめに',
          items: [
            {label: '概要', to: '/'},
            {label: '決済フロー', to: '/getting-started/payment-flow'},
            {label: 'Quick Start', to: '/getting-started/quickstart'},
          ],
        },
        {
          title: '実装',
          items: [
            {label: 'EC への組み込み', to: '/client/install'},
            {label: 'サーバー実装', to: '/server/authentication'},
            {label: 'Webhooks', to: '/webhooks/events'},
          ],
        },
        {
          title: '運用',
          items: [
            {label: '決済ライフサイクル', to: '/lifecycle/statuses'},
            {label: 'テスト', to: '/testing/sandbox'},
            {label: '既知の制限', to: '/support/limitations'},
          ],
        },
      ],
      copyright: `<img class="footer-wordmark" src="/docs/img/logo-wordmark-stblpay-black.png" alt="STBLpay" loading="lazy" /><div>運営会社：<a href="https://www.ango-ya.org/" target="_blank" rel="noreferrer">合同会社暗号屋</a></div><div>© 2026 STBLpay — 加盟店向け連携ガイド</div>`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['bash', 'json', 'php'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
