// ==UserScript==
// @name         Chessbook Native Board Appearance
// @namespace    tweeks.io
// @version      10.0.0
// @description  Adds a polished Board Appearance panel to Chessbook Settings with saved colours and native Chessbook piece sets.
// @author       Tweeks
// @match        https://chessbook.com/*
// @match        https://www.chessbook.com/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const KEY = 'tweeks.chessbook.custom-board-appearance.v1';
  const defaults = { light: '#f0d9b5', dark: '#b58863', style: 'chessbook' };
  const styleLabels = { chessbook: 'Chessbook', lichess: 'Lichess', chesscom: 'Chess.com', sans: 'Modern Unicode', serif: 'Classic Serif' };
  const colourPresets = { '#f0d9b5,#b58863': 'Classic', '#f0f0f0,#779556': 'Green', '#dee3e6,#8ca2ad': 'Blue', '#f5e6c8,#8b5a3c': 'Walnut' };
  let settings = load();
  let boardObserver;

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
      // Migrate discontinued and legacy values to the native Chessbook artwork.
      if (stored.style === 'standard' || stored.style === 'anarchy') {
        stored.style = 'chessbook';
        localStorage.setItem(KEY, JSON.stringify(stored));
      }
      return { ...defaults, ...stored };
    } catch (_) { return { ...defaults }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(settings)); }
  function appearanceSummary() {
    const colours = colourPresets[`${settings.light.toLowerCase()},${settings.dark.toLowerCase()}`] || 'Custom';
    return `Piece Style: ${styleLabels[settings.style] || 'Chessbook'} · Colours: ${colours}`;
  }
  function updateAppearanceSummary() {
    document.querySelectorAll('#sidebar .sidebar-button').forEach(action => {
      const label = Array.from(action.querySelectorAll('p')).find(p => p.textContent.trim() === 'Appearance');
      if (!label) return;
      const valueContainer = Array.from(action.children).find(child => child.classList?.contains('text-xs'));
      const value = valueContainer?.querySelector('p');
      if (!value) return;
      const summary = appearanceSummary();
      if (value.textContent.trim() !== summary) value.textContent = summary;
      value.dataset.twbaSummary = 'true';
      action.setAttribute('title', summary);
      action.setAttribute('aria-label', `Appearance. ${summary}`);
    });
  }
  function squareIsLight(square) {
    const name = square.dataset.testid.replace('square-', '');
    return ((name.charCodeAt(0) - 97) + Number(name[1])) % 2 === 0;
  }
  function pieceSvg(piece, family) {
    const glyphs = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };
    const glyph = glyphs[piece] || '';
    const white = piece[0] === 'w';
    const serif = family === 'serif';
    const fill = white ? '#ffffff' : '#171717';
    const stroke = white ? '#303030' : '#eeeeee';
    const font = serif ? 'Georgia,serif' : 'Arial,sans-serif';
    const weight = serif ? '400' : '700';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="78" text-anchor="middle" font-family="${font}" font-size="82" font-weight="${weight}" fill="${fill}" stroke="${stroke}" stroke-width="${serif ? 1 : 2}" paint-order="stroke">${glyph}</text></svg>`);
  }
  // Chessbook exposes its board art from its own /pieces directory. The board's
  // default confirms the Chessbook set name (chessbook_monochrome); Lichess and
  // Chess.com use the matching native set directories. Keeping these same-origin
  // paths avoids downloading pieces from Lichess or Chess.com and lets the site
  // serve, cache, and update its own artwork.
  const nativePieceSets = {
    chessbook: 'chessbook_monochrome',
    lichess: 'lichess',
    chesscom: 'chesscom'
  };
  function nativePieceSource(piece, set) {
    return new URL(`/pieces/${nativePieceSets[set]}/${piece}.svg`, location.origin).href;
  }
  function pieceSource(piece, original) {
    if (nativePieceSets[settings.style]) return nativePieceSource(piece, settings.style);
    if (settings.style === 'sans') return pieceSvg(piece, 'sans');
    if (settings.style === 'serif') return pieceSvg(piece, 'serif');
    return original;
  }
  function applyPieces(root = document) {
    root.querySelectorAll('[data-testid="chessboard"] #pieces-layer img').forEach(img => {
      const match = img.src.match(/\/(w|b)([KQRBNP])\.svg(?:$|\?)/i);
      const piece = img.dataset.twPiece || (match && match[1] + match[2].toUpperCase());
      if (!piece) return;
      img.dataset.twPiece = piece;
      if (!img.dataset.twOriginalSrc) img.dataset.twOriginalSrc = img.getAttribute('src') || img.src;
      const desired = pieceSource(piece, img.dataset.twOriginalSrc);
      if (img.getAttribute('src') !== desired) img.setAttribute('src', desired);
      // Native Chessbook artwork is same-origin. If an asset is ever unavailable,
      // retain the site's original piece instead of substituting a lookalike icon.
      img.onerror = () => { if (settings.style !== 'chessbook') img.src = img.dataset.twOriginalSrc; };
    });
  }
  // Keep colours in a dedicated stylesheet as well as on the existing squares. The
  // stylesheet wins over Chessbook's ordinary inline re-render styles, so the saved
  // colours remain in effect when React finishes hydrating after a reload.
  function syncBoardColourCss() {
    let css = '';
    for (let file = 0; file < 8; file += 1) {
      for (let rank = 1; rank <= 8; rank += 1) {
        const square = String.fromCharCode(97 + file) + rank;
        const light = (file + rank) % 2 === 0;
        css += `[data-testid="chessboard"] [data-testid="square-${square}"]{background-color:${light ? settings.light : settings.dark}!important}`;
      }
    }
    let appearanceStyle = document.getElementById('twba-saved-colours');
    if (!appearanceStyle) {
      appearanceStyle = document.createElement('style');
      appearanceStyle.id = 'twba-saved-colours';
      (document.head || document.documentElement).append(appearanceStyle);
    }
    appearanceStyle.textContent = css;
  }
  function applyAppearance() {
    syncBoardColourCss();
    document.querySelectorAll('[data-testid="chessboard"] [data-testid^="square-"]').forEach(square => {
      square.style.setProperty('background-color', squareIsLight(square) ? settings.light : settings.dark, 'important');
    });
    applyPieces();
  }
  function observeBoard() {
    const board = document.querySelector('[data-testid="chessboard"]');
    if (!board) return;
    if (board === boardObserver?.target) {
      applyPieces();
      return;
    }
    boardObserver?.observer.disconnect();
    const observer = new MutationObserver(() => applyAppearance());
    observer.observe(board.querySelector('#pieces-layer') || board, {
      childList: true,
      subtree: true
    });
    boardObserver = { target: board, observer };
    applyAppearance();
  }
  function closePanel() {
    const panel = document.getElementById('tw-board-appearance');
    const host = panel?.parentElement;
    if (!panel || !host || panel.dataset.twbaClosing) return;
    panel.dataset.twbaClosing = 'true';
    panel.classList.remove('twba-panel-active');
    host.classList.remove('twba-showing-panel');
    // Keep the panel mounted for the duration of its exit transition, while the
    // original Settings view fades back in and returns from the left.
    window.setTimeout(() => panel.remove(), 180);
  }
  function openPanel() {
    const host = document.querySelector('#sidebar-inner');
    if (!host || document.getElementById('tw-board-appearance')) return;
    const panel = document.createElement('section');
    panel.id = 'tw-board-appearance';
    panel.className = 'twba-panel';
    panel.setAttribute('aria-label', 'Board appearance');
    panel.innerHTML = `<div class="twba-title padding-sidebar"><p>Appearance</p><span>Personalise your board</span></div>
      <section class="twba-section" aria-labelledby="twba-colours-title">
        <h2 id="twba-colours-title">Board colours</h2>
        <div class="twba-row"><label for="twba-light">Light squares</label><div class="twba-colour-control"><output id="twba-light-value">${settings.light}</output><input id="twba-light" type="color" value="${settings.light}" aria-label="Light square colour"></div></div>
        <div class="twba-row"><label for="twba-dark">Dark squares</label><div class="twba-colour-control"><output id="twba-dark-value">${settings.dark}</output><input id="twba-dark" type="color" value="${settings.dark}" aria-label="Dark square colour"></div></div>
      </section>
      <section class="twba-section" aria-labelledby="twba-presets-title">
        <h2 id="twba-presets-title">Colour presets</h2>
        <div class="twba-presets"><button type="button" data-preset="#f0d9b5,#b58863"><i style="--twba-light:#f0d9b5;--twba-dark:#b58863"></i><span>Classic</span></button><button type="button" data-preset="#f0f0f0,#779556"><i style="--twba-light:#f0f0f0;--twba-dark:#779556"></i><span>Green</span></button><button type="button" data-preset="#dee3e6,#8ca2ad"><i style="--twba-light:#dee3e6;--twba-dark:#8ca2ad"></i><span>Blue</span></button><button type="button" data-preset="#f5e6c8,#8b5a3c"><i style="--twba-light:#f5e6c8;--twba-dark:#8b5a3c"></i><span>Walnut</span></button></div>
      </section>
      <section class="twba-section twba-piece-section" aria-labelledby="twba-pieces-title">
        <h2 id="twba-pieces-title">Piece icons</h2>
        <div class="twba-piece-list"><label class="twba-piece-row"><span>Chessbook</span><input type="radio" name="twba-style" value="chessbook" aria-label="Chessbook pieces"><i></i></label><label class="twba-piece-row"><span>Lichess</span><input type="radio" name="twba-style" value="lichess" aria-label="Lichess pieces"><i></i></label><label class="twba-piece-row"><span>Chess.com</span><input type="radio" name="twba-style" value="chesscom" aria-label="Chess.com pieces"><i></i></label><label class="twba-piece-row"><span>Modern Unicode</span><input type="radio" name="twba-style" value="sans" aria-label="Modern Unicode pieces"><i></i></label><label class="twba-piece-row"><span>Classic Serif</span><input type="radio" name="twba-style" value="serif" aria-label="Classic Serif pieces"><i></i></label></div>
      </section>
      <footer class="twba-footer"><button type="button" class="twba-reset">Reset to default</button></footer>`;
    host.append(panel);
    host.classList.add('twba-showing-panel');
    // Start from the right, then animate after the browser has painted the
    // initial state so the outgoing Settings menu can fade at the same time.
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('twba-panel-active')));
    (panel.querySelector(`input[value="${settings.style}"]`) || panel.querySelector('input[value="chessbook"]')).checked = true;
    const update = () => { settings.light = panel.querySelector('#twba-light').value; settings.dark = panel.querySelector('#twba-dark').value; settings.style = panel.querySelector('input[name="twba-style"]:checked').value; panel.querySelector('#twba-light-value').value = settings.light; panel.querySelector('#twba-dark-value').value = settings.dark; save(); applyAppearance(); updateAppearanceSummary(); };
    panel.querySelectorAll('input').forEach(el => el.addEventListener('input', update));
    panel.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { const [light, dark] = button.dataset.preset.split(','); panel.querySelector('#twba-light').value = light; panel.querySelector('#twba-dark').value = dark; update(); }));
    panel.querySelector('.twba-reset').addEventListener('click', () => { settings = { ...defaults }; panel.querySelector('#twba-light').value = settings.light; panel.querySelector('#twba-dark').value = settings.dark; panel.querySelector('input[value="chessbook"]').checked = true; update(); });
  }
  document.addEventListener('click', event => {
    // Chessbook's own Back button stays in its normal location above the sidebar.
    // While Appearance is open, it returns to the Settings list instead of letting
    // the site's handler navigate away from the current settings section.
    if (event.target.closest('#back-button') && document.getElementById('tw-board-appearance')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel();
      return;
    }
    const action = event.target.closest('#sidebar .sidebar-button');
    const label = action && Array.from(action.querySelectorAll('p')).find(p => p.textContent.trim() === 'Appearance');
    if (!label) return;
    event.preventDefault(); event.stopImmediatePropagation(); openPanel();
  }, true);
  const style = document.createElement('style');
  style.textContent = `#sidebar-inner{overflow:hidden}#sidebar-inner>:not(#tw-board-appearance){transition:opacity 160ms ease,transform 160ms ease}#sidebar-inner.twba-showing-panel>:not(#tw-board-appearance){opacity:0!important;transform:translateX(-24px)!important;pointer-events:none}#tw-board-appearance{position:absolute;inset:0;display:flex;flex-direction:column;width:100%;min-height:100%;overflow-y:auto;box-sizing:border-box;background:var(--twba-background,hsl(207 7.58% 14%));color:var(--color-primary,#f5f5f5);opacity:0;transform:translateX(40px);pointer-events:none;transition:opacity 160ms ease,transform 160ms ease}.twba-panel-active{opacity:1!important;transform:translateX(0)!important;pointer-events:auto!important}.twba-title{padding-top:12px;padding-bottom:22px}.twba-title p{margin:0;color:var(--color-primary,#f5f5f5);font-size:20px;font-weight:600;line-height:1.45}.twba-title span{display:block;margin-top:2px;color:#778088;font-size:12px;font-weight:600}.twba-section{margin:0 0 20px}.twba-section h2{margin:0;padding:0 18px 8px;color:#778088;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.045em}.twba-row,.twba-piece-row{display:flex;align-items:center;box-sizing:border-box;width:100%;min-height:45px;padding:8px 18px;border-top:1px solid rgb(47,51,55);background:transparent;color:var(--color-primary,#f5f5f5);font-size:14px;font-weight:500}.twba-row:last-child,.twba-piece-row:last-child{border-bottom:1px solid rgb(47,51,55)}.twba-row{justify-content:space-between}.twba-colour-control{display:flex;align-items:center;gap:10px}.twba-colour-control output{color:#778088;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;text-transform:uppercase}.twba-colour-control input{width:27px;height:27px;padding:0;border:1px solid #596168;border-radius:4px;background:transparent;cursor:pointer}.twba-colour-control input::-webkit-color-swatch-wrapper{padding:2px}.twba-colour-control input::-webkit-color-swatch{border:0;border-radius:2px}.twba-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 18px}.twba-presets button{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:0;border:0;background:transparent;color:#aeb6bb;font:600 11px system-ui,sans-serif;cursor:pointer}.twba-presets button i{display:block;width:100%;aspect-ratio:1.35;border:1px solid #596168;border-radius:4px;background:conic-gradient(var(--twba-light) 25%,var(--twba-dark) 0 50%,var(--twba-light) 0 75%,var(--twba-dark) 0);background-size:16px 16px;transition:border-color 120ms ease,transform 120ms ease}.twba-presets button:hover{color:var(--color-primary,#f5f5f5)}.twba-presets button:hover i,.twba-presets button:focus-visible i{border-color:#72c3e6;transform:translateY(-1px)}.twba-piece-section{margin-bottom:12px}.twba-piece-list{border-bottom:1px solid rgb(47,51,55)}.twba-piece-row{justify-content:space-between;cursor:pointer;transition:background-color 120ms ease}.twba-piece-row:hover{background:#2b3135}.twba-piece-row:last-child{border-bottom:0}.twba-piece-row input{position:absolute;opacity:0;pointer-events:none}.twba-piece-row i{display:grid;place-items:center;width:16px;height:16px;border:1px solid #778088;border-radius:50%;box-sizing:border-box}.twba-piece-row input:checked+i{border-color:#72c3e6}.twba-piece-row input:checked+i:after{content:'';width:8px;height:8px;border-radius:50%;background:#72c3e6}.twba-piece-row:has(input:checked){color:#fff}.twba-footer{padding:6px 18px 28px}.twba-reset{padding:5px 0;border:0;background:transparent;color:#778088;font:600 12px system-ui,sans-serif;cursor:pointer}.twba-reset:hover,.twba-reset:focus-visible{color:#72c3e6;text-decoration:underline}.twba-panel button:focus-visible,.twba-row input:focus-visible{outline:2px solid #72c3e6;outline-offset:2px}@media (prefers-reduced-motion:reduce){#sidebar-inner>:not(#tw-board-appearance),#tw-board-appearance,.twba-presets button i{transition:none}}`;
  document.head.append(style);
  // Restore from localStorage immediately, then repeat briefly while Chessbook
  // hydrates its board. This closes the reload-time gap before its first render.
  observeBoard();
  applyAppearance();
  updateAppearanceSummary();
  [100, 350, 900, 1800].forEach(delay => setTimeout(() => {
    observeBoard();
    applyAppearance();
    updateAppearanceSummary();
  }, delay));
  // Chessbook may re-render the sidebar or replace the board after SPA navigation.
  setInterval(() => { observeBoard(); updateAppearanceSummary(); }, 1500);
})();
