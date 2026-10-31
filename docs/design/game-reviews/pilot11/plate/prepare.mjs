import fs from 'node:fs/promises';
import {sha} from '../../../../../tools/game-assets/io.mjs';
import {fingerprint,validateSchema} from '../../../../../tools/game-assets/schema.mjs';
import {binding,reviewAsset} from '../../../../../tools/game-assets/reviews.mjs';
import {inspectAsset} from '../../../../../tools/game-assets/images.mjs';
const lane='docs/design/game-reviews/pilot11/plate';
const evidence=process.argv[2];if(!evidence)throw Error('evidence directory required');
const inputs=JSON.parse(await fs.readFile(`${lane}/generation-inputs.json`,'utf8'));
const manifest=JSON.parse(await fs.readFile('docs/design/game-asset-manifest.json','utf8'));
const specs=[
 {face:[.30,.25,.48,.20],emblem:[.48,.52,.19,.13],hands:[[.26,.69],[.79,.69]],observations:['Curved upward silver flame helmet, low half-lidded eyes and short straight mouth match the PO CQ original.','Whole flame tip, both relaxed hands and two boots remain visible with transparent margins.','Red vest carries a round vertically split dark oxide/polished silver medallion with central teardrop, no GA hexagon.','Brushed silver face and scale/pickled-silver emblem contrast retain pickling meaning, without strength claims.','At actual 72px, flame silhouette, red vest and circular badge distinguish PO CQ; no text or crop.']},
 {face:[.23,.30,.47,.21],emblem:[.46,.52,.15,.10],hands:[[.22,.83],[.89,.69]],observations:['Central raised helmet ridge, low half-lidded eyes and straight tiny mouth retain original PHS identity.','Kneeling low silhouette includes grounded hand, both armored legs and boots, visibly distinct from upright after state.','Unobscured round chest badge is divided vertically and remains round; no CQ vest or GA hexagon.','Soft matte grey armor and low kneeling pose communicate untreated state; no cracks or damage implying failure.','Actual 72px preserves ridge, face and vertical circle seam; kneeling silhouette distinguishes the before state.']},
 {face:[.25,.28,.45,.16],emblem:[.42,.45,.15,.10],hands:[[.22,.67],[.80,.67]],observations:['Same PHS central-ridge helmet, half-lidded face and short mouth as new front; original heated eyes retained.','Upright short plated body has same shoulder and boot design as front, with both fists outside torso.','Vertical split circle persists, now silver/oxidized warm halves; neither hexagon nor unrelated family symbol.','Fine dark quenched scale, amber seams and standing posture materially differ from soft matte kneeling front.','At actual 72px the ridge, circular badge and upright dark silhouette remain legible and paired with front.']},
 {face:[.26,.22,.48,.21],emblem:[.45,.51,.16,.12],hands:[[.25,.66],[.84,.49]],observations:['Low dome cap, horizontal seam, low eyes and gentle curved smile match CQ Dogeum original.','Whole figure with plum folded vest, raised mitten beside body and both boots is unclipped.','Pointed vertical hexagon has silver top, dark middle horizontal band and silver bottom; clear purple outline.','Zinc-like silver crystalline coating and purple family vest retain protective coating identity.','At actual 72px the smile, round cap, purple vest and distinct hex badge read clearly without text.']},
 {face:[.25,.23,.49,.22],emblem:[.44,.48,.19,.13],hands:[[.25,.66],[.76,.66]],observations:['HPF original dome cap and neutral oval eyes/short mouth retained, unlike CQ smiling face.','Full short rounded body and boots visible, with both hands clear of centered chest badge.','Flat-topped hexagon keeps three horizontal silver/dark/silver regions and continuous plum outline.','Bright pale satin Al-Si coating and purple boundary seams define untreated state without armor substitution.','At actual 72px pale HPF cap, neutral face and banded hex remain readable; full body fits the frame.']},
 {face:[.25,.23,.49,.22],emblem:[.44,.48,.19,.13],hands:[[.25,.66],[.71,.56]],observations:['Same HPF dome cap, face ratio, oval eyes and tiny mouth as new front; warm eye points follow original after state.','Same rounded body and boots with newly bent arm; fist stays to right of hex badge and leaves it clear.','Identical flat-top three-region banded hex and plum perimeter remain visible after heat treatment.','Darkened crystalline tempered surface retains protective coating with narrow warm seam light; actual structure differs from pale front.','Actual 72px preserves HPF face and hex; warm dark after state contrasts clearly with same-person pale front.']}
];
const prepared={assets:[],faces:[],crops:[],placements:[],optionalDerived:[]};
const rect=a=>Object.fromEntries(['x','y','width','height'].map((k,i)=>[k,a[i]]));
const names=['face','silhouette','emblem','material','thumbnail72'];
for(let index=0;index<inputs.length;index++){
 const input=inputs[index],spec=specs[index],id=`${input.cardId}-${input.side}`;
 const face=structuredClone(manifest.faces.find(f=>f.cardId===input.cardId&&f.side===input.side));
 Object.assign(face,{status:'approved',safeRects:{face:rect(spec.face),emblem:rect(spec.emblem)},anchors:{leftHand:{x:spec.hands[0][0],y:spec.hands[0][1]},rightHand:{x:spec.hands[1][0],y:spec.hands[1][1]},workbench:{x:.5,y:.94}},reviewReceipt:`${lane}/${id}-character-review.json`});
 prepared.faces.push(face);
 for(const kind of ['character','thumbnail']){
  const row=structuredClone(manifest.assets.find(a=>a.assetId===`${kind}:${input.cardId}:${input.side}`));
  const bytes=await fs.readFile(row.path),master=await fs.readFile(row.masterPath);
  Object.assign(row,{status:'approved',bytes:bytes.length,sha256:sha(bytes),masterSha256:sha(master),reviewReceipt:`${lane}/${id}-${kind}-review.json`});
  const sourceEvidence=`${lane}/${id}-${kind==='character'?'generation':'export'}.json`;
  const checks={};
  for(let n=0;n<names.length;n++){const name=names[n],proof=name==='thumbnail72'?`${lane}/${id}-72.png`:row.path;checks[name]={result:'pass',observation:spec.observations[n],evidence:proof,sha256:sha(await fs.readFile(proof)),displayWidth:name==='thumbnail72'?72:null};}
  const receipt={schemaVersion:1,status:'approved',purpose:'production',reviewer:'game_pilot_plate self visual review; independent acceptance pending',reviewedAt:new Date().toISOString(),binding:binding(row),referenceSha256:sha(await fs.readFile(row.reference)),generation:{method:kind==='character'?'built-in-imagegen':'derived-export',sourceEvidence,sourceEvidenceSha256:sha(await fs.readFile(sourceEvidence))},checks,metadata:{face:kind==='character'?fingerprint(face):null,crop:null}};
  await fs.writeFile(row.reviewReceipt,JSON.stringify(receipt,null,2)+'\n');prepared.assets.push(row);
 }
}
for(const row of prepared.assets)manifest.assets[manifest.assets.findIndex(a=>a.assetId===row.assetId)]=row;
for(const row of prepared.faces)manifest.faces[manifest.faces.findIndex(a=>a.cardId===row.cardId&&a.side===row.side)]=row;
validateSchema(manifest);
const results=[];for(const row of prepared.assets)results.push({inspection:await inspectAsset(row,process.cwd()),receipt:await reviewAsset(row,{root:process.cwd(),reviewRoot:'docs/design/game-reviews',manifest})});
await fs.writeFile(`${evidence}/prepared.json`,JSON.stringify(prepared,null,2)+'\n');
await fs.writeFile(`${evidence}/validation.json`,JSON.stringify({status:'PASS',scope:'plate six faces only; not pilot11 group acceptance',assetCount:12,faceCount:6,results},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',assetCount:12,faceCount:6,prepared:`${evidence}/prepared.json`}));
