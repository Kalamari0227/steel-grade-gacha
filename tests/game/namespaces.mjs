export const namespaces = Object.freeze({
  education: Object.freeze({save:'steelgrade_gacha_v1',toon:'sgg_toon_seen',database:'steelgrade_gacha',store:'save'}),
  game: Object.freeze({save:'sgg_game_save_v1',toon:'sgg_game_toon_seen',database:'sgg_game',store:'save'}),
});
export function namespaceFor(edition) {
  if(!Object.hasOwn(namespaces,edition)) throw Error(`Unknown fixture edition: ${edition}`);
  return namespaces[edition];
}
export function normalizeCatalog(value,edition) {
  const keys=namespaceFor(edition);
  if(JSON.stringify(Object.keys(value.keys).sort())!==JSON.stringify(['save','toon']) || value.keys.save!==keys.save || value.keys.toon!==keys.toon) throw Error('Catalog namespace mismatch');
  return {...value,keys:{save:namespaces.education.save,toon:namespaces.education.toon}};
}
export async function installFixture(page,fixture) {
  const expected=namespaceFor(fixture.edition);
  if(!fixture.state || typeof fixture.state!=='object' || Array.isArray(fixture.state)) throw Error('Invalid fixture state');
  return page.evaluate(async ({fixture,expected})=>{
    const db=await new Promise(resolve=>idbOpen(resolve));
    const actual={save:KEY,toon:TOON_SEEN,database:db?.name,store:db?.objectStoreNames.contains('save')?'save':null};
    if(JSON.stringify(actual)!==JSON.stringify(expected)) throw Error('Fixture namespace mismatch before write');
    if(fixture.namespaces && JSON.stringify(fixture.namespaces)!==JSON.stringify(expected)) throw Error('Fixture declared namespace mismatch before write');
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(expected.store,'readwrite');
      tx.objectStore(expected.store).put(JSON.stringify(fixture.state),expected.save);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    localStorage.setItem(expected.save,JSON.stringify(fixture.state));
    localStorage.setItem(expected.toon,fixture.toonSeen || '');
    return actual;
  },{fixture,expected});
}
