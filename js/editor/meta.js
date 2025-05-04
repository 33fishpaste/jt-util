import { $, getDeep, setDeep, deleteDeep,
         keySetValid }                from '../utils.js';
import { state,
         updateDataJsonArea,
         updateMetaJsonArea }         from './state.js';
import { rebuildDataTable }           from './render.js';

/* ============================ */
/* 1) パース & 描画             */
/* ============================ */
export function parseMeta(str){
  if(!str.trim()) return [];
  try{
    const js=JSON.parse(str);
    return js._meta?.columns||[];
  }catch{
    alert('メタ JSON が不正です'); return [];
  }
}

export function renderMetaRow(col={}){
  const tr=document.createElement('tr');

  /* 操作セル */
  const tdOp=document.createElement('td');
  const up   =Object.assign(document.createElement('button'),{textContent:'▲'});
  up.onclick =()=>{const p=tr.previousElementSibling;if(p){tr.parentElement.insertBefore(tr,p);handleMetaChanged();}};
  const down =Object.assign(document.createElement('button'),{textContent:'▼'});
  down.onclick =()=>{const n=tr.nextElementSibling;if(n){tr.parentElement.insertBefore(n,tr);handleMetaChanged();}};
  const del  =Object.assign(document.createElement('button'),{textContent:'✕'});
  del.onclick =()=>{tr.remove();handleMetaChanged();};
  tdOp.append(up,down,del);
  tr.appendChild(tdOp);

  const tdKey=document.createElement('td');
  tdKey.contentEditable=true;
  tdKey.textContent=col.key??'';
  tdKey.dataset.origin=col.key??'';
  tr.appendChild(tdKey);

  const tdLabel=document.createElement('td');
  tdLabel.contentEditable=true;
  tdLabel.textContent=col.label??'';
  tr.appendChild(tdLabel);

  const tdMul=document.createElement('td');
  const cb=document.createElement('input');
  cb.type='checkbox';
  cb.checked=!!col.multiline;
  tdMul.appendChild(cb);
  tr.appendChild(tdMul);

  return tr;
}

export function renderMetaFlatTable(columns){
  const tbl=document.createElement('table');
  tbl.className='meta';
  tbl.createTHead().innerHTML='<tr><th></th><th>key</th><th>label</th><th>multiline</th></tr>';
  const tb=tbl.createTBody();
  columns.forEach(c=>tb.appendChild(renderMetaRow(c)));
  return tbl;
}

export function columnsFromMetaTable(){
  const cols=[];
  $('#metaTableZone .meta tbody')?.querySelectorAll('tr').forEach(tr=>{
    const [,keyCell,labelCell,mulCell]=tr.children;
    const key=keyCell.textContent.trim();
    if(!key) return;
    const c={key};
    const lab=labelCell.textContent.trim();
    if(lab) c.label=lab;
    if(mulCell.querySelector('input').checked) c.multiline=true;
    cols.push(c);
  });
  return cols;
}

/* ============================ */
/* 2) メタ & データ更新         */
/* ============================ */
function renameKeyAcrossData(oldK,newK){
  if(oldK===newK) return;
  const oldArr=oldK.split('.');
  const newArr=newK.split('.');
  state.currentData.forEach(obj=>{
    const v=getDeep(obj,oldArr);
    if(v===undefined) return;
    const deepening=newK.startsWith(oldK+'.');
    if(deepening){
      deleteDeep(obj,oldArr);
      setDeep(obj,newArr,v);
    }else{
      setDeep(obj,newArr,v);
      deleteDeep(obj,oldArr);
    }
  });
}
function removeKeyAcrossData(k){
  const arr=k.split('.');
  state.currentData.forEach(obj=>{
    const val=getDeep(obj,arr);
    if(val===undefined) return;
    if(val&&typeof val==='object'&&Object.keys(val).length) return;
    deleteDeep(obj,arr);
  });
}
export function handleMetaChanged(){
  const newCols=columnsFromMetaTable();
  const newKeys=newCols.map(c=>c.key);
  if(!keySetValid(newKeys)) return;

  const oldKeys=state.currentColumns.map(c=>c.key);
  oldKeys.filter(k=>!newKeys.includes(k)).forEach(removeKeyAcrossData);

  state.currentColumns=newCols;
  updateMetaJsonArea();
  rebuildDataTable();
  updateDataJsonArea();
}

/* ============================ */
/* 3) メタ自動生成              */
/* ============================ */
function inferColumnsFromData(dataArr){
  const keys=new Set();
  function walk(o,base=''){
    if(o&&typeof o==='object'&&!Array.isArray(o)){
      Object.entries(o).forEach(([k,v])=>{
        const path=base?`${base}.${k}`:k;
        if(v&&typeof v==='object'&&!Array.isArray(v)) walk(v,path);
        else keys.add(path);
      });
    }
  }
  dataArr.forEach(obj=>walk(obj));
  return [...keys].map(k=>({key:k,label:k.split('.').pop()}));
}
export function obtainColumns(dataArr){
  const hasTable=!!state.metaZone.querySelector('.meta');
  let cols=hasTable?columnsFromMetaTable():parseMeta(state.elMeta.value);

  if(!hasTable){
    if(!cols.length) cols=inferColumnsFromData(dataArr);
    state.currentColumns=cols;
    state.metaZone.textContent='';
    state.metaZone.appendChild(renderMetaFlatTable(cols));
    updateMetaJsonArea();
  }
  return cols;
}
