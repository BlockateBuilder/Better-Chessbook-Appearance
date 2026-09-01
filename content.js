
(() => {
  'use strict';

  const KEY = 'tweeks.chessbook.custom-board-appearance.v1';
  const defaults = { light: '#f0d9b5', dark: '#b58863', coordinate: '#b58863', coordinateMode: 'auto', style: 'chessbook', customPresets: [] };
  const styleLabels = { chessbook: 'Chessbook', lichess: 'Lichess', chesscom: 'Chess.com', sans: 'Modern Unicode', serif: 'Classic Serif' };
  const builtInPresets = [
    { id: 'classic', name: 'Classic', light: '#f0d9b5', dark: '#b58863' },
    { id: 'green', name: 'Green', light: '#f0f0f0', dark: '#779556' },
    { id: 'blue', name: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
    { id: 'walnut', name: 'Walnut', light: '#f5e6c8', dark: '#8b5a3c' }
  ];
  // This sheet is installed at document-start. Board settings uses sidebar-action-0
  // for Appearance, so conceal its native summary before the sidebar's first paint.
  // A narrower data attribute is added as soon as its Appearance label is available.
  const earlySummaryStyle = document.createElement('style');
  earlySummaryStyle.id = 'twba-appearance-summary-guard';
  earlySummaryStyle.textContent = '#sidebar [data-testid="sidebar-action-0"] > .text-xs > p{visibility:hidden!important}#sidebar [data-testid="sidebar-action-0"][data-twba-not-appearance] > .text-xs > p{visibility:visible!important}#sidebar [data-testid="sidebar-action-0"][data-twba-appearance] > .text-xs > p{visibility:visible!important;color:transparent!important;font-size:0!important}#sidebar [data-testid="sidebar-action-0"][data-twba-appearance] > .text-xs > p::after{content:attr(data-twba-display);color:rgb(119,128,136);font-size:12px;font-weight:600;white-space:normal}';
  (document.head || document.documentElement).append(earlySummaryStyle);

  let settings = load();
  let boardObserver;
  let sidebarObserver;
  let observedSidebar;
  let summaryUpdateQueued = false;

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
      // Migrate discontinued and legacy values to the native Chessbook artwork.
      if (stored.style === 'standard' || stored.style === 'anarchy') stored.style = 'chessbook';
      const customPresets = Array.isArray(stored.customPresets) ? stored.customPresets
        .filter(preset => preset && typeof preset.name === 'string' && /^#[0-9a-f]{6}$/i.test(preset.light) && /^#[0-9a-f]{6}$/i.test(preset.dark))
        .slice(0, 30)
        .map((preset, index) => ({ id: String(preset.id || `custom-${index}`), name: preset.name.slice(0, 32), light: preset.light, dark: preset.dark })) : [];
      const coordinate = /^#[0-9a-f]{6}$/i.test(stored.coordinate) ? stored.coordinate : defaults.coordinate;
      const coordinateMode = stored.coordinateMode === 'custom' ? 'custom' : 'auto';
      return { ...defaults, ...stored, coordinate, coordinateMode, customPresets };
    } catch (_) { return { ...defaults, customPresets: [] }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(settings)); }
  function allPresets() { return [...builtInPresets, ...settings.customPresets]; }
  function appearanceSummary() {
    const pair = `${settings.light.toLowerCase()},${settings.dark.toLowerCase()}`;
    const colours = allPresets().find(preset => `${preset.light.toLowerCase()},${preset.dark.toLowerCase()}` === pair)?.name || 'Custom';
    return `Piece Style: ${styleLabels[settings.style] || 'Chessbook'} · Colours: ${colours}`;
  }
  function updateAppearanceSummary() {
    document.querySelectorAll('#sidebar [data-testid="sidebar-action-0"] > .text-xs > p').forEach(value => {
      const action = value.closest('.sidebar-button');
      const label = action && Array.from(action.querySelectorAll('p')).find(p => p.textContent.trim() === 'Appearance');
      if (!action || !label) {
        // The paint guard is intentionally broad only before this classification.
        // Restore ordinary action-0 summaries immediately when they are not ours.
        action?.setAttribute('data-twba-not-appearance', 'true');
        return;
      }
      action.removeAttribute('data-twba-not-appearance');
      const summary = appearanceSummary();
      // Never expose the site's transient value. The real text is deliberately
      // transparent; its ::after content is the only visible summary, including
      // when Chessbook subsequently tries to write its own setting text.
      action.dataset.twbaAppearance = 'true';
      value.dataset.twbaSummary = 'true';
      value.dataset.twbaDisplay = summary;
      if (value.textContent.trim() !== summary) value.textContent = summary;
      action.setAttribute('title', summary);
      action.setAttribute('aria-label', `Appearance. ${summary}`);
    });
  }
  function observeAppearanceSummary() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar === observedSidebar) return;
    sidebarObserver?.disconnect();
    observedSidebar = sidebar;
    sidebarObserver = new MutationObserver(() => {
      if (summaryUpdateQueued) return;
      summaryUpdateQueued = true;
      // Mutation observers run before the next paint; coalescing avoids repeated
      // work when Chessbook replaces several nodes in one sidebar update.
      queueMicrotask(() => {
        summaryUpdateQueued = false;
        updateAppearanceSummary();
      });
    });
    sidebarObserver.observe(sidebar, { childList: true, subtree: true, characterData: true });
    updateAppearanceSummary();
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
  function pieceSource(piece, original) {
    switch (settings.style) {
      case 'chessbook': return original;
      case 'lichess': return `https://lichess1.org/assets/piece/cburnett/${piece}.svg`;
      case 'chesscom': return `https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${piece.toLowerCase()}.png`;
      case 'sans': return pieceSvg(piece, 'sans');
      case 'serif': return pieceSvg(piece, 'serif');
      default: return original;
    }
  }
  function pieceFromSource(source) {
    // Supports Chessbook's SVG paths, Lichess SVGs, and Chess.com PNG filenames.
    const match = String(source || '').match(/\/([wb][kqrbnp])\.(?:svg|png)(?:$|[?#])/i);
    return match ? match[1][0].toLowerCase() + match[1][1].toUpperCase() : '';
  }
  function applyPieces(root = document) {
    const boards = root.matches?.('[data-testid="chessboard"]') ? [root] : root.querySelectorAll('[data-testid="chessboard"]');
    boards.forEach(board => board.querySelectorAll('#pieces-layer img:not(.twba-piece-overlay)').forEach(img => {
      const nativeSource = img.getAttribute('src') || img.currentSrc || img.src;
      // Read the live native image on every pass: a newly rendered piece may have
      // a different type, while its position is still controlled by Chessbook's
      // parent element and its animation styles.
      const piece = pieceFromSource(nativeSource) || img.dataset.twPiece;
      if (!piece) return;
      img.dataset.twPiece = piece;
      if (!img.dataset.twOriginalSrc) img.dataset.twOriginalSrc = nativeSource;

      const desired = pieceSource(piece, img.dataset.twOriginalSrc);
      const host = img.parentElement;
      if (!host) return;
      let overlay = Array.from(host.children).find(child => child.matches?.('img.twba-piece-overlay'));
      if (!overlay) {
        overlay = document.createElement('img');
        overlay.className = 'twba-piece-overlay';
        overlay.alt = '';
        overlay.draggable = false;
        overlay.setAttribute('aria-hidden', 'true');
        host.append(overlay);
      }
      if (overlay.getAttribute('src') !== desired) overlay.setAttribute('src', desired);
    }));
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
        // Rank labels live along the h-file and file labels live along rank 1.
        // Cover the whole bottom rank so b through g receive the same update as
        // a and h. In automatic mode every label uses its own square's opposing
        // colour; custom mode uses the chosen single coordinate colour.
        const coordinateColour = settings.coordinateMode === 'auto'
          ? (light ? settings.dark : settings.light)
          : settings.coordinate;
        if (rank === 1) css += `[data-testid="chessboard"] [data-testid="square-${square}"] > p{color:${coordinateColour}!important}`;
        if (file === 7) css += `[data-testid="chessboard"] [data-testid="square-${square}"] > p[id^="coord-"]{color:${coordinateColour}!important}`;
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
    document.querySelectorAll('[data-testid="chessboard"] [data-testid^="square-"]').forEach(square => {
      const name = square.dataset.testid.replace('square-', '');
      // File labels span a1 through h1, while rank labels are on h1 through h8.
      // Recolour both edges so labels b–g are not left at Chessbook's old colour.
      const isCoordinateEdge = name[1] === '1' || name[0] === 'h';
      if (!isCoordinateEdge) return;
      const light = ((name.charCodeAt(0) - 97) + Number(name[1])) % 2 === 0;
      const colour = settings.coordinateMode === 'auto' ? (light ? settings.dark : settings.light) : settings.coordinate;
      square.querySelectorAll(':scope > p').forEach(label => label.style.setProperty('color', colour, 'important'));
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
    const piecesLayer = board.querySelector('#pieces-layer');
    const observer = new MutationObserver(mutations => {
      // The site's source changes are deliberately read only from native images.
      // Overlay changes are ignored, preventing a feedback loop when an overlay is
      // inserted or refreshed.
      const nativePieceChanged = mutations.some(mutation => {
        if (mutation.type === 'childList') return true;
        return mutation.type === 'attributes' && mutation.target.matches('img:not(.twba-piece-overlay)');
      });
      if (nativePieceChanged) applyPieces(board);
    });
    observer.observe(piecesLayer || board, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    boardObserver = { target: board, observer };
    applyAppearance();
  }
  function closePanel(withSettingsOpeningAnimation = false) {
    const panel = document.getElementById('tw-board-appearance');
    const host = panel?.parentElement;
    if (!panel || !host || panel.dataset.twbaClosing) return;
    panel.dataset.twbaClosing = 'true';
    if (withSettingsOpeningAnimation) {
      // The Settings button is a return to the menu, rather than a close. Restore
      // the native menu under the custom panel and animate it in from the right,
      // matching Chessbook's normal Settings-opening direction.
      host.querySelectorAll(':scope > :not(#tw-board-appearance)').forEach(view => {
        view.animate([
          { opacity: 0, transform: 'translateX(24px)' },
          { opacity: 1, transform: 'translateX(0)' }
        ], { duration: 180, easing: 'ease', fill: 'both' });
      });
      panel.classList.add('twba-panel-returning');
    }
    panel.classList.remove('twba-panel-active');
    host.classList.remove('twba-showing-panel');
    // Keep the panel mounted for the duration of its exit transition so both
    // sidebar views remain visible throughout the hand-off.
    window.setTimeout(() => panel.remove(), 180);
  }
  function presetCard(preset, custom = false) {
    const colours = `${preset.light},${preset.dark}`;
    const safeName = preset.name.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    return `<button type="button" class="twba-preset" data-preset="${colours}" data-preset-id="${preset.id}" aria-label="Use ${safeName} colour preset"><i style="--twba-light:${preset.light};--twba-dark:${preset.dark}"></i><span>${safeName}</span>${custom ? '<b class="twba-delete-preset" aria-label="Delete this preset" title="Delete preset">×</b>' : ''}</button>`;
  }
  function renderPresets(panel) {
    const list = panel.querySelector('.twba-presets');
    if (!list) return;
    list.innerHTML = `${builtInPresets.map(preset => presetCard(preset)).join('')}${settings.customPresets.map(preset => presetCard(preset, true)).join('')}<button type="button" class="twba-save-preset" aria-label="Save current board colours as a preset"><i>+</i><span>Save current</span></button>`;
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
        <div class="twba-row twba-coordinate-colour-row"><label for="twba-coordinate">Coordinate colour</label><div class="twba-colour-control"><output id="twba-coordinate-value">${settings.coordinate}</output><input id="twba-coordinate" type="color" value="${settings.coordinate}" aria-label="Board coordinate colour"></div></div>
        <div class="twba-row twba-coordinate-auto"><label for="twba-coordinate-auto"><span>Automatically use opposing square colour</span><small id="twba-coordinate-mode-status" aria-live="polite"></small></label><input id="twba-coordinate-auto" type="checkbox" role="switch" aria-describedby="twba-coordinate-mode-status" aria-label="Automatically use opposing square colour" ${settings.coordinateMode === 'auto' ? 'checked' : ''}></div>
      </section>
      <section class="twba-section" aria-labelledby="twba-presets-title">
        <h2 id="twba-presets-title">Colour presets</h2>
        <div class="twba-presets" aria-label="Colour preset gallery"></div>
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
    const syncPresetSelection = () => {
      const selectedPreset = `${settings.light.toLowerCase()},${settings.dark.toLowerCase()}`;
      panel.querySelectorAll('[data-preset]').forEach(button => {
        const selected = button.dataset.preset.toLowerCase() === selectedPreset;
        button.classList.toggle('twba-preset-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    };
    const update = () => {
      settings.light = panel.querySelector('#twba-light').value;
      settings.dark = panel.querySelector('#twba-dark').value;
      settings.coordinate = panel.querySelector('#twba-coordinate').value;
      settings.coordinateMode = panel.querySelector('#twba-coordinate-auto').checked ? 'auto' : 'custom';
      settings.style = panel.querySelector('input[name="twba-style"]:checked').value;
      panel.querySelector('#twba-light-value').value = settings.light;
      panel.querySelector('#twba-dark-value').value = settings.dark;
      panel.querySelector('#twba-coordinate-value').value = settings.coordinate;
      const coordinateInput = panel.querySelector('#twba-coordinate');
      const automaticCoordinates = settings.coordinateMode === 'auto';
      coordinateInput.disabled = automaticCoordinates;
      coordinateInput.setAttribute('aria-disabled', String(coordinateInput.disabled));
      panel.querySelector('.twba-coordinate-colour-row').classList.toggle('twba-row-disabled', automaticCoordinates);
      const coordinateStatus = panel.querySelector('#twba-coordinate-mode-status');
      coordinateStatus.textContent = automaticCoordinates
        ? 'Enabled: each label uses the opposite colour of its square.'
        : 'Disabled: all labels use the Coordinate colour above.';
      syncPresetSelection(); save(); applyAppearance(); updateAppearanceSummary();
    };
    update();
    renderPresets(panel);
    syncPresetSelection();
    panel.querySelectorAll('input').forEach(el => el.addEventListener('input', update));
    panel.querySelector('.twba-presets').addEventListener('click', event => {
      const deleteButton = event.target.closest('.twba-delete-preset');
      const presetButton = event.target.closest('[data-preset]');
      if (deleteButton && presetButton) {
        event.preventDefault();
        event.stopPropagation();
        settings.customPresets = settings.customPresets.filter(preset => preset.id !== presetButton.dataset.presetId);
        save();
        renderPresets(panel);
        syncPresetSelection();
        updateAppearanceSummary();
        return;
      }
      if (presetButton) {
        const [light, dark] = presetButton.dataset.preset.split(',');
        panel.querySelector('#twba-light').value = light;
        panel.querySelector('#twba-dark').value = dark;
        update();
        return;
      }
      if (!event.target.closest('.twba-save-preset')) return;
      // A preset is defined by its light/dark colour pair, rather than by its
      // label. This also prevents saving a custom copy of a built-in preset.
      const currentColours = `${settings.light},${settings.dark}`.toLowerCase();
      const existingPreset = allPresets().find(preset =>
        `${preset.light},${preset.dark}`.toLowerCase() === currentColours
      );
      if (existingPreset) {
        window.alert(`These board colours are already saved as the preset "${existingPreset.name}".`);
        return;
      }
      if (settings.customPresets.length >= 30) { window.alert('You can save up to 30 colour presets. Delete a saved preset to add another.'); return; }
      const name = window.prompt('Name this colour preset:', 'My preset');
      if (name === null) return;
      const cleanedName = name.trim().slice(0, 32);
      if (!cleanedName) return;
      settings.customPresets.push({ id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: cleanedName, light: settings.light, dark: settings.dark });
      save();
      renderPresets(panel);
      syncPresetSelection();
      updateAppearanceSummary();
    });
    panel.querySelector('.twba-reset').addEventListener('click', () => {
      settings = { ...defaults, customPresets: settings.customPresets };
      panel.querySelector('#twba-light').value = settings.light;
      panel.querySelector('#twba-dark').value = settings.dark;
      panel.querySelector('#twba-coordinate').value = settings.coordinate;
      panel.querySelector('#twba-coordinate-auto').checked = true;
      panel.querySelector('input[value="chessbook"]').checked = true;
      update();
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (!document.getElementById('tw-board-appearance')) return;
    event.preventDefault();
    closePanel();
  }, true);
  document.addEventListener('click', event => {
    const appearancePanel = document.getElementById('tw-board-appearance');
    // This is Chessbook's persistent top-right Settings button. While the custom
    // Appearance view is open, use it to return to the underlying Settings menu
    // instead of allowing the site's normal close handler to dismiss the sidebar.
    const topSettingsButton = event.target.closest('#sidebar > div > div[style*="z-index: 15"] > div > button');
    if (topSettingsButton && appearancePanel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel(true);
      return;
    }
    // Chessbook's own Back button stays in its normal location above the sidebar.
    // While Appearance is open, it returns to the Settings list instead of letting
    // the site's handler navigate away from the current settings section.
    if (event.target.closest('#back-button') && appearancePanel) {
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
  style.textContent = `#sidebar-inner{overflow:hidden}#sidebar-inner>:not(#tw-board-appearance){transition:opacity 160ms ease,transform 160ms ease}#sidebar-inner.twba-showing-panel>:not(#tw-board-appearance){opacity:0!important;transform:translateX(-24px)!important;pointer-events:none}#tw-board-appearance{position:absolute;inset:0;display:flex;flex-direction:column;width:100%;min-height:100%;overflow-y:auto;box-sizing:border-box;background:var(--twba-background,hsl(207 7.58% 14%));color:var(--color-primary,#f5f5f5);opacity:0;transform:translateX(40px);pointer-events:none;transition:opacity 180ms ease,transform 180ms ease}.twba-panel-active{opacity:1!important;transform:translateX(0)!important;pointer-events:auto!important}.twba-panel-returning{opacity:0!important;transform:translateX(-40px)!important;pointer-events:none!important}.twba-title{padding-top:12px;padding-bottom:22px}.twba-title p{margin:0;color:var(--color-primary,#f5f5f5);font-size:20px;font-weight:600;line-height:1.45}.twba-title span{display:block;margin-top:2px;color:#778088;font-size:12px;font-weight:600}.twba-section{margin:0 0 20px}.twba-section h2{margin:0;padding:0 18px 8px;color:#778088;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.045em}.twba-row,.twba-piece-row{display:flex;align-items:center;box-sizing:border-box;width:100%;min-height:45px;padding:8px 18px;border-top:1px solid rgb(47,51,55);background:transparent;color:var(--color-primary,#f5f5f5);font-size:14px;font-weight:500}.twba-row:last-child,.twba-piece-row:last-child{border-bottom:1px solid rgb(47,51,55)}.twba-row{justify-content:space-between}.twba-colour-control{display:flex;align-items:center;gap:10px}.twba-colour-control output{color:#778088;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;text-transform:uppercase}.twba-colour-control input{width:27px;height:27px;padding:0;border:1px solid #596168;border-radius:4px;background:transparent;cursor:pointer}.twba-colour-control input::-webkit-color-swatch-wrapper{padding:2px}.twba-colour-control input::-webkit-color-swatch{border:0;border-radius:2px}.twba-colour-control input:disabled{cursor:not-allowed;opacity:.42}.twba-coordinate-colour-row.twba-row-disabled{color:#778088}.twba-coordinate-colour-row.twba-row-disabled output{opacity:.5}.twba-coordinate-auto{align-items:center}.twba-coordinate-auto label{display:flex;flex:1;flex-direction:column;gap:2px;padding-right:12px}.twba-coordinate-auto label span{color:var(--color-primary,#f5f5f5)}.twba-coordinate-auto label small{color:#778088;font-size:11px;font-weight:500;line-height:1.3}.twba-coordinate-auto input{width:16px;height:16px;margin:0;accent-color:#72c3e6;cursor:pointer}.twba-coordinate-auto input:not(:checked){accent-color:#778088}.twba-presets{display:flex;gap:10px;padding:2px 18px 8px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:#596168 transparent}.twba-presets button{position:relative;display:flex;flex:0 0 82px;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:0 0 3px;border:0;background:transparent;color:#aeb6bb;font:600 11px system-ui,sans-serif;cursor:pointer;scroll-snap-align:start}.twba-presets button i{display:block;width:100%;aspect-ratio:1.35;border:1px solid #596168;border-radius:4px;background:conic-gradient(var(--twba-light) 25%,var(--twba-dark) 0 50%,var(--twba-light) 0 75%,var(--twba-dark) 0);background-size:16px 16px;transition:border-color 120ms ease,transform 120ms ease}.twba-presets button:hover{color:var(--color-primary,#f5f5f5)}.twba-presets button:hover i,.twba-presets button:focus-visible i{border-color:#72c3e6;transform:translateY(-1px)}.twba-presets button.twba-preset-selected i{border-color:#72c3e6;outline:1px solid #72c3e6;outline-offset:2px}.twba-presets button.twba-preset-selected{color:var(--color-primary,#f5f5f5)}.twba-presets .twba-save-preset i{display:grid;place-items:center;border-style:dashed;background:transparent;color:#778088;font:400 25px/1 system-ui,sans-serif}.twba-presets .twba-save-preset:hover i,.twba-presets .twba-save-preset:focus-visible i{color:#72c3e6}.twba-delete-preset{position:absolute;top:-5px;right:-5px;display:grid!important;place-items:center;width:17px;height:17px;padding:0!important;border:1px solid #596168!important;border-radius:50%!important;background:#252a2e!important;color:#aeb6bb!important;font:600 15px/15px system-ui,sans-serif!important;line-height:1!important;opacity:0;transition:opacity 120ms ease}.twba-preset:hover .twba-delete-preset,.twba-preset:focus-within .twba-delete-preset{opacity:1}.twba-delete-preset:hover,.twba-delete-preset:focus-visible{border-color:#d86a6a!important;color:#fff!important}.twba-piece-section{margin-bottom:12px}.twba-piece-list{border-bottom:1px solid rgb(47,51,55)}.twba-piece-row{justify-content:space-between;cursor:pointer;transition:background-color 120ms ease}.twba-piece-row:hover{background:#2b3135}.twba-piece-row:last-child{border-bottom:0}.twba-piece-row input{position:absolute;opacity:0;pointer-events:none}.twba-piece-row i{display:grid;place-items:center;width:16px;height:16px;border:1px solid #778088;border-radius:50%;box-sizing:border-box}.twba-piece-row input:checked+i{border-color:#72c3e6}.twba-piece-row input:checked+i:after{content:'';width:8px;height:8px;border-radius:50%;background:#72c3e6}.twba-piece-row:has(input:checked){color:#fff}.twba-footer{padding:6px 18px 28px}.twba-reset{padding:5px 0;border:0;background:transparent;color:#778088;font:600 12px system-ui,sans-serif;cursor:pointer}.twba-reset:hover,.twba-reset:focus-visible{color:#72c3e6;text-decoration:underline}.twba-panel button:focus-visible,.twba-row input:focus-visible{outline:2px solid #72c3e6;outline-offset:2px}@media (prefers-reduced-motion:reduce){#sidebar-inner>:not(#tw-board-appearance),#tw-board-appearance,.twba-presets button i{transition:none}}`;
  (document.head || document.documentElement).append(style);

  // Keep the native images in the DOM for Chessbook's move/layout logic, but never
  // paint them. The overlay is a sibling in the same animated piece wrapper, so it
  // follows every move while the site is unable to flash a replacement icon.
  const protectedPiecesStyle = document.createElement('style');
  protectedPiecesStyle.id = 'twba-protected-pieces';
  protectedPiecesStyle.textContent = `
    [data-testid="chessboard"] #pieces-layer img:not(.twba-piece-overlay) { opacity: 0 !important; }
    [data-testid="chessboard"] #pieces-layer img.twba-piece-overlay {
      position: absolute !important;
      inset: 0;
      display: block;
      width: 100% !important;
      height: 100% !important;
      max-width: none;
      pointer-events: none !important;
      opacity: 1 !important;
      object-fit: contain;
    }
  `;
  (document.head || document.documentElement).append(protectedPiecesStyle);

  // Keep the preset gallery horizontal, but deliberately compact: the cards are
  // narrow, swipe/trackpad-scrollable chips instead of a tall grid. The reduced
  // section rhythm lets the complete Appearance view sit in a normal sidebar.
  const compactStyle = document.createElement('style');
  compactStyle.id = 'twba-compact-preset-menu';
  compactStyle.textContent = `
    #tw-board-appearance .twba-title { padding-top: 8px; padding-bottom: 12px; }
    #tw-board-appearance .twba-title p { font-size: 18px; line-height: 1.3; }
    #tw-board-appearance .twba-title span { margin-top: 1px; }
    #tw-board-appearance .twba-section { margin-bottom: 10px; }
    #tw-board-appearance .twba-section h2 { padding-bottom: 4px; }
    #tw-board-appearance .twba-row,
    #tw-board-appearance .twba-piece-row { min-height: 36px; padding-top: 4px; padding-bottom: 4px; }
    #tw-board-appearance .twba-colour-control { gap: 8px; }
    #tw-board-appearance .twba-colour-control input { width: 23px; height: 23px; }
    /* A non-wrapping rail keeps every preset on one compact line. Extra saved
       presets remain available through ordinary horizontal touchpad/swipe scrolling. */
    #tw-board-appearance .twba-presets {
      display: flex !important;
      flex-flow: row nowrap !important;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      /* Keep cards and their labels safely inside the horizontal scrollport. */
      padding-top: 12px;
      padding-bottom: 12px;
      scroll-padding-block: 12px;
      overflow-x: auto !important;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
    }
    #tw-board-appearance .twba-presets button {
      display: flex !important;
      flex: 0 0 138px !important;
      width: 138px !important;
      max-width: 138px;
      min-width: 138px !important;
      gap: 4px;
      padding-bottom: 0;
      font-size: 18px;
      line-height: 22px;
      white-space: nowrap;
      scroll-snap-align: start;
    }
    #tw-board-appearance .twba-presets button span {
      display: block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #tw-board-appearance .twba-presets button i { aspect-ratio: 1.7; background-size: 10px 10px; }
    #tw-board-appearance .twba-presets .twba-save-preset i { font-size: 18px; }
    #tw-board-appearance .twba-delete-preset { top: -3px; right: -3px; width: 14px; height: 14px; font-size: 12px !important; line-height: 12px !important; }
    #tw-board-appearance .twba-piece-section { margin-bottom: 6px; }
    #tw-board-appearance .twba-footer { padding-top: 2px; padding-bottom: 12px; }
  `;
  (document.head || document.documentElement).append(compactStyle);
  // Restore from localStorage immediately, then repeat briefly while Chessbook
  // hydrates. This also attaches the narrow sidebar observer once it exists.
  observeBoard();
  applyAppearance();
  observeAppearanceSummary();
  [100, 350, 900, 1800].forEach(delay => setTimeout(() => {
    observeBoard();
    applyAppearance();
    observeAppearanceSummary();
    updateAppearanceSummary();
  }, delay));
})();
