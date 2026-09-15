/* STEEL DRIVE — garage-linked top-view silhouettes. Each key mirrors the main game's CARS key. */
Object.assign(MODEL,{
 t:{c:'#b84d48',w:52,h:92,kind:'minivan'},
 h:{c:'#477ba4',w:43,h:79,kind:'sedan'},
 n:{c:'#cf9b42',w:51,h:82,kind:'suv'},
 m:{c:'#596a78',w:53,h:91,kind:'suv3'},
 s:{c:'#497b63',w:43,h:67,kind:'kei'},
 z:{c:'#8a668f',w:49,h:77,kind:'crossover'},
 b:{c:'#a85f43',w:46,h:82,kind:'boxer'},
 d:{c:'#4d8f9b',w:39,h:63,kind:'roadster'}
});
function playerCar(cx,cy,key){
 const m=MODEL[key]||MODEL.h,w=m.w,h=m.h,k=m.kind;
 x.save();x.translate(Math.round(cx),Math.round(cy));
 // shadow + tyres
 x.fillStyle='#0b1014';x.fillRect(-w/2+2,-h/2-3,w-4,h+6);
 const wheel=(yy,len=13)=>{x.fillStyle='#090d10';x.fillRect(-w/2-5,yy,6,len);x.fillRect(w/2-1,yy,6,len)};
 wheel(-h*.31,k==='suv'||k==='suv3'?16:13);wheel(h*.14,k==='suv'||k==='suv3'?16:13);
 // body shell
 x.fillStyle=m.c;x.fillRect(-w/2,-h/2,w,h);
 // key-specific silhouette cues
 if(k==='minivan'){
   x.fillStyle='#9fc7d3';x.fillRect(-w*.38,-h*.37,w*.76,20);x.fillRect(-w*.38,-h*.08,w*.76,19);x.fillRect(-w*.38,h*.19,w*.76,13);
   x.fillStyle='#253640';x.fillRect(-2,-h*.37,4,69);x.fillStyle='#d7b84e';x.fillRect(-w/2+2,-7,3,25);x.fillRect(w/2-5,-7,3,25);
 }else if(k==='sedan'){
   x.fillStyle='#a9ced8';x.fillRect(-w*.34,-h*.27,w*.68,18);x.fillStyle='#263841';x.fillRect(-w*.34,1,w*.68,15);
   x.fillStyle=m.c;x.fillRect(-w*.43,-h*.43,w*.86,10);x.fillRect(-w*.43,h*.30,w*.86,9);
 }else if(k==='suv'){
   x.fillStyle='#202c32';x.fillRect(-w*.43,-h*.42,w*.86,5);x.fillRect(-w*.43,h*.35,w*.86,5);
   x.fillStyle='#a5cad3';x.fillRect(-w*.35,-h*.27,w*.70,19);x.fillStyle='#263840';x.fillRect(-w*.35,3,w*.70,18);
   x.fillStyle='#d8c56a';x.fillRect(-w*.44,-h/2+6,7,6);x.fillRect(w*.44-7,-h/2+6,7,6);
 }else if(k==='suv3'){
   x.fillStyle='#111a1f';x.fillRect(-w*.39,-h*.44,4,h*.78);x.fillRect(w*.39-4,-h*.44,4,h*.78);
   x.fillStyle='#9fc5cf';x.fillRect(-w*.33,-h*.31,w*.66,18);x.fillRect(-w*.33,-h*.03,w*.66,17);x.fillRect(-w*.33,h*.22,w*.66,12);
   x.fillStyle='#d7dde0';x.fillRect(-w*.28,-h/2-3,w*.56,4);
 }else if(k==='kei'){
   x.fillStyle='#a9cdd5';x.fillRect(-w*.35,-h*.31,w*.70,17);x.fillStyle='#273941';x.fillRect(-w*.35,0,w*.70,15);
   x.fillStyle='#e3e6e5';x.fillRect(-w*.42,-h/2+3,w*.84,4);x.fillRect(-w*.42,h/2-7,w*.84,4);
 }else if(k==='crossover'){
   x.fillStyle='#151e23';x.fillRect(-w*.44,-h*.38,5,h*.68);x.fillRect(w*.44-5,-h*.38,5,h*.68);
   x.fillStyle='#9ec6d1';x.fillRect(-w*.34,-h*.26,w*.68,17);x.fillStyle='#24363f';x.fillRect(-w*.34,2,w*.68,16);
   x.fillStyle='#d7dde0';x.fillRect(-w*.30,-h/2+4,w*.60,3);
 }else if(k==='boxer'){
   x.fillStyle='#a5cad4';x.fillRect(-w*.34,-h*.25,w*.68,18);x.fillStyle='#263840';x.fillRect(-w*.34,3,w*.68,15);
   x.fillStyle='#121a1f';x.fillRect(-6,-h/2+7,12,8);x.fillStyle='#d7dde0';x.fillRect(-w*.31,h*.35,w*.62,3);
 }else if(k==='roadster'){
   x.fillStyle='#18272e';x.fillRect(-w*.30,-h*.08,w*.60,20);x.fillStyle='#a9cbd3';x.fillRect(-w*.34,-h*.22,w*.68,5);
   x.fillStyle='#d8dde0';x.fillRect(-w*.35,-h*.29,w*.70,3);x.fillStyle=m.c;x.fillRect(-w*.42,h*.24,w*.84,9);
 }
 // lamps, common identity language
 x.fillStyle='#ffe99a';x.fillRect(-w*.34,-h/2+2,8,5);x.fillRect(w*.34-8,-h/2+2,8,5);
 x.fillStyle='#b52525';x.fillRect(-w*.33,h/2-6,7,4);x.fillRect(w*.33-7,h/2-6,7,4);
 // tiny model key makes prototypes unmistakable without changing main-game naming
 x.fillStyle='rgba(255,255,255,.75)';x.font='bold 8px ui-monospace';x.textAlign='center';x.fillText(key.toUpperCase(),0,h*.43-7);
 x.restore();
}
