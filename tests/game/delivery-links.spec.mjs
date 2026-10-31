import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {auditReleaseSet} from '../../tools/suite-evidence.mjs';
import {absoluteInput,boundArtifact,deliveryLinks,verifyPreview,fileRecord,validateMedia} from '../../tools/delivery-files.mjs';
import {record} from '../helpers/edition-package-site.mjs';
let checked,preview,hub,inputBefore;
test.beforeAll(async()=>{
 checked=await auditReleaseSet(process.env.SGG_RELEASE_SET,'delivery');hub=await absoluteInput(process.env.SGG_DELIVERY_HUB,'SGG_DELIVERY_HUB');
 const previewFile=await absoluteInput(process.env.SGG_PREVIEW_RECEIPT,'SGG_PREVIEW_RECEIPT');preview=JSON.parse(await fs.readFile(previewFile,'utf8'));
 if(checked.set.hub.path!==hub||checked.set.preview.path!==previewFile)throw Error('Unbound delivery inputs');
 await boundArtifact(checked.set.hub);await boundArtifact(checked.set.preview);
 inputBefore=await fileRecord(process.env.SGG_RELEASE_SET);
});
test.afterAll(async()=>{if(inputBefore)expect(await fileRecord(process.env.SGG_RELEASE_SET)).toEqual(inputBefore);});
test('all live hub targets bind actual files and the current package-only preview',async({page},info)=>{
 for(const role of ['preview','runtime-package','source-archive','art-index','equipment-index','screen-index','video','audio-listening','evidence'])if(!checked.set.links.some(r=>r.role===role))throw Error('Missing delivery role: '+role);
 const links=await deliveryLinks(hub,checked.set.links),http=await verifyPreview(preview,checked.binding);
 const response=await page.goto(preview.origin);expect(response.status()).toBe(200);
 await page.waitForFunction(()=>typeof S!=='undefined'&&!saveHold);
 expect(await page.getAttribute('body','data-game-release')).toBe(checked.binding.releaseId);expect(await page.getAttribute('body','data-game-fixture')).toBe('false');
 await record(info,'live-delivery',{hub,links,http,preview,releaseId:checked.binding.releaseId});
});
test('declared delivered artwork audio and ideal-state coverage are nonempty and source-bound',async({},info)=>{
 const requirements=await validateMedia(checked);
 await record(info,'live-media',{requirements,media:checked.set.media,coverage:checked.set.coverage});
});
