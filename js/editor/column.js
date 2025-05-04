/* ========= Column tree utilities ========= */
export function buildColumnTree(columns){
  const root = { children:{}, order:[], leafCount:0 };
  columns.forEach(col => {
    const segs = col.key.split('.');
    let node   = root;
    segs.forEach((seg,i)=>{
      if(!node.children[seg]){
        node.children[seg] = {
          label    : i===segs.length-1 ? (col.label||seg) : seg,
          keyPath  : segs.slice(0,i+1).join('.'),
          colMeta  : null,
          children : {},
          order    : [],
          leafCount: 0,
        };
        node.order.push(seg);
      }
      node = node.children[seg];
      if(i===segs.length-1) node.colMeta = col;
    });
  });
  (function countLeaves(nd){
    if(!nd.order.length) return nd.leafCount = 1;
    nd.leafCount = nd.order.reduce((s,k)=>s+countLeaves(nd.children[k]),0);
    return nd.leafCount;
  })(root);
  return root;
}
export const maxDepthOf = (node,d=0)=>
  !node.order.length ? d+1
                     : Math.max(...node.order.map(k=>maxDepthOf(node.children[k],d+1)));
