/**
 * KinDevST ドメイン検証モジュール
 *
 * kintone ドメイン（cybozu.com 系）かどうかを厳密に判定するための単一ソース。
 * 認証ヘッダー付きリクエストの送信先を検証し、認証情報の漏洩を防ぐ。
 *
 * 【重要】url.includes('.cybozu.com') のような部分文字列一致は使わないこと。
 * 例: "https://x.cybozu.com.evil.example/" や "https://evilcybozu.com/" を
 * 通過させてしまい、認証情報が攻撃者ドメインへ送信される危険がある。
 */

'use strict';

// 許可するベースドメイン（host_permissions と一致させること）
// 拡張する場合は manifest.json の host_permissions も同時に更新する。
const ALLOWED_BASE_DOMAINS = ['cybozu.com'];

/**
 * ホスト名が許可された kintone ドメインかを厳密に判定
 * ラベル境界で一致するため "evilcybozu.com" や "cybozu.com.evil.example" は拒否。
 * サブドメイン必須（bare な "cybozu.com" は host_permissions の *.cybozu.com に合わせ非許可）。
 * @param {string} hostname - 検証するホスト名
 * @returns {boolean}
 */
export function isKintoneHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const host = hostname.toLowerCase();
  return ALLOWED_BASE_DOMAINS.some(base => host.endsWith(`.${base}`) && host.length > base.length + 1);
}

/**
 * URL 文字列が許可された kintone ドメインかを判定
 * @param {string} url - 検証する URL
 * @returns {boolean}
 */
export function isKintoneUrl(url) {
  if (!url || typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // スキームも https に限定（http や拡張内スキームを排除）
  if (parsed.protocol !== 'https:') return false;
  return isKintoneHostname(parsed.hostname);
}

/**
 * URL が kintone ドメインでなければ例外を投げる（実行直前の最終防衛線用）
 * @param {string} url - 検証する URL
 * @param {string} errorMessage - 拒否時のエラーメッセージ
 * @throws {Error} 許可されないドメインの場合
 */
export function assertKintoneUrl(url, errorMessage) {
  if (!isKintoneUrl(url)) {
    throw new Error(errorMessage || `許可されていないドメインです: ${url}`);
  }
}
