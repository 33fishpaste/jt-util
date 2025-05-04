/* ============================ */
/* meta.js – full revision 2025‑05‑04 */
/* ============================ */

import { $, getDeep, setDeep, deleteDeep,
         keySetValid }                from '../utils.js';
import { state,
         updateDataJsonArea,
         updateMetaJsonArea }         from './state.js';
import { rebuildDataTable }           from './render.js';

/* ============================ */
/* 1) パース & 描画             */
/* ============================ */

/**
 * メタ JSON ( _meta.columns ) 文字列を配列に変換
 * @param {string} str
 * @returns {Array<{key:string,label?:string,multiline?:boolean}>}
 */
export function parseMeta(str){
  if(!str.trim()) return [];
  try{
    const js = JSON.parse(str);
    return js._meta?.columns || [];
  }catch{
    alert('メタ JSON が不正です');
    return [];
  }
}

/**
 * 1 行分の <tr> 要素を生成
 */
export function renderMetaRow(col = {}){
  const tr = document.createElement('tr');

  /* 操作セル */
  const tdOp = document.createElement('td');
  const up   = Object.assign(document.createElement('button'), { textContent: '▲' });
  up.onclick = () => {
    const p = tr.previousElementSibling;
    if(p){ tr.parentElement.insertBefore(tr, p); handleMetaChanged(); }
  };
  const down = Object.assign(document.createElement('button'), { textContent: '▼' });
  down.onclick = () => {
    const n = tr.nextElementSibling;
    if(n){ tr.parentElement.insertBefore(n, tr); handleMetaChanged(); }
  };
  const del  = Object.assign(document.createElement('button'), { textContent: '✕' });
  del.onclick = () => { tr.remove(); handleMetaChanged(); };
  tdOp.append(up, down, del);
  tr.appendChild(tdOp);

  /* key */
  const tdKey = document.createElement('td');
  tdKey.contentEditable = true;
  tdKey.textContent     = col.key ?? '';
  tdKey.dataset.origin  = col.key ?? '';
  tr.appendChild(tdKey);

  /* label */
  const tdLabel = document.createElement('td');
  tdLabel.contentEditable = true;
  tdLabel.textContent     = col.label ?? '';
  tr.appendChild(tdLabel);

  /* multiline */
  const tdMul  = document.createElement('td');
  const cb     = document.createElement('input');
  cb.type      = 'checkbox';
  cb.checked   = !!col.multiline;
  tdMul.appendChild(cb);
  tr.appendChild(tdMul);

  return tr;
}

/**
 * メタテーブル (<table class="meta">) を生成
 */
export function renderMetaFlatTable(columns){
  const tbl = document.createElement('table');
  tbl.className = 'meta';
  tbl.createTHead().innerHTML = '<tr><th></th><th>key</th><th>label</th><th>multiline</th></tr>';
  const tb = tbl.createTBody();
  columns.forEach(c => tb.appendChild(renderMetaRow(c)));
  return tbl;
}

/**
 * 編集中テーブルから columns 配列を取得
 */
export function columnsFromMetaTable(){
  const cols = [];
  $('#metaTableZone .meta tbody')?.querySelectorAll('tr').forEach(tr => {
    const [,keyCell,labelCell,mulCell] = tr.children;
    const key = keyCell.textContent.trim();
    if(!key) return;
    const c = { key };
    const lab = labelCell.textContent.trim();
    if(lab) c.label = lab;
    if(mulCell.querySelector('input').checked) c.multiline = true;
    cols.push(c);
  });
  return cols;
}

/* ============================ */
/* 2) メタ & データ更新         */
/* ============================ */

export function renameKeyAcrossData(oldK, newK){
  if(oldK === newK) return;
  const oldArr = oldK.split('.');
  const newArr = newK.split('.');
  state.currentData.forEach(obj => {
    const v = getDeep(obj, oldArr);
    if(v === undefined) return;
    /* 旧キーが親 → 子 へ深掘りするケースでは、上書き順序を変えないとツリー破壊する */
    deleteDeep(obj, oldArr);
    setDeep(obj, newArr, v);
  });
}

function removeKeyAcrossData(k){
  const arr = k.split('.');
  state.currentData.forEach(obj => {
    const val = getDeep(obj, arr);
    if(val === undefined) return;
    if(val && typeof val === 'object' && Object.keys(val).length) return; // 子を持つ場合はスキップ
    deleteDeep(obj, arr);
  });
}

export function handleMetaChanged(){
  const newCols = columnsFromMetaTable();
  const newKeys = newCols.map(c => c.key);
  if(!keySetValid(newKeys)) return;

  /* 削除されたキーをデータから除去 (浅い削除) */
  const oldKeys = state.currentColumns.map(c => c.key);
  oldKeys.filter(k => !newKeys.includes(k)).forEach(removeKeyAcrossData);

  state.currentColumns = newCols;
  updateMetaJsonArea();
  rebuildDataTable();
  updateDataJsonArea();
}

/* ============================ */
/* 3) メタ自動生成              */
/* ============================ */

/**
 * データ配列から葉キー一覧を抽出して column 定義を推測
 * @param {Array<object>} dataArr
 * @returns {Array<{key:string,label:string}>}
 */
function inferColumnsFromData(dataArr){
  const keys = new Set();
  function walk(o, base = ''){
    if(o && typeof o === 'object' && !Array.isArray(o)){
      Object.entries(o).forEach(([k, v]) => {
        const path = base ? `${base}.${k}` : k;
        if(v && typeof v === 'object' && !Array.isArray(v))
          walk(v, path);
        else
          keys.add(path);
      });
    }
  }
  dataArr.forEach(obj => walk(obj));
  return [...keys].map(k => ({ key: k, label: k.split('.').pop() }));
}

/**
 * 現在の UI 状態とテキストエリアを参照し、必要に応じ columns を取得/生成
 * @param {Array<object>} dataArr – データ JSON 正常化結果
 * @returns {Array<object>} columns – 最終的に採用される columns
 */
export function obtainColumns(dataArr){
  const metaJsonEmpty = !state.elMeta.value.trim();
  const hasTable      = !!state.metaZone.querySelector('.meta');

  /* ------------------------- */
  /* ① メタ JSON が空 → 再生成 */
  /* ------------------------- */
  if(metaJsonEmpty){
    const cols = inferColumnsFromData(dataArr);
    state.currentColumns = cols;

    /* テーブル描画を再生成 */
    state.metaZone.textContent = '';
    state.metaZone.appendChild(renderMetaFlatTable(cols));

    /* JSON テキストエリアも同期 */
    updateMetaJsonArea();
    return cols;
  }

  /* ------------------------------------------------- */
  /* ② テーブルが既に画面にある場合 → それを優先        */
  /* ------------------------------------------------- */
  if(hasTable) return columnsFromMetaTable();

  /* ------------------------------------------------- */
  /* ③ メタ JSON はあるがテーブル未描画 → 描画して同期 */
  /* ------------------------------------------------- */
  let cols = parseMeta(state.elMeta.value);
  if(!cols.length) cols = inferColumnsFromData(dataArr);

  state.currentColumns = cols;
  state.metaZone.textContent = '';
  state.metaZone.appendChild(renderMetaFlatTable(cols));
  updateMetaJsonArea();

  return cols;
}
