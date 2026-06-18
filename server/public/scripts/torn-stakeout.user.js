// ==UserScript==
// @name         Stakeout
// @namespace    RussianRob
// @version      1.0.15
// @description  Stake out players and factions with status alerts (online, hospital, landing, life, chain, war...) — forked from TornTools
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-stakeout.user.js
// @updateURL    https://tornwar.com/scripts/torn-stakeout.user.js
// ==/UserScript==
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.0.15';

  function hoursSince(tsSec, nowMs) {
    return (nowMs / 1000 - tsSec) / 3600;
  }

  function evaluatePlayer(old, snap, alerts, nowMs) {
    if (!old) return [];
    var fired = [];
    if (alerts.landing && old.state === 'Traveling' && snap.state !== 'Traveling') fired.push('landing');
    if (alerts.okay && snap.state === 'Okay' && old.state !== 'Okay') fired.push('okay');
    if (alerts.hospital && snap.state === 'Hospital' && old.state !== 'Hospital') fired.push('hospital');
    if (alerts.online && snap.lastAction === 'Online' && old.lastAction !== 'Online') fired.push('online');
    if (alerts.life !== false) {
      var thr = snap.lifeMax * (alerts.life / 100);
      var oThr = old.lifeMax * (alerts.life / 100);
      if (snap.lifeCur <= thr && !(old.lifeCur <= oThr)) fired.push('life');
    }
    if (alerts.offline !== false) {
      if (hoursSince(snap.lastActionTs, nowMs) >= alerts.offline && hoursSince(old.lastActionTs, nowMs) < alerts.offline) fired.push('offline');
    }
    if (alerts.revivable && snap.revivable && !old.revivable) fired.push('revivable');
    return fired;
  }

  function evaluateFaction(old, snap, alerts) {
    if (!old) return [];
    var fired = [];
    if (alerts.chainReaches !== false) {
      if (alerts.chainReaches === 0) {
        if (old.chain >= 10 && snap.chain < old.chain) fired.push('chainReaches');
      } else if (snap.chain >= alerts.chainReaches && old.chain < alerts.chainReaches) {
        fired.push('chainReaches');
      }
    }
    if (alerts.memberCountDrops !== false && snap.membersCur < alerts.memberCountDrops && !(old.membersCur < alerts.memberCountDrops)) fired.push('memberCountDrops');
    if (alerts.rankedWarStarts && snap.rankedWar && !old.rankedWar) fired.push('rankedWarStarts');
    if (alerts.inRaid && snap.raid && !old.raid) fired.push('inRaid');
    if (alerts.inTerritoryWar && snap.territoryWar && !old.territoryWar) fired.push('inTerritoryWar');
    return fired;
  }

  function mapPlayerResponse(j) {
    var p = (j && j.profile) ? j.profile : (j || {});
    return {
      name: p.name,
      state: p.status ? p.status.state : '',
      description: p.status ? (p.status.description || '') : '',
      lastAction: p.last_action ? p.last_action.status : '',
      lastActionTs: p.last_action ? p.last_action.timestamp : 0,
      lifeCur: p.life ? p.life.current : 0,
      lifeMax: p.life ? p.life.maximum : 0,
      revivable: !!p.revivable
    };
  }

  function mapFactionResponse(j) {
    var basic = j.basic || {};
    var chain = j.chain || {};
    var wars = j.wars || {};
    return {
      name: basic.name != null ? basic.name : (j.name || ''),
      chain: chain.current != null ? chain.current : 0,
      respect: basic.respect != null ? basic.respect : 0,
      membersCur: basic.members != null ? basic.members : 0,
      membersMax: basic.capacity != null ? basic.capacity : 0,
      rankedWar: !!(wars.ranked),
      raid: Array.isArray(wars.raids) ? wars.raids.length > 0 : false,
      territoryWar: Array.isArray(wars.territory) ? wars.territory.length > 0 : false
    };
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { hoursSince: hoursSince, evaluatePlayer: evaluatePlayer, evaluateFaction: evaluateFaction, mapPlayerResponse: mapPlayerResponse, mapFactionResponse: mapFactionResponse };
    return;
  }

  var PLAYERS_KEY = 'stakeout_players';
  var FACTIONS_KEY = 'stakeout_factions';
  var SETTINGS_KEY = 'stakeout_settings';
  var DEFAULT_SETTINGS = { apiKey: '', pollSeconds: 30, sound: true, sectionCollapsed: false };

  function gmGet(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') {
        var v = GM_getValue(key, null);
        if (v == null) return fallback;
        return typeof v === 'string' ? JSON.parse(v) : v;
      }
      var ls = localStorage.getItem(key);
      return ls == null ? fallback : JSON.parse(ls);
    } catch (_) { return fallback; }
  }
  function gmSet(key, val) {
    try {
      var s = JSON.stringify(val);
      if (typeof GM_setValue === 'function') GM_setValue(key, s);
      else localStorage.setItem(key, s);
    } catch (_) {}
  }
  function getPlayers() { var a = gmGet(PLAYERS_KEY, []); return Array.isArray(a) ? a : []; }
  function setPlayers(a) { gmSet(PLAYERS_KEY, a); }
  function getFactions() { var a = gmGet(FACTIONS_KEY, []); return Array.isArray(a) ? a : []; }
  function setFactions(a) { gmSet(FACTIONS_KEY, a); }
  function getSettings() {
    var s = gmGet(SETTINGS_KEY, null);
    if (!s || typeof s !== 'object') return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }
  function setSettings(s) { gmSet(SETTINGS_KEY, s); }

  function apiFetch(section, id, selections, cb) {
    var settings = getSettings();
    if (!settings.apiKey) { cb(new Error('no api key')); return; }
    var url = 'https://api.torn.com/v2/' + section + '/' + id + '?selections=' + selections.join(',');
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'GET', url: url,
        headers: { 'Authorization': 'ApiKey ' + settings.apiKey, 'Accept': 'application/json' },
        onload: function (r) {
          try {
            var d = JSON.parse(r.responseText);
            if (d.error) { cb(new Error('api ' + d.error.code + ': ' + d.error.error)); return; }
            cb(null, d);
          } catch (e) { cb(e); }
        },
        onerror: function () { cb(new Error('network error')); }
      });
    } else { cb(new Error('GM_xmlhttpRequest unavailable')); }
  }

  var polling = false;
  function pollOnce() {
    if (polling) return;
    polling = true;
    var nowMs = Date.now();
    var players = getPlayers();
    var factions = getFactions();
    var queue = [];
    players.forEach(function (p, i) { queue.push({ kind: 'player', rec: p, idx: i }); });
    factions.forEach(function (f, i) { queue.push({ kind: 'faction', rec: f, idx: i }); });
    var qi = 0;
    function next() {
      if (qi >= queue.length) { polling = false; return; }
      var job = queue[qi++];
      if (job.kind === 'player') {
        apiFetch('user', job.rec.id, ['profile'], function (err, d) {
          if (!err && d) {
            var snap = mapPlayerResponse(d);
            var fired = evaluatePlayer(job.rec.info, snap, job.rec.alerts, nowMs);
            job.rec.info = snap;
            var arr = getPlayers(); if (arr[job.idx] && arr[job.idx].id === job.rec.id) { arr[job.idx].info = snap; setPlayers(arr); }
            fired.forEach(function (a) { notifyPlayer(job.rec, snap, a); });
            renderPanel();
          }
          next();
        });
      } else {
        apiFetch('faction', job.rec.id, ['basic', 'chain', 'wars'], function (err, d) {
          if (!err && d) {
            var snap = mapFactionResponse(d);
            var fired = evaluateFaction(job.rec.info, snap, job.rec.alerts);
            job.rec.info = snap;
            var arr = getFactions(); if (arr[job.idx] && arr[job.idx].id === job.rec.id) { arr[job.idx].info = snap; setFactions(arr); }
            fired.forEach(function (a) { notifyFaction(job.rec, snap, a); });
            renderPanel();
          }
          next();
        });
      }
    }
    next();
  }

  var pollTimer = null;
  function restartPolling() {
    if (pollTimer) clearInterval(pollTimer);
    var secs = getSettings().pollSeconds || 30;
    pollTimer = setInterval(pollOnce, Math.max(10, secs) * 1000);
  }

  var PLAYER_MSG = {
    okay: 'is now OKAY', hospital: 'is in hospital', landing: 'has landed', online: 'is now online',
    life: 'life dropped below threshold', offline: 'has been offline a while', revivable: 'is now revivable'
  };
  var FACTION_MSG = {
    chainReaches: 'chain alert', memberCountDrops: 'member count dropped',
    rankedWarStarts: 'ranked war started', inRaid: 'is in a raid', inTerritoryWar: 'is in a territory war'
  };

  function tone(ctx, freq, type, start, dur, gain) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.value = gain == null ? 0.07 : gain;
    o.start(ctx.currentTime + (start || 0));
    o.stop(ctx.currentTime + (start || 0) + dur);
  }
  var SOUNDS = {
    ping: function (ctx) { tone(ctx, 880, 'sine', 0, 0.18); },
    chime: function (ctx) { tone(ctx, 660, 'sine', 0, 0.14); tone(ctx, 990, 'sine', 0.12, 0.2); },
    alert: function (ctx) { tone(ctx, 1047, 'square', 0, 0.08, 0.05); tone(ctx, 1047, 'square', 0.13, 0.08, 0.05); tone(ctx, 1047, 'square', 0.26, 0.08, 0.05); },
    buzz: function (ctx) { tone(ctx, 200, 'sawtooth', 0, 0.28, 0.05); },
    rising: function (ctx) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.07;
      o.frequency.setValueAtTime(400, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
    }
  };
  var SOUND_OPTIONS = [['off', 'Off'], ['ping', 'Ping'], ['chime', 'Chime'], ['alert', 'Alert'], ['buzz', 'Buzz'], ['rising', 'Rising']];
  function effectiveSound(s) { return s.soundType || (s.sound === false ? 'off' : 'ping'); }
  function playSound(preview) {
    var st = preview || effectiveSound(getSettings());
    if (st === 'off' || !SOUNDS[st]) return;
    try { var ctx = new (window.AudioContext || window.webkitAudioContext)(); SOUNDS[st](ctx); } catch (_) {}
  }

  function toastContainer() {
    var c = document.getElementById('stk-toasts');
    if (!c) { c = document.createElement('div'); c.id = 'stk-toasts'; document.body.appendChild(c); }
    return c;
  }
  function showToast(text, href) {
    var c = toastContainer();
    var t = document.createElement('div');
    t.className = 'stk-toast';
    var msg = document.createElement('span');
    msg.className = 'stk-toast-msg';
    msg.textContent = text;
    msg.onclick = function () { if (href) window.open(href, '_blank'); t.remove(); };
    var x = document.createElement('span');
    x.className = 'stk-toast-x';
    x.textContent = '✕';
    x.onclick = function (e) { e.stopPropagation(); t.remove(); };
    t.appendChild(msg);
    t.appendChild(x);
    c.appendChild(t);
    while (c.children.length > 5) c.removeChild(c.firstChild);
    setTimeout(function () { t.classList.add('stk-toast-in'); }, 20);
  }

  function notify(text, href) {
    showToast(text, href);
    playSound();
    try {
      if (typeof window !== 'undefined' && window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
        window.flutter_inappwebview.callHandler('scheduleNotification', {
          title: 'Stakeout', subtitle: text,
          id: Math.floor(Math.random() * 9000) + 1000,
          timestamp: Date.now() + 1500,
          urlCallback: href || '', launchNativeToast: false
        });
        return;
      }
    } catch (_) {}
    try {
      if (typeof browser !== 'undefined' && browser.notifications && browser.notifications.create) {
        browser.notifications.create('stk-' + Date.now(), { type: 'basic', iconUrl: 'https://www.torn.com/favicon.ico', title: 'Stakeout', message: text });
        return;
      }
    } catch (_) {}
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        var n = new Notification('Stakeout', { body: text, icon: 'https://www.torn.com/favicon.ico', tag: 'stakeout' });
        if (href) n.onclick = function () { window.open(href, '_blank'); n.close(); };
        return;
      }
    } catch (_) {}
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({ title: 'Stakeout', text: text, onclick: function () { if (href) window.open(href, '_blank'); } });
        return;
      }
    } catch (_) {}
  }

  function requestWebNotifPermission() {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
        Notification.requestPermission();
      }
    } catch (_) {}
  }

  function notifyPlayer(rec, snap, alert) {
    var who = (rec.label || snap.name || ('Player ' + rec.id)) + ' [' + rec.id + ']';
    notify(who + ' ' + (PLAYER_MSG[alert] || alert), 'https://www.torn.com/profiles.php?XID=' + rec.id);
  }
  function notifyFaction(rec, snap, alert) {
    var who = (snap.name || ('Faction ' + rec.id)) + ' [' + rec.id + ']';
    var extra = alert === 'chainReaches' ? (' (chain ' + snap.chain + ')') : '';
    notify(who + ' ' + (FACTION_MSG[alert] || alert) + extra, 'https://www.torn.com/factions.php?step=profile&ID=' + rec.id);
  }

  function injectStyles() {
    if (document.getElementById('stk-styles')) return;
    var s = document.createElement('style');
    s.id = 'stk-styles';
    s.textContent = [
      '#stk-toasts{position:fixed;right:16px;bottom:80px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;max-width:320px;align-items:flex-end;}',
      '.stk-toast{display:flex;align-items:center;gap:8px;max-width:320px;background:#1b1f2a;color:#e6e8ee;border:1px solid #2a3447;border-left:3px solid #6ee7b7;border-radius:8px;padding:10px 12px;font:600 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.5);opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s;}',
      '.stk-toast-in{opacity:1;transform:translateY(0);}',
      '.stk-toast-msg{cursor:pointer;flex:1;}',
      '.stk-toast-x{cursor:pointer;opacity:.55;padding:0 2px;font-size:12px;}',
      '.stk-toast-x:hover{opacity:1;}',
      '#stk-section.stk-sec-wrap{margin:10px 0;border:1px solid rgba(128,128,128,.3);border-radius:5px;overflow:hidden;font:13px/1.45 Arial,system-ui,sans-serif;}',
      '.stk-sec-head{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(#8aac3d,#6f9430);color:#fff;font-weight:700;padding:7px 12px;cursor:pointer;text-shadow:0 1px 1px rgba(0,0,0,.25);user-select:none;}',
      '.stk-chev{font-size:11px;transition:transform .15s;}',
      '.stk-sec-wrap.stk-collapsed .stk-chev{transform:rotate(-90deg);}',
      '.stk-sec-body{padding:10px 12px;background:rgba(128,128,128,.07);color:inherit;}',
      '.stk-sec-wrap.stk-collapsed .stk-sec-body{display:none;}',
      '.stk-enable{display:flex;align-items:center;gap:6px;font-weight:600;margin:0 0 8px;cursor:pointer;}',
      '.stk-cols{display:flex;gap:28px;flex-wrap:wrap;}',
      '.stk-col-title{font-weight:700;font-size:11px;text-transform:uppercase;opacity:.6;margin:0 0 4px;}',
      '.stk-opt{display:block;margin:3px 0;font-size:12px;}',
      '.stk-opt.stk-dis{opacity:.45;}',
      '.stk-opt input[type=checkbox]{vertical-align:middle;margin-right:5px;}',
      '.stk-num{width:46px;margin:0 3px;padding:1px 4px;border:1px solid rgba(128,128,128,.45);border-radius:3px;background:rgba(128,128,128,.12);color:inherit;font:inherit;}',
      '.stk-foot{margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.25);font-size:11px;opacity:.9;display:flex;flex-direction:column;gap:5px;}',
      '.stk-foot input{padding:2px 5px;border:1px solid rgba(128,128,128,.45);border-radius:3px;background:rgba(128,128,128,.12);color:inherit;font:inherit;}',
      '.stk-test{background:linear-gradient(#8aac3d,#6f9430);color:#fff;border:0;border-radius:4px;padding:4px 10px;font:inherit;font-weight:700;cursor:pointer;}',
      '.stk-test:hover{filter:brightness(1.08);}',
      '.stk-soundsel{padding:2px 4px;border:1px solid rgba(128,128,128,.45);border-radius:3px;background:rgba(128,128,128,.12);color:inherit;font:inherit;}',
      '.stk-foot .stk-key{width:150px;} .stk-foot .stk-polln{width:54px;}',
      '.stk-status{font-size:11px;opacity:.65;margin-top:6px;}',
      '.stk-watch{margin-top:2px;}',
      '.stk-watch-item{display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;font-size:11px;}',
      '.stk-watch-item a[href]{color:inherit;text-decoration:none;font-weight:600;}',
      '.stk-watch-x{cursor:pointer;color:#d6504a;font-weight:700;text-decoration:none;}',
      '.stk-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle;}',
      '.stk-on{background:#5aa700;} .stk-off{background:#8a8a8a;} .stk-hosp{background:#e64d1a;}'
    ].join('');
    document.head.appendChild(s);
  }

  function defaultPlayerAlerts() { return { okay: false, hospital: true, landing: true, online: true, life: false, offline: false, revivable: false }; }
  function defaultFactionAlerts() { return { chainReaches: false, memberCountDrops: false, rankedWarStarts: true, inRaid: false, inTerritoryWar: false }; }

  function addTarget(rawId, kind) {
    var id = parseInt(String(rawId).replace(/[^0-9]/g, ''), 10);
    if (!id) return;
    if (kind === 'player') {
      var ps = getPlayers();
      if (ps.some(function (p) { return p.id === id; })) return;
      ps.push({ id: id, order: Date.now(), label: '', info: null, alerts: defaultPlayerAlerts() });
      setPlayers(ps);
    } else {
      var fs = getFactions();
      if (fs.some(function (f) { return f.id === id; })) return;
      fs.push({ id: id, order: Date.now(), info: null, alerts: defaultFactionAlerts() });
      setFactions(fs);
    }
    renderPanel();
    pollOnce();
  }

  function removePlayer(id) { setPlayers(getPlayers().filter(function (p) { return p.id !== id; })); renderPanel(); }
  function removeFaction(id) { setFactions(getFactions().filter(function (f) { return f.id !== id; })); renderPanel(); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function dot(snap) {
    if (!snap) return '<span class="stk-dot stk-off"></span>';
    if (snap.state === 'Hospital') return '<span class="stk-dot stk-hosp"></span>';
    if (snap.lastAction === 'Online') return '<span class="stk-dot stk-on"></span>';
    return '<span class="stk-dot stk-off"></span>';
  }

  function alertOpt(id, key, checked, label, enabled) {
    return '<label class="stk-opt' + (enabled ? '' : ' stk-dis') + '"><input type="checkbox" data-akey="' + key + '" data-id="' + id + '"' + (checked ? ' checked' : '') + (enabled ? '' : ' disabled') + '> ' + label + '</label>';
  }
  function alertNum(id, key, on, val, before, after, enabled, ph) {
    return '<label class="stk-opt' + (enabled ? '' : ' stk-dis') + '"><input type="checkbox" data-anumck="' + key + '" data-id="' + id + '"' + (on ? ' checked' : '') + (enabled ? '' : ' disabled') + '> ' + before +
      ' <input class="stk-num" data-anum="' + key + '" data-id="' + id + '" value="' + (val === false || val == null ? '' : val) + '" placeholder="' + (ph || '') + '"' + (enabled ? '' : ' disabled') + '>' + (after ? ' ' + after : '') + '</label>';
  }
  function playerCols(p, enabled) {
    var a = p.alerts;
    return '<div class="stk-cols"><div class="stk-col"><div class="stk-col-title">Alerts</div>' +
      alertOpt(p.id, 'online', a.online, 'comes online', enabled) +
      alertOpt(p.id, 'hospital', a.hospital, 'enters hospital', enabled) +
      alertOpt(p.id, 'landing', a.landing, 'lands from travel', enabled) +
      alertOpt(p.id, 'okay', a.okay, 'becomes okay', enabled) +
      alertOpt(p.id, 'revivable', a.revivable, 'is revivable', enabled) +
      '</div><div class="stk-col"><div class="stk-col-title">Thresholds</div>' +
      alertNum(p.id, 'life', a.life !== false, a.life, 'life drops below', '%', enabled, '15') +
      alertNum(p.id, 'offline', a.offline !== false, a.offline, 'offline at least', 'h', enabled, '24') +
      '</div></div>';
  }
  function factionCols(f, enabled) {
    var a = f.alerts;
    return '<div class="stk-cols"><div class="stk-col"><div class="stk-col-title">General</div>' +
      alertNum(f.id, 'chainReaches', a.chainReaches !== false, a.chainReaches, 'chain reaches', '', enabled, 'N') +
      alertNum(f.id, 'memberCountDrops', a.memberCountDrops !== false, a.memberCountDrops, 'member count drops below', 'members', enabled, 'N') +
      '</div><div class="stk-col"><div class="stk-col-title">Wars</div>' +
      alertOpt(f.id, 'rankedWarStarts', a.rankedWarStarts, 'ranked war', enabled) +
      alertOpt(f.id, 'inRaid', a.inRaid, 'raid', enabled) +
      alertOpt(f.id, 'inTerritoryWar', a.inTerritoryWar, 'territory war', enabled) +
      '</div></div>';
  }

  function updateAlert(kind, id, key, value) {
    if (kind === 'player') {
      var ps = getPlayers(); ps.forEach(function (p) { if (p.id === id) p.alerts[key] = value; }); setPlayers(ps);
    } else {
      var fs = getFactions(); fs.forEach(function (f) { if (f.id === id) f.alerts[key] = value; }); setFactions(fs);
    }
  }

  function statusTextPlayer(info) {
    if (!info) return 'pending…';
    return info.state + (info.lifeMax ? ' · life ' + Math.round(info.lifeCur / info.lifeMax * 100) + '%' : '') + (info.lastAction ? ' · ' + info.lastAction : '');
  }
  function statusTextFaction(info) {
    if (!info) return 'pending…';
    return 'chain ' + info.chain + ' · members ' + info.membersCur + '/' + info.membersMax + (info.rankedWar ? ' · in war' : '');
  }
  function watchHtml() {
    var ps = getPlayers(), fs = getFactions();
    if (!ps.length && !fs.length) return '';
    var items = '';
    ps.forEach(function (p) { items += '<span class="stk-watch-item">' + dot(p.info) + '<a href="https://www.torn.com/profiles.php?XID=' + p.id + '" target="_blank" rel="noopener">' + esc((p.info && p.info.name) || p.id) + '</a><a class="stk-watch-x" data-wx="p" data-id="' + p.id + '">✕</a></span>'; });
    fs.forEach(function (f) { items += '<span class="stk-watch-item"><a href="https://www.torn.com/factions.php?step=profile&ID=' + f.id + '" target="_blank" rel="noopener">' + esc((f.info && f.info.name) || f.id) + '</a><a class="stk-watch-x" data-wx="f" data-id="' + f.id + '">✕</a></span>'; });
    return '<div class="stk-watch"><div class="stk-col-title">Watching (' + (ps.length + fs.length) + ')</div>' + items + '</div>';
  }

  function renderPanel() {
    var body = document.getElementById('stk-body');
    if (!body) return;
    if (body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    var xid = currentProfileXid(), fid = currentFactionId();
    var s = getSettings();
    var html = '';
    if (xid) {
      var p = getPlayers().filter(function (x) { return x.id === xid; })[0];
      var on = !!p;
      html += '<label class="stk-enable"><input type="checkbox" id="stk-enable"' + (on ? ' checked' : '') + '> Stakeout this player</label>';
      html += playerCols(p || { id: xid, alerts: defaultPlayerAlerts() }, on);
      html += '<div class="stk-status">' + (on ? esc(statusTextPlayer(p.info)) : 'not staking out') + '</div>';
    } else {
      var f = getFactions().filter(function (x) { return x.id === fid; })[0];
      var onf = !!f;
      html += '<label class="stk-enable"><input type="checkbox" id="stk-enable"' + (onf ? ' checked' : '') + '> Stakeout this faction</label>';
      html += factionCols(f || { id: fid, alerts: defaultFactionAlerts() }, onf);
      html += '<div class="stk-status">' + (onf ? esc(statusTextFaction(f.info)) : 'not staking out') + '</div>';
    }
    if (!s.apiKey) {
      html += '<div class="stk-status" style="color:#e6a23c;">⚠ Enter your Torn API key below to fetch names and live status.</div>';
    }
    html += '<div class="stk-foot">';
    html += '<div>API key <input class="stk-key" id="stk-key" value="' + (s.apiKey ? '••••••••' : '') + '" placeholder="Torn API key"></div>';
    var stp = effectiveSound(s);
    var nTargets = getPlayers().length + getFactions().length;
    var rate = s.pollSeconds ? Math.round(nTargets / s.pollSeconds * 60) : 0;
    html += '<div>Poll <input class="stk-polln" id="stk-poll" value="' + s.pollSeconds + '"> s &nbsp; Sound <select class="stk-soundsel" id="stk-sound">' + SOUND_OPTIONS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === stp ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
    html += '<div class="stk-status">~' + rate + ' API calls/min total (' + nTargets + ' staked)</div>';
    var nperm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    var notifRow = nperm === 'granted' ? '<span class="stk-status">🔔 System notifications enabled</span>'
      : nperm === 'denied' ? '<span class="stk-status">🔔 Notifications blocked — allow torn.com in your browser settings</span>'
      : nperm === 'unsupported' ? ''
      : '<button type="button" class="stk-test" id="stk-enable-notif">🔔 Enable notifications</button>';
    html += '<div>' + notifRow + '</div>';
    html += '<div><button type="button" class="stk-test" id="stk-test">🔔 Test notification</button></div>';
    html += watchHtml();
    html += '</div>';
    body.innerHTML = html;
    wireSection(body, xid, fid);
  }

  function wireSection(body, xid, fid) {
    var kind = xid ? 'player' : 'faction';
    var tid = xid || fid;
    var en = body.querySelector('#stk-enable');
    if (en) en.onchange = function () {
      if (en.checked) addTarget(tid, kind);
      else if (kind === 'player') removePlayer(tid); else removeFaction(tid);
    };
    body.querySelectorAll('input[data-akey]').forEach(function (el) {
      el.onchange = function () { updateAlert(kind, parseInt(el.getAttribute('data-id'), 10), el.getAttribute('data-akey'), el.checked); };
    });
    body.querySelectorAll('.stk-opt input[data-anumck], .stk-opt input[data-anum]').forEach(function (el) {
      el.onchange = function () {
        var row = el.closest('.stk-opt');
        var ck = row.querySelector('input[type=checkbox]');
        var num = row.querySelector('.stk-num');
        var key = ck.getAttribute('data-anumck');
        var nv = parseInt(String((num && num.value) || '').replace(/[^0-9]/g, ''), 10);
        var val = ck.checked ? (isNaN(nv) ? (key === 'chainReaches' ? 0 : false) : nv) : false;
        updateAlert(kind, parseInt(ck.getAttribute('data-id'), 10), key, val);
      };
    });
    var keyEl = body.querySelector('#stk-key');
    if (keyEl) keyEl.onchange = function () { if (keyEl.value && keyEl.value.indexOf('•') === -1) { var s = getSettings(); s.apiKey = keyEl.value.trim(); setSettings(s); pollOnce(); } };
    var pollEl = body.querySelector('#stk-poll');
    if (pollEl) pollEl.onchange = function () { var s = getSettings(); s.pollSeconds = Math.max(10, parseInt(pollEl.value, 10) || 30); setSettings(s); restartPolling(); };
    var soundEl = body.querySelector('#stk-sound');
    if (soundEl) soundEl.onchange = function () { var s = getSettings(); s.soundType = soundEl.value; s.sound = soundEl.value !== 'off'; setSettings(s); playSound(soundEl.value); };
    var notifEl = body.querySelector('#stk-enable-notif');
    if (notifEl) notifEl.onclick = function () {
      try {
        if (typeof Notification !== 'undefined' && Notification.requestPermission) { Notification.requestPermission().then(function () { renderPanel(); }); }
      } catch (_) {}
    };
    var testEl = body.querySelector('#stk-test');
    if (testEl) testEl.onclick = function () {
      var fire = function () { notify('Stakeout test notification ✅ — if this also shows as a system notification (not just this toast), alerts will work.', 'https://www.torn.com'); };
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default' && Notification.requestPermission) { Notification.requestPermission().then(fire); return; }
      } catch (_) {}
      fire();
    };
    body.querySelectorAll('.stk-watch-x').forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var id = parseInt(a.getAttribute('data-id'), 10); if (a.getAttribute('data-wx') === 'p') removePlayer(id); else removeFaction(id); };
    });
    body.querySelectorAll('.stk-watch-item > a[href]').forEach(function (a) { a.addEventListener('click', function (e) { e.stopPropagation(); }); });
  }

  function currentProfileXid() {
    if (!/profiles\.php/i.test(location.pathname)) return null;
    var m = location.search.match(/[?&]XID=(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }
  function currentFactionId() {
    var m = location.search.match(/[?&]ID=(\d+)/i);
    return (/factions\.php/i.test(location.pathname) && /step=profile/i.test(location.href) && m) ? parseInt(m[1], 10) : null;
  }
  function injectStakeoutSection() {
    injectStyles();
    var xid = currentProfileXid(), fid = currentFactionId();
    if (!xid && !fid) return;
    var target = xid ? ('p' + xid) : ('f' + fid);
    var existing = document.getElementById('stk-section');
    if (existing) {
      if (existing.getAttribute('data-target') === target) return;
      existing.remove();
    }
    var anchor = document.querySelector('.content-title, [class*="titleContainer"], h4');
    if (!anchor || !anchor.parentNode) return;
    var wrap = document.createElement('div');
    wrap.id = 'stk-section';
    wrap.className = 'stk-sec-wrap';
    wrap.setAttribute('data-target', target);
    if (getSettings().sectionCollapsed) wrap.classList.add('stk-collapsed');
    wrap.innerHTML = '<div class="stk-sec-head"><span>' + (xid ? 'Player' : 'Faction') + ' Stakeout</span><span class="stk-chev">▼</span></div><div class="stk-sec-body" id="stk-body"></div>';
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    wrap.querySelector('.stk-sec-head').onclick = function () {
      wrap.classList.toggle('stk-collapsed');
      var st = getSettings(); st.sectionCollapsed = wrap.classList.contains('stk-collapsed'); setSettings(st);
    };
    renderPanel();
    requestWebNotifPermission();
  }

  function boot() {
    injectStyles();
    injectStakeoutSection();
    restartPolling();
    pollOnce();
    var mo = new MutationObserver(function () { injectStakeoutSection(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
