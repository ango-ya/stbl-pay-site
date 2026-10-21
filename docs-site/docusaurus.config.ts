import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// 日本語（既定）と英語の 2 つを出す。英語は /docs/en/ 以下になる。
// Docusaurus はロケールごとに設定を読み直し、そのたびに DOCUSAURUS_CURRENT_LOCALE を入れる。
// ナビの html の項目やフッターは翻訳ファイルの対象にならないので、ここで言語ごとに書き分ける
const en = process.env.DOCUSAURUS_CURRENT_LOCALE === 'en';
// LP は日本語が /、英語が /en/
const lp = en ? '/en/' : '/';

const config: Config = {
  title: en ? 'STBLpay Docs' : 'STBLpay ドキュメント',
  tagline: en
    ? 'Merchant guide to adding payments where buyers pay in yen and you receive a stablecoin'
    : '円で払い、ステーブルコインで受け取る決済を EC に組み込むための加盟店向けガイド',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // stbl-pay.com の /docs/ 以下に置く（ビルド結果は scripts/build-dist.sh が dist/docs/ へ入れる）
  url: 'https://stbl-pay.com',
  baseUrl: '/docs/',

  onBrokenLinks: 'throw',
  // 英語版は見出しに明示の id を付けてリンク先をそろえている。ずれたらビルドで落とす
  onBrokenAnchors: 'throw',
  // 既定の「baseUrl が合っていない」警告はインラインのスクリプトとスタイルを足すので外す（CSP を締めるため）
  baseUrlIssueBanner: false,

  // 自前でライト／ダークを切り替えるので、Dark Reader などの拡張機能に色を変えさせない。
  // 変えさせると、最初に見える高さより下だけ拡張機能の色になり、途中で背景が切り替わって見える
  headTags: [
    {
      tagName: 'meta',
      attributes: {name: 'darkreader-lock'},
    },
  ],

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    localeConfigs: {
      ja: {label: '日本語', htmlLang: 'ja'},
      en: {label: 'English', htmlLang: 'en'},
    },
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
      // 切り替えのボタンは出さない（ヘッダーを LP と同じ並びにするため）。ライト／ダークは OS の設定に従う
      disableSwitch: true,
    },
    navbar: {
      logo: {
        alt: en ? 'STBLpay' : 'すてぶるペイ',
        // ロゴは LP へ戻る（src/theme/Logo）
        src: en ? 'img/logo-wordmark-stblpay-black.png' : 'img/logo-wordmark-suteburu-black.png',
      },
      // LP のヘッダーと同じ項目を並べる。LP の節へのリンクは baseUrl（/docs/）を付けないよう html で書く。
      // 「ドキュメント」は今いる場所として強調する。Quick Start などはサイドバーからたどる
      items: [
        ...(en
          ? [
              ['#comparison', 'Fees'],
              ['#flow', 'How it works'],
              ['#videos', 'Video'],
              ['#faq', 'FAQ'],
            ]
          : [
              ['#comparison', '手数料'],
              ['#flow', '仕組み'],
              ['#videos', '動画'],
              ['#faq', 'FAQ'],
            ]
        ).map(([hash, label]) => ({
          type: 'html' as const,
          position: 'left' as const,
          value: `<a class="navbar__item navbar__link lp-nav" href="${lp}${hash}">${label}</a>`,
        })),
        {
          type: 'html',
          position: 'left',
          value: `<a class="navbar__item navbar__link lp-nav navbar__link--active" aria-current="page" href="/docs/${en ? 'en/' : ''}">${en ? 'Docs' : 'ドキュメント'}</a>`,
        },
        // LP と同じく、もう一方の言語へのリンクだけを出す（src/components/LocaleToggleNavbarItem.tsx）
        {
          type: 'custom-localeToggle',
          position: 'left',
        },
        {
          type: 'html',
          position: 'right',
          value: `<a class="navbar__item navbar__link navbar-cta" href="${lp}#early-access">${en ? 'Talk to us about integrating' : '導入を相談する'}</a>`,
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: en ? 'Getting started' : 'はじめに',
          items: [
            {label: en ? 'Overview' : '概要', to: '/'},
            {label: en ? 'Payment flow' : '決済フロー', to: '/getting-started/payment-flow'},
            {label: 'Quick Start', to: '/getting-started/quickstart'},
          ],
        },
        {
          title: en ? 'Build' : '実装',
          items: [
            {label: en ? 'Add to your store' : 'EC への組み込み', to: '/client/install'},
            {label: en ? 'Server side' : 'サーバー実装', to: '/server/authentication'},
            {label: 'Webhooks', to: '/webhooks/events'},
          ],
        },
        {
          title: en ? 'Operate' : '運用',
          items: [
            {label: en ? 'Payment lifecycle' : '決済ライフサイクル', to: '/lifecycle/statuses'},
            {label: en ? 'Testing' : 'テスト', to: '/testing/sandbox'},
            {label: en ? 'Known limitations' : '既知の制限', to: '/support/limitations'},
          ],
        },
      ],
      copyright: `<img class="footer-wordmark" src="/docs/img/logo-wordmark-stblpay-black.png" alt="STBLpay" loading="lazy" /><div>${en ? 'Operated by' : '運営会社：'}<a href="https://www.ango-ya.org/" target="_blank" rel="noreferrer">${en ? ' Ango-ya LLC' : '合同会社暗号屋'}</a></div><div>© 2026 STBLpay — ${en ? 'Merchant integration guide' : '加盟店向け連携ガイド'}</div>`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['bash', 'json', 'php'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
