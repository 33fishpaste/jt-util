import {
  $, $$, getDeep, setDeep, deleteDeep,
  normalizeDataJson, copyToClipboard,
  keySetValid, fitHeight
} from './utils.js';

/* ========= 状態 ========= */
let currentData    = [];
let currentColumns = [];
let currentView    = 'nest';   // 'nest' | 'flat'

/* ========= DOM キャッシュ ========= */
const elData   = $('#dataJson');
const elMeta   = $('#metaJson');
const dataZone = $('#tableZone');
const metaZone = $('#metaTableZone');

/* ========= 内部 util ========= */
const updateDataJsonArea = () =>
  (elData.value = JSON.stringify(currentData, null, 2));
const updateMetaJsonArea = () =>
  (elMeta.value = JSON.stringify({ _meta: { columns: currentColumns } }, null, 2));
const reindexEntities = () =>
  $('#tableZone').querySelectorAll('table.entity').forEach((t, i) => (t.dataset.index = i));

/* -------------------------------------------------- */
/*  1) Column tree utilities                          */
/* -------------------------------------------------- */
function buildColumnTree(columns) {
  const root = { children:{}, order:[], leafCount:0 };
  columns.forEach(col => {
    const segs = col.key.split('.');
    let node = root;
    segs.forEach((seg, i) => {
      if (!node.children[seg]) {
        node.children[seg] = {
          label    : i === segs.length - 1 ? (col.label || seg) : seg,
          keyPath  : segs.slice(0, i + 1).join('.'),
          colMeta  : null,
          children : {},
          order    : [],
          leafCount: 0
        };
        node.order.push(seg);
      }
      node = node.children[seg];
      if (i === segs.length - 1) node.colMeta = col;
    });
  });
  (function countLeaves(nd){
    if(!nd.order.length) return nd.leafCount = 1;
    nd.leafCount = nd.order.reduce((s,k)=>s+countLeaves(nd.children[k]),0);
    return nd.leafCount;
  })(root);
  return root;
}
const maxDepthOf = (node, d = 0) =>
  !node.order.length ? d + 1
                     : Math.max(...node.order.map(k => maxDepthOf(node.children[k], d + 1)));

/* -------------------------------------------------- */
/*  2) ネストテーブル描画                              */
/* -------------------------------------------------- */
function renderDataNode(node, dataObj) {
  if (!node.order.length) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = node.colMeta.label || node.label;

    const td = document.createElement('td');
    const v  = getDeep(dataObj, node.keyPath.split('.')) ?? '';
    if (node.colMeta.multiline) {
      const ta = document.createElement('textarea');
      ta.rows = 3; ta.value = v; td.appendChild(ta);
    } else {
      td.contentEditable = true; td.textContent = v;
    }
    td.dataset.key = node.colMeta.key;
    tr.append(th, td);
    return tr;
  }
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = node.label;

  const td = document.createElement('td');
  td.classList.add('no-alt');
  const sub = document.createElement('table');
  sub.className = 'nested';
  node.order.forEach(seg => sub.appendChild(renderDataNode(node.children[seg], dataObj)));
  td.appendChild(sub);
  tr.append(th, td);
  return tr;
}
function renderEntityTable(rowObj, columns, i) {
  const t = document.createElement('table');
  t.className = 'entity';
  t.dataset.index = i;

  const titleKey = columns[0]?.key || '';
  t.dataset.titleKey = titleKey;
  const cap = document.createElement('caption');
  cap.textContent = titleKey ? getDeep(rowObj, titleKey.split('.')) ?? '' : '';
  t.appendChild(cap);

  const tree = buildColumnTree(columns);
  tree.order.forEach(seg => t.appendChild(renderDataNode(tree.children[seg], rowObj)));

  /* 削除 */
  t.addEventListener('contextmenu', e => {
    if (e.target.closest('table.entity') !== t) return;
    e.preventDefault();
    if (confirm('このエンティティを削除しますか？')) {
      const idx = [...$('#tableZone').querySelectorAll('table.entity')].indexOf(t);
      currentData.splice(idx, 1);
      t.remove();
      updateDataJsonArea();
      reindexEntities();
    }
  });
  return t;
}
function renderTables(arr, columns) {
  const f = document.createDocumentFragment();
  arr.forEach((o, i) => f.appendChild(renderEntityTable(o, columns, i)));
  return f;
}

/* -------------------------------------------------- */
/*  3) フラットテーブル描画                            */
/* -------------------------------------------------- */
function renderFlatTable(arr, columns) {
  const table = document.createElement('table');
  table.className = 'flat';

  const tree       = buildColumnTree(columns);
  const maxDepth   = maxDepthOf(tree);
  const headerRows = Array.from({ length: maxDepth }, () => document.createElement('tr'));

  (function addHeader(node, depth) {
    const th = document.createElement('th');
    th.textContent = node.label;
    const hasChild = node.order.length > 0;
    if (hasChild && node.leafCount > 1) th.colSpan = node.leafCount;
    if (!hasChild) {
      const rs = maxDepth - depth;
      if (rs > 1) th.rowSpan = rs;
    }
    headerRows[depth].appendChild(th);
    node.order.forEach(seg => addHeader(node.children[seg], depth + 1));
  })(tree, 0);

  const thead = document.createElement('thead');
  headerRows.forEach(r => thead.appendChild(r));
  table.appendChild(thead);

  /* --- leaf columns --- */
  const leafColumns = [];
  (function collect(node){
    if (!node.order.length) { if (node.colMeta) leafColumns.push(node.colMeta); return; }
    node.order.forEach(seg => collect(node.children[seg]));
  })(tree);

  /* --- tbody --- */
  const tbody = document.createElement('tbody');
  (arr.length ? arr : [{}]).forEach(obj => {
    const tr = document.createElement('tr');
    leafColumns.forEach(col => {
      const td = document.createElement('td');
      const v  = getDeep(obj, col.key.split('.')) ?? '';
      if (col.multiline) {
        const ta = document.createElement('textarea');
        ta.rows = 3; ta.value = v; td.appendChild(ta);
      } else {
        td.contentEditable = true; td.textContent = v;
      }
      td.dataset.key = col.key;
      tr.appendChild(td);
    });
    /* 削除 */
    tr.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (confirm('この行を削除しますか？')) {
        const idx = [...table.tBodies[0].rows].indexOf(tr);
        currentData.splice(idx, 1);
        tr.remove();
        updateDataJsonArea();
      }
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

/* -------------------------------------------------- */
/*  4) JSON ⇄ Table                                   */
/* -------------------------------------------------- */
function jsonFromTables() {
  const flat = $('#tableZone table.flat');
  if (flat) {
    const data = [];
    flat.querySelectorAll('tbody tr').forEach(tr => {
      const o = {};
      tr.querySelectorAll('td[data-key]').forEach(td => {
        const val = td.querySelector('textarea')?.value ?? td.textContent.trim();
        setDeep(o, td.dataset.key.split('.'), val);
      });
      data.push(o);
    });
    return data;
  }
  const data = [];
  $('#tableZone').querySelectorAll('table.entity').forEach(ent => {
    const o = {};
    ent.querySelectorAll('[data-key]').forEach(cell => {
      const val = cell.querySelector('textarea')?.value ?? cell.textContent.trim();
      setDeep(o, cell.dataset.key.split('.'), val);
    });
    data.push(o);
  });
  return data;
}

/* -------------------------------------------------- */
/*  5) メタテーブル                                   */
/* -------------------------------------------------- */
function parseMeta(str) {
  if (!str.trim()) return [];
  try {
    const js = JSON.parse(str);
    return js._meta?.columns || [];
  } catch {
    alert('メタ JSON が不正です');
    return [];
  }
}
function renderMetaRow(col = {}) {
  const tr = document.createElement('tr');

  const tdKey = document.createElement('td');
  tdKey.contentEditable = true;
  tdKey.textContent = col.key ?? '';
  tdKey.dataset.origin = col.key ?? '';
  tr.appendChild(tdKey);

  const tdLabel = document.createElement('td');
  tdLabel.contentEditable = true;
  tdLabel.textContent = col.label ?? '';
  tr.appendChild(tdLabel);

  const tdMul = document.createElement('td');
  const cb    = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!col.multiline;
  tdMul.appendChild(cb);
  tr.appendChild(tdMul);

  const tdOp = document.createElement('td');
  const up   = Object.assign(document.createElement('button'), { textContent:'▲' });
  up.onclick = () => { const p = tr.previousElementSibling; if (p) { tr.parentElement.insertBefore(tr,p); handleMetaChanged(); } };
  const down = Object.assign(document.createElement('button'), { textContent:'▼' });
  down.onclick = () => { const n = tr.nextElementSibling; if (n) { tr.parentElement.insertBefore(n,tr); handleMetaChanged(); } };
  const del  = Object.assign(document.createElement('button'), { textContent:'✕' });
  del.onclick = () => { tr.remove(); handleMetaChanged(); };
  tdOp.append(up, down, del);
  tr.appendChild(tdOp);
  return tr;
}
function renderMetaFlatTable(columns) {
  const tbl = document.createElement('table');
  tbl.className = 'meta';
  const thead = tbl.createTHead();
  thead.innerHTML = '<tr><th>key</th><th>label</th><th>multiline</th><th></th></tr>';
  const tb = tbl.createTBody();
  columns.forEach(c => tb.appendChild(renderMetaRow(c)));
  return tbl;
}
function columnsFromMetaTable() {
  const cols = [];
  $('#metaTableZone .meta tbody')?.querySelectorAll('tr').forEach(tr => {
    const [keyCell, labelCell, mulCell] = tr.children;
    const key = keyCell.textContent.trim();
    if (!key) return;
    const c = { key };
    const lab = labelCell.textContent.trim();
    if (lab) c.label = lab;
    if (mulCell.querySelector('input').checked) c.multiline = true;
    cols.push(c);
  });
  return cols;
}

/* -------------------------------------------------- */
/*  6) メタ & データ更新                               */
/* -------------------------------------------------- */
function renameKeyAcrossData(oldK, newK) {
  if (oldK === newK) return;
  const oldArr = oldK.split('.');
  const newArr = newK.split('.');
  currentData.forEach(obj => {
    const v = getDeep(obj, oldArr);
    if (v === undefined) return;
    const deepening = newK.startsWith(oldK + '.');
    if (deepening) { deleteDeep(obj, oldArr); setDeep(obj, newArr, v); }
    else           { setDeep(obj, newArr, v); deleteDeep(obj, oldArr); }
  });
}
function removeKeyAcrossData(k) {
  const arr = k.split('.');
  currentData.forEach(obj => {
    const val = getDeep(obj, arr);
    if (val === undefined) return;
    if (val && typeof val === 'object' && Object.keys(val).length) return;
    deleteDeep(obj, arr);
  });
}
function handleMetaChanged() {
  const newCols = columnsFromMetaTable();
  const newKeys = newCols.map(c => c.key);
  if (!keySetValid(newKeys)) return;
  const oldKeys = currentColumns.map(c => c.key);
  oldKeys.filter(k => !newKeys.includes(k)).forEach(removeKeyAcrossData);
  currentColumns = newCols;
  updateMetaJsonArea();
  rebuildDataTable();
  updateDataJsonArea();
}

/* -------------------------------------------------- */
/*  7) メタ自動生成                                   */
/* -------------------------------------------------- */
function inferColumnsFromData(dataArr) {
  const keys = new Set();
  function walk(o, base='') {
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      Object.entries(o).forEach(([k,v])=>{
        const path = base ? `${base}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path);
        else keys.add(path);
      });
    }
  }
  dataArr.forEach(obj => walk(obj));
  return [...keys].map(k => ({ key:k, label:k.split('.').pop() }));
}
function obtainColumns(dataArr) {
  let cols;
  if (metaZone.querySelector('.meta'))
    cols = columnsFromMetaTable();
  else
    cols = parseMeta(elMeta.value);
  if (!cols.length) {
    cols = inferColumnsFromData(dataArr);
    currentColumns = cols;
    metaZone.textContent = '';
    metaZone.appendChild(renderMetaFlatTable(cols));
    updateMetaJsonArea();
  }
  return cols;
}

/* -------------------------------------------------- */
/*  8) テーブル再描画                                 */
/* -------------------------------------------------- */
function rebuildDataTable() {
  dataZone.textContent = '';
  if (currentView === 'flat')
    dataZone.appendChild(renderFlatTable(currentData, currentColumns));
  else
    dataZone.appendChild(renderTables(currentData, currentColumns));
}

/* -------------------------------------------------- */
/*  9) UI イベント                                    */
/* -------------------------------------------------- */
export function initEditor() {

  /* ----- ボタン群 ----- */
  $('#btnBuild').onclick = () => {
    let data; try { data = normalizeDataJson(elData.value, elData); }
    catch { return alert('データ JSON が不正です'); }

    currentColumns = obtainColumns(data);
    if (!keySetValid(currentColumns.map(c=>c.key)))
      return alert('メタデータキーに重複または親子衝突があります');

    currentData = data; currentView = 'nest';
    rebuildDataTable(); updateDataJsonArea();
  };

  $('#btnBuildFlat').onclick = () => {
    let data; try { data = normalizeDataJson(elData.value, elData); }
    catch { return alert('データ JSON が不正です'); }

    currentColumns = obtainColumns(data);
    if (!keySetValid(currentColumns.map(c=>c.key)))
      return alert('メタデータキーに重複または親子衝突があります');

    currentData = data; currentView = 'flat';
    rebuildDataTable(); updateDataJsonArea();
  };

  $('#btnToJson').onclick = async () => {
    currentData = jsonFromTables(); updateDataJsonArea();
    await copyToClipboard(elData.value, 'JSON をクリップボードにコピーしました');
  };

  $('#btnAddEntity').onclick = () => {
    currentData.push({}); updateDataJsonArea();
    (currentView === 'flat' ? $('#btnBuildFlat') : $('#btnBuild')).click();
  };

  /* --- メタ側 --- */
  $('#btnMetaBuildFlat').onclick = () => {
    metaZone.textContent = '';
    metaZone.appendChild(renderMetaFlatTable(parseMeta(elMeta.value)));
    handleMetaChanged();
  };
  $('#btnAddColumn').onclick = () => {
    let tbl = metaZone.querySelector('.meta');
    if (!tbl) { $('#btnMetaBuildFlat').click(); tbl = metaZone.querySelector('.meta'); }
    tbl.tBodies[0].appendChild(renderMetaRow());
  };
  $('#btnMetaToJson').onclick = async () => {
    if (!keySetValid(columnsFromMetaTable().map(c=>c.key)))
      return alert('メタデータキーに重複または親子衝突があります');
    updateMetaJsonArea();
    await copyToClipboard(elMeta.value,'メタ JSON をクリップボードにコピーしました');
  };

  /* ----- リアルタイム同期 ----- */
  dataZone.addEventListener('input', e => {
    const td = e.target.closest('td[data-key]'); if (!td) return;
    const keyPath = td.dataset.key.split('.');
    const val = td.querySelector('textarea')?.value ?? td.textContent.trim();

    let idx = -1;
    if (currentView === 'flat') {
      const tr = td.closest('tr');
      idx = [...dataZone.querySelectorAll('table.flat tbody tr')].indexOf(tr);
    } else {
      const ent = td.closest('table.entity');
      idx = [...dataZone.querySelectorAll('table.entity')].indexOf(ent);
      if (ent && ent.dataset.titleKey === keyPath.join('.'))
        ent.querySelector('caption').textContent = val;
    }
    if (idx < 0) return;
    setDeep(currentData[idx], keyPath, val);
    updateDataJsonArea();
  });

  metaZone.addEventListener('input', e => {
    const td = e.target.closest('td'); if (!td) return;
    const keyCell = td.cellIndex === 0;
    if (keyCell) {
      const newKey = td.textContent.trim();
      if (!newKey || newKey.endsWith('.')) return;

      const rows = td.closest('tbody').querySelectorAll('tr');
      const draftKeys = [...rows].map(r => r.children[0].textContent.trim()).filter(Boolean);
      if (!keySetValid(draftKeys)) return;
      const oldKey = td.dataset.origin || '';
      if (oldKey && oldKey !== newKey) renameKeyAcrossData(oldKey, newKey);
      td.dataset.origin = newKey;
    }
    handleMetaChanged();
  });
  metaZone.addEventListener('change', handleMetaChanged);

  /* ----- textarea 高さ調整 ----- */
  $$('textarea:not(.compact)').forEach(ta => {
    fitHeight(ta);
    ta.addEventListener('input', () => fitHeight(ta));
  });
}

/* -------------------------------------------------- */
/* 10) 外部から利用するメソッド                       */
/* -------------------------------------------------- */
export const EditorAPI = {
  newDocument(){
    $('#docTitle').value = '';
    elData.value = '';
    elMeta.value = '';
    currentData = [];
    currentColumns = [];
    $('#tableZone').innerHTML = '';
    metaZone.innerHTML = '';          // ← 追加：メタデータテーブルもクリア
  }
};
