import { $, $$, safeJsonParse } from './utils.js';
import { EditorAPI }            from './editor.js';

/* ========= 定数 ========= */
const STORAGE_WIP_DATA   = 'app.dataJson';
const STORAGE_WIP_META   = 'app.metaJson';
const STORAGE_WIP_TITLE  = 'app.title';
const STORAGE_DOC_PREFIX = 'app.doc.';

/* ========= DOM ========= */
const elSidebar   = $('#sidebar');
const elOverlay   = $('#overlay');
const elHamburger = $('#hamburger');
const elEditorPg  = $('#editorPage');
const elStoragePg = $('#storagePage');
const elTitleInp  = $('#docTitle');
const elDataTA    = $('#dataJson');
const elMetaTA    = $('#metaJson');

/* -------------------------------------------------- */
/*  1) ハンバーガー & ページ遷移                      */
/* -------------------------------------------------- */
function openMenu (){ elSidebar.classList.add('open'); document.body.classList.add('menu-open'); }
function closeMenu(){ elSidebar.classList.remove('open'); document.body.classList.remove('menu-open'); }

export function initMenuRouting(){
  /* ------ ハンバーガー：トグル動作に変更 ------ */
  elHamburger.onclick = () => {
    if (document.body.classList.contains('menu-open')) closeMenu();
    else                                               openMenu();
  };
  elOverlay.onclick   = closeMenu;

  /* ------ メニュー項目 ------ */
  $('#mi-new').onclick     = () => { closeMenu(); EditorAPI.newDocument(); showPage('editor'); };
  $('#mi-storage').onclick = () => { closeMenu(); showPage('storage'); };
}

function showPage(page){
  $$('.page').forEach(p => p.classList.remove('active'));
  if (page === 'storage'){ renderStorageList(); elStoragePg.classList.add('active'); }
  else                   { elEditorPg .classList.add('active'); }
}

/* -------------------------------------------------- */
/*  2) オートセーブ                                   */
/* -------------------------------------------------- */
function saveWip(){
  localStorage.setItem(STORAGE_WIP_DATA , elDataTA.value);
  localStorage.setItem(STORAGE_WIP_META , elMetaTA.value);
  localStorage.setItem(STORAGE_WIP_TITLE, elTitleInp.value);
  if (elTitleInp.value.trim()) saveAsDocument(elTitleInp.value.trim());
}
function loadWip(){
  if (localStorage.getItem(STORAGE_WIP_DATA )!==null) elDataTA.value = localStorage.getItem(STORAGE_WIP_DATA);
  if (localStorage.getItem(STORAGE_WIP_META )!==null) elMetaTA.value = localStorage.getItem(STORAGE_WIP_META);
  if (localStorage.getItem(STORAGE_WIP_TITLE)!==null) elTitleInp.value = localStorage.getItem(STORAGE_WIP_TITLE);
}
export const WIP = { saveWip, loadWip };

/* データ／メタはリアルタイム保存、タイトルはフォーカスアウト時のみ保存 */
['input','change'].forEach(ev=>{
  elDataTA .addEventListener(ev, saveWip);
  elMetaTA .addEventListener(ev, saveWip);
});
elTitleInp.addEventListener('change', saveWip);   // ← ここだけ change のみ

/* -------------------------------------------------- */
/*  3) ドキュメント管理                               */
/* -------------------------------------------------- */
function saveAsDocument(title){
  const payload = {
    title,
    data   : safeJsonParse(elDataTA.value , []),
    meta   : safeJsonParse(elMetaTA.value , {}),
    updated: Date.now()
  };
  localStorage.setItem(STORAGE_DOC_PREFIX + title, JSON.stringify(payload));
}

function loadDocument(title){
  const raw = localStorage.getItem(STORAGE_DOC_PREFIX + title);
  if (!raw) return alert('Not found');
  const obj = JSON.parse(raw);

  elTitleInp.value = obj.title;
  elDataTA .value  = JSON.stringify(obj.data, null, 2);
  elMetaTA .value  = JSON.stringify(obj.meta, null, 2);
  saveWip();
  $('#btnBuild').click();   // テーブル再描画
  showPage('editor');
}

function deleteDocument(title){
  if (!confirm(`${title} を削除しますか？`)) return;
  localStorage.removeItem(STORAGE_DOC_PREFIX + title);
  renderStorageList();
}

/* -------------------------------------------------- */
/*  4) Storage 一覧描画                               */
/* -------------------------------------------------- */
function renderStorageList(){
  elStoragePg.innerHTML = '<h2>Storage</h2>';

  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_DOC_PREFIX));
  if (keys.length === 0){
    elStoragePg.insertAdjacentHTML('beforeend','<p>保存済み JSON はありません。</p>');
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'storage-list';

  keys.sort().forEach(k => {
    const o  = JSON.parse(localStorage.getItem(k));
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="doc-title">${o.title}</span>
      <button class="openDoc" data-t="${o.title}">開く</button>
      <button class="delDoc"  data-t="${o.title}">削除</button>
    `;
    ul.appendChild(li);
  });
  elStoragePg.appendChild(ul);
}

/* Storage ページのボタン操作 */
elStoragePg.addEventListener('click', e => {
  if (e.target.matches('.openDoc')) loadDocument(e.target.dataset.t);
  if (e.target.matches('.delDoc'))  deleteDocument(e.target.dataset.t);
});

/* -------------------------------------------------- */
export const StorageAPI = { saveAsDocument, loadDocument };
