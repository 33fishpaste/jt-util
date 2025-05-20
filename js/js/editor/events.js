import { $, $$,
         normalizeDataJson,
         copyToClipboard,
         keySetValid,
         setDeep          }          from '../utils.js';
import { state,
         updateDataJsonArea,
         updateMetaJsonArea,
         autoFitAllTextareas }        from './state.js';
import * as meta                      from './meta.js';
import { rebuildDataTable }           from './render.js';

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
  /* nest */
  const data=[];
  $('#tableZone').querySelectorAll('table.entity').forEach(ent=>{
    const o={};
    ent.querySelectorAll('[data-key]').forEach(cell=>{
      const val=cell.querySelector('textarea')?.value ?? cell.textContent.trim();
      setDeep(o,cell.dataset.key.split('.'),val);
    });
    data.push(o);
  });
  return data;
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

  /* ----- リアルタイム同期 ----- */
  state.dataZone.addEventListener('input', e=>{
    const td=e.target.closest('td[data-key]');
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
