'use strict';

const SCREEN_GLOBAL = 'global';
const SCREEN_PLUGIN_CONFIG = 'plugin.config';

/**
 * JS API のフィルター可否判定
 * 判定ソースは js-api-definitions.json の各 API エントリに埋め込まれた
 * pcScreens / mobileScreens フィールド（カテゴリ未掲載 API は常に表示）
 *
 * @param {Object|null} definition - APIの定義オブジェクト
 * @param {{ platform: 'all'|'pc'|'mobile', screen: string }} filter
 * @returns {boolean}
 */
export function matchesScreenFilter(definition, filter) {
  const platform = filter?.platform || 'all';
  const screen = filter?.screen || '';

  if (platform === 'all' && !screen) return true;
  if (!definition) return true;

  const pcScreens = Array.isArray(definition.pcScreens) ? definition.pcScreens : null;
  const mobileScreens = Array.isArray(definition.mobileScreens) ? definition.mobileScreens : null;

  // pcScreens / mobileScreens フィールド未付与 API は判定対象外（常に表示）
  if (pcScreens === null && mobileScreens === null) return true;

  const pcOk = _matchPlatform(pcScreens, screen);
  const mobileOk = _matchPlatform(mobileScreens, screen);

  if (platform === 'pc') return pcOk;
  if (platform === 'mobile') return mobileOk;
  return pcOk || mobileOk;
}

function _matchPlatform(screens, screen) {
  if (!screens || screens.length === 0) return false;
  if (!screen) return true;
  // "global" は kintone アプリ画面全般を指し、plugin.config は含まない
  // plugin.config 対応 API は pcScreens / mobileScreens に明示的に "plugin.config" を含める
  if (screen === SCREEN_PLUGIN_CONFIG) return screens.includes(SCREEN_PLUGIN_CONFIG);
  return screens.includes(SCREEN_GLOBAL) || screens.includes(screen);
}
