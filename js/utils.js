/* ========= DOM helpers ========= */
export const $  = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ========= Deep-path helpers ========= */
export const getDeep = (obj, pathArr) =>
  pathArr.reduce((o, k) => (o ? o[k] : undefined), obj);

export const setDeep = (obj, pathArr, val) => {
  let cur = obj;
  pathArr.forEach((k, i) => {
    if (i === pathArr.length - 1) return (cur[k] = val);
    if (!(k in cur) || typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  });
};

export const deleteDeep = (obj, pathArr) => {
  if (!obj) return;
  const key = pathArr[0];
  if (pathArr.length === 1) return delete obj[key];
  deleteDeep(obj[key], pathArr.slice(1));
  if (obj[key] && Object.keys(obj[key]).length === 0) delete obj[key];
};

/* ========= Misc helpers ========= */
export function normalizeDataJson(str, ta) {
  if (!str.trim()) return [];
  let data = JSON.parse(str);
  if (!Array.isArray(data)) {
    data = [data];
    if (ta) ta.value = JSON.stringify(data, null, 2);
  }
  return data;
}

export async function copyToClipboard(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    alert(msg);
  } catch { alert('クリップボードにコピーできませんでした'); }
}

export const keySetValid = keys => {
  const set = new Set();
  for (const k of keys) {
    if (set.has(k)) return false;
    set.add(k);
  }
  const arr = [...set].sort();
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j].startsWith(arr[i] + '.')) return false;
    }
  }
  return true;
};

export const safeJsonParse = (str, fallback) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

/* ========= Textarea auto height ========= */
export function fitHeight(ta) {
  if (ta.classList.contains('compact')) return;
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
  const lines = (ta.value.match(/\n/g) || []).length + 1;
  ta.style.height = 'auto';
  ta.style.height = lh * (lines + 2) + 'px';
}
