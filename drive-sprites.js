/* STEEL DRIVE — 8 garage-linked top-view sprites. Keys mirror the main game's CARS. */
Object.assign(MODEL,{
 t:{w:52,h:92,i:0,kind:'minivan'}, h:{w:43,h:79,i:1,kind:'sedan'},
 n:{w:51,h:82,i:2,kind:'suv'}, m:{w:53,h:91,i:3,kind:'suv3'},
 s:{w:43,h:67,i:4,kind:'kei'}, z:{w:49,h:77,i:5,kind:'crossover'},
 b:{w:46,h:82,i:6,kind:'sedan'}, d:{w:39,h:63,i:7,kind:'roadster'}
});
const DRIVE_SHEET=new Image();
DRIVE_SHEET.src='assets/drive/sprites.svg?v=1';
function playerCar(cx,cy,key){
 const m=MODEL[key]||MODEL.h;
 x.save();x.translate(Math.round(cx),Math.round(cy));
 // A small road shadow keeps the sprite readable at speed.
 x.fillStyle='rgba(0,0,0,.32)';x.fillRect(-m.w*.42,-m.h*.45,m.w*.84,m.h*.96);
 if(DRIVE_SHEET.complete&&DRIVE_SHEET.naturalWidth){
   // Sheet cells are 80×140. Scale each car by its actual class silhouette.
   x.drawImage(DRIVE_SHEET,m.i*80,0,80,140,-m.w/2,-m.h/2,m.w,m.h);
 }else{
   // Loading fallback: never block gameplay if the sprite asset is late.
   x.fillStyle='#d8dde0';x.fillRect(-m.w/2,-m.h/2,m.w,m.h);
 }
 x.restore();
}
