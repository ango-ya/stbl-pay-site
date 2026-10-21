import React from 'react';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAlternatePageUtils} from '@docusaurus/theme-common/internal';

// LP と同じく、もう一方の言語へのリンクを 1 つだけ出す（日本語のページでは「EN」、英語のページでは「日本語」）。
// 行き先は同じページのもう一方の言語版
export default function LocaleToggleNavbarItem({mobile = false}: {mobile?: boolean}) {
  const {
    i18n: {currentLocale},
  } = useDocusaurusContext();
  const {search, hash} = useLocation();
  const {createUrl} = useAlternatePageUtils();
  const target = currentLocale === 'en' ? 'ja' : 'en';
  // 別の言語は別のアプリとして出るので、SPA の遷移ではなく普通のリンクで移る
  const link = (
    <a
      className={mobile ? 'menu__link' : 'navbar__item navbar__link'}
      href={`${createUrl({locale: target, fullyQualified: false})}${search}${hash}`}
      lang={target}
      hrefLang={target}>
      {target === 'en' ? 'EN' : '日本語'}
    </a>
  );
  return mobile ? <li className="menu__list-item">{link}</li> : link;
}
