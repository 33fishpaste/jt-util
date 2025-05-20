import { $, $$,
         normalizeDataJson,
         copyToClipboard,
         keySetValid,
         setDeep,
         getDeep          }          from '../utils.js';
import { state,
         updateDataJsonArea,
         updateMetaJsonArea,
         autoFitAllTextareas }        from './state.js';
import * as meta                      from './meta.js';
import { rebuildDataTable }           from './render.js';
import { buildColumnTree }            from './column.js';

/* ========= JSON ⇄ Table 変換 ========= */
function jsonFromTables(){
  const flat=$('#tableZone table.flat');
  if(flat){
    const data=[];
    flat.querySelectorAll('tbody tr').forEach(tr=>{
      const o={};
      tr.querySelectorAll('td[data-key]').forEach(td=>{
        const val=td.querySelector('textarea')?.value ?? td.textContent.trim();
        setDeep(o,td.dataset.key.split('.'),val);
      });
      data.push(o);
    });
    return data;
  }

  const nests=$$('#tableZone table.entity');
  if(!nests.length) return [];
  return nests.map(ent=>{
    const o={};
    ent.querySelectorAll('td[data-key]').forEach(td=>{
      const val=td.querySelector('textarea')?.value ?? td.textContent.trim();
      setDeep(o,td.dataset.key.split('.'),val);
    });
    return o;
  });
}

/* ========= initEditor ========= */
export function initEditor(){

  /* ----- ビルド ----- */
  $('#btnBuild').onclick = () => buildTables('nest');
  $('#btnBuildFlat').onclick = () => buildTables('flat');

  $('#btnToJson').onclick = async () => {
    state.currentData = jsonFromTables();
    updateDataJsonArea();
    await copyToClipboard(state.elData.value,'JSON をクリップボードにコピーしました');
  };

  /* ----- TSV コピー ----- */
  $('#btnToTsv').onclick = async () => {
    if (state.currentView !== 'flat') {
      return alert('フラットテーブル表示時のみ TSV コピーが使えます');
    }

    // カラムツリーを構築してフラットテーブルの列順を取得
    const tree = buildColumnTree(state.currentColumns);
    const leafCols = [];
    (function collect(node){
      if(!node.order.length){
        if(node.colMeta) leafCols.push(node.colMeta);
        return;
      }
      node.order.forEach(seg => collect(node.children[seg]));
    })(tree);

    // ヘッダ行
    const header = leafCols
      .map(c => c.key.replace(/\t|\n/g, ' '))
      .join('\t');

    // データ行
    const rows = state.currentData.map(obj =>
      leafCols.map(col => {
        const v = getDeep(obj, col.key.split('.')) ?? '';
        return String(v).replace(/\t|\n/g, ' ');
      }).join('\t')
    );

    const tsv = [header, ...rows].join('\n');
    await copyToClipboard(tsv, 'TSV をクリップボードにコピーしました');
  };

  /* ----- TSV → JSON 取込 ----- */
  $('#btnFromTsv').onclick = async () => {
    /* 1) クリップボードから取得 */
    const tsv = await navigator.clipboard.readText();
    if (!tsv || !tsv.includes('\t')) {
      return alert('クリップボードに TSV 形式データが見つかりません');
    }

    /* 2) 行を分割し、ヘッダ＋本体を取得 */
    const lines = tsv.trim().replace(/\r\n/g, '\n').split('\n').filter(Boolean);
    if (lines.length < 2) return alert('TSV の行数が不足しています');

    const headers = lines[0].split('\t');

    /* 3) TSV → JSON 配列へ変換 */
    const data = lines.slice(1).map(line => {
      const cells = line.split('\t');
      const obj = {};
      headers.forEach((key, i) => {
        /* 空値も保持。多階層キーは '.' で分割 */
        setDeep(obj, key.split('.'), cells[i] ?? '');
      });
      return obj;
    });

    /* 4) state を更新し、JSON テキストエリアへ反映 */
    state.currentData = data;
    state.currentColumns = meta.obtainColumns(data);
    if (!keySetValid(state.currentColumns.map(c => c.key))) {
      alert('取得した TSV から重複／親子衝突キーが検出されました');
      return;
    }

    state.currentView = 'flat';        // デフォルトでフラット表示へ
    rebuildDataTable();                // テーブル再描画
    updateDataJsonArea();              // JSON テキストエリア更新

    alert('TSV を JSON に変換し、入力データに貼り付けました');
  };

  /* ----- メタテーブル表示／非表示 ----- */
$('#btnToggleMeta').onclick = () => {
  const zone = state.metaZone;               // メタテーブルを包む要素
  const btn  = $('#btnToggleMeta');

  const hidden = zone.style.display === 'none';
  zone.style.display = hidden ? '' : 'none'; // toggle
  btn.textContent  = hidden ? 'メタ非表示' : 'メタ表示';
};



  $('#btnAddEntity').onclick = () => {
    state.currentData.push({});
    updateDataJsonArea();
    (state.currentView==='flat'?$('#btnBuildFlat'):$('#btnBuild')).click();
  };

  /* ----- ネストテーブル開閉 ----- */
  state.dataZone.addEventListener('click', e => {
    const th = e.target.closest('th.collapsible');
    if(!th) return;
    const td = th.nextElementSibling;
    if(!td) return;
    const collapsed = th.classList.toggle('collapsed');
    td.style.display = collapsed ? 'none' : '';
  });

  /* --- メタ側 --- */
  $('#btnMetaBuildFlat').onclick = () => {
    state.metaZone.textContent='';
    state.metaZone.appendChild(meta.renderMetaFlatTable(meta.parseMeta(state.elMeta.value)));
    meta.handleMetaChanged();
  };
  $('#btnAddColumn').onclick = () => {
    let tbl=state.metaZone.querySelector('.meta');
    if(!tbl){ $('#btnMetaBuildFlat').click(); tbl=state.metaZone.querySelector('.meta'); }
    tbl.tBodies[0].appendChild(meta.renderMetaRow());
  };
  $('#btnMetaToJson').onclick = async () => {
    if(!keySetValid(meta.columnsFromMetaTable().map(c=>c.key)))
      return alert('メタデータキーに重複または親子衝突があります');
    updateMetaJsonArea();
    await copyToClipboard(state.elMeta.value,'メタ JSON をクリップボードにコピーしました');
  };

  /* ----- データテーブル側のセル編集 ----- */
  state.dataZone.addEventListener('input', e=>{
    const td=e.target.closest('td');
    if(!td) return;

    const keyPath=td.dataset.key.split('.');
    const val=td.querySelector('textarea')?.value ?? td.textContent.trim();

    let idx=-1;
    if(state.currentView==='flat'){
      const tr=td.closest('tr');
      idx=[...state.dataZone.querySelectorAll('table.flat tbody tr')].indexOf(tr);
    }else{
      const ent=td.closest('table.entity');
      idx=[...state.dataZone.querySelectorAll('table.entity')].indexOf(ent);
      if(ent&&ent.dataset.titleKey===keyPath.join('.'))
        ent.querySelector('caption span:first-child').textContent=val;
    }
    if(idx<0) return;
    setDeep(state.currentData[idx],keyPath,val);
    updateDataJsonArea();
  });

  /* ----- メタテーブル側の編集 ----- */
  state.metaZone.addEventListener('input', e=>{
    const td=e.target.closest('td');
    if(!td) return;
    const keyCell=td.cellIndex===1; /* 操作列が先頭 */

    if(keyCell){
      const newKey=td.textContent.trim();
      if(!newKey||newKey.endsWith('.')) return;

      const rows=td.closest('tbody').querySelectorAll('tr');
      const draftKeys=[...rows].map(r=>r.children[1].textContent.trim()).filter(Boolean);
      if(!keySetValid(draftKeys)) return;

      const oldKey=td.dataset.origin||'';
      if(oldKey&&oldKey!==newKey) meta.renameKeyAcrossData(oldKey,newKey);
      td.dataset.origin=newKey;
    }
    meta.handleMetaChanged();
  });
  state.metaZone.addEventListener('change', meta.handleMetaChanged);

  /* textarea 高さ調整 */
  autoFitAllTextareas();
}

/* ========= 内部ヘルパ ========= */
function buildTables(view){
  let data;
  try{ data=normalizeDataJson(state.elData.value,state.elData); }
  catch{ return alert('データ JSON が不正です'); }

  state.currentColumns = meta.obtainColumns(data);
  if(!keySetValid(state.currentColumns.map(c=>c.key)))
    return alert('メタデータキーに重複または親子衝突があります');

  state.currentData = data;
  state.currentView = view;
  rebuildDataTable();
  updateDataJsonArea();
}
