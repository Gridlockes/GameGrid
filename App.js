'use strict';

(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grid = document.getElementById('grid');
  const boot = document.getElementById('boot');
  const skipHint = document.getElementById('skipHint');
  const toast = document.getElementById('toast');

  const INTRO_MS   = reduceMotion ? 700 : 6000;  // how long the cube is shown
  const AUDIO_WAIT = 3000;                        // max we wait for audio to buffer
  const bootStart  = performance.now();

  let cards = [];
  let booted = false;

  // ----- audio served from our own backend (cached after first request) -----
  const introSound = new Audio('/audio/intro.mp3');
  introSound.preload = 'auto';
  introSound.volume = 0.55;
  let soundPlayed = false;
  function tryPlaySound(){
    if (soundPlayed) return;
    const p = introSound.play();
    if (p) p.then(() => { soundPlayed = true; }).catch(() => {/* awaits a user gesture */});
  }
  // if autoplay is blocked, the first interaction kicks it off
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, tryPlaySound, { once: true }));

  const audioReady = new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done){ done = true; resolve(); } };
    introSound.addEventListener('canplaythrough', finish, { once: true });
    introSound.addEventListener('error', finish, { once: true });
    setTimeout(finish, AUDIO_WAIT);
    introSound.load();
  });

  // ----- pull the catalog from the backend -----
  const gamesReady = fetch('/api/games')
    .then(r => r.json())
    .then(renderGames)
    .catch(err => {
      console.error('Failed to load games:', err);
      grid.innerHTML = '<p style="color:var(--ink-dim)">Could not load the game list. Is the server running?</p>';
    });

  function renderGames(games){
    grid.innerHTML = '';
    games.forEach((g, i) => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `games/${g.slug}.html`;
      a.style.setProperty('--i', i);
      a.style.setProperty('--hue', g.hue);
      a.innerHTML = `
        <div class="cover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g.icon}</svg>
        </div>
        <div class="meta">
          <div class="title">${g.title}</div>
          <div class="desc">${g.description}</div>
          <div class="tags">
            <span class="tag genre">${g.genre.toUpperCase()}</span>
            <span class="tag">${g.players}</span>
            <span class="play">PLAY</span>
          </div>
        </div>`;
      grid.appendChild(a);
    });
    cards = Array.from(grid.querySelectorAll('.card'));
  }

  // ----- navigation (keyboard + gamepad share this) -----
  function columns(){
    if (!cards.length) return 1;
    const firstTop = cards[0].offsetTop;
    let n = 0;
    for (const c of cards){ if (c.offsetTop === firstTop) n++; else break; }
    return Math.max(1, n);
  }
  function focusedIndex(){ return cards.indexOf(document.activeElement); }
  function move(step){
    const idx = focusedIndex();
    if (idx === -1){ cards[0] && cards[0].focus(); return; }
    const next = idx + step;
    if (next >= 0 && next < cards.length) cards[next].focus();
  }
  function launch(){
    const idx = focusedIndex();
    const card = idx === -1 ? cards[0] : cards[idx];
    if (card) window.location.href = card.getAttribute('href');
  }

  grid.addEventListener('keydown', (e) => {
    if (focusedIndex() === -1) return;
    const cols = columns();
    switch (e.key){
      case 'ArrowRight': move(1); break;
      case 'ArrowLeft':  move(-1); break;
      case 'ArrowDown':  move(cols); break;
      case 'ArrowUp':    move(-cols); break;
      default: return;
    }
    e.preventDefault();
  });

  // ----- gamepad -----
  let padActive = false, axisNeutral = true, lastNav = 0, firePrev = false;
  function showToast(name){
    document.getElementById('toastText').textContent =
      (name ? name.split('(')[0].trim() : 'Controller') + ' connected';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }
  window.addEventListener('gamepadconnected', (e) => { padActive = true; showToast(e.gamepad.id); tryPlaySound(); });

  function pollGamepads(){
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(Boolean);
    if (pad){
      if (!padActive){ padActive = true; showToast(pad.id); }
      const now = performance.now();
      const cols = columns();
      const lx = pad.axes[0] || 0, ly = pad.axes[1] || 0;
      const b = pad.buttons;
      const left  = (b[14] && b[14].pressed) || lx < -0.55;
      const right = (b[15] && b[15].pressed) || lx >  0.55;
      const up    = (b[12] && b[12].pressed) || ly < -0.55;
      const down  = (b[13] && b[13].pressed) || ly >  0.55;
      const fire  = (b[0] && b[0].pressed) || (b[9] && b[9].pressed); // cross / start

      let step = 0;
      if (left) step = -1; else if (right) step = 1;
      else if (up) step = -cols; else if (down) step = cols;

      if (!booted){
        if (step !== 0 || fire) finishBoot();
      } else {
        if (step !== 0){
          if (axisNeutral || now - lastNav > 200){ move(step); lastNav = now; axisNeutral = false; }
        } else { axisNeutral = true; }
        if (fire && !firePrev) launch();
      }
      firePrev = fire;
    }
    requestAnimationFrame(pollGamepads);
  }
  requestAnimationFrame(pollGamepads);

  // ----- boot sequence: wait for assets, sync the sound, then reveal -----
  function finishBoot(){
    if (booted) return;
    booted = true;
    boot.classList.add('done');
    setTimeout(() => { cards[0] && cards[0].focus(); }, 400);
  }
  boot.addEventListener('pointerdown', finishBoot);

  // Start sound the moment audio has buffered (so it lines up with the cube),
  // and keep the intro on screen for the full INTRO_MS once the grid is ready.
  audioReady.then(() => {
    skipHint.textContent = 'PRESS ANY BUTTON TO SKIP';
    tryPlaySound();
  });

  Promise.all([gamesReady, audioReady]).then(() => {
    const elapsed = performance.now() - bootStart;
    setTimeout(finishBoot, Math.max(INTRO_MS - elapsed, 400));
  });
})();
