// ==UserScript==
// @name         Stakeout
// @namespace    RussianRob
// @version      1.0.0
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
  var SCRIPT_VERSION = '1.0.0';

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
    return {
      name: j.name,
      state: j.status ? j.status.state : '',
      description: j.status ? (j.status.description || '') : '',
      lastAction: j.last_action ? j.last_action.status : '',
      lastActionTs: j.last_action ? j.last_action.timestamp : 0,
      lifeCur: j.life ? j.life.current : 0,
      lifeMax: j.life ? j.life.maximum : 0,
      revivable: !!j.revivable
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
  var DEFAULT_SETTINGS = { apiKey: '', pollSeconds: 30, sound: true, panelOpen: false, panelPos: null };

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

})();
