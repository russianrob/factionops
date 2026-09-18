/**
 * Socket.IO event handlers for real-time war coordination.
 */

import * as store from "./store.js";
import { fetchFactionMembers } from "./torn-api.js";

const CALL_EXPIRE_MS = parseInt(process.env.CALL_EXPIRE_MS, 10) || 20 * 60 * 1000; // 20 minutes
const SOFT_UNCALL_MS = 30_000; // 30 seconds after hospital detection
const REFRESH_COOLDOWN_MS = 30_000; // 30 seconds between refreshes per war

/** Track call expiry timers so they can be cancelled. */
const callTimers = new Map(); // `${warId}:${targetId}` → timeoutId

/** Track last refresh timestamp per warId. */
const refreshCooldowns = new Map(); // warId → timestamp

/**
 * Register all Socket.IO event handlers for a connected socket.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export function registerSocketHandlers(io, socket) {
  const user = socket.user; // set by auth middleware: { playerId, playerName, factionId, factionName }

  // ── join_war ────────────────────────────────────────────────────────

  socket.on("join_war", ({ warId, factionId, enemyFactionId }) => {
    if (!warId || !factionId) {
      return socket.emit("error", { message: "warId and factionId are required" });
    }

    const room = `war_${warId}`;
    socket.join(room);

    // Track the player
    store.setPlayer(user.playerId, {
      socketId: socket.id,
      factionId,
      warId,
      name: user.playerName,
    });

    // Ensure war exists
    const war = store.getOrCreateWar(warId, factionId, enemyFactionId || null);

    console.log(`[ws] ${user.playerName} joined war room ${room}`);

    // Send current war state to the joining player
    socket.emit("war_state", {
      warId: war.warId,
      factionId: war.factionId,
      enemyFactionId: war.enemyFactionId,
      enemyFactionName: war.enemyFactionName || null,
      calls: war.calls,
      priorities: war.priorities,
      enemyStatuses: war.enemyStatuses,
      chainData: war.chainData,
      onlinePlayers: store.getOnlinePlayersForWar(warId),
      viewers: store.getViewersForWar(warId),
      ourFactionOnline: war.ourFactionOnline || null,
      warTarget: war.warTarget || null,
      warScores: war.warScores || null,
      warEta: war.warEta || null,
      warEnded: war.warEnded || false,
      warResult: war.warResult || null,
      strategy: war.strategy || null,
      enemyActivityByHour: war.enemyActivityByHour || null,
    });
  });

  // ── call_target ─────────────────────────────────────────────────────

  socket.on("call_target", ({ targetId, targetName }) => {
    if (!targetId) {
      return socket.emit("error", { message: "targetId is required" });
    }

    const player = store.getPlayer(user.playerId);
    if (!player?.warId) {
      return socket.emit("error", { message: "You must join a war first" });
    }

    const war = store.getWar(player.warId);
    if (!war) return;

    // Check if target is already called
    if (war.calls[targetId]) {
      return socket.emit("error", {
        message: `Target ${targetId} is already called by ${war.calls[targetId].calledBy.name}`,
      });
    }

    // Register the call
    const callData = {
      calledBy: { id: user.playerId, name: user.playerName },
      timestamp: Date.now(),
    };
    war.calls[targetId] = callData;
    store.saveState();

    const room = `war_${player.warId}`;
    io.to(room).emit("target_called", {
      targetId,
      targetName: targetName || targetId,
      calledBy: callData.calledBy,
      timestamp: callData.timestamp,
    });

    // Set auto-expire timer — extend if target is in hospital
    const timerKey = `${player.warId}:${targetId}`;
    clearExistingTimer(timerKey);
    let expireMs = CALL_EXPIRE_MS;
    const targetStatus = war.enemyStatuses[targetId];
    if (targetStatus && targetStatus.status && targetStatus.status.toLowerCase().includes('hospital') && targetStatus.until > 0) {
      const hospRemainingMs = (targetStatus.until - Math.floor(Date.now() / 1000)) * 1000;
      if (hospRemainingMs > 0) {
        expireMs = hospRemainingMs + CALL_EXPIRE_MS;
        console.log(`[ws] Target ${targetId} in hospital — call expires in ${Math.round(expireMs / 1000)}s (hosp ${Math.round(hospRemainingMs / 1000)}s + ${CALL_EXPIRE_MS / 1000}s)`);
      }
    }
    callTimers.set(
      timerKey,
      setTimeout(() => {
        uncallTarget(io, player.warId, targetId, "expired");
      }, expireMs),
    );

    console.log(`[ws] ${user.playerName} called target ${targetId} in war ${player.warId}`);
  });

  // ── uncall_target ───────────────────────────────────────────────────

  socket.on("uncall_target", ({ targetId }) => {
    if (!targetId) {
      return socket.emit("error", { message: "targetId is required" });
    }

    const player = store.getPlayer(user.playerId);
    if (!player?.warId) return;

    const war = store.getWar(player.warId);
    if (!war) return;

    // Only the caller can uncall (or the system via auto-expire)
    const call = war.calls[targetId];
    if (!call) return;
    if (call.calledBy.id !== user.playerId) {
      return socket.emit("error", { message: "Only the caller can uncall this target" });
    }

    uncallTarget(io, player.warId, targetId, "manual");
    console.log(`[ws] ${user.playerName} uncalled target ${targetId}`);
  });

  // ── update_status ───────────────────────────────────────────────────

  socket.on("update_status", ({ targetId, status, until }) => {
    if (!targetId || !status) {
      return socket.emit("error", { message: "targetId and status are required" });
    }

    const player = store.getPlayer(user.playerId);
    if (!player?.warId) return;

    const war = store.getWar(player.warId);
    if (!war) return;

    // Merge with existing data (preserve name/level if already known)
    const existing = war.enemyStatuses[targetId] || {};
    war.enemyStatuses[targetId] = {
      ...existing,
      status,
      until: until ?? existing.until ?? 0,
    };
    store.saveState();

    io.to(`war_${player.warId}`).emit("status_updated", {
      targetId,
      status,
      until: until ?? 0,
      updatedBy: { id: user.playerId, name: user.playerName },
    });

    // 2026-05-16: soft-uncall-on-hospital removed (matches routes.js).
    // Was silently clearing calls 30s after ANY hospital transition,
    // even when an enemy hospitalized the called target. Result: a
    // second player could re-call the target with no 409, looking
    // like a call was stolen. attacks-feed auto-uncall handles the
    // genuine 'caller landed the hit' case (war-status-monitor.js
    // line 425+) with a log line; everything else falls back to the
    // 5-min server expiry.
  });

  // ── refresh_statuses ────────────────────────────────────────────────

  socket.on("refresh_statuses", async ({ factionId }) => {
    const player = store.getPlayer(user.playerId);
    if (!player?.warId) return;

    const war = store.getWar(player.warId);
    if (!war || !war.enemyFactionId) {
      return socket.emit("error", { message: "No enemy faction configured for this war" });
    }

    // Rate limit: max 1 refresh per 30s per war room
    const now = Date.now();
    const lastRefresh = refreshCooldowns.get(player.warId) || 0;
    if (now - lastRefresh < REFRESH_COOLDOWN_MS) {
      const waitSec = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefresh)) / 1000);
      return socket.emit("error", { message: `Please wait ${waitSec}s before refreshing again` });
    }
    refreshCooldowns.set(player.warId, now);

    // Get an API key
    const apiKey = store.getApiKeyForFaction(factionId || war.factionId);
    if (!apiKey) {
      return socket.emit("error", { message: "No API key available for status refresh" });
    }

    try {
      const statuses = await fetchFactionMembers(war.enemyFactionId, apiKey);
      war.enemyStatuses = statuses;
      store.saveState();

      io.to(`war_${player.warId}`).emit("statuses_refreshed", { statuses });
      console.log(`[ws] Statuses refreshed for war ${player.warId} (${Object.keys(statuses).length} members)`);
    } catch (err) {
      console.error("[ws] Status refresh failed:", err.message);
      socket.emit("error", { message: `Status refresh failed: ${err.message}` });
    }
  });

  // ── disconnect ──────────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    // Remove from online players but do NOT auto-uncall (they might reconnect)
    const removed = store.removePlayerBySocket(socket.id);
    if (removed) {
      console.log(`[ws] ${removed.name} disconnected (${reason})`);
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function clearExistingTimer(timerKey) {
  if (callTimers.has(timerKey)) {
    clearTimeout(callTimers.get(timerKey));
    callTimers.delete(timerKey);
  }
}

function uncallTarget(io, warId, targetId, reason) {
  const war = store.getWar(warId);
  if (!war || !war.calls[targetId]) return;

  const caller = war.calls[targetId].calledBy || {};
  delete war.calls[targetId];
  store.saveState();

  const timerKey = `${warId}:${targetId}`;
  clearExistingTimer(timerKey);

  io.to(`war_${warId}`).emit("target_uncalled", { targetId, reason });
  // 2026-05-16: log every server-side uncall so we can trace 'where
  // did my call go?' reports. The silent variant of this fn caused
  // exactly that diagnostic black hole.
  console.log(`[socket-uncall] cleared ${targetId} (was ${caller.name || '?'}, reason=${reason})`);
}
