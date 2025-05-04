import { $ }      from '../utils.js';
import { state }  from './state.js';

export const EditorAPI = {
  newDocument(){
    $('#docTitle').value = '';
    state.elData.value   = '';
    state.elMeta.value   = '';
    state.currentData    = [];
    state.currentColumns = [];
    state.dataZone.innerHTML = '';
    state.metaZone.innerHTML = '';
  }
};
