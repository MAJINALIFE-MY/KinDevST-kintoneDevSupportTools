/**
 * KinDevST 日時フォーマットモジュール
 * 日時の表示形式を統一的に管理
 */

'use strict';

/**
 * 現在の日付と時刻を表示用文字列に変換
 * @returns {{ dateStr: string, timeStr: string, displayTime: string }}
 */
export function formatCurrentDateTime() {
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    dateStr,
    timeStr,
    displayTime: `${dateStr} ${timeStr}`,
    timestamp: now.getTime()
  };
}

/**
 * タイムスタンプから表示用文字列を生成
 * @param {number} timestamp - タイムスタンプ
 * @returns {string} 表示用文字列
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${dateStr} ${timeStr}`;
}
