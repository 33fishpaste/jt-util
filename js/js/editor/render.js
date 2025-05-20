import { $, getDeep, setDeep }         from '../utils.js';
import { state, updateDataJsonArea }   from './state.js';
import { buildColumnTree, maxDepthOf } from './column.js';

function fitThWidth(th){
  const len = (th.textContent || '').trim().length;
  th.style.whiteSpace = 'nowrap';
  th.style.width = (len + 2) + 'ch';
}

/* ========= ネストテーブル描画 ========= */
function renderDataNode(node,dataObj){
  if(!node.order.length){
    const tr=document.createElement('tr');

    const th=document.createElement('th');
    th.textContent=node.colMeta.label||node.label;
    fitThWidth(th);

    const td=document.createElement('td');
    const v=getDeep(dataObj,node.keyPath.split('.')) ?? '';
    if(node.colMeta.multiline){
      const ta=document.createElement('textarea');
      ta.rows=3; ta.value=v; td.appendChild(ta);
    }else{
      td.contentEditable=true; td.textContent=v;
    }
    td.dataset.key=node.colMeta.key;
    tr.append(th,td);
    return tr;
  }

  const tr=document.createElement('tr');
  const th=document.createElement('th');
  th.textContent=node.label;
  fitThWidth(th);
  th.classList.add('collapsible');

  const td=document.createElement('td');
  td.classList.add('no-alt');
  const sub=document.createElement('table');
  sub.className='nested';
  node.order.forEach(seg=>sub.appendChild(renderDataNode(node.children[seg],dataObj)));
  td.appendChild(sub);

  tr.append(th,td);
  return tr;
}

function renderEntityTable(rowObj,columns,i){
  const t=document.createElement('table');
  t.className='entity';
  t.dataset.index=i;
  t.style.width='100%'; // タイトル行がテーブル幅いっぱいに広がるように

  const titleKey=columns[0]?.key||'';
  t.dataset.titleKey=titleKey;

  /* ========= タイトル行（thead） ========= */
  const thead=document.createElement('thead');
  const trTitle=document.createElement('tr');
  const thTitle=document.createElement('th');
  thTitle.colSpan=2;                 // entity テーブルは常に 2 カラム構成
  thTitle.className='entity-title';

  // フレックスレイアウトで左にタイトル、右に操作ボタン
  const wrap=document.createElement('div');
  wrap.style.display='flex';
  wrap.style.alignItems='center';
  wrap.style.justifyContent='space-between';
  wrap.style.width='100%';

  const capLabel=document.createElement('span');
  capLabel.textContent=titleKey?getDeep(rowObj,titleKey.split('.'))??'':'';
  wrap.appendChild(capLabel);

  const recOps=document.createElement('span');

  const up   =Object.assign(document.createElement('button'),{textContent:'▲'});
  up.onclick =()=>{
    if(i===0) return;
    [state.currentData[i-1],state.currentData[i]]=[state.currentData[i],state.currentData[i-1]];
    rebuildDataTable(); updateDataJsonArea();
  };
  const down =Object.assign(document.createElement('button'),{textContent:'▼'});
  down.onclick =()=>{
    if(i===state.currentData.length-1) return;
    [state.currentData[i+1],state.currentData[i]]=[state.currentData[i],state.currentData[i+1]];
    rebuildDataTable(); updateDataJsonArea();
  };
  const del  =Object.assign(document.createElement('button'),{textContent:'✕'});
  del.onclick =()=>{
    if(!confirm('このレコードを削除しますか？')) return;
    state.currentData.splice(i,1);
    rebuildDataTable(); updateDataJsonArea();
  };
  recOps.append(up,down,del);
  wrap.appendChild(recOps);

  thTitle.appendChild(wrap);
  trTitle.appendChild(thTitle);
  thead.appendChild(trTitle);
  t.appendChild(thead);

  /* ========= データ本体 ========= */
  const tree=buildColumnTree(columns);
  tree.order.forEach(seg=>t.appendChild(renderDataNode(tree.children[seg],rowObj)));
  return t;
}

export function renderNestTables(arr,columns){
  const f=document.createDocumentFragment();
  arr.forEach((o,i)=>f.appendChild(renderEntityTable(o,columns,i)));
  return f;
}

/* ========= フラットテーブル描画 ========= */
export function renderFlatTable(arr,columns){
  const table=document.createElement('table');
  table.className='flat';

  /* header */
  const tree=buildColumnTree(columns);
  const maxDepth=maxDepthOf(tree);
  const headerRows=Array.from({length:maxDepth},()=>document.createElement('tr'));

  /* 行操作列用空白ヘッダ */
  const blankTh=document.createElement('th');
  blankTh.rowSpan=maxDepth;
  headerRows[0].appendChild(blankTh);

  (function addHeader(node,depth){
    const th=document.createElement('th');
    const hasChild=node.order.length>0;
    th.className=hasChild?'':'leaf-col';

    const labSpan=document.createElement('span');
    labSpan.textContent=node.label;
    th.appendChild(labSpan);

    if(hasChild&&node.leafCount>1) th.colSpan=node.leafCount;
    if(!hasChild){
      const rs=maxDepth-depth;
      if(rs>1) th.rowSpan=rs;
    }
    headerRows[depth].appendChild(th);
    node.order.forEach(seg=>addHeader(node.children[seg],depth+1));
  })(tree,0);

  const thead=document.createElement('thead');
  headerRows.forEach(r=>thead.appendChild(r));
  table.appendChild(thead);

  /* leaf columns */
  const leafColumns=[];
  (function collect(node){
    if(!node.order.length){ if(node.colMeta) leafColumns.push(node.colMeta); return; }
    node.order.forEach(seg=>collect(node.children[seg]));
  })(tree);

  /* tbody */
  const tbody=document.createElement('tbody');
  (arr.length?arr:[{}]).forEach((obj,i)=>{
    const tr=document.createElement('tr');

    /* 行操作セル */
    const optd=document.createElement('td');
    const up   =Object.assign(document.createElement('button'),{textContent:'▲'});
    up.onclick =()=>{
      if(i===0) return;
      [state.currentData[i-1],state.currentData[i]]=[state.currentData[i],state.currentData[i-1]];
      rebuildDataTable(); updateDataJsonArea();
    };
    const down =Object.assign(document.createElement('button'),{textContent:'▼'});
    down.onclick =()=>{
      if(i===state.currentData.length-1) return;
      [state.currentData[i+1],state.currentData[i]]=[state.currentData[i],state.currentData[i+1]];
      rebuildDataTable(); updateDataJsonArea();
    };
    const del  =Object.assign(document.createElement('button'),{textContent:'✕'});
    del.onclick =()=>{
      if(!confirm('このレコードを削除しますか？')) return;
      state.currentData.splice(i,1);
      rebuildDataTable(); updateDataJsonArea();
    };
    optd.append(up,down,del);
    tr.appendChild(optd);

    /* データセル */
    leafColumns.forEach(col=>{
      const td=document.createElement('td');
      const v=getDeep(obj,col.key.split('.')) ?? '';
      if(col.multiline){
        const ta=document.createElement('textarea');
        ta.rows=3; ta.value=v; td.appendChild(ta);
      }else{
        td.contentEditable=true; td.textContent=v;
      }
      td.dataset.key=col.key;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

/* ========= テーブル再描画 ========= */
export function rebuildDataTable(){
  state.dataZone.textContent='';
  if(state.currentView==='flat')
    state.dataZone.appendChild(renderFlatTable(state.currentData,state.currentColumns));
  else
    state.dataZone.appendChild(renderNestTables(state.currentData,state.currentColumns));
}
