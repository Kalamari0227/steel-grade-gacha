var GAME_AV = (function () {
  'use strict';
  const music = {workshop:'workshop',dex:'collection',research:'collection',craft:'craft',garage:'garage'};
  let equipment = false, route = '', routeTimer = null, generation = 0;
  function destination() { const name = location.hash.slice(1); return name === 'learn' || name === 'learning' ? 'research' : Object.hasOwn(music,name) ? name : 'workshop'; }
  function cue(id) {
    try { return Promise.resolve(GAME_AUDIO.play(id)).catch(function () { return false; }); }
    catch (_) { return Promise.resolve(false); }
  }
  function select(name) { if (GAME_AUDIO.snapshot().route !== music[name]) GAME_AUDIO.setRoute(name); }
  function enterEquipment() { equipment = true; select('craft'); }
  function leaveEquipment() { if (!equipment) return; equipment = false; select(destination()); }
  function routeChanged(name) {
    if (route === name) return;
    const previous = route; route = name; equipment = false;
    const token = ++generation;
    clearTimeout(routeTimer);
    routeTimer = setTimeout(function () {
      routeTimer = null;
      if (token !== generation || document.hidden) return;
      select(equipment ? 'craft' : destination());
      if (previous) cue('ui.tab');
    },0);
  }
  function cancel() { generation++; clearTimeout(routeTimer); routeTimer = null; leaveEquipment(); }
  function boot() {
    route = destination();
    document.addEventListener('click',function (event) {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.matches('#btnSettings,#homeSettings')) cue('ui.tap');
      else if (button.matches('#settingsX,#cardX,#pickX,#equipCancel,#pkDone2,#pickLater,#partX,#craftBack,#qpBack,#quizX,#qDone,[data-draw-close],[data-draw-skip],[data-craft-skip],[data-garage-skip]')) cue('ui.back');
    });
    document.addEventListener('visibilitychange',function () { if (document.hidden) cancel(); });
    window.addEventListener('pagehide',cancel);
  }
  return Object.freeze({boot:boot,cue:cue,enterEquipment:enterEquipment,leaveEquipment:leaveEquipment,routeChanged:routeChanged,cancel:cancel});
}());
