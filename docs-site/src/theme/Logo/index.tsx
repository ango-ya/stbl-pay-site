import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useThemeConfig} from '@docusaurus/theme-common';
import ThemedImage from '@theme/ThemedImage';
import type {Props} from '@theme/Logo';

// ロゴは LP（日本語は /、英語は /en/）へ戻る。元の Logo はリンク先に必ず baseUrl（/docs/）を足すので、
// 同じ見た目のまま、リンクだけ普通の a にする
export default function Logo({imageClassName, titleClassName, ...rest}: Props) {
  const {
    i18n: {currentLocale},
  } = useDocusaurusContext();
  const {
    navbar: {logo},
  } = useThemeConfig();
  const src = useBaseUrl(logo?.src ?? '');
  const img = <ThemedImage className={logo?.className} sources={{light: src, dark: src}} alt={logo?.alt ?? 'STBLpay'} />;
  return (
    <a href={currentLocale === 'en' ? '/en/' : '/'} {...rest}>
      {imageClassName ? <div className={imageClassName}>{img}</div> : img}
    </a>
  );
}
