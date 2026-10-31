import fs from 'node:fs/promises';
import path from 'node:path';
import {fingerprint} from '../../tools/game-assets/schema.mjs';
export function draftPlacements(manifest){
  return manifest.placements.map(row=>{
    const face=manifest.faces.find(f=>f.cardId===row.cardId&&f.side===row.side);
    const rightY=Math.max(.54,Math.min(.69,face.anchors.rightHand.y-.07));
    const layouts={
      shield:[.025,.60,.32,'leftHand',0],dagger:[.045,Math.max(.45,Math.min(.51,face.anchors.leftHand.y-.16)),.25,'leftHand',0],
      potion:[.735,.805,.22,'workbench',0],arrow:[.685,rightY,.30,'rightHand',-30],
      spark:[.03,Math.max(.59,Math.min(.7,face.anchors.leftHand.y)),.30,'leftHand',0],
      glass:[.72,.77,.25,'workbench',0],loupe:[.04,.66,.30,'leftHand',0],
      forge:[.03,.765,.34,'workbench',0],flange:[.35,.78,.32,'workbench',0],
      iron:[.32,.765,.34,'workbench',0],kettle:[.02,.78,.32,'workbench',0],
      bath:[.32,.755,.36,'workbench',0],jominy:[.65,.78,.32,'workbench',0],section:[.32,.755,.36,'workbench',0]
    };
    const [x,y,width,anchor,rotation]=layouts[row.itemKey];
    const placement={...row,status:'approved',rect:{x,y,width,height:width*2/3},pivot:{x:.5,y:.5},rotation,z:40,anchor,occlusionMask:null,reviewReceipt:`docs/design/game-reviews/placements/${row.cardId}-${row.side}-${row.itemKey}.json`};
    if(row.cardId==='ga-340W'&&row.side==='front'&&row.itemKey==='dagger')Object.assign(placement,{rect:{x:.005,y:.46,width:.4,height:.4*2/3},rotation:-20});
    if(row.cardId==='ssial-1180Y'&&row.side==='front'&&row.itemKey==='arrow')Object.assign(placement,{rect:{x:.58,y:.49,width:.42,height:.28},rotation:-45,pivot:{x:0,y:0}});
    return placement;
  });
}
export async function writeDraft(root){
  const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/design/game-asset-manifest.json'),'utf8'));
  const rows=draftPlacements(manifest);
  const fragment={schemaVersion:2,edition:'game',group:'placements',assets:[],faces:[],crops:[],placements:rows.map((value,i)=>({beforeSha256:fingerprint(manifest.placements[i]),value})),optionalDerived:[]};
  await fs.writeFile(path.join(root,'docs/design/game-reviews/placements/manifest-fragment.json'),JSON.stringify(fragment,null,2)+'\n');
  return rows;
}
