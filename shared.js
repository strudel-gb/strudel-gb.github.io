/**
 * strudel-gb — Shared JavaScript Utilities
 * Shared helper functions for instrument categorization, formatting, visualizers, copy-to-clipboard, etc.
 */

// Categorization helper for Game Boy instruments
function getInstrumentCategory(name, inst = {}) {
  const pulsePresets = [
    'gb', 'gb.lead', 'gb.square', 'gb.pluck', 'gb.pad', 'gb.vibrato', 'gb.siren', 
    'gb.steel-drum', 'gb.alien', 'gb.slow-brass', 'gb.harpsichord', 'gb.magic-chime', 
    'gb.mellow-flute', 'gb.crunch-lead', 'gb.bell-pluck', 'gb.square-sub', 
    'gb.delay-trail', 'gb.soft-pad', 'gb.bowed-string', 'gb.arp-synth', 
    'gb.pulse-organ', 'gb.drip'
  ];
  
  const sfxPresets = [
    'gb.coin', 'gb.jump', 'gb.powerup', 'gb.death', 'gb.laser-long', 
    'gb.balloon', 'gb.bubble', 'gb.teleport', 'gb.sci-fi-zap'
  ];

  if (pulsePresets.includes(name)) {
    return 'Synth (Pulse)';
  } else if (sfxPresets.includes(name)) {
    return 'Sound FX';
  } else if (inst.channel === 'wave') {
    return 'Synth (Wave)';
  } else if (inst.channel === 'noise') {
    return 'Percussion (Noise)';
  } else {
    return 'Percussion (Other)';
  }
}

// Group an instruments object by category
function groupInstrumentsByCategory(instrumentsObj) {
  const categories = {
    'Synth (Pulse)': [],
    'Synth (Wave)': [],
    'Percussion (Noise)': [],
    'Percussion (Other)': [],
    'Sound FX': []
  };

  if (!instrumentsObj) return categories;

  Object.keys(instrumentsObj).forEach(name => {
    const inst = instrumentsObj[name];
    const cat = getInstrumentCategory(name, inst);
    if (categories[cat]) {
      categories[cat].push({ name, ...inst });
    }
  });

  return categories;
}

// Human-readable instrument label formatting
function formatInstrumentLabel(name) {
  if (!name) return '';
  const dispName = name.replace('gb.', '');
  if (dispName === 'gb') return 'Default';
  return dispName.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Copy code to clipboard helper with temporary UI feedback
function copyCodeToClipboard(btnElement, codeText) {
  navigator.clipboard.writeText(codeText).then(() => {
    const originalText = btnElement.textContent;
    btnElement.textContent = 'Copied!';
    setTimeout(() => {
      btnElement.textContent = originalText;
    }, 1200);
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
}

// Default timbre labels for idle/inactive channels
const DEFAULT_TIMBRES = {
  P1: 'Duty 50%',
  P2: 'Duty 50%',
  WV: 'triangle',
  NS: '15-bit'
};

// Internal state for smooth visualizer decay across frames (flicker-free)
const displayState = [
  { volume: 0, note: '---', timbre: 'Duty 50%', active: false },
  { volume: 0, note: '---', timbre: 'Duty 50%', active: false },
  { volume: 0, note: '---', timbre: 'triangle', active: false },
  { volume: 0, note: '---', timbre: '15-bit', active: false }
];

// Helper to construct 8 block segment spans
function renderBlockSegments() {
  return '<span class="ch-block"></span>'.repeat(8);
}

// High-performance Real-Time Channel Activity renderer (equal height CSS block segments)
function updateRealtimeChannelActivity(channels, containerId = 'realtimeChannelActivity') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let vizContainer = container.querySelector('.channel-viz-container');
  if (!vizContainer) {
    vizContainer = document.createElement('div');
    vizContainer.className = 'channel-viz-container';
    vizContainer.innerHTML = `
      <div class="channel-viz-row"><span class="ch-name">P1</span><span class="ch-note">---</span><div class="ch-bar">${renderBlockSegments()}</div><span class="ch-timbre">Duty 50%</span></div>
      <div class="channel-viz-row"><span class="ch-name">P2</span><span class="ch-note">---</span><div class="ch-bar">${renderBlockSegments()}</div><span class="ch-timbre">Duty 50%</span></div>
      <div class="channel-viz-row"><span class="ch-name">WV</span><span class="ch-note">---</span><div class="ch-bar">${renderBlockSegments()}</div><span class="ch-timbre">triangle</span></div>
      <div class="channel-viz-row"><span class="ch-name">NS</span><span class="ch-note">---</span><div class="ch-bar">${renderBlockSegments()}</div><span class="ch-timbre">15-bit</span></div>
    `;
    container.innerHTML = '';
    container.appendChild(vizContainer);
  }
  
  const labels = ['P1', 'P2', 'WV', 'NS'];
  const rows = vizContainer.children;
  
  channels.forEach((chan, idx) => {
    const row = rows[idx];
    if (!row) return;
    
    const label = labels[idx] || `C${idx + 1}`;
    const defaultTimbre = DEFAULT_TIMBRES[label] || '---';
    const state = displayState[idx] || (displayState[idx] = { volume: 0, note: '---', timbre: defaultTimbre, active: false });

    if (chan.active) {
      state.active = true;
      const targetVol = chan.volume !== undefined ? chan.volume : 15;
      state.volume = Math.max(state.volume, targetVol);
      if (chan.note && chan.note !== '---') state.note = chan.note;
      if (chan.timbre) state.timbre = chan.timbre;
    } else {
      // Smooth volume envelope decay over ~100ms when note releases
      state.volume = Math.max(0, state.volume - 2.5);
      if (state.volume <= 0) {
        state.active = false;
        state.note = '---';
        state.timbre = defaultTimbre;
      }
    }

    const isActive = state.active && state.volume > 0;
    const noteName = isActive ? state.note : '---';
    const timbreText = isActive ? state.timbre : defaultTimbre;
    
    // Active blocks count (0 to 8)
    const activeBlocks = isActive ? Math.max(1, Math.min(8, Math.round((state.volume / 15) * 8))) : 0;
    
    const noteEl = row.querySelector('.ch-note');
    const barEl = row.querySelector('.ch-bar');
    const timbreEl = row.querySelector('.ch-timbre');
    
    if (noteEl && noteEl.textContent !== noteName) {
      noteEl.textContent = noteName;
    }
    
    if (barEl) {
      // If barEl doesn't have 8 block children yet, initialize them
      if (barEl.children.length !== 8) {
        barEl.innerHTML = renderBlockSegments();
      }
      const blocks = barEl.children;
      for (let i = 0; i < 8; i++) {
        if (blocks[i]) {
          if (i < activeBlocks) {
            if (!blocks[i].classList.contains('active')) blocks[i].classList.add('active');
          } else {
            if (blocks[i].classList.contains('active')) blocks[i].classList.remove('active');
          }
        }
      }
    }

    if (timbreEl && timbreEl.textContent !== timbreText) {
      timbreEl.textContent = timbreText;
    }
    
    if (isActive && !row.classList.contains('active')) {
      row.classList.add('active');
    } else if (!isActive && row.classList.contains('active')) {
      row.classList.remove('active');
    }
  });
}

// Unified Spectrum Visualizer Bars renderer
function updateVisualizerBars(channels, vizBarsElements) {
  if (!vizBarsElements || vizBarsElements.length === 0) return;
  channels.forEach((chan, idx) => {
    const state = displayState[idx];
    const vol = (chan.active ? (chan.volume !== undefined ? chan.volume : 15) : (state ? state.volume : 0));
    const isActive = (chan.active || (state && state.active && state.volume > 0));
    
    // Map volume 0-15 to bar height 4px - 32px
    const height = isActive ? Math.round((vol / 15) * 28) + 4 : 4;
    
    const barStart = idx * 3;
    for (let i = 0; i < 3; i++) {
      if (vizBarsElements[barStart + i]) {
        vizBarsElements[barStart + i].style.height = `${height}px`;
      }
    }
  });
}

// Immediately reset visualizer to silent state
function resetVisualizerUI(containerId = 'realtimeChannelActivity', vizBarsElements = null) {
  const labels = ['P1', 'P2', 'WV', 'NS'];
  displayState.forEach((state, idx) => {
    state.volume = 0;
    state.note = '---';
    state.timbre = DEFAULT_TIMBRES[labels[idx]] || '---';
    state.active = false;
  });
  
  const silentChannels = [
    { name: 'pulse1', active: false, volume: 0, freq: 0, note: '---', timbre: 'Duty 50%' },
    { name: 'pulse2', active: false, volume: 0, freq: 0, note: '---', timbre: 'Duty 50%' },
    { name: 'wave', active: false, volume: 0, freq: 0, note: '---', timbre: 'triangle' },
    { name: 'noise', active: false, volume: 0, freq: 0, note: '---', timbre: '15-bit' }
  ];
  
  updateRealtimeChannelActivity(silentChannels, containerId);
  if (vizBarsElements) {
    updateVisualizerBars(silentChannels, vizBarsElements);
  }
}

// Attach to global window object
if (typeof window !== 'undefined') {
  window.GBShared = {
    getInstrumentCategory,
    groupInstrumentsByCategory,
    formatInstrumentLabel,
    copyCodeToClipboard,
    updateRealtimeChannelActivity,
    updateVisualizerBars,
    resetVisualizerUI
  };
}
