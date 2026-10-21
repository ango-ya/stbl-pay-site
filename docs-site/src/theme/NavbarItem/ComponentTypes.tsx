import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import LocaleToggleNavbarItem from '@site/src/components/LocaleToggleNavbarItem';

// ナビの項目に、LP と同じ形の言語の切り替え（custom-localeToggle）を足す
export default {
  ...ComponentTypes,
  'custom-localeToggle': LocaleToggleNavbarItem,
};
