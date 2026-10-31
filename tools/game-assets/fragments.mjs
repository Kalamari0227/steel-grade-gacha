import {exactKeys, readJson, requireValue, safePath} from './io.mjs';
import {contract, derivedContract, fingerprint, validateSchema} from './schema.mjs';
export async function applyFragment(manifest,context) {
  const {root,reviewRoot,group}=context;
  const placementsOnly=group==='placements';
  requireValue(placementsOnly||Object.hasOwn(contract.groups,group),'unknown-group',group);
  const fragmentPath=`${reviewRoot}/${group}/manifest-fragment.json`;
  const fragment=await readJson(await safePath(root,fragmentPath));
  exactKeys(fragment,['schemaVersion','edition','group','assets','faces','crops','placements','optionalDerived'],'fragment');
  requireValue(fragment.schemaVersion===2&&fragment.edition==='game'&&fragment.group===group,'fragment-identity',group);
  if(placementsOnly) {
    for(const key of ['assets','faces','crops','optionalDerived'])requireValue(Array.isArray(fragment[key])&&fragment[key].length===0,'placement-only-collection',key);
    requireValue(Array.isArray(fragment.placements)&&fragment.placements.length===107,'placement-count','107');
  }
  const candidate=structuredClone(manifest),seenIds=new Set(),seenPaths=new Set();
  let changes=0;
  for(const collection of ['assets','optionalDerived','faces','crops','placements']) {
    requireValue(Array.isArray(fragment[collection]),'fragment-rows',collection);
    for(const update of fragment[collection]) {
      exactKeys(update,['beforeSha256','value'],'fragment update');
      const row=update.value;
      requireValue(row&&typeof row==='object','fragment-value',collection);
      let id,owner,find;
      switch(collection) {
        case 'assets':case 'optionalDerived': {
          id=row.assetId;
          const expected=collection==='assets'?contract.assets.find(x=>x.assetId===id):derivedContract(row);
          requireValue(expected,'unknown-asset',id);owner=expected.ownerGroup;
          requireValue(!seenPaths.has(row.path),'duplicate-path',row.path);seenPaths.add(row.path);
          find=x=>x.assetId===id;break;
        }
        case 'faces':case 'placements':
          id=`${row.cardId}:${row.side}${collection==='placements'?':'+row.itemKey:''}`;
          owner=contract.assets.find(x=>x.assetId===`character:${row.cardId}:${row.side}`)?.ownerGroup;
          find=x=>x.cardId===row.cardId&&x.side===row.side&&(collection==='faces'||x.itemKey===row.itemKey);break;
        case 'crops': id=row.assetId;owner='environments';find=x=>x.assetId===id;break;
        default: throw Error('unreachable collection');
      }
      requireValue((placementsOnly&&collection==='placements')||owner===group,'group-ownership',`${group}/${id} owned by ${owner}`);
      requireValue(!seenIds.has(collection+':'+id),'duplicate-id',id);seenIds.add(collection+':'+id);
      const index=candidate[collection].findIndex(find),previous=index===-1?null:candidate[collection][index];
      requireValue(index>=0||collection==='optionalDerived','unknown-row',id);
      requireValue(update.beforeSha256===(previous?fingerprint(previous):null),'stale-fragment',id);
      requireValue(row.status==='approved','fragment-pending',id);
      if(index===-1)candidate[collection].push(row);else candidate[collection][index]=row;
      changes++;
    }
  }
  requireValue(changes>0,'empty-fragment',group);
  candidate.stage=['assets','optionalDerived','faces','crops','placements'].every(key=>candidate[key].every(row=>row.status==='approved'))?'release':'schema-only';
  validateSchema(candidate);
  return {candidate,fragmentPath,fragmentSha256:fingerprint(fragment),changes};
}
