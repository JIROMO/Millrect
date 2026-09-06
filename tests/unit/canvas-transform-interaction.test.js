"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { bootApp } = require("../harness/boot.js");
function boot() {
  const app = bootApp();
  const c = vm.createContext({ ...app, console, document: { querySelector: () => null },
    window: {}, liveUpdateShapes: () => {}, realToMM: x => x });
  for (const f of ["transform.js", "interaction.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../../app/js", f), "utf8"), c);
  const commands = fs.readFileSync(path.join(__dirname, "../../app/js/commands.js"), "utf8");
  vm.runInContext(commands.slice(commands.indexOf("function shiftShape("), commands.indexOf("function regenerateShapeIds(")), c);
  vm.runInContext("_updatePathSizeDisplay = () => {};", c);
  return c;
}
function close(a,b) { assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`); }
function pointClose(a,b) { close(a[0],b[0]); close(a[1],b[1]); }
function begin(c, shape, hi) {
  c.getCurrentLayer().shapes.push(shape);
  c.shape = shape; c.hi = hi;
  vm.runInContext(`_ds = { action: 'resize', shapeId: shape.id, hi,
    startRP: {x:0,y:0}, origShape: JSON.parse(JSON.stringify(shape)),
    origPivot: getShapePivotReal(shape), origGroupBB: shape.type === 'group' ? groupResizeBounds(shape) : null };`, c);
}
function vector(c, shape, x,y) { return c.applyVisualTransformReal(x,y,shape.rotation,shape.flipH,shape.flipV,0,0); }
function corner(c,shape,x,y) { return c.applyShapeTransformReal(x,y,shape); }
test("rotated/flipped rectangle handles keep opposite anchor fixed across frames and clamp", () => {
  for (const rotation of [0,30,90,145]) for (const flipH of [false,true]) for(const hi of [0,1,2,3,4,5,6,7]) {
    const c=boot(), shape={id:'r',type:'rect',x:10,y:20,width:40,height:20,rotation,flipH};
    const left=[0,6,7].includes(hi),right=[2,3,4].includes(hi),top=[0,1,2].includes(hi),bottom=[4,5,6].includes(hi);
    const anchor=s=>corner(c,s,left?s.x+s.width:right?s.x:s.x+s.width/2,top?s.y+s.height:bottom?s.y:s.y+s.height/2);
    const before=anchor(shape); begin(c,shape,hi);
    for(const d of [4,9,2,100]) {
      const [x,y]=vector(c,shape,d,d); c.handleResize({x,y},false); pointClose(anchor(shape),before);
    }
  }
});
test("top-left proportional resize preserves ratio and bottom-right anchor", () => {
  const c=boot(); const box=c.anchoredResizeBox({x:10,y:20,width:40,height:20},0,-20,-10,true);
  close(box.width,60);close(box.height,30);close(box.x+box.width,50);close(box.y+box.height,40);
});
test("rotated line does not accumulate anchor correction between frames", () => {
  const c=boot(), s={id:'l',type:'line',x1:0,y1:0,x2:40,y2:10,rotation:35};
  const before=corner(c,s,s.x1,s.y1);begin(c,s,1);
  for(const d of [3,7,3]) {const [x,y]=vector(c,s,d,d);c.handleResize({x,y},false);pointClose(corner(c,s,s.x1,s.y1),before);}
});
test("corner circle keeps the requested bounding corner in all four drag directions",()=>{
 const c=boot();for(const sx of [-1,1])for(const sy of [-1,1]){
  const start={x:20,y:30},end={x:20+sx*40,y:30+sy*25};
  const s=c.buildPreview('circle',start,end,true,true);
  close(s.r,20);close(s.cx-sx*s.r,start.x);close(s.cy-sy*s.r,start.y);
 }
 const centered=c.buildPreview('circle',{x:20,y:30},{x:50,y:70},true,false);
 close(centered.cx,20);close(centered.cy,30);close(centered.r,50);
});
test("nested rotated groups scale uniformly without drift, retaining circle geometry",()=>{
 const c=boot();const s={id:'g',type:'group',rotation:25,children:[
  {id:'r',type:'rect',x:0,y:0,width:30,height:20,rotation:15},
  {id:'nested',type:'group',rotation:40,children:[{id:'circle',type:'circle',cx:50,cy:20,r:5}]}]};
 begin(c,s,4);const before=c.collectWorldPointsReal(s,[]); const bb=c.groupResizeBounds(s);
 const [dx,dy]=vector(c,s,bb.width,bb.height);
 c.handleResize({x:dx,y:dy},false);const first=JSON.stringify(s);
 close(s.children[1].children[0].r,10);
 const after=c.collectWorldPointsReal(s,[]);
 for(let i=1;i<before.length;i++) {close(after[i][0]-after[0][0],2*(before[i][0]-before[0][0]));close(after[i][1]-after[0][1],2*(before[i][1]-before[0][1]));}
 c.handleResize({x:dx,y:dy},false); assert.equal(JSON.stringify(s),first);
});
test("rotated ellipse resizing uses its center as pivot and fixes the opposite corner",()=>{
 const c=boot(),s={id:'e',type:'ellipse',cx:50,cy:60,rx:20,ry:10,rotation:40};
 const anchor=s=>corner(c,s,s.cx-s.rx,s.cy-s.ry),before=anchor(s);begin(c,s,4);
 for(const d of [2,8,2]){const [x,y]=vector(c,s,d,d);c.handleResize({x,y},false);pointClose(anchor(s),before);}
});
test("corner-circle commit matches the preview and is undoable", () => {
  const c = boot();
  vm.runInContext('_drawStyle = () => ({stroke:"#000",fill:"none"}); updateToolbar = () => {}; uiUpdate = () => {}; render = () => {};', c);
  const start = {x:40,y:50}, end = {x:10,y:90};
  const preview = c.buildPreview("circle",start,end,true,true);
  c.commitShape("circle",start,end,true,true);
  const shape = c.getCurrentLayer().shapes.at(-1);
  close(shape.cx,preview.cx); close(shape.cy,preview.cy); close(shape.r,preview.r);
  c.undo(); assert.equal(c.getCurrentLayer().shapes.length,0);
  c.redo(); close(c.getCurrentLayer().shapes.at(-1).r,preview.r);
});
test("group picking hits child geometry and leaves empty space unselected",()=>{
  const c=boot();
  c.realToPaperDist=x=>x; c.paperToRealDist=x=>x; c.resolveStrokeWidthMm=()=>0;
  c.getShapeBBox=(shape,scale,ancestors=[])=>c.aabbFromPoints(c.collectWorldPointsReal(shape,ancestors));
  const shape={id:'g',type:'group',rotation:30,children:[
    {id:'a',type:'rect',x:0,y:0,width:10,height:10,fill:'#fff'},
    {id:'b',type:'rect',x:80,y:0,width:10,height:10,fill:'#fff'}]};
  const child=c.applyWorldTransformReal(5,5,shape.children[0],[shape]);
  const gap=c.applyShapeTransformReal(45,5,shape);
  assert.equal(c.realPointInShapeGeometry({x:child[0],y:child[1]},shape,{}),true);
  assert.equal(c.realPointInShapeGeometry({x:gap[0],y:gap[1]},shape,{}),false);
});
