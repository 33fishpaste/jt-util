import { $, $$, fitHeight } from '../utils.js';
import { WIP }              from '../storage.js';

/* ========= 共有ステート ========= */
export const state = {
  currentData   : [],
  currentColumns: [],
  currentView   : 'nest',   // 'nest' | 'flat'

  /* DOM */
  elData  : $('#dataJson'),
  elMeta  : $('#metaJson'),
  dataZone: $('#tableZone'),
  metaZone: $('#metaTableZone'),
};

/* ========= JSON テキストエリア同期 ========= */
export const updateDataJsonArea = () => {
  state.elData.value = JSON.stringify(state.currentData, null, 2);
  WIP.saveWip();
};
export const updateMetaJsonArea = () => {
  state.elMeta.value = JSON.stringify({ _meta: { columns: state.currentColumns } }, null, 2);
  WIP.saveWip();
};

/* ========= textarea 自動高さ調整 ========= */
export function autoFitAllTextareas() {
  $$('.centerPane textarea:not(.compact)').forEach(ta => {
    fitHeight(ta);
    ta.addEventListener('input', () => fitHeight(ta));
  });
}
