/**
 * KinDevST 暗号化管理モジュール
 * Web Crypto APIを使用して認証情報を暗号化/復号化
 */

'use strict';

const CRYPTO_KEY_NAME = 'kindevst_encryption_key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * 暗号化キーを取得または生成
 */
async function getOrCreateEncryptionKey() {
  const stored = await chrome.storage.local.get([CRYPTO_KEY_NAME]);
  
  if (stored[CRYPTO_KEY_NAME]) {
    const keyData = JSON.parse(stored[CRYPTO_KEY_NAME]);
    return await crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(keyData.key),
      { name: ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  
  const exported = await crypto.subtle.exportKey('raw', key);
  const keyData = {
    key: arrayBufferToBase64(exported),
    createdAt: Date.now()
  };
  
  await chrome.storage.local.set({ [CRYPTO_KEY_NAME]: JSON.stringify(keyData) });
  return key;
}

/**
 * 認証情報を暗号化
 */
export async function encrypt(plaintext) {
  if (!plaintext) return '';
  
  try {
    const key = await getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      key,
      new TextEncoder().encode(plaintext)
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('[KinDevST Crypto] 暗号化エラー:', error);
    return plaintext; // エラー時は平文を返す（後方互換性）
  }
}

/**
 * 認証情報を復号化
 */
export async function decrypt(ciphertext) {
  if (!ciphertext) return '';
  
  try {
    const key = await getOrCreateEncryptionKey();
    const combined = base64ToArrayBuffer(ciphertext);
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    // 復号化失敗時は平文として扱う（既存データの後方互換性）
    return ciphertext;
  }
}

/**
 * 暗号化キーを削除
 */
export async function clearEncryptionKey() {
  await chrome.storage.local.remove([CRYPTO_KEY_NAME]);
}

// ヘルパー関数
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
