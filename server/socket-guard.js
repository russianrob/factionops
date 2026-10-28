/**
 * Socket.IO hands each message to its listener on a later tick, outside any
 * try/catch, so a listener that throws (an empty message unpacked as an
 * object, say) or returns a promise that rejects takes the whole server down,
 * and every connection with it. guardSocket makes each listener this
 * connection adds after it log the failure and drop that one message instead.
 * A connection whose messages keep failing goes quiet after `quietAfter` lines.
 *
 * socket.off with the original listener would not find the wrapped one;
 * nothing in the server removes socket listeners.
 */
export function guardSocket(socket, { log = console.error, quietAfter = 5 } = {}) {
  const on = socket.on.bind(socket);
  let failures = 0;
  const failed = (event, err) => {
    failures++;
    const who = `${socket.user?.playerName} (${socket.user?.playerId})`;
    if (failures <= quietAfter) log(`[ws] ${event} from ${who} failed: ${err?.message || err}`);
    else if (failures === quietAfter + 1) log(`[ws] ${who}: more failed messages, no more logged for this connection`);
  };
  socket.on = (event, listener) => on(event, function (...args) {
    try {
      const result = listener.apply(this, args);
      if (result && typeof result.then === "function") result.then(undefined, (err) => failed(event, err));
      return result;
    } catch (err) {
      failed(event, err);
    }
  });
  return socket;
}
