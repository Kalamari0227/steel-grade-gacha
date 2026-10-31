import {expect} from '@playwright/test';
import {appURL} from '../helpers/paths.mjs';
import {installFixture,namespaces} from './namespaces.mjs';
export async function controlledFixture(page,edition){
  const keys=namespaces[edition];
  await page.route('**/controlled-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Owned fixture namespace probe</title><script>
var KEY=${JSON.stringify(keys.save)},TOON_SEEN=${JSON.stringify(keys.toon)};
function idbOpen(cb){const q=indexedDB.open(${JSON.stringify(keys.database)},1);q.onupgradeneeded=()=>q.result.createObjectStore('save');q.onsuccess=()=>cb(q.result);}
</script>`}));
  await page.goto(appURL+'/controlled-fixture');
  const fixture={edition,state:{owned:{'qp-1470':true},stock:{'qp-1470':1},items:{arrow:'qp-1470'}},toonSeen:'sentinel'};
  await installFixture(page,fixture);
  const observed=await page.evaluate(async()=>{
    const db=await new Promise(resolve=>idbOpen(resolve));
    const mirror=await new Promise(resolve=>{const q=db.transaction('save').objectStore('save').get(KEY);q.onsuccess=()=>resolve(JSON.parse(q.result));});
    return {keys:Object.keys(localStorage).sort(),state:JSON.parse(localStorage.getItem(KEY)),seen:localStorage.getItem(TOON_SEEN),mirror,database:db.name};
  });
  expect(observed).toEqual({keys:[keys.save,keys.toon].sort(),state:fixture.state,seen:'sentinel',mirror:fixture.state,database:keys.database});
  return observed;
}
