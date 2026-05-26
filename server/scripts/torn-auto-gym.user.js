// ==UserScript==
// @name         Torn Auto Gym
// @namespace    RussianRob
// @version      1.2.15
// @description  Fork of Stephen Lynx's Auto Gym Switch (Greasy Fork 480060). Cross-gym training, PDA support, unified swap toasts, tile/button unlock after gym switch, fetch-arg type safety for non-gym pages.
// @author       Stephen Lynx (RussianRob maintains fork)
// @license      MIT
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-auto-gym.user.js
// @updateURL    https://tornwar.com/scripts/torn-auto-gym.meta.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
var lynx = {};

// Torn's gym page disables (blurs + pointer-events:none) stat tiles
// for stats the current specialist gym can't train (e.g. Mr. Isoyamas
// greys out STR/SPD/DEX). With auto-switch installed the user wants to
// click those tiles anyway — the swap fires, the gym changes, the train
// goes through. Inject a stylesheet that restores pointer-events but
// keeps a faded look so it's still clear which stats need a swap.
(function injectWbStyles() {
  function inject() {
    if (document.getElementById('wb-auto-gym-style')) return;
    var s = document.createElement('style');
    s.id = 'wb-auto-gym-style';
    // Force-enable the locked stat tiles plus their inner disabled
    // buttons / markers — Torn renders the train button with its own
    // disabled state separate from the <li>'s locked class.
    var statTileSel = ['strength', 'defense', 'speed', 'dexterity']
      .map(function(s) { return 'li[class*="' + s + '___"]'; })
      .join(',');
    // Keep Torn's native blur on locked tiles so the visual signal stays —
    // only force pointer-events through so our click-capture handler can
    // fire. Same for the inner disabled button: clickable but still looks
    // disabled.
    s.textContent = ''
      + statTileSel.split(',').map(function(t){return t + '[class*="locked___"]';}).join(',') + ' {'
      + '  pointer-events: auto !important;'
      + '  cursor: pointer !important;'
      + '}'
      + statTileSel.split(',').map(function(t){return t + ' button[disabled]';}).join(',') + ','
      + statTileSel.split(',').map(function(t){return t + ' [class*="disabled___"]';}).join(',') + ','
      + statTileSel.split(',').map(function(t){return t + ' [aria-disabled="true"]';}).join(',') + ' {'
      + '  pointer-events: auto !important;'
      + '  cursor: pointer !important;'
      + '}';
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.head) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
})();

lynx.mainRatioOptions = ['No main gym', 'Str', 'Def', 'Spe', 'Dex'];
lynx.secondaryRatioOptions = ['No secondary gym', 'Def/Dex', 'Str/Spe'];

lynx.red = '#d83500';
lynx.green = '#00a500';

lynx.gymInfo = {
  1 : {
    'str': 2,
    'spe': 2,
    'def': 2,
    'dex': 2
  },
  2 : {
    'str': 2.4,
    'spe': 2.4,
    'def': 2.7,
    'dex': 2.4
  },
  3 : {
    'str': 2.7,
    'spe': 3.2,
    'def': 3.0,
    'dex': 2.7
  },
  4 : {
    'str': 3.2,
    'spe': 3.2,
    'def': 3.2,
    'dex': 0
  },
  5 : {
    'str': 3.4,
    'spe': 3.6,
    'def': 3.4,
    'dex': 3.2
  },
  6 : {
    'str': 3.4,
    'spe': 3.6,
    'def': 3.6,
    'dex': 3.8
  },
  7 : {
    'str': 3.7,
    'spe': 0,
    'def': 3.7,
    'dex': 3.7
  },
  8 : {
    'str': 4,
    'spe': 4,
    'def': 4,
    'dex': 4
  },
  9 : {
    'str': 4.8,
    'spe': 4.4,
    'def': 4,
    'dex': 4.2
  },
  10 : {
    'str': 4.4,
    'spe': 4.6,
    'def': 4.8,
    'dex': 4.4
  },
  11 : {
    'str': 5,
    'spe': 4.6,
    'def': 5.2,
    'dex': 4.6
  },
  12 : {
    'str': 5,
    'spe': 5.2,
    'def': 5,
    'dex': 5
  },
  13 : {
    'str': 5,
    'spe': 5.4,
    'def': 4.8,
    'dex': 5.2
  },
  14 : {
    'str': 5.5,
    'spe': 5.7,
    'def': 5.5,
    'dex': 5.2
  },
  15 : {
    'str': 0,
    'spe': 5.5,
    'def': 5.5,
    'dex': 5.7
  },
  16 : {
    'str': 6,
    'spe': 6,
    'def': 6,
    'dex': 6
  },
  17 : {
    'str': 6,
    'spe': 6.2,
    'def': 6.4,
    'dex': 6.2
  },
  18 : {
    'str': 6.5,
    'spe': 6.4,
    'def': 6.2,
    'dex': 6.2
  },
  19 : {
    'str': 6.4,
    'spe': 6.5,
    'def': 6.4,
    'dex': 6.8
  },
  20 : {
    'str': 6.4,
    'spe': 6.4,
    'def': 6.8,
    'dex': 7
  },
  21 : {
    'str': 7,
    'spe': 6.4,
    'def': 6.4,
    'dex': 6.5
  },
  22 : {
    'str': 6.8,
    'spe': 6.5,
    'def': 7,
    'dex': 6.5
  },
  23 : {
    'str': 6.8,
    'spe': 7,
    'def': 7,
    'dex': 6.8
  },
  24 : {
    'str': 7.3,
    'spe': 7.3,
    'def': 7.3,
    'dex': 7.3
  },
  25 : {
    'str': 0,
    'spe': 0,
    'def': 7.5,
    'dex': 7.5
  },
  26 : {
    'str': 7.5,
    'spe': 7.5,
    'def': 0,
    'dex': 0
  },
  27 : {
    'str': 8,
    'spe': 0,
    'def': 0,
    'dex': 0
  },
  28 : {
    'str': 0,
    'spe': 0,
    'def': 8,
    'dex': 0
  },
  29 : {
    'str': 0,
    'spe': 8,
    'def': 0,
    'dex': 0
  },
  30 : {
    'str': 0,
    'spe': 0,
    'def': 0,
    'dex': 8
  },
  31 : {
    'str': 9,
    'spe': 9,
    'def': 9,
    'dex': 9
  },
  32 : {
    'str': 10,
    'spe': 10,
    'def': 10,
    'dex': 10
  },
  33 : {
    'str': 3.4,
    'spe': 3.4,
    'def': 4.6,
    'dex': 0
  }
};

// lynx.currentGym is used to store the current gym being used
lynx.classList = ['specialist', 'heavyweight', 'middleweight', 'lightweight', 'jail'];

lynx.currentStats = {};

lynx.abbreviations = ['k', 'm', 'b', 't'];

lynx.picks = {
  'str': [],
  'def': [],
  'spe': [],
  'dex': []
};

lynx.ratioLabels = {};

lynx.stats = ['str', 'def', 'spe', 'dex'];

lynx.checkGym = function(gymId) {

  lynx.gymInfo[gymId].checked = true;
  var gymStats = lynx.gymInfo[gymId];

  for (var stat of lynx.stats) {

    if (gymStats[stat]) {
      lynx.picks[stat].push({
        id: gymId,
        gain: gymStats[stat]
      });
    }

  }

};

lynx.sortGyms = function(a, b) {

  if (a.gain === b.gain) {
    return b.id - a.id;
  } else {
    return b.gain - a.gain;
  }

};

lynx.pickGyms = function(gymStatus) {

  for (var gymClass of lynx.classList) {

    for (var gym of gymStatus[gymClass]) {

      lynx.gymInfo[gym.id].name = gym.name;
      lynx.gymInfo[gym.id].cost = gym.energyCost;

      if (! (gym.status === 'available' || gym.status === 'active')) {
        continue;
      }

      if (gym.status === 'active') {
        lynx.currentGym = gym.id;
      }

      lynx.checkGym(gym.id);

    }
  }

  for (var stat in lynx.picks) {
    lynx.picks[stat].sort(lynx.sortGyms);
  }

};

lynx.formatNumber = function(number) {

  var abbreviationIndex = -1;

  while (number > 1000 && abbreviationIndex < lynx.abbreviations.length) {
    number /= 1000;
    abbreviationIndex++;
  }

  return Math.trunc(number) + (abbreviationIndex >= 0 ? lynx.abbreviations[abbreviationIndex] : '');

};

lynx.calculateRatios = function() {

  for (var labelStat in lynx.ratioLabels) {
    lynx.ratioLabels[labelStat].innerHTML = '';
  }

  var mainGym = lynx.mainGymSelect.selectedIndex;
  localStorage.setItem('lynxMainGym', mainGym);
  var secondaryGym = lynx.secondaryGymSelect.selectedIndex;
  localStorage.setItem('lynxSecondaryGym', secondaryGym);

  if (mainGym) {
    var mainStatName = lynx.stats[mainGym - 1];
    var secondHighestStatName;
    var secondHighestStatValue = 0;

    for (var stat of lynx.stats) {

      if (stat !== mainStatName && lynx.currentStats[stat] > secondHighestStatValue) {
        secondHighestStatName = stat;
        secondHighestStatValue = lynx.currentStats[stat];
      }

    }

    var mainTarget = secondHighestStatValue * 1.25;

    if (mainTarget > lynx.currentStats[mainStatName]) {

      lynx.ratioLabels[mainStatName].innerHTML = 'Must gain ' + lynx.formatNumber(mainTarget - lynx.currentStats[mainStatName]);
      lynx.ratioLabels[mainStatName].style.color = lynx.red;

    } else {

      var lead = lynx.currentStats[mainStatName] / 1.25;
      lead -= secondHighestStatValue;

      lynx.ratioLabels[secondHighestStatName].innerHTML = 'Can gain ' + lynx.formatNumber(lead);
      lynx.ratioLabels[secondHighestStatName].style.color = lynx.green;
    }

  }

  if (secondaryGym) {

    var defStats = ['dex', 'def'];
    var offStats = ['str', 'spe'];

    var defSum = lynx.currentStats.def + lynx.currentStats.dex;

    var offSum = lynx.currentStats.str + lynx.currentStats.spe;

    var secondaryTarget = (secondaryGym === 1 ? offSum: defSum) * 1.25;

    var secondaryCurrent = secondaryGym === 1 ? defSum: offSum;

    if (secondaryTarget > secondaryCurrent) {

      for (let stat of secondaryGym === 1 ? defStats: offStats) {
        lynx.ratioLabels[stat].innerHTML = 'Must gain ' + lynx.formatNumber(secondaryTarget - secondaryCurrent);
        lynx.ratioLabels[stat].style.color = lynx.red;
      }

    } else {
      var secondaryLead = secondaryCurrent / 1.25;
      secondaryLead -= secondaryGym === 1 ? offSum: defSum;

      for (let stat of secondaryGym === 1 ? offStats: defStats) {
        lynx.ratioLabels[stat].innerHTML = 'Can gain ' + lynx.formatNumber(secondaryLead);
        lynx.ratioLabels[stat].style.color = lynx.green;
      }

    }

  }
};

lynx.setupRatios = function(stats) {

  var existingMainRatio = document.querySelector('select#lynx_mainRatio');
  var existingSecondaryRatio = document.querySelector('select#lynx_secondaryRatio');

  if (existingMainRatio && existingSecondaryRatio) {
    existingMainRatio.closest('.lynx').remove();
  }

  lynx.ratioSetup = true;

  for (var stat in stats) {
    lynx.currentStats[stat.substring(0, 3)] = +stats[stat].value.replace(/,/g, '');
  }

  var parent = document.getElementsByClassName('content-wrapper')[0];

  var ratioDiv = document.createElement('div');
  ratioDiv.className = 'lynx';

  lynx.mainGymSelect = document.createElement('select');
  lynx.mainGymSelect.id = 'lynx_mainRatio';

  lynx.secondaryGymSelect = document.createElement('select');
  lynx.secondaryGymSelect.id = 'lynx_secondaryRatio';

  ratioDiv.appendChild(lynx.mainGymSelect);

  for (var mainOption of lynx.mainRatioOptions) {

    var option = document.createElement('option');
    option.innerHTML = mainOption;
    lynx.mainGymSelect.appendChild(option);
  }

  lynx.mainGymSelect.selectedIndex = +localStorage.getItem('lynxMainGym') || 0;
  lynx.mainGymSelect.onchange = lynx.calculateRatios;

  ratioDiv.appendChild(lynx.secondaryGymSelect);

  for (var secondaryOptionText of lynx.secondaryRatioOptions) {
    var secondaryOption = document.createElement('option');
    secondaryOption.innerHTML = secondaryOptionText;
    lynx.secondaryGymSelect.appendChild(secondaryOption);
  }

  lynx.secondaryGymSelect.selectedIndex = +localStorage.getItem('lynxSecondaryGym') || 0;
  lynx.secondaryGymSelect.onchange = lynx.calculateRatios;

  parent.appendChild(ratioDiv);

};

lynx.setupRatioLabels = function() {

  var statDivs = document.querySelectorAll('[class^=\'propertyContent\']');

  for (var statDiv of statDivs) {
    var existingRatioLabels = statDiv.getElementsByClassName('lynx');

    while (existingRatioLabels.length) {
      existingRatioLabels[0].remove();
    }

  }

  for (var i = 0; i < lynx.stats.length; i++) {

    var statName = lynx.stats[i];

    var statDiv = statDivs[i];

    var ratioLabel = document.createElement('div');
    ratioLabel.className = 'lynx';

    statDiv.appendChild(ratioLabel);

    lynx.ratioLabels[statName] = ratioLabel;

  }

};

lynx.swapGyms = async function(gymToUse) {

  var changeResult = await getAction({
    type: 'post',
    action: 'gym.php',
    data: {
      step: 'changeGym',
      gymID: gymToUse
    }
  });

  if (changeResult.success) {

    lynx.currentGym = gymToUse;

    try {

      var labelName = document.querySelector('[class^=\'notificationText\'] b');
      labelName.innerHTML = lynx.gymInfo[gymToUse].name;

      var listLabelEnergy = document.querySelectorAll('[class^=\'description\']');

      for (var label of listLabelEnergy) {
        label.getElementsByTagName('p')[1].innerHTML = lynx.gymInfo[gymToUse].cost + ' energy per train';
      }

      var activeButton = document.querySelector('[class*=\'active\'][class^=\'gymButton\']');

      var activeClass = '';

      for (var classEntry of activeButton.classList) {
        if (!classEntry.indexOf('active')) {
          activeClass = classEntry;
          break;
        }

      }

      activeButton.classList.remove(activeClass);
      document.querySelector('[class*=\'gym-' + gymToUse + '\']').parentElement.classList.add(activeClass);
      
      var logos = document.querySelectorAll('[class^=\'logo\']');
      
      var logo;

      for(var i = 0; i < logos.length; i++) {
        
        if(logos[i].tagName === 'IMG'){
          logo = logos[i];
          break;
        }
        
      }

      var newSrc = logo.src.split('/');
      newSrc[newSrc.length - 1] = gymToUse + '.png';
      logo.src = newSrc.join('/');

    } catch(error) {
      console.log(error);
      // Still toast even if the visual sync threw — the server-side
      // swap already happened and the user needs to know.
      if (lynx.showSwapToast) {
        lynx.showSwapToast('Switched to ' + (lynx.gymInfo[gymToUse] && lynx.gymInfo[gymToUse].name || ('gym ' + gymToUse)));
      }
      return new Response(JSON.stringify({
        message: 'Gym changed but failed to update visual elements. Wait for patch.'
      }));
    }

    // Unified swap toast — fires for every successful swap (both AGS's
    // own auto-swap during the train fetch hook AND the blurred-tile
    // click path) so the user gets one consistent confirmation format.
    if (lynx.showSwapToast) {
      var name = (lynx.gymInfo[gymToUse] && lynx.gymInfo[gymToUse].name) || ('gym ' + gymToUse);
      lynx.showSwapToast('Switched to ' + name);
    }

  }

  return new Response(JSON.stringify({
    message: changeResult.message
  }));
};

// Capture clicks on disabled stat tiles. When the user is on a
// specialist gym, Torn's React handler refuses to fire the train fetch
// for stats that gym can't train (Mr. Isoyamas blocks STR/SPD/DEX).
// Without this handler, auto-switch never gets a train fetch to
// intercept for those stats — the workflow dead-ends at the click.
//
// Flow when user taps a blocked stat tile:
//   1. Detect: click is inside a [class*="propertyContent___"] that
//      Torn marks disabled (greyed/locked/inactive).
//   2. Identify the stat from the tile's stat-class (strength___ etc.).
//   3. Pick the best UNLOCKED gym that trains that stat from
//      lynx.picks[stat] — the same list AGS uses for autoswitch.
//   4. preventDefault + stopImmediatePropagation so Torn's no-op
//      handler doesn't run.
//   5. Call lynx.swapGyms(bestId) — AGS's own swap helper, handles
//      rfcv + DOM resync.
//   6. After a short delay (so Torn re-renders the now-enabled tile),
//      programmatically click the same tile so Torn's React fires
//      the train fetch normally — our fetch hook + AGS swap path
//      takes care of the rest.
lynx.statClassToKey = {
  'strength': 'str',
  'defense':  'def',
  'speed':    'spe',
  'dexterity':'dex',
};
// Actual Torn DOM (verified):
//   <li class="speed___d3OO8 locked___zpLSk">
//     <div class="propertyTitle___dZL4b">…</div>
//   </li>
// Tile = the <li>. Stat = first part of its first className. Locked
// state = presence of any class starting with "locked___".
lynx.findClickedStatTile = function(el) {
  if (!el || !el.closest) return null;
  var statSelectors = Object.keys(lynx.statClassToKey)
    .map(function(s) { return 'li[class*="' + s + '___"]'; })
    .join(', ');
  var tile = el.closest(statSelectors);
  if (!tile) return null;
  var statKey = null;
  var classes = (tile.className || '').split(/\s+/);
  for (var i = 0; i < classes.length; i++) {
    var m = classes[i].match(/^(strength|defense|speed|dexterity)___/);
    if (m) { statKey = lynx.statClassToKey[m[1]]; break; }
  }
  return statKey ? { tile: tile, statKey: statKey } : null;
};
lynx.tileIsDisabled = function(tile) {
  if (!tile) return false;
  var classes = (tile.className || '').split(/\s+/);
  for (var i = 0; i < classes.length; i++) {
    if (classes[i].indexOf('locked___') === 0) return true;
  }
  // Also catch any inner element marked locked / disabled, as a fallback
  if (tile.querySelector('[class*="locked___"], [class*="disabled___"], [aria-disabled="true"], button[disabled]')) {
    return true;
  }
  return false;
};
// Mirror a train response into Torn's native gain-message container so the
// bypass path looks identical to a React-handled train. Structure observed:
//   <div class="message___X">
//     <div class="messageWrapper___Y">
//       <div>
//         <p>{message}</p>
//         <p role="alert" class="gained___Z">{gainMessage}</p>
//       </div>
//     </div>
//   </div>
// Approach: find the existing container and overwrite its two <p> tags'
// textContent — re-using whatever hashed classes Torn already set so the
// success styling carries through. If the container or paragraphs aren't
// there yet, return false and let the caller fall back to a toast.
lynx.renderTrainResultNatively = function(d) {
  var container = document.querySelector('[class*="gymContent___"] [class*="message___"]')
    || document.querySelector('[class*="message___"]');
  if (!container) return false;
  var msgP = container.querySelector('p:not([role="alert"])');
  var gainP = container.querySelector('p[role="alert"], [class*="gained___"]');
  if (!msgP && !gainP) return false;
  if (msgP) msgP.textContent = d.message || '';
  if (gainP) gainP.textContent = d.gainMessage || '';
  return true;
};

// Visible toast so user knows a swap happened. Floating overlay,
// auto-hides after a few seconds. Tapping it also dismisses.
lynx.showSwapToast = function(message) {
  var existing = document.getElementById('wb-auto-gym-toast');
  if (existing) existing.remove();
  var t = document.createElement('div');
  t.id = 'wb-auto-gym-toast';
  t.textContent = message;
  t.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:80px', 'transform:translateX(-50%)',
    'background:#0a0d14', 'color:#6ee7b7',
    'border:1px solid #6ee7b7', 'border-radius:8px',
    'padding:10px 16px', 'font:600 13px/1.3 -apple-system,system-ui,sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5)', 'z-index:99999',
    'max-width:90vw', 'text-align:center', 'cursor:pointer',
    'pointer-events:auto',
  ].join(';');
  t.addEventListener('click', function(){ t.remove(); });
  document.body.appendChild(t);
  setTimeout(function() { if (t.parentNode) t.remove(); }, 4500);
};

// Post-swap visual sync. lynx.gymInfo[id] has per-stat dot values
// (0 = gym can't train that stat). For each tile, ensure locked___ class
// presence matches the new gym's capability. Removes only the previously-
// applied class names — we don't add a fresh locked class because React
// would just regenerate its own on next render anyway.
lynx.unlockTilesForGym = function(gymId) {
  var info = lynx.gymInfo[gymId];
  if (!info) return;
  Object.keys(lynx.statClassToKey).forEach(function(statApiName) {
    var key = lynx.statClassToKey[statApiName];
    var tile = document.querySelector('li[class*="' + statApiName + '___"]');
    if (!tile) return;
    if (info[key] > 0) {
      // Strip locked___* from the <li>
      Array.prototype.slice.call(tile.classList).forEach(function(c) {
        if (c.indexOf('locked___') === 0) tile.classList.remove(c);
      });
      // Strip locked___ / disabled___ classes AND disabled attrs from every
      // descendant — the train button has its own disabled state deeper in.
      tile.querySelectorAll('*').forEach(function(el) {
        Array.prototype.slice.call(el.classList).forEach(function(c) {
          if (c.indexOf('locked___') === 0 || c.indexOf('disabled___') === 0) {
            el.classList.remove(c);
          }
        });
        if (el.hasAttribute('disabled')) el.removeAttribute('disabled');
        if (el.getAttribute('aria-disabled') === 'true') el.setAttribute('aria-disabled', 'false');
      });
      // Mark so the Train-button bypass below knows to intercept clicks here.
      tile.setAttribute('data-wb-unlocked', key);
    }
  });
};

lynx.bestUnlockedGymForStat = function(statKey) {
  var gymList = lynx.picks[statKey] || [];
  for (var i = 0; i < gymList.length; i++) {
    var g = gymList[i];
    var marker = document.querySelector('[class*="gym-' + g.id + '"]');
    var parent = marker && marker.parentElement;
    if (!parent) continue;
    var locked = false;
    for (var c = 0; c < parent.classList.length; c++) {
      if (parent.classList[c].indexOf('locked') === 0) { locked = true; break; }
    }
    if (!locked) return g;
  }
  return null;
};
function _wbClickHandler(ev) {
  if (lynx.disableCheckbox && lynx.disableCheckbox.checked) return;
  var hit = lynx.findClickedStatTile(ev.target);
  if (!hit) return;
  if (!lynx.tileIsDisabled(hit.tile)) return; // tile is already enabled — let React handle
  var bestGym = lynx.bestUnlockedGymForStat(hit.statKey);
  if (!bestGym) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  (async function() {
    try {
      await lynx.swapGyms(bestGym.id);
      if (lynx.currentGym === bestGym.id) {
        // swapGyms already fired the "Switched to <gym>" toast. Append a
        // hint specific to this path (the user tapped a blurred tile and
        // now needs to tap the now-enabled Train button).
        lynx.unlockTilesForGym(bestGym.id);
        var statLabel = { str: 'STR', def: 'DEF', spe: 'SPD', dex: 'DEX' }[hit.statKey] || hit.statKey;
        var gymName = (lynx.gymInfo[bestGym.id] && lynx.gymInfo[bestGym.id].name) || ('gym ' + bestGym.id);
        lynx.showSwapToast('Switched to ' + gymName + ' for ' + statLabel);
      } else {
        lynx.showSwapToast('Gym swap rejected by Torn (captcha?). Switch manually.');
      }
    } catch (e) {
      lynx.showSwapToast('Gym swap failed: ' + (e && e.message));
    }
  })();
}
document.addEventListener('click', _wbClickHandler, true);

// After a cross-gym swap we strip locked / disabled markers from the target
// stat tile, but Torn's React onClick handler still has stale state and
// refuses to fire the train POST. Capture clicks on the Train button inside
// any tile we marked data-wb-unlocked, synthesize the train fetch ourselves,
// and prevent React's no-op handler from running.
function _wbTrainBypassHandler(ev) {
  if (lynx.disableCheckbox && lynx.disableCheckbox.checked) return;
  var btn = ev.target.closest('button');
  if (!btn) return;
  var tile = btn.closest('li[data-wb-unlocked]');
  if (!tile) return;
  if ((btn.textContent || '').trim().toUpperCase() !== 'TRAIN') return;
  var statKey = tile.getAttribute('data-wb-unlocked');
  var statApi = ({ str: 'strength', def: 'defense', spe: 'speed', dex: 'dexterity' })[statKey];
  if (!statApi) return;
  if (!lynx.lastRfcv) {
    lynx.showSwapToast('No rfcv yet — reload the gym page once');
    return;
  }
  // Read repeats from Torn's per-tile counter if we can find it; default to 1.
  var repeats = 1;
  var repeatEl = tile.querySelector('[class*="propertyValue___"], [class*="amount___"], [class*="counter___"]');
  if (repeatEl) {
    var n = parseInt((repeatEl.textContent || '').replace(/[^\d]/g, ''), 10);
    if (n > 0 && n <= 100) repeats = n;
  }
  ev.preventDefault();
  ev.stopImmediatePropagation();

  // Use Torn's own getAction() global — same helper AGS uses for swapGyms.
  // It handles the rfcv / CSRF / headers / body format Torn's API expects.
  // Hand-rolling fetch hit "didn't match specific pattern" regex rejections,
  // likely because cached rfcv tokens are action-tied and rotate.
  var trainFn;
  if (typeof window.getAction === 'function') {
    trainFn = function() {
      return new Promise(function(resolve, reject) {
        try {
          var res = window.getAction({
            type: 'post',
            action: 'gym.php',
            data: { step: 'train', stat: statApi, repeats: repeats },
          });
          // getAction usually returns a Promise; if not, wrap.
          Promise.resolve(res).then(resolve, reject);
        } catch (e) { reject(e); }
      });
    };
  } else {
    // Fallback if Torn's helper isn't exposed for some reason.
    var url = '/gym.php?step=train&rfcv=' + encodeURIComponent(lynx.lastRfcv);
    trainFn = function() {
      return window.fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
        body: JSON.stringify({ step: 'train', stat: statApi, repeats: repeats }),
      }).then(function(r){ return r.json(); });
    };
  }

  trainFn().then(function(d){
    if (d && d.success) {
      // Update the stat tile's value (Torn's React would normally do this
      // — we have to since we bypassed it).
      if (d.stat && d.stat.newValue) {
        var valEl = tile.querySelector('[class*="propertyValue___"]');
        if (valEl) valEl.textContent = d.stat.newValue;
      }
      // Write the gain message into Torn's native message container so it
      // renders where Torn normally puts it, not in a toast. Container
      // sits at [class*="message___"] inside [class*="gymContent___"]
      // with two <p> children: descriptive message + "You gained X stat".
      var rendered = lynx.renderTrainResultNatively(d);
      if (!rendered) {
        // Container not present yet (very first train of a session before
        // Torn has populated it). Fall back to toast just this once.
        lynx.showSwapToast(d.gainMessage || ('Trained ' + statKey.toUpperCase()));
      }
    } else {
      // Failures stay in the toast — Torn's native container is for
      // success messages, and surfacing an error there would look wrong.
      lynx.showSwapToast('Train failed: ' + (d && d.message ? d.message : 'unknown'));
    }
  }).catch(function(e){
    lynx.showSwapToast('Train failed: ' + (e && e.message));
  });
}
document.addEventListener('click', _wbTrainBypassHandler, true);

lynx.runRatioCheck = function() {

  if (!lynx.initialRatioSetup) {
    lynx.setupRatios(lynx.downloadedStats);
    lynx.initialRatioSetup = true;
  }

  lynx.setupRatioLabels();
  lynx.calculateRatios();
};

lynx.setDisable = function() {

  for (var existingDisable of document.querySelectorAll('#gymroot .lynx')) {
    var existingDisableCheckbox = existingDisable.querySelector('input[type=\'checkbox\']');
    var existingDisableLabel = existingDisable.querySelector('span');

    if (existingDisableCheckbox && existingDisableLabel && existingDisableLabel.textContent === 'Disable auto gym switch') {
      existingDisable.remove();
    }

  }

  lynx.disableCheckbox = document.createElement('input');
  lynx.disableCheckbox.type = 'checkbox';
  lynx.disableCheckbox.onchange = function() {
    localStorage.setItem('lynxDisableSwap', lynx.disableCheckbox.checked ? 1 : 0);
  }

  lynx.disableCheckbox.checked = !!+localStorage.getItem('lynxDisableSwap');

  var div = document.createElement('div');
  div.className = 'lynx';
  div.appendChild(lynx.disableCheckbox);

  var label = document.createElement('span');
  label.innerHTML = 'Disable auto gym switch';

  div.appendChild(label);

  document.getElementById('gymroot').appendChild(div);

};

(function() {

  'use strict';

  var lynxElements = document.getElementsByClassName('lynx');

  while (lynxElements.length) {
    lynxElements[0].remove();
  }

  var focusCallback = function(event) {

    if (lynx.domReady && !document.getElementById('specialistGyms')) {
      lynx.runRatioCheck();
      lynx.removedFocusCallback = true;
      removeEventListener('focus', focusCallback);
    }

  };

  addEventListener('focus', focusCallback);

  var originalFetch = window.fetch;

  window.fetch = async function(...args) {

    // args[0] is a string when the page calls fetch with a URL, but
    // can be a Request object (or anything else) on other Torn pages. PDA
    // keeps this hook live across SPA navigation away from /gym.php, so we
    // see fetches with non-string args[0] and the old args[0].indexOf(...)
    // calls below crash. Normalise to a URL string once at the top and let
    // every prefix check operate on that. If we can't get a URL, treat the
    // request as "not interesting" and just pass it through.
    var _url0 = typeof args[0] === 'string'
      ? args[0]
      : (args[0] && typeof args[0].url === 'string' ? args[0].url : '');
    if (typeof _url0 !== 'string' || !_url0) {
      return await originalFetch(...args);
    }
    // Cache rfcv from any gym URL we see so we can synthesize gym POSTs
    // ourselves (used by the post-swap Train-button bypass below).
    try {
      var _m = _url0.match(/[?&]rfcv=([^&]+)/);
      if (_m) lynx.lastRfcv = _m[1];
    } catch (_) {}

    if (!_url0.indexOf('/gym.php?step=train') && !lynx.disableCheckbox.checked) {

      var stat = JSON.parse(args[1].body).stat.substring(0, 3);

      var gymToUse;
      var gymList = lynx.picks[stat];
      for (var gym of gymList) {

        if (gym.id > 24 && gym.id < 32) {

          var isLocked = false;
          for (var classEntry of document.querySelector('[class*=\'gym-' + gym.id + '\']').parentElement.classList) {
            if (!classEntry.indexOf('locked')) {
              isLocked = true;
              break;
            }

          }

          if (!isLocked) {
            gymToUse = gym.id;
            break;
          }
        } else {
          gymToUse = gym.id;
          break;
        }

      }

      if (gymToUse && gymToUse !== lynx.currentGym) {
        return await lynx.swapGyms(gymToUse);
      }

    }

    var result = await originalFetch(...args);

    var jsonData;

    if (!lynx.booted && !_url0.indexOf('/gym.php?step=getInitialGymInfo')) {

      lynx.booted = true;
      jsonData = await result.clone().json();

      lynx.downloadedStats = jsonData.stats;

      var observer = new MutationObserver(function(mutationList, observer) {

        for (var event of mutationList) {

          // This does not suffice for when the player doesn't confirm the gym
          // change
          if (event.target.tagName === 'DIV' && !event.target.className.indexOf('message') && event.addedNodes.length && !event.addedNodes[0].className.indexOf('messageWrapper')) {

            if (!lynx.disableCheckbox) {
              lynx.setDisable();
            }

            if (document.getElementById('specialistGyms')) {
              return observer.disconnect();
            }

            if (!document.hidden) {
              lynx.runRatioCheck();

              if (!lynx.removedFocusCallback) {
                lynx.removedFocusCallback = true;
                removeEventListener('focus', focusCallback);
              }
            } else {
              lynx.domReady = true;
            }
            break;
          }
        }

      });

      observer.observe(document.getElementsByTagName('body')[0], {
        childList: true,
        subtree: true
      });

      lynx.pickGyms(jsonData.gyms);

    } else if (!_url0.indexOf('/gym.php?step=changeGym') || !_url0.indexOf('/gym.php?step=purchaseMembership')) {

      try { jsonData = await result.clone().json(); } catch (_) { jsonData = null; }

      if (jsonData && jsonData.success) {

        // Torn's UI-initiated changeGym can send body as JSON string,
        // FormData, URLSearchParams, ReadableStream, etc. AGS assumed
        // JSON string and crashed otherwise — leaving lynx.currentGym
        // stuck on the old gym, which then made AGS try redundant
        // swaps and Torn replied "you're already in this gym".
        var newGymId = null;
        try {
          var b = args[1] && args[1].body;
          if (typeof b === 'string') {
            try { newGymId = JSON.parse(b).gymID; } catch (_) {}
            if (newGymId == null) {
              var p = new URLSearchParams(b);
              var v = p.get('gymID');
              if (v != null) newGymId = Number(v);
            }
          } else if (b && typeof b.get === 'function') {
            // FormData / URLSearchParams
            var v2 = b.get('gymID');
            if (v2 != null) newGymId = Number(v2);
          }
          // Last-resort: response itself sometimes includes the gym id.
          if (newGymId == null) {
            if (jsonData.gymID != null) newGymId = Number(jsonData.gymID);
            else if (jsonData.gym && jsonData.gym.id != null) newGymId = Number(jsonData.gym.id);
          }
        } catch (e) {
          try { console.warn('[wb-auto-gym] changeGym body parse failed:', e && e.message); } catch (_) {}
        }

        if (newGymId != null && !isNaN(newGymId)) {
          lynx.currentGym = newGymId;

          if (lynx.gymInfo[lynx.currentGym] && !lynx.gymInfo[lynx.currentGym].checked) {
            lynx.checkGym(lynx.currentGym);

            for (var sortStat in lynx.picks) {
              lynx.picks[sortStat].sort(lynx.sortGyms);
            }
          }
        }
      }
    } else if (lynx.ratioSetup && !_url0.indexOf('/gym.php?step=train')) {

      jsonData = await result.clone().json();

      if (jsonData.success) {
        // The data will contain gymsStatuses array, objects with id and status
        // when locking status will be lockedPurchased, when unlocking again
        // status will be available
        // Is this better than checking the button each time?
        lynx.currentStats[jsonData.stat.name.substring(0, 3)] = +jsonData.stat.newValue.replace(/,/g, '');
        lynx.calculateRatios();

      }
    }

    return result;

  };

})();
