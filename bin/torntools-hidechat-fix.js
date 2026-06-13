/* warboard fix for TornTools "Hide Chat" re-tick. TornTools' in-page hide-chat
   checkbox calls hideChats(), which adds the `tt-chat-hidden` class only
   `if (settings.pages.chat.hideChat)` — read BEFORE its own write saves the new
   value. So re-ticking reads a stale value and fails to re-hide (untick works
   because showChats() removes unconditionally). Our runtime now delivers
   storage.onChanged, so we sync the class to the SAVED value on the change
   instead. Robust: keys on the storage payload + the stable `tt-chat-hidden`
   class, not on TornTools' minified internals. Appended to extension.js (runs in
   the TornTools content world, after the browser shim). */
(function () {
  try {
    var b = (typeof browser !== "undefined" && browser) || (typeof chrome !== "undefined" && chrome);
    if (!b || !b.storage || !b.storage.onChanged || !b.storage.onChanged.addListener) return;
    function hideVal(s) {
      return s && s.pages && s.pages.chat ? s.pages.chat.hideChat : undefined;
    }
    b.storage.onChanged.addListener(function (changes) {
      if (!changes) return;
      for (var key in changes) {
        var ch = changes[key];
        var nv = hideVal(ch && ch.newValue);
        if (nv === undefined) continue;
        if (nv === hideVal(ch && ch.oldValue)) continue; // only act on actual hideChat changes
        document.documentElement.classList.toggle("tt-chat-hidden", !!nv);
        return;
      }
    });
  } catch (e) {
    try { console.log("[warboard] hide-chat fix error", e); } catch (_) {}
  }
})();
