import { initEditor }             from './editor/index.js';
import { initMenuRouting, WIP }   from './storage.js';

window.addEventListener('DOMContentLoaded', () => {
  initEditor();         // エディタ機能をバインド
  initMenuRouting();    // メニュー & ページ遷移
  WIP.loadWip();        // 前回作業を復元

  /* ページを開いた直後、データがあれば自動ビルド（ネスト） */
  if (document.querySelector('#dataJson').value.trim())
    document.querySelector('#btnBuild').click();
});
