// ==UserScript==
// @name         CommandCenter - Faction War Coordinator
// @namespace    https://tornwar.com
// @version      4.9.28
// @description  Real-time faction war coordination tool for Torn.com (CommandCenter build).
// @author       RussianRob
// @copyright    2024-2026, RussianRob (https://tornwar.com)
// @license      MIT (code) — FactionOps™ / CommandCenter™ names are unregistered trademarks of RussianRob; brand use requires permission
// @downloadURL  https://tornwar.com/scripts/commandcenter.user.js
// @updateURL    https://tornwar.com/scripts/commandcenter.meta.js
// @require      https://tornwar.com/socket.io/socket.io.js
// @match        https://www.torn.com/factions.php?step=your*
// @match        https://www.torn.com/factions.php?step=profile*
// @match        https://www.torn.com/loader.php?sid=attack*
// @match        https://torn.com/loader.php?sid=attack*
// @match        https://www.torn.com/page.php?sid=attack*
// @match        https://torn.com/page.php?sid=attack*
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://torn.com/profiles.php?XID=*
// @match        https://www.torn.com/war.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      tornwar.com
// @connect      localhost
// @connect      *
// @run-at       document-idle
// ==/UserScript==

// ── Bundled Socket.IO Client v4.8.4 (MIT) ──────────────────────────────
// Embedded inline for Torn PDA compatibility (PDA does not support @require).
/* SOCKET_IO_START */
/*!
 * Socket.IO v4.8.4
 * (c) 2014-2025 Guillermo Rauch
 * Released under the MIT License.
 */
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):(t="undefined"!=typeof globalThis?globalThis:t||self).io=n()}(this,(function(){"use strict";function t(t,n){(null==n||n>t.length)&&(n=t.length);for(var i=0,r=Array(n);i<n;i++)r[i]=t[i];return r}function n(t,n){for(var i=0;i<n.length;i++){var r=n[i];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,f(r.key),r)}}function i(t,i,r){return i&&n(t.prototype,i),r&&n(t,r),Object.defineProperty(t,"prototype",{writable:!1}),t}function r(n,i){var r="undefined"!=typeof Symbol&&n[Symbol.iterator]||n["@@iterator"];if(!r){if(Array.isArray(n)||(r=function(n,i){if(n){if("string"==typeof n)return t(n,i);var r={}.toString.call(n).slice(8,-1);return"Object"===r&&n.constructor&&(r=n.constructor.name),"Map"===r||"Set"===r?Array.from(n):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?t(n,i):void 0}}(n))||i&&n&&"number"==typeof n.length){r&&(n=r);var e=0,o=function(){};return{s:o,n:function(){return e>=n.length?{done:!0}:{done:!1,value:n[e++]}},e:function(t){throw t},f:o}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var s,u=!0,h=!1;return{s:function(){r=r.call(n)},n:function(){var t=r.next();return u=t.done,t},e:function(t){h=!0,s=t},f:function(){try{u||null==r.return||r.return()}finally{if(h)throw s}}}}function e(){return e=Object.assign?Object.assign.bind():function(t){for(var n=1;n<arguments.length;n++){var i=arguments[n];for(var r in i)({}).hasOwnProperty.call(i,r)&&(t[r]=i[r])}return t},e.apply(null,arguments)}function o(t){return o=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},o(t)}function s(t,n){t.prototype=Object.create(n.prototype),t.prototype.constructor=t,h(t,n)}function u(){try{var t=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(t){}return(u=function(){return!!t})()}function h(t,n){return h=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,n){return t.__proto__=n,t},h(t,n)}function f(t){var n=function(t,n){if("object"!=typeof t||!t)return t;var i=t[Symbol.toPrimitive];if(void 0!==i){var r=i.call(t,n||"default");if("object"!=typeof r)return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===n?String:Number)(t)}(t,"string");return"symbol"==typeof n?n:n+""}function c(t){return c="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},c(t)}function a(t){var n="function"==typeof Map?new Map:void 0;return a=function(t){if(null===t||!function(t){try{return-1!==Function.toString.call(t).indexOf("[native code]")}catch(n){return"function"==typeof t}}(t))return t;if("function"!=typeof t)throw new TypeError("Super expression must either be null or a function");if(void 0!==n){if(n.has(t))return n.get(t);n.set(t,i)}function i(){return function(t,n,i){if(u())return Reflect.construct.apply(null,arguments);var r=[null];r.push.apply(r,n);var e=new(t.bind.apply(t,r));return i&&h(e,i.prototype),e}(t,arguments,o(this).constructor)}return i.prototype=Object.create(t.prototype,{constructor:{value:i,enumerable:!1,writable:!0,configurable:!0}}),h(i,t)},a(t)}var v=Object.create(null);v.open="0",v.close="1",v.ping="2",v.pong="3",v.message="4",v.upgrade="5",v.noop="6";var l=Object.create(null);Object.keys(v).forEach((function(t){l[v[t]]=t}));var p,d={type:"error",data:"parser error"},y="function"==typeof Blob||"undefined"!=typeof Blob&&"[object BlobConstructor]"===Object.prototype.toString.call(Blob),b="function"==typeof ArrayBuffer,w=function(t){return"function"==typeof ArrayBuffer.isView?ArrayBuffer.isView(t):t&&t.buffer instanceof ArrayBuffer},g=function(t,n,i){var r=t.type,e=t.data;return y&&e instanceof Blob?n?i(e):m(e,i):b&&(e instanceof ArrayBuffer||w(e))?n?i(e):m(new Blob([e]),i):i(v[r]+(e||""))},m=function(t,n){var i=new FileReader;return i.onload=function(){var t=i.result.split(",")[1];n("b"+(t||""))},i.readAsDataURL(t)};function k(t){return t instanceof Uint8Array?t:t instanceof ArrayBuffer?new Uint8Array(t):new Uint8Array(t.buffer,t.byteOffset,t.byteLength)}for(var A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01234.8.49+/",j="undefined"==typeof Uint8Array?[]:new Uint8Array(256),E=0;E<64;E++)j[A.charCodeAt(E)]=E;var O,B="function"==typeof ArrayBuffer,S=function(t,n){if("string"!=typeof t)return{type:"message",data:C(t,n)};var i=t.charAt(0);return"b"===i?{type:"message",data:N(t.substring(1),n)}:l[i]?t.length>1?{type:l[i],data:t.substring(1)}:{type:l[i]}:d},N=function(t,n){if(B){var i=function(t){var n,i,r,e,o,s=.75*t.length,u=t.length,h=0;"="===t[t.length-1]&&(s--,"="===t[t.length-2]&&s--);var f=new ArrayBuffer(s),c=new Uint8Array(f);for(n=0;n<u;n+=4)i=j[t.charCodeAt(n)],r=j[t.charCodeAt(n+1)],e=j[t.charCodeAt(n+2)],o=j[t.charCodeAt(n+3)],c[h++]=i<<2|r>>4,c[h++]=(15&r)<<4|e>>2,c[h++]=(3&e)<<6|63&o;return f}(t);return C(i,n)}return{base64:!0,data:t}},C=function(t,n){return"blob"===n?t instanceof Blob?t:new Blob([t]):t instanceof ArrayBuffer?t:t.buffer},T=String.fromCharCode(30);function U(){return new TransformStream({transform:function(t,n){!function(t,n){y&&t.data instanceof Blob?t.data.arrayBuffer().then(k).then(n):b&&(t.data instanceof ArrayBuffer||w(t.data))?n(k(t.data)):g(t,!1,(function(t){p||(p=new TextEncoder),n(p.encode(t))}))}(t,(function(i){var r,e=i.length;if(e<126)r=new Uint8Array(1),new DataView(r.buffer).setUint8(0,e);else if(e<65536){r=new Uint8Array(3);var o=new DataView(r.buffer);o.setUint8(0,126),o.setUint16(1,e)}else{r=new Uint8Array(9);var s=new DataView(r.buffer);s.setUint8(0,127),s.setBigUint64(1,BigInt(e))}t.data&&"string"!=typeof t.data&&(r[0]|=128),n.enqueue(r),n.enqueue(i)}))}})}function M(t){return t.reduce((function(t,n){return t+n.length}),0)}function x(t,n){if(t[0].length===n)return t.shift();for(var i=new Uint8Array(n),r=0,e=0;e<n;e++)i[e]=t[0][r++],r===t[0].length&&(t.shift(),r=0);return t.length&&r<t[0].length&&(t[0]=t[0].slice(r)),i}function I(t){if(t)return function(t){for(var n in I.prototype)t[n]=I.prototype[n];return t}(t)}I.prototype.on=I.prototype.addEventListener=function(t,n){return this.t=this.t||{},(this.t["$"+t]=this.t["$"+t]||[]).push(n),this},I.prototype.once=function(t,n){function i(){this.off(t,i),n.apply(this,arguments)}return i.fn=n,this.on(t,i),this},I.prototype.off=I.prototype.removeListener=I.prototype.removeAllListeners=I.prototype.removeEventListener=function(t,n){if(this.t=this.t||{},0==arguments.length)return this.t={},this;var i,r=this.t["$"+t];if(!r)return this;if(1==arguments.length)return delete this.t["$"+t],this;for(var e=0;e<r.length;e++)if((i=r[e])===n||i.fn===n){r.splice(e,1);break}return 0===r.length&&delete this.t["$"+t],this},I.prototype.emit=function(t){this.t=this.t||{};for(var n=new Array(arguments.length-1),i=this.t["$"+t],r=1;r<arguments.length;r++)n[r-1]=arguments[r];if(i){r=0;for(var e=(i=i.slice(0)).length;r<e;++r)i[r].apply(this,n)}return this},I.prototype.emitReserved=I.prototype.emit,I.prototype.listeners=function(t){return this.t=this.t||{},this.t["$"+t]||[]},I.prototype.hasListeners=function(t){return!!this.listeners(t).length};var R="function"==typeof Promise&&"function"==typeof Promise.resolve?function(t){return Promise.resolve().then(t)}:function(t,n){return n(t,0)},L="undefined"!=typeof self?self:"undefined"!=typeof window?window:Function("return this")();function _(t){for(var n=arguments.length,i=new Array(n>1?n-1:0),r=1;r<n;r++)i[r-1]=arguments[r];return i.reduce((function(n,i){return t.hasOwnProperty(i)&&(n[i]=t[i]),n}),{})}var D=L.setTimeout,P=L.clearTimeout;function $(t,n){n.useNativeTimers?(t.setTimeoutFn=D.bind(L),t.clearTimeoutFn=P.bind(L)):(t.setTimeoutFn=L.setTimeout.bind(L),t.clearTimeoutFn=L.clearTimeout.bind(L))}function F(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}var V=function(t){function n(n,i,r){var e;return(e=t.call(this,n)||this).description=i,e.context=r,e.type="TransportError",e}return s(n,t),n}(a(Error)),q=function(t){function n(n){var i;return(i=t.call(this)||this).writable=!1,$(i,n),i.opts=n,i.query=n.query,i.socket=n.socket,i.supportsBinary=!n.forceBase64,i}s(n,t);var i=n.prototype;return i.onError=function(n,i,r){return t.prototype.emitReserved.call(this,"error",new V(n,i,r)),this},i.open=function(){return this.readyState="opening",this.doOpen(),this},i.close=function(){return"opening"!==this.readyState&&"open"!==this.readyState||(this.doClose(),this.onClose()),this},i.send=function(t){"open"===this.readyState&&this.write(t)},i.onOpen=function(){this.readyState="open",this.writable=!0,t.prototype.emitReserved.call(this,"open")},i.onData=function(t){var n=S(t,this.socket.binaryType);this.onPacket(n)},i.onPacket=function(n){t.prototype.emitReserved.call(this,"packet",n)},i.onClose=function(n){this.readyState="closed",t.prototype.emitReserved.call(this,"close",n)},i.pause=function(t){},i.createUri=function(t){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return t+"://"+this.i()+this.o()+this.opts.path+this.u(n)},i.i=function(){var t=this.opts.hostname;return-1===t.indexOf(":")?t:"["+t+"]"},i.o=function(){return this.opts.port&&(this.opts.secure&&443!==Number(this.opts.port)||!this.opts.secure&&80!==Number(this.opts.port))?":"+this.opts.port:""},i.u=function(t){var n=function(t){var n="";for(var i in t)t.hasOwnProperty(i)&&(n.length&&(n+="&"),n+=encodeURIComponent(i)+"="+encodeURIComponent(t[i]));return n}(t);return n.length?"?"+n:""},n}(I),X=function(t){function n(){var n;return(n=t.apply(this,arguments)||this).h=!1,n}s(n,t);var r=n.prototype;return r.doOpen=function(){this.v()},r.pause=function(t){var n=this;this.readyState="pausing";var i=function(){n.readyState="paused",t()};if(this.h||!this.writable){var r=0;this.h&&(r++,this.once("pollComplete",(function(){--r||i()}))),this.writable||(r++,this.once("drain",(function(){--r||i()})))}else i()},r.v=function(){this.h=!0,this.doPoll(),this.emitReserved("poll")},r.onData=function(t){var n=this;(function(t,n){for(var i=t.split(T),r=[],e=0;e<i.length;e++){var o=S(i[e],n);if(r.push(o),"error"===o.type)break}return r})(t,this.socket.binaryType).forEach((function(t){if("opening"===n.readyState&&"open"===t.type&&n.onOpen(),"close"===t.type)return n.onClose({description:"transport closed by the server"}),!1;n.onPacket(t)})),"closed"!==this.readyState&&(this.h=!1,this.emitReserved("pollComplete"),"open"===this.readyState&&this.v())},r.doClose=function(){var t=this,n=function(){t.write([{type:"close"}])};"open"===this.readyState?n():this.once("open",n)},r.write=function(t){var n=this;this.writable=!1,function(t,n){var i=t.length,r=new Array(i),e=0;t.forEach((function(t,o){g(t,!1,(function(t){r[o]=t,++e===i&&n(r.join(T))}))}))}(t,(function(t){n.doWrite(t,(function(){n.writable=!0,n.emitReserved("drain")}))}))},r.uri=function(){var t=this.opts.secure?"https":"http",n=this.query||{};return!1!==this.opts.timestampRequests&&(n[this.opts.timestampParam]=F()),this.supportsBinary||n.sid||(n.b64=1),this.createUri(t,n)},i(n,[{key:"name",get:function(){return"polling"}}])}(q),H=!1;try{H="undefined"!=typeof XMLHttpRequest&&"withCredentials"in new XMLHttpRequest}catch(t){}var z=H;function J(){}var K=function(t){function n(n){var i;if(i=t.call(this,n)||this,"undefined"!=typeof location){var r="https:"===location.protocol,e=location.port;e||(e=r?"443":"80"),i.xd="undefined"!=typeof location&&n.hostname!==location.hostname||e!==n.port}return i}s(n,t);var i=n.prototype;return i.doWrite=function(t,n){var i=this,r=this.request({method:"POST",data:t});r.on("success",n),r.on("error",(function(t,n){i.onError("xhr post error",t,n)}))},i.doPoll=function(){var t=this,n=this.request();n.on("data",this.onData.bind(this)),n.on("error",(function(n,i){t.onError("xhr poll error",n,i)})),this.pollXhr=n},n}(X),Y=function(t){function n(n,i,r){var e;return(e=t.call(this)||this).createRequest=n,$(e,r),e.l=r,e.p=r.method||"GET",e.m=i,e.k=void 0!==r.data?r.data:null,e.A(),e}s(n,t);var i=n.prototype;return i.A=function(){var t,i=this,r=_(this.l,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");r.xdomain=!!this.l.xd;var e=this.j=this.createRequest(r);try{e.open(this.p,this.m,!0);try{if(this.l.extraHeaders)for(var o in e.setDisableHeaderCheck&&e.setDisableHeaderCheck(!0),this.l.extraHeaders)this.l.extraHeaders.hasOwnProperty(o)&&e.setRequestHeader(o,this.l.extraHeaders[o])}catch(t){}if("POST"===this.p)try{e.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(t){}try{e.setRequestHeader("Accept","*/*")}catch(t){}null===(t=this.l.cookieJar)||void 0===t||t.addCookies(e),"withCredentials"in e&&(e.withCredentials=this.l.withCredentials),this.l.requestTimeout&&(e.timeout=this.l.requestTimeout),e.onreadystatechange=function(){var t;3===e.readyState&&(null===(t=i.l.cookieJar)||void 0===t||t.parseCookies(e.getResponseHeader("set-cookie"))),4===e.readyState&&(200===e.status||1223===e.status?i.O():i.setTimeoutFn((function(){i.B("number"==typeof e.status?e.status:0)}),0))},e.send(this.k)}catch(t){return void this.setTimeoutFn((function(){i.B(t)}),0)}"undefined"!=typeof document&&(this.S=n.requestsCount++,n.requests[this.S]=this)},i.B=function(t){this.emitReserved("error",t,this.j),this.N(!0)},i.N=function(t){if(void 0!==this.j&&null!==this.j){if(this.j.onreadystatechange=J,t)try{this.j.abort()}catch(t){}"undefined"!=typeof document&&delete n.requests[this.S],this.j=null}},i.O=function(){var t=this.j.responseText;null!==t&&(this.emitReserved("data",t),this.emitReserved("success"),this.N())},i.abort=function(){this.N()},n}(I);if(Y.requestsCount=0,Y.requests={},"undefined"!=typeof document)if("function"==typeof attachEvent)attachEvent("onunload",G);else if("function"==typeof addEventListener){addEventListener("onpagehide"in L?"pagehide":"unload",G,!1)}function G(){for(var t in Y.requests)Y.requests.hasOwnProperty(t)&&Y.requests[t].abort()}var Q,W=(Q=tt({xdomain:!1}))&&null!==Q.responseType,Z=function(t){function n(n){var i;i=t.call(this,n)||this;var r=n&&n.forceBase64;return i.supportsBinary=W&&!r,i}return s(n,t),n.prototype.request=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return e(t,{xd:this.xd},this.opts),new Y(tt,this.uri(),t)},n}(K);function tt(t){var n=t.xdomain;try{if("undefined"!=typeof XMLHttpRequest&&(!n||z))return new XMLHttpRequest}catch(t){}if(!n)try{return new(L[["Active"].concat("Object").join("X")])("Microsoft.XMLHTTP")}catch(t){}}var nt="undefined"!=typeof navigator&&"string"==typeof navigator.product&&"reactnative"===navigator.product.toLowerCase(),it=function(t){function n(){return t.apply(this,arguments)||this}s(n,t);var r=n.prototype;return r.doOpen=function(){var t=this.uri(),n=this.opts.protocols,i=nt?{}:_(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(t,n,i)}catch(t){return this.emitReserved("error",t)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()},r.addEventListeners=function(){var t=this;this.ws.onopen=function(){t.opts.autoUnref&&t.ws.C.unref(),t.onOpen()},this.ws.onclose=function(n){return t.onClose({description:"websocket connection closed",context:n})},this.ws.onmessage=function(n){return t.onData(n.data)},this.ws.onerror=function(n){return t.onError("websocket error",n)}},r.write=function(t){var n=this;this.writable=!1;for(var i=function(){var i=t[r],e=r===t.length-1;g(i,n.supportsBinary,(function(t){try{n.doWrite(i,t)}catch(t){}e&&R((function(){n.writable=!0,n.emitReserved("drain")}),n.setTimeoutFn)}))},r=0;r<t.length;r++)i()},r.doClose=function(){void 0!==this.ws&&(this.ws.onerror=function(){},this.ws.close(),this.ws=null)},r.uri=function(){var t=this.opts.secure?"wss":"ws",n=this.query||{};return this.opts.timestampRequests&&(n[this.opts.timestampParam]=F()),this.supportsBinary||(n.b64=1),this.createUri(t,n)},i(n,[{key:"name",get:function(){return"websocket"}}])}(q),rt=L.WebSocket||L.MozWebSocket,et=function(t){function n(){return t.apply(this,arguments)||this}s(n,t);var i=n.prototype;return i.createSocket=function(t,n,i){return nt?new rt(t,n,i):n?new rt(t,n):new rt(t)},i.doWrite=function(t,n){this.ws.send(n)},n}(it),ot=function(t){function n(){return t.apply(this,arguments)||this}s(n,t);var r=n.prototype;return r.doOpen=function(){var t=this;try{this.T=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(t){return this.emitReserved("error",t)}this.T.closed.then((function(){t.onClose()})).catch((function(n){t.onError("webtransport error",n)})),this.T.ready.then((function(){t.T.createBidirectionalStream().then((function(n){var i=function(t,n){O||(O=new TextDecoder);var i=[],r=0,e=-1,o=!1;return new TransformStream({transform:function(s,u){for(i.push(s);;){if(0===r){if(M(i)<1)break;var h=x(i,1);o=!(128&~h[0]),e=127&h[0],r=e<126?3:126===e?1:2}else if(1===r){if(M(i)<2)break;var f=x(i,2);e=new DataView(f.buffer,f.byteOffset,f.length).getUint16(0),r=3}else if(2===r){if(M(i)<8)break;var c=x(i,8),a=new DataView(c.buffer,c.byteOffset,c.length),v=a.getUint32(0);if(v>Math.pow(2,21)-1){u.enqueue(d);break}e=v*Math.pow(2,32)+a.getUint32(4),r=3}else{if(M(i)<e)break;var l=x(i,e);u.enqueue(S(o?l:O.decode(l),n)),r=0}if(0===e||e>t){u.enqueue(d);break}}}})}(Number.MAX_SAFE_INTEGER,t.socket.binaryType),r=n.readable.pipeThrough(i).getReader(),e=U();e.readable.pipeTo(n.writable),t.U=e.writable.getWriter();!function n(){r.read().then((function(i){var r=i.done,e=i.value;r||(t.onPacket(e),n())})).catch((function(t){}))}();var o={type:"open"};t.query.sid&&(o.data='{"sid":"'.concat(t.query.sid,'"}')),t.U.write(o).then((function(){return t.onOpen()}))}))}))},r.write=function(t){var n=this;this.writable=!1;for(var i=function(){var i=t[r],e=r===t.length-1;n.U.write(i).then((function(){e&&R((function(){n.writable=!0,n.emitReserved("drain")}),n.setTimeoutFn)}))},r=0;r<t.length;r++)i()},r.doClose=function(){var t;null===(t=this.T)||void 0===t||t.close()},i(n,[{key:"name",get:function(){return"webtransport"}}])}(q),st={websocket:et,webtransport:ot,polling:Z},ut=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,ht=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function ft(t){if(t.length>8e3)throw"URI too long";var n=t,i=t.indexOf("["),r=t.indexOf("]");-1!=i&&-1!=r&&(t=t.substring(0,i)+t.substring(i,r).replace(/:/g,";")+t.substring(r,t.length));for(var e,o,s=ut.exec(t||""),u={},h=14;h--;)u[ht[h]]=s[h]||"";return-1!=i&&-1!=r&&(u.source=n,u.host=u.host.substring(1,u.host.length-1).replace(/;/g,":"),u.authority=u.authority.replace("[","").replace("]","").replace(/;/g,":"),u.ipv6uri=!0),u.pathNames=function(t,n){var i=/\/{2,9}/g,r=n.replace(i,"/").split("/");"/"!=n.slice(0,1)&&0!==n.length||r.splice(0,1);"/"==n.slice(-1)&&r.splice(r.length-1,1);return r}(0,u.path),u.queryKey=(e=u.query,o={},e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,(function(t,n,i){n&&(o[n]=i)})),o),u}var ct="function"==typeof addEventListener&&"function"==typeof removeEventListener,at=[];ct&&addEventListener("offline",(function(){at.forEach((function(t){return t()}))}),!1);var vt=function(t){function n(n,i){var r;if((r=t.call(this)||this).binaryType="arraybuffer",r.writeBuffer=[],r.M=0,r.I=-1,r.R=-1,r.L=-1,r._=1/0,n&&"object"===c(n)&&(i=n,n=null),n){var o=ft(n);i.hostname=o.host,i.secure="https"===o.protocol||"wss"===o.protocol,i.port=o.port,o.query&&(i.query=o.query)}else i.host&&(i.hostname=ft(i.host).host);return $(r,i),r.secure=null!=i.secure?i.secure:"undefined"!=typeof location&&"https:"===location.protocol,i.hostname&&!i.port&&(i.port=r.secure?"443":"80"),r.hostname=i.hostname||("undefined"!=typeof location?location.hostname:"localhost"),r.port=i.port||("undefined"!=typeof location&&location.port?location.port:r.secure?"443":"80"),r.transports=[],r.D={},i.transports.forEach((function(t){var n=t.prototype.name;r.transports.push(n),r.D[n]=t})),r.opts=e({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},i),r.opts.path=r.opts.path.replace(/\/$/,"")+(r.opts.addTrailingSlash?"/":""),"string"==typeof r.opts.query&&(r.opts.query=function(t){for(var n={},i=t.split("&"),r=0,e=i.length;r<e;r++){var o=i[r].split("=");n[decodeURIComponent(o[0])]=decodeURIComponent(o[1])}return n}(r.opts.query)),ct&&(r.opts.closeOnBeforeunload&&(r.P=function(){r.transport&&(r.transport.removeAllListeners(),r.transport.close())},addEventListener("beforeunload",r.P,!1)),"localhost"!==r.hostname&&(r.$=function(){r.F("transport close",{description:"network connection lost"})},at.push(r.$))),r.opts.withCredentials&&(r.V=void 0),r.q(),r}s(n,t);var i=n.prototype;return i.createTransport=function(t){var n=e({},this.opts.query);n.EIO=4,n.transport=t,this.id&&(n.sid=this.id);var i=e({},this.opts,{query:n,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[t]);return new this.D[t](i)},i.q=function(){var t=this;if(0!==this.transports.length){var i=this.opts.rememberUpgrade&&n.priorWebsocketSuccess&&-1!==this.transports.indexOf("websocket")?"websocket":this.transports[0];this.readyState="opening";var r=this.createTransport(i);r.open(),this.setTransport(r)}else this.setTimeoutFn((function(){t.emitReserved("error","No transports available")}),0)},i.setTransport=function(t){var n=this;this.transport&&this.transport.removeAllListeners(),this.transport=t,t.on("drain",this.X.bind(this)).on("packet",this.H.bind(this)).on("error",this.B.bind(this)).on("close",(function(t){return n.F("transport close",t)}))},i.onOpen=function(){this.readyState="open",n.priorWebsocketSuccess="websocket"===this.transport.name,this.emitReserved("open"),this.flush()},i.H=function(t){if("opening"===this.readyState||"open"===this.readyState||"closing"===this.readyState)switch(this.emitReserved("packet",t),this.emitReserved("heartbeat"),t.type){case"open":this.onHandshake(JSON.parse(t.data));break;case"ping":this.J("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this.K();break;case"error":var n=new Error("server error");n.code=t.data,this.B(n);break;case"message":this.emitReserved("data",t.data),this.emitReserved("message",t.data)}},i.onHandshake=function(t){this.emitReserved("handshake",t),this.id=t.sid,this.transport.query.sid=t.sid,this.I=t.pingInterval,this.R=t.pingTimeout,this.L=t.maxPayload,this.onOpen(),"closed"!==this.readyState&&this.K()},i.K=function(){var t=this;this.clearTimeoutFn(this.Y);var n=this.I+this.R;this._=Date.now()+n,this.Y=this.setTimeoutFn((function(){t.F("ping timeout")}),n),this.opts.autoUnref&&this.Y.unref()},i.X=function(){this.writeBuffer.splice(0,this.M),this.M=0,0===this.writeBuffer.length?this.emitReserved("drain"):this.flush()},i.flush=function(){if("closed"!==this.readyState&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){var t=this.G();this.transport.send(t),this.M=t.length,this.emitReserved("flush")}},i.G=function(){if(!(this.L&&"polling"===this.transport.name&&this.writeBuffer.length>1))return this.writeBuffer;for(var t,n=1,i=0;i<this.writeBuffer.length;i++){var r=this.writeBuffer[i].data;if(r&&(n+="string"==typeof(t=r)?function(t){for(var n=0,i=0,r=0,e=t.length;r<e;r++)(n=t.charCodeAt(r))<128?i+=1:n<2048?i+=2:n<55296||n>=57344?i+=3:(r++,i+=4);return i}(t):Math.ceil(1.33*(t.byteLength||t.size))),i>0&&n>this.L)return this.writeBuffer.slice(0,i);n+=2}return this.writeBuffer},i.W=function(){var t=this;if(!this._)return!0;var n=Date.now()>this._;return n&&(this._=0,R((function(){t.F("ping timeout")}),this.setTimeoutFn)),n},i.write=function(t,n,i){return this.J("message",t,n,i),this},i.send=function(t,n,i){return this.J("message",t,n,i),this},i.J=function(t,n,i,r){if("function"==typeof n&&(r=n,n=void 0),"function"==typeof i&&(r=i,i=null),"closing"!==this.readyState&&"closed"!==this.readyState){(i=i||{}).compress=!1!==i.compress;var e={type:t,data:n,options:i};this.emitReserved("packetCreate",e),this.writeBuffer.push(e),r&&this.once("flush",r),this.flush()}},i.close=function(){var t=this,n=function(){t.F("forced close"),t.transport.close()},i=function i(){t.off("upgrade",i),t.off("upgradeError",i),n()},r=function(){t.once("upgrade",i),t.once("upgradeError",i)};return"opening"!==this.readyState&&"open"!==this.readyState||(this.readyState="closing",this.writeBuffer.length?this.once("drain",(function(){t.upgrading?r():n()})):this.upgrading?r():n()),this},i.B=function(t){if(n.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&"opening"===this.readyState)return this.transports.shift(),this.q();this.emitReserved("error",t),this.F("transport error",t)},i.F=function(t,n){if("opening"===this.readyState||"open"===this.readyState||"closing"===this.readyState){if(this.clearTimeoutFn(this.Y),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),ct&&(this.P&&removeEventListener("beforeunload",this.P,!1),this.$)){var i=at.indexOf(this.$);-1!==i&&at.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",t,n),this.writeBuffer=[],this.M=0}},n}(I);vt.protocol=4;var lt=function(t){function n(){var n;return(n=t.apply(this,arguments)||this).Z=[],n}s(n,t);var i=n.prototype;return i.onOpen=function(){if(t.prototype.onOpen.call(this),"open"===this.readyState&&this.opts.upgrade)for(var n=0;n<this.Z.length;n++)this.tt(this.Z[n])},i.tt=function(t){var n=this,i=this.createTransport(t),r=!1;vt.priorWebsocketSuccess=!1;var e=function(){r||(i.send([{type:"ping",data:"probe"}]),i.once("packet",(function(t){if(!r)if("pong"===t.type&&"probe"===t.data){if(n.upgrading=!0,n.emitReserved("upgrading",i),!i)return;vt.priorWebsocketSuccess="websocket"===i.name,n.transport.pause((function(){r||"closed"!==n.readyState&&(c(),n.setTransport(i),i.send([{type:"upgrade"}]),n.emitReserved("upgrade",i),i=null,n.upgrading=!1,n.flush())}))}else{var e=new Error("probe error");e.transport=i.name,n.emitReserved("upgradeError",e)}})))};function o(){r||(r=!0,c(),i.close(),i=null)}var s=function(t){var r=new Error("probe error: "+t);r.transport=i.name,o(),n.emitReserved("upgradeError",r)};function u(){s("transport closed")}function h(){s("socket closed")}function f(t){i&&t.name!==i.name&&o()}var c=function(){i.removeListener("open",e),i.removeListener("error",s),i.removeListener("close",u),n.off("close",h),n.off("upgrading",f)};i.once("open",e),i.once("error",s),i.once("close",u),this.once("close",h),this.once("upgrading",f),-1!==this.Z.indexOf("webtransport")&&"webtransport"!==t?this.setTimeoutFn((function(){r||i.open()}),200):i.open()},i.onHandshake=function(n){this.Z=this.nt(n.upgrades),t.prototype.onHandshake.call(this,n)},i.nt=function(t){for(var n=[],i=0;i<t.length;i++)~this.transports.indexOf(t[i])&&n.push(t[i]);return n},n}(vt),pt=function(t){function n(n){var i=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r="object"===c(n)?n:i;return(!r.transports||r.transports&&"string"==typeof r.transports[0])&&(r.transports=(r.transports||["polling","websocket","webtransport"]).map((function(t){return st[t]})).filter((function(t){return!!t}))),t.call(this,n,r)||this}return s(n,t),n}(lt);pt.protocol;var dt="function"==typeof ArrayBuffer,yt=function(t){return"function"==typeof ArrayBuffer.isView?ArrayBuffer.isView(t):t.buffer instanceof ArrayBuffer},bt=Object.prototype.toString,wt="function"==typeof Blob||"undefined"!=typeof Blob&&"[object BlobConstructor]"===bt.call(Blob),gt="function"==typeof File||"undefined"!=typeof File&&"[object FileConstructor]"===bt.call(File);function mt(t){return dt&&(t instanceof ArrayBuffer||yt(t))||wt&&t instanceof Blob||gt&&t instanceof File}function kt(t,n){if(!t||"object"!==c(t))return!1;if(Array.isArray(t)){for(var i=0,r=t.length;i<r;i++)if(kt(t[i]))return!0;return!1}if(mt(t))return!0;if(t.toJSON&&"function"==typeof t.toJSON&&1===arguments.length)return kt(t.toJSON(),!0);for(var e in t)if(Object.prototype.hasOwnProperty.call(t,e)&&kt(t[e]))return!0;return!1}function At(t){var n=[],i=t.data,r=t;return r.data=jt(i,n),r.attachments=n.length,{packet:r,buffers:n}}function jt(t,n){if(!t)return t;if(mt(t)){var i={_placeholder:!0,num:n.length};return n.push(t),i}if(Array.isArray(t)){for(var r=new Array(t.length),e=0;e<t.length;e++)r[e]=jt(t[e],n);return r}if("object"===c(t)&&!(t instanceof Date)){var o={};for(var s in t)Object.prototype.hasOwnProperty.call(t,s)&&(o[s]=jt(t[s],n));return o}return t}function Et(t,n){return t.data=Ot(t.data,n),delete t.attachments,t}function Ot(t,n){if(!t)return t;if(t&&!0===t._placeholder){if("number"==typeof t.num&&t.num>=0&&t.num<n.length)return n[t.num];throw new Error("illegal attachments")}if(Array.isArray(t))for(var i=0;i<t.length;i++)t[i]=Ot(t[i],n);else if("object"===c(t))for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(t[r]=Ot(t[r],n));return t}var Bt,St=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];!function(t){t[t.CONNECT=0]="CONNECT",t[t.DISCONNECT=1]="DISCONNECT",t[t.EVENT=2]="EVENT",t[t.ACK=3]="ACK",t[t.CONNECT_ERROR=4]="CONNECT_ERROR",t[t.BINARY_EVENT=5]="BINARY_EVENT",t[t.BINARY_ACK=6]="BINARY_ACK"}(Bt||(Bt={}));var Nt=function(){function t(t){this.replacer=t}var n=t.prototype;return n.encode=function(t){return t.type!==Bt.EVENT&&t.type!==Bt.ACK||!kt(t)?[this.encodeAsString(t)]:this.encodeAsBinary({type:t.type===Bt.EVENT?Bt.BINARY_EVENT:Bt.BINARY_ACK,nsp:t.nsp,data:t.data,id:t.id})},n.encodeAsString=function(t){var n=""+t.type;return t.type!==Bt.BINARY_EVENT&&t.type!==Bt.BINARY_ACK||(n+=t.attachments+"-"),t.nsp&&"/"!==t.nsp&&(n+=t.nsp+","),null!=t.id&&(n+=t.id),null!=t.data&&(n+=JSON.stringify(t.data,this.replacer)),n},n.encodeAsBinary=function(t){var n=At(t),i=this.encodeAsString(n.packet),r=n.buffers;return r.unshift(i),r},t}(),Ct=function(t){function n(n){var i;return(i=t.call(this)||this).reviver=n,i}s(n,t);var i=n.prototype;return i.add=function(n){var i;if("string"==typeof n){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");var r=(i=this.decodeString(n)).type===Bt.BINARY_EVENT;r||i.type===Bt.BINARY_ACK?(i.type=r?Bt.EVENT:Bt.ACK,this.reconstructor=new Tt(i),0===i.attachments&&t.prototype.emitReserved.call(this,"decoded",i)):t.prototype.emitReserved.call(this,"decoded",i)}else{if(!mt(n)&&!n.base64)throw new Error("Unknown type: "+n);if(!this.reconstructor)throw new Error("got binary data when not reconstructing a packet");(i=this.reconstructor.takeBinaryData(n))&&(this.reconstructor=null,t.prototype.emitReserved.call(this,"decoded",i))}},i.decodeString=function(t){var i=0,r={type:Number(t.charAt(0))};if(void 0===Bt[r.type])throw new Error("unknown packet type "+r.type);if(r.type===Bt.BINARY_EVENT||r.type===Bt.BINARY_ACK){for(var e=i+1;"-"!==t.charAt(++i)&&i!=t.length;);var o=t.substring(e,i);if(o!=Number(o)||"-"!==t.charAt(i))throw new Error("Illegal attachments");r.attachments=Number(o)}if("/"===t.charAt(i+1)){for(var s=i+1;++i;){if(","===t.charAt(i))break;if(i===t.length)break}r.nsp=t.substring(s,i)}else r.nsp="/";var u=t.charAt(i+1);if(""!==u&&Number(u)==u){for(var h=i+1;++i;){var f=t.charAt(i);if(null==f||Number(f)!=f){--i;break}if(i===t.length)break}r.id=Number(t.substring(h,i+1))}if(t.charAt(++i)){var c=this.tryParse(t.substr(i));if(!n.isPayloadValid(r.type,c))throw new Error("invalid payload");r.data=c}return r},i.tryParse=function(t){try{return JSON.parse(t,this.reviver)}catch(t){return!1}},n.isPayloadValid=function(t,n){switch(t){case Bt.CONNECT:return Mt(n);case Bt.DISCONNECT:return void 0===n;case Bt.CONNECT_ERROR:return"string"==typeof n||Mt(n);case Bt.EVENT:case Bt.BINARY_EVENT:return Array.isArray(n)&&("number"==typeof n[0]||"string"==typeof n[0]&&-1===St.indexOf(n[0]));case Bt.ACK:case Bt.BINARY_ACK:return Array.isArray(n)}},i.destroy=function(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)},n}(I),Tt=function(){function t(t){this.packet=t,this.buffers=[],this.reconPack=t}var n=t.prototype;return n.takeBinaryData=function(t){if(this.buffers.push(t),this.buffers.length===this.reconPack.attachments){var n=Et(this.reconPack,this.buffers);return this.finishedReconstruction(),n}return null},n.finishedReconstruction=function(){this.reconPack=null,this.buffers=[]},t}();var Ut=Number.isInteger||function(t){return"number"==typeof t&&isFinite(t)&&Math.floor(t)===t};function Mt(t){return"[object Object]"===Object.prototype.toString.call(t)}var xt=Object.freeze({__proto__:null,protocol:5,get PacketType(){return Bt},Encoder:Nt,Decoder:Ct,isPacketValid:function(t){return"string"==typeof t.nsp&&(void 0===(n=t.id)||Ut(n))&&function(t,n){switch(t){case Bt.CONNECT:return void 0===n||Mt(n);case Bt.DISCONNECT:return void 0===n;case Bt.EVENT:return Array.isArray(n)&&("number"==typeof n[0]||"string"==typeof n[0]&&-1===St.indexOf(n[0]));case Bt.ACK:return Array.isArray(n);case Bt.CONNECT_ERROR:return"string"==typeof n||Mt(n);default:return!1}}(t.type,t.data);var n}});function It(t,n,i){return t.on(n,i),function(){t.off(n,i)}}var Rt=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1}),Lt=function(t){function n(n,i,r){var o;return(o=t.call(this)||this).connected=!1,o.recovered=!1,o.receiveBuffer=[],o.sendBuffer=[],o.it=[],o.rt=0,o.ids=0,o.acks={},o.flags={},o.io=n,o.nsp=i,r&&r.auth&&(o.auth=r.auth),o.l=e({},r),o.io.et&&o.open(),o}s(n,t);var o=n.prototype;return o.subEvents=function(){if(!this.subs){var t=this.io;this.subs=[It(t,"open",this.onopen.bind(this)),It(t,"packet",this.onpacket.bind(this)),It(t,"error",this.onerror.bind(this)),It(t,"close",this.onclose.bind(this))]}},o.connect=function(){return this.connected||(this.subEvents(),this.io.ot||this.io.open(),"open"===this.io.st&&this.onopen()),this},o.open=function(){return this.connect()},o.send=function(){for(var t=arguments.length,n=new Array(t),i=0;i<t;i++)n[i]=arguments[i];return n.unshift("message"),this.emit.apply(this,n),this},o.emit=function(t){var n,i,r;if(Rt.hasOwnProperty(t))throw new Error('"'+t.toString()+'" is a reserved event name');for(var e=arguments.length,o=new Array(e>1?e-1:0),s=1;s<e;s++)o[s-1]=arguments[s];if(o.unshift(t),this.l.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this.ut(o),this;var u={type:Bt.EVENT,data:o,options:{}};if(u.options.compress=!1!==this.flags.compress,"function"==typeof o[o.length-1]){var h=this.ids++,f=o.pop();this.ht(h,f),u.id=h}var c=null===(i=null===(n=this.io.engine)||void 0===n?void 0:n.transport)||void 0===i?void 0:i.writable,a=this.connected&&!(null===(r=this.io.engine)||void 0===r?void 0:r.W());return this.flags.volatile&&!c||(a?(this.notifyOutgoingListeners(u),this.packet(u)):this.sendBuffer.push(u)),this.flags={},this},o.ht=function(t,n){var i,r=this,e=null!==(i=this.flags.timeout)&&void 0!==i?i:this.l.ackTimeout;if(void 0!==e){var o=this.io.setTimeoutFn((function(){delete r.acks[t];for(var i=0;i<r.sendBuffer.length;i++)r.sendBuffer[i].id===t&&r.sendBuffer.splice(i,1);n.call(r,new Error("operation has timed out"))}),e),s=function(){r.io.clearTimeoutFn(o);for(var t=arguments.length,i=new Array(t),e=0;e<t;e++)i[e]=arguments[e];n.apply(r,i)};s.withError=!0,this.acks[t]=s}else this.acks[t]=n},o.emitWithAck=function(t){for(var n=this,i=arguments.length,r=new Array(i>1?i-1:0),e=1;e<i;e++)r[e-1]=arguments[e];return new Promise((function(i,e){var o=function(t,n){return t?e(t):i(n)};o.withError=!0,r.push(o),n.emit.apply(n,[t].concat(r))}))},o.ut=function(t){var n,i=this;"function"==typeof t[t.length-1]&&(n=t.pop());var r={id:this.rt++,tryCount:0,pending:!1,args:t,flags:e({fromQueue:!0},this.flags)};t.push((function(t){if(i.it[0],null!==t)r.tryCount>i.l.retries&&(i.it.shift(),n&&n(t));else if(i.it.shift(),n){for(var e=arguments.length,o=new Array(e>1?e-1:0),s=1;s<e;s++)o[s-1]=arguments[s];n.apply(void 0,[null].concat(o))}return r.pending=!1,i.ft()})),this.it.push(r),this.ft()},o.ft=function(){var t=arguments.length>0&&void 0!==arguments[0]&&arguments[0];if(this.connected&&0!==this.it.length){var n=this.it[0];n.pending&&!t||(n.pending=!0,n.tryCount++,this.flags=n.flags,this.emit.apply(this,n.args))}},o.packet=function(t){t.nsp=this.nsp,this.io.ct(t)},o.onopen=function(){var t=this;"function"==typeof this.auth?this.auth((function(n){t.vt(n)})):this.vt(this.auth)},o.vt=function(t){this.packet({type:Bt.CONNECT,data:this.lt?e({pid:this.lt,offset:this.dt},t):t})},o.onerror=function(t){this.connected||this.emitReserved("connect_error",t)},o.onclose=function(t,n){this.connected=!1,delete this.id,this.emitReserved("disconnect",t,n),this.yt()},o.yt=function(){var t=this;Object.keys(this.acks).forEach((function(n){if(!t.sendBuffer.some((function(t){return String(t.id)===n}))){var i=t.acks[n];delete t.acks[n],i.withError&&i.call(t,new Error("socket has been disconnected"))}}))},o.onpacket=function(t){if(t.nsp===this.nsp)switch(t.type){case Bt.CONNECT:t.data&&t.data.sid?this.onconnect(t.data.sid,t.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case Bt.EVENT:case Bt.BINARY_EVENT:this.onevent(t);break;case Bt.ACK:case Bt.BINARY_ACK:this.onack(t);break;case Bt.DISCONNECT:this.ondisconnect();break;case Bt.CONNECT_ERROR:this.destroy();var n=new Error(t.data.message);n.data=t.data.data,this.emitReserved("connect_error",n)}},o.onevent=function(t){var n=t.data||[];null!=t.id&&n.push(this.ack(t.id)),this.connected?this.emitEvent(n):this.receiveBuffer.push(Object.freeze(n))},o.emitEvent=function(n){if(this.bt&&this.bt.length){var i,e=r(this.bt.slice());try{for(e.s();!(i=e.n()).done;){i.value.apply(this,n)}}catch(t){e.e(t)}finally{e.f()}}t.prototype.emit.apply(this,n),this.lt&&n.length&&"string"==typeof n[n.length-1]&&(this.dt=n[n.length-1])},o.ack=function(t){var n=this,i=!1;return function(){if(!i){i=!0;for(var r=arguments.length,e=new Array(r),o=0;o<r;o++)e[o]=arguments[o];n.packet({type:Bt.ACK,id:t,data:e})}}},o.onack=function(t){var n=this.acks[t.id];"function"==typeof n&&(delete this.acks[t.id],n.withError&&t.data.unshift(null),n.apply(this,t.data))},o.onconnect=function(t,n){this.id=t,this.recovered=n&&this.lt===n,this.lt=n,this.connected=!0,this.emitBuffered(),this.ft(!0),this.emitReserved("connect")},o.emitBuffered=function(){var t=this;this.receiveBuffer.forEach((function(n){return t.emitEvent(n)})),this.receiveBuffer=[],this.sendBuffer.forEach((function(n){t.notifyOutgoingListeners(n),t.packet(n)})),this.sendBuffer=[]},o.ondisconnect=function(){this.destroy(),this.onclose("io server disconnect")},o.destroy=function(){this.subs&&(this.subs.forEach((function(t){return t()})),this.subs=void 0),this.io.wt(this)},o.disconnect=function(){return this.connected&&this.packet({type:Bt.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this},o.close=function(){return this.disconnect()},o.compress=function(t){return this.flags.compress=t,this},o.timeout=function(t){return this.flags.timeout=t,this},o.onAny=function(t){return this.bt=this.bt||[],this.bt.push(t),this},o.prependAny=function(t){return this.bt=this.bt||[],this.bt.unshift(t),this},o.offAny=function(t){if(!this.bt)return this;if(t){for(var n=this.bt,i=0;i<n.length;i++)if(t===n[i])return n.splice(i,1),this}else this.bt=[];return this},o.listenersAny=function(){return this.bt||[]},o.onAnyOutgoing=function(t){return this.gt=this.gt||[],this.gt.push(t),this},o.prependAnyOutgoing=function(t){return this.gt=this.gt||[],this.gt.unshift(t),this},o.offAnyOutgoing=function(t){if(!this.gt)return this;if(t){for(var n=this.gt,i=0;i<n.length;i++)if(t===n[i])return n.splice(i,1),this}else this.gt=[];return this},o.listenersAnyOutgoing=function(){return this.gt||[]},o.notifyOutgoingListeners=function(t){if(this.gt&&this.gt.length){var n,i=r(this.gt.slice());try{for(i.s();!(n=i.n()).done;){n.value.apply(this,t.data)}}catch(t){i.e(t)}finally{i.f()}}},i(n,[{key:"disconnected",get:function(){return!this.connected}},{key:"active",get:function(){return!!this.subs}},{key:"volatile",get:function(){return this.flags.volatile=!0,this}}])}(I);function _t(t){t=t||{},this.ms=t.min||100,this.max=t.max||1e4,this.factor=t.factor||2,this.jitter=t.jitter>0&&t.jitter<=1?t.jitter:0,this.attempts=0}_t.prototype.duration=function(){var t=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var n=Math.random(),i=Math.floor(n*this.jitter*t);t=1&Math.floor(10*n)?t+i:t-i}return 0|Math.min(t,this.max)},_t.prototype.reset=function(){this.attempts=0},_t.prototype.setMin=function(t){this.ms=t},_t.prototype.setMax=function(t){this.max=t},_t.prototype.setJitter=function(t){this.jitter=t};var Dt=function(t){function n(n,i){var r,e;(r=t.call(this)||this).nsps={},r.subs=[],n&&"object"===c(n)&&(i=n,n=void 0),(i=i||{}).path=i.path||"/socket.io",r.opts=i,$(r,i),r.reconnection(!1!==i.reconnection),r.reconnectionAttempts(i.reconnectionAttempts||1/0),r.reconnectionDelay(i.reconnectionDelay||1e3),r.reconnectionDelayMax(i.reconnectionDelayMax||5e3),r.randomizationFactor(null!==(e=i.randomizationFactor)&&void 0!==e?e:.5),r.backoff=new _t({min:r.reconnectionDelay(),max:r.reconnectionDelayMax(),jitter:r.randomizationFactor()}),r.timeout(null==i.timeout?2e4:i.timeout),r.st="closed",r.uri=n;var o=i.parser||xt;return r.encoder=new o.Encoder,r.decoder=new o.Decoder,r.et=!1!==i.autoConnect,r.et&&r.open(),r}s(n,t);var i=n.prototype;return i.reconnection=function(t){return arguments.length?(this.kt=!!t,t||(this.skipReconnect=!0),this):this.kt},i.reconnectionAttempts=function(t){return void 0===t?this.At:(this.At=t,this)},i.reconnectionDelay=function(t){var n;return void 0===t?this.jt:(this.jt=t,null===(n=this.backoff)||void 0===n||n.setMin(t),this)},i.randomizationFactor=function(t){var n;return void 0===t?this.Et:(this.Et=t,null===(n=this.backoff)||void 0===n||n.setJitter(t),this)},i.reconnectionDelayMax=function(t){var n;return void 0===t?this.Ot:(this.Ot=t,null===(n=this.backoff)||void 0===n||n.setMax(t),this)},i.timeout=function(t){return arguments.length?(this.Bt=t,this):this.Bt},i.maybeReconnectOnOpen=function(){!this.ot&&this.kt&&0===this.backoff.attempts&&this.reconnect()},i.open=function(t){var n=this;if(~this.st.indexOf("open"))return this;this.engine=new pt(this.uri,this.opts);var i=this.engine,r=this;this.st="opening",this.skipReconnect=!1;var e=It(i,"open",(function(){r.onopen(),t&&t()})),o=function(i){n.cleanup(),n.st="closed",n.emitReserved("error",i),t?t(i):n.maybeReconnectOnOpen()},s=It(i,"error",o);if(!1!==this.Bt){var u=this.Bt,h=this.setTimeoutFn((function(){e(),o(new Error("timeout")),i.close()}),u);this.opts.autoUnref&&h.unref(),this.subs.push((function(){n.clearTimeoutFn(h)}))}return this.subs.push(e),this.subs.push(s),this},i.connect=function(t){return this.open(t)},i.onopen=function(){this.cleanup(),this.st="open",this.emitReserved("open");var t=this.engine;this.subs.push(It(t,"ping",this.onping.bind(this)),It(t,"data",this.ondata.bind(this)),It(t,"error",this.onerror.bind(this)),It(t,"close",this.onclose.bind(this)),It(this.decoder,"decoded",this.ondecoded.bind(this)))},i.onping=function(){this.emitReserved("ping")},i.ondata=function(t){try{this.decoder.add(t)}catch(t){this.onclose("parse error",t)}},i.ondecoded=function(t){var n=this;R((function(){n.emitReserved("packet",t)}),this.setTimeoutFn)},i.onerror=function(t){this.emitReserved("error",t)},i.socket=function(t,n){var i=this.nsps[t];return i?this.et&&!i.active&&i.connect():(i=new Lt(this,t,n),this.nsps[t]=i),i},i.wt=function(t){for(var n=0,i=Object.keys(this.nsps);n<i.length;n++){var r=i[n];if(this.nsps[r].active)return}this.St()},i.ct=function(t){for(var n=this.encoder.encode(t),i=0;i<n.length;i++)this.engine.write(n[i],t.options)},i.cleanup=function(){this.subs.forEach((function(t){return t()})),this.subs.length=0,this.decoder.destroy()},i.St=function(){this.skipReconnect=!0,this.ot=!1,this.onclose("forced close")},i.disconnect=function(){return this.St()},i.onclose=function(t,n){var i;this.cleanup(),null===(i=this.engine)||void 0===i||i.close(),this.backoff.reset(),this.st="closed",this.emitReserved("close",t,n),this.kt&&!this.skipReconnect&&this.reconnect()},i.reconnect=function(){var t=this;if(this.ot||this.skipReconnect)return this;var n=this;if(this.backoff.attempts>=this.At)this.backoff.reset(),this.emitReserved("reconnect_failed"),this.ot=!1;else{var i=this.backoff.duration();this.ot=!0;var r=this.setTimeoutFn((function(){n.skipReconnect||(t.emitReserved("reconnect_attempt",n.backoff.attempts),n.skipReconnect||n.open((function(i){i?(n.ot=!1,n.reconnect(),t.emitReserved("reconnect_error",i)):n.onreconnect()})))}),i);this.opts.autoUnref&&r.unref(),this.subs.push((function(){t.clearTimeoutFn(r)}))}},i.onreconnect=function(){var t=this.backoff.attempts;this.ot=!1,this.backoff.reset(),this.emitReserved("reconnect",t)},n}(I),Pt={};function $t(t,n){"object"===c(t)&&(n=t,t=void 0);var i,r=function(t){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"",i=arguments.length>2?arguments[2]:void 0,r=t;i=i||"undefined"!=typeof location&&location,null==t&&(t=i.protocol+"//"+i.host),"string"==typeof t&&("/"===t.charAt(0)&&(t="/"===t.charAt(1)?i.protocol+t:i.host+t),/^(https?|wss?):\/\//.test(t)||(t=void 0!==i?i.protocol+"//"+t:"https://"+t),r=ft(t)),r.port||(/^(http|ws)$/.test(r.protocol)?r.port="80":/^(http|ws)s$/.test(r.protocol)&&(r.port="443")),r.path=r.path||"/";var e=-1!==r.host.indexOf(":")?"["+r.host+"]":r.host;return r.id=r.protocol+"://"+e+":"+r.port+n,r.href=r.protocol+"://"+e+(i&&i.port===r.port?"":":"+r.port),r}(t,(n=n||{}).path||"/socket.io"),e=r.source,o=r.id,s=r.path,u=Pt[o]&&s in Pt[o].nsps;return n.forceNew||n["force new connection"]||!1===n.multiplex||u?i=new Dt(e,n):(Pt[o]||(Pt[o]=new Dt(e,n)),i=Pt[o]),r.query&&!n.query&&(n.query=r.queryKey),i.socket(r.path,n)}return e($t,{Manager:Dt,Socket:Lt,io:$t,connect:$t}),$t}));
//# sourceMappingURL=socket.io.min.js.map

/* SOCKET_IO_END */
// Capture io from wherever the UMD wrapper put it
var io = io || (typeof globalThis !== 'undefined' && globalThis.io) || (typeof self !== 'undefined' && self.io) || (typeof window !== 'undefined' && window.io);

// =============================================================================
// CHANGELOG
// =============================================================================
// v4.9.3   - Fix: PDA connection no longer flips to Offline on a single poll hiccup (requires 3 consecutive failures); renamed 'Syncing' to 'Connected'.
// v4.9.2   - Fix: Boost toast z-index to max to ensure visibility on attack pages; add assist toast debug log.
// v4.9.1   - Feature: Added Test Toast Notification button in settings.
// v4.9.0   - Feature: PDA Notification toggle and Test button now visible to all users (not PDA-only).
// v4.8.47  - Fix: Remove settings gear and heatmap button from all attack page URLs (loader.php and page.php).
// v4.8.46  - Fix: Remove FactionOps overlay (heatmap/settings buttons) from attack pages when navigating from war pages.
// v4.8.45  - Fix: Corrected malformed regex in target ID extraction that could prevent assist button from appearing.
// v4.8.44  - Fix: Assist button now triggers correctly on the new Torn page.php?sid=attack URL format.
// v4.8.43  - Fix: Assist button now extracts target ID from the DOM when resuming attacks (URL missing user ID) and waits for React to render.
// v4.8.42  - Fix: Assist button match rules broadened to ensure it appears on all attack page variations.
// v4.8.41  - Fix: Assist button fixed by updating target ID extraction regex to match all Torn URL formats.
// v4.8.28  - Revert: Removed OC Spawn Assistant integration from FactionOps (keeping it as a standalone tool).
// v4.8.27  - Fix: Tactical Battle Plan (Scout Report) now strictly sorts targets and hitters by highest/lowest stats properly.
// v4.8.26  - Fix: Chain notifications (bonus hits, panics, alerts) will no longer fire when the chain is in Cooldown.
// v4.8.25  - Feature: Upgraded OC Spawn Assistant with tooltips and detailed member CPR breakdowns (synced with standalone v1.1.4).
// v4.8.24  - Fix: Rewrote button injection logic to ensure Spawn Assistant appears on Crimes tab dynamically.
// v4.8.30  - Fix: Custom War Target percentage goal display was being overwritten by the real-time ETA display loop.
// v4.8.23  - Fix: Improved injection logic for the OC Spawn Assistant button so it properly appears on the Crimes tab.
// v4.8.20  - Feature: Integrated "OC Spawn Assistant" directly into FactionOps (Crimes Tab). Uses backend caching to save Torn API calls!
// v4.8.19  - Fix: Faction Leaders can now reset the Enemy Activity Heatmap, and the server auto-wipes it when a new enemy is detected.
// v4.8.18  - Feature: War page reports DOM timer to server — OC tab gets accurate countdown.
// v4.8.12  - Fix: War timer showed "--:--" instead of WON/LOST when FactionOps was opened from a non-war tab at the end of a war.
// v4.8.11  - Fix: Resolved bug causing "998:58" Ranked War timers when activating FactionOps from non-war tabs (e.g. Armory).
// v4.8.10  - UI: Re-added percentage markers to the Heatmap legend for clarity.
// v4.8.9   - UI: Updated Heatmap legend to match the new high-activity color scale (Red/Yellow).
// v4.8.8   - UI: Improved Member Activity Heatmap colors to highlight peak hours (Top 5% red, top 20% yellow).
// v4.8.7   - Feature: Removed automated Push/Hold/Turtle Strategy Engine from the overlay.
// v4.8.6   - Feature: Removed experimental "Enemy Surge" push notification (the heatmap natively tracks activity better now).
// v4.8.5   - Feature: Rebuilt toast notification system with stacking, scaling duration, progress bars, and icons.
// v4.5.33  - Feature: Added UI in settings for faction leaders to configure custom broadcast roles.
// v4.5.31  - Improvement: Migrated Faction Broadcast to use HTTP POST, enabling leaders to broadcast even on fallback SSE connections.
// v4.5.30  - Feature: Faction leaders and bankers can now broadcast messages to their faction directly from the war overlay.
// v4.5.29  - Revert: Restored the exact PDA scanner logic from v4.5.22 after newer fixes caused false "LOST" reads during rapid target decay.
// v4.5.28  - Fix: Fixed PDA scanner sometimes returning LOST prematurely when the server has not yet polled the decayed target.
// v4.5.27  - Feature: Added Admin Broadcast feature allowing admin to send global toast notifications to all active tabs.
// v4.5.26  - Fix: Timer says "LOST" instead of "WON" if the enemy reaches the target first, and prevents the PDA scanner from grabbing crazy elapsed times (e.g. "15d" from a player profile) which caused the target decay math to crash.
// v4.5.25  - Fix: PDA text scanner now strictly pulls the target score directly from the server's state.warEta to prevent fake target extraction.
// v4.5.24  - Fix: PDA text scanner now anchors the target search using the lead score to prevent greedy regex grabbing 10-digit IDs or stats.
// v4.5.23  - Fix: Fixed "ERR: SCORE" bug on Torn PDA by bypassing the DOM entirely for the lead score and using the server state.
// v4.5.22  - Fix: Fixed PDA text scanner failing by using textContent to read the hidden native Torn UI, plus improved regex extraction.
// v4.5.21  - Fix: Added bulletproof raw-text scanner fallback to guarantee timer works on Torn PDA's mobile layout.
// v4.5.20  - Feature: Added detailed stats to the Ranked War timer popup, displaying target score, lead score, score gap, and decay rate per hour.
// v4.5.19  - Fix: Resolved CSS clipping issue that was hiding the Ranked War timer details popup.
// v4.5.18  - Fix: Added heavy-duty text scanner fallback to successfully locate timer and target elements on Torn PDA's mobile layout.
// v4.5.17  - Fix: Updated DOM selectors in updateWarTimer to correctly identify and read Ranked War targets.
// v4.5.16  - Fix: Forced the UI to use the local pure-decay ETA calculation instead of falling back to server predictions.
// v4.5.15  - Revert: Ranked War ETA now uses pure target decay against current lead (matching original Torn Ranked War Timer).
// v4.5.14  - Fix: ETA calculation now includes our scoring momentum combined with target decay, predicting closing speed from hour 0 for both manual and ranked war targets.
// v4.5.11  - Fix: Timer saying WON instead of LOST when the enemy reaches the target before you do.
// v4.5.10  - Rewrote the fallback ETA logic completely from scratch to exactly match the flawless code from the Torn Ranked War Timer script, guaranteeing 100% ETA synchronization.
// v4.5.9   - Critical Math Fix: Resolved issue where ETA inflated to 1h29m+ by correctly identifying that Torn API sends the original target (not decayed) while Torn UI sends a discrete decayed target
// v4.5.8   - Revert to continuous decay math (Torn API actually drops smoothly in the background, not discretely) with a proper float-rounding fix to prevent oscillation
// v4.5.7   - Fix: Timer jitter/oscillation (59m -> 01:01) caused by calculating continuous decay relative to now() instead of absolute discrete hourly drops
// v4.5.6   - Fix: War timer saying "01:00" due to Torn UI displaying "days" which broke the time split array (calculated as 200+ hours instead of 50h)
// v4.5.5   - Fix: War timer saying "WON" prematurely due to locale-specific number formatting (dots/spaces) and long-war decay math issues (>124h)
// v4.5.4   - Fix: War timer accuracy — scoped DOM selectors to avoid picking up unrelated timers (e.g. hospital/chain)
// v4.5.3   - Feature: Auto-clear custom war target once reached (switches to standard war timer)
// v4.5.2   - Feature: Switch to exact war decay timer once custom target reaches 100% (even before 24h)
// v4.5.1   - Fix: Prevent War Target Reached notifications from repeating continuously on page reloads
// v3.16.2  - Add SSE (EventSource) test button in PDA settings to probe real-time support
// v3.16.1  - Show RT/Poll connection badge for all users (was admin-only)
// v3.16.0  - Multi-hit deal calls: long-press/right-click Call button for 15-min reserved deal call
// v3.15.7  - Fix race condition: own-faction members no longer leak into overlay before enemy data loads
// v3.15.6  - Fix web push notifications showing target ID: send targetName in call API request
// v3.15.5  - Add 'Test PDA Notification' button in settings (debug/verify scheduleNotification)
// v3.15.4  - Fix PDA notifications showing target ID instead of name; improved name lookup fallback
// v3.15.3  - Adaptive PDA polling: 2s during active war, 5s when idle (saves battery + server load)
// v3.15.2  - Fix pre-war countdown: detect via lead=0 from DOM instead of text matching
// v3.15.1  - Pre-war countdown: show time until war starts instead of 0% when war hasn't begun
// v3.15.0  - PDA: native push notifications via scheduleNotification handler (calls, chain, bonus, war target)
// v3.14.16 - PDA: revert Socket.IO attempt (all transports blocked by InAppWebView); reduce PDA poll to 3.5s
// v3.14.15 - PDA: force polling transport (WebSocket confirmed blocked by InAppWebView)
// v3.14.14 - PDA: show toast diagnostics for Socket.IO connection (visible on screen)
// v3.14.13 - PDA: enable Socket.IO WebSocket connection (was blocked), add transport diagnostics
// v3.14.12 - War timer click opens detail popup (mobile-friendly); no wiki link
// v3.14.6 - Move energy display to header-left (next to settings gear) to reduce header row wrapping on mobile
// v3.14.5 - Integrate ranked war timer into overlay header (estimated time to target-drop win)
// v3.12.0 - Real-time push: Socket.IO connection for instant call/priority/status updates; polling reduced to 5s fallback
// v3.11.6 - Fix: auto-retry on network error for call/uncall/priority actions (1s delay, 10s timeout)
// v3.11.5 - Jailed members moved to collapsed Unavailable section; hospital pill shows countdown timer
// v3.11.4 - UI: Compact 2-row header (logo+stats row 1, war info centered row 2)
// v3.11.3 - Fix: Center "War vs" line on mobile when header wraps
// v3.11.2 - UI: Move settings gear and heatmap buttons next to logo/connection dot (left side of header)
// v3.11.1 - Online badge: "us" count from server-side Torn API poll (all faction members, not just FactionOps users)
// v3.11.0 - Online badge: show both faction (us) and enemy online counts
// v3.10.9 - Fix: FF badge truncation on mobile (sub-row flex-wrap)
// v3.10.8 - Inline Fair Fight scores from ffscouter.com API (per-user, color coded, visible on PDA)
// v3.10.7 - Fix: priority dropdown no longer destroyed by poll re-renders
// v3.10.6 - Grant Banker role priority-setting permissions
// v3.10.5 - Fix: priority border line flickering (eliminate double-render, conditional class toggles, batched DOM reorder)
// v3.10.4 - Activity heatmap switched to TCT (UTC)
// v3.10.3 - API-based energy bar in overlay header
// v3.10.2 - Energy bar poll (user bars API)
// v3.10.1 - Revert to visible Torn native chain bar in header
// v3.10.0 - Custom live chain display (count + timer)
// v3.9.9  - Fix: PDA chain bar — cached element ref, pass directly to observer
// v3.9.8  - Fix: chain bar race — stopDirectChainPoll before observer, settle delay
// v3.9.7  - DOM-based chain reader: zero API calls for chain data; server chain polling disabled
// v3.9.6  - Chain bar CSS fix for readable display; server exponential backoff on API failures
// v3.9.5  - Chain bar: retry with delay + DOM diagnostic for PDA compatibility
// v3.9.4  - Clone Torn's native #barChain into overlay header (live updates from Torn JS)
// v3.9.3  - Revert to simple full-page overlay; re-add chain info to header from server data
// v3.9.0  - Remove chain info from overlay header too; Torn's native chain fully visible
// v3.8.9  - Remove chain bar entirely; standalone Next Up bar below Torn's UI
// v3.8.8  - Remove heatmap and settings buttons from attack page
// v3.8.7  - Remove attack page info box overlay
// v3.8.6  - Fix: online/idle/offline dots now work — server field renamed from 'online' to 'activity'
// v3.8.5  - UI: Next Up timer color changed to bright red for better visibility
// v3.8.4  - Fix: timer flicker — sub-second precision + strict monotonic guard (Math.min, zero tolerance)
// v3.8.3  - Fix: hospital timer flicker — monotonic guard prevents server polls from bumping timers up
// v3.8.2  - Sort: remove high priority idle/offline tier; high priority always tier 0
// v3.8.1  - Sort: online targets float above idle/offline within each tier
// v3.8.0  - Instant med-out detection: DOM MutationObserver watches Torn's member rows for status changes, forwards to server immediately
// v3.7.9  - Fix: server converted Torn API Unix timestamps to seconds remaining (was showing raw epoch values)
// v3.7.8  - Timers show days+hours for long durations (e.g. Xanax OD: "20530d 6h" instead of "492714h 36m")
// v3.7.7  - Sort: my calls pinned to top, others' calls to bottom; Call button blue, Mine green, others red
// v3.7.6  - Fix: chain timer flicker — monotonic guard rejects stale cached timeouts unless chain count changes
// v3.7.5  - Collapse unattackable members (traveling/abroad) into expandable section; hide federal/fallen
// v3.7.4  - Fix: traveling/abroad members now display correctly with Travel status
// v3.7.3  - Perf: reduce client chain poll to 30s (fixes scroll lag on PDA)
// v3.7.2  - Chain timer: compensate for Torn API cache age (sub-second accuracy)
// v3.7.1  - Direct Torn API chain polling (5s) for real-time chain accuracy
// v3.7.0  - Fix: chain timer accuracy — removed unreliable DOM reader, uses intercepted API + server poll
// v3.6.9  - Activate button: dark/black style
// v3.6.8  - Fix: chain timer no longer jumps (DOM-anchored wall-clock countdown)
// v3.6.7  - Fix: stat numbers no longer cut off on mobile (tighter grid columns)
// v3.6.6  - Activate button: restore original red/orange color
// v3.6.5  - Activate button: smaller and left-aligned
// v3.6.4  - Auto-detect ranked war opponent via Torn API (no manual setup needed)
// v3.6.3  - Fix: chain timer no longer pauses when leaving/re-entering FactionOps overlay
// v3.6.0  - Live push/turtle strategy — enemy activity tracking, real-time war recommendations
//           - Strategy indicator bar below NEXT UP with PUSH/HOLD/TURTLE, confidence, timing
//           - Enemy activity sparkline (24h by hour) with peak/dead zone markers
//           - Strategy section in scout report during active war
//           - REST endpoint GET /api/war/:warId/strategy
// v3.6.2  - Chain timer syncs instantly from Torn's DOM (no more delay from server polling)
// v3.6.1  - Chain poll interval 10s (was 30s), drift threshold 5s for tighter sync
// v3.6.0  - Fix: chain timer smooth countdown (no more jitter from server polls) — smooth client countdown, no server reset loop
// v3.5.8  - Chain updates instantly via intercepted Torn data (no more 30s delay)
// v3.5.7  - Fix: replace DELETE HTTP methods with POST for PDA compatibility
//           (fixes "network error" when removing faction API key)
// v3.5.6  - Revert mini profile popup (not compatible with PDA)
// v3.5.5  - Custom mini profile popup via Torn internal API
// v3.5.4  - Fix: persist player API keys to disk across server restarts
//           - Mini profile popup improvements
// v3.5.3  - Fix: mini profile popup on target name links
// v3.5.2  - Version bump for update detection
// v3.5.1  - Fix: row flicker on DOM reorder (use insertBefore in-place)
// v3.5.0  - Overlay hides entire Torn page content, takes over full page
//           - Version shown in download button text
//           - Weekly Tuesday membership check (purge non-faction members)
//           - Server auth locked to faction 42055
// v3.0.58 - Fix: high priority only floats to top when target is OK status
// v3.0.57 - High priority targets sort above all others
// v3.0.56 - Grant War Leader access to priority tagging + heatmap reset
// v3.0.55 - Remove BSP sort option and dead code
// v3.0.54 - UI: move activate button below Torn nav bar, rounded corners
// v3.0.50 - Fix: hide floating heatmap FAB on faction/war pages
// v3.0.49 - Chain count + timer in overlay header
// v3.0.48 - Move heatmap button into overlay header next to settings gear
// v3.0.46 - Theme toggle applies to entire UI (CSS variables refactor)
// v3.0.44 - Fix: activate button on all faction pages, not just war context
// v3.0.38 - Compliance refactor: server-side war polling, faction API key
//           setup, remove interceptor forwarding
// v3.0.37 - Show BSP stats inline next to player name/ID
// v3.0.35 - Next Up queue inside overlay header
//           - Activate FactionOps button on war page (no auto-start)
// v3.0.34 - Settings gear button in overlay header
// v3.0.33 - Toast on call conflict
// v3.0.32 - Optimistic call/uncall with rollback on failure
// v3.0.31 - Show "Mine" on your calls, caller name for others
// v3.0.29 - Clickable target names (links to Torn profile)
// v3.0.25 - Hide BSP column on mobile
// v3.0.21 - Mobile responsive grid improvements (v3.0.1 - v3.0.21)
// v3.0.0  - Full dark overlay replaces Torn war page
// v2.0.5  - Add Attack button to war page rows
// v2.0.3  - PDA compatibility: PDA_httpGet/PDA_httpPost bridge
// v2.0.0  - Replace Socket.IO with HTTP polling
// v1.2.0  - Bundle Socket.IO client inline (zero external deps for PDA)
// v1.1.0  - Torn PDA auto-detection and API key support
// v1.0.1  - Auto-update URLs, HTTPS release
// v1.0.0  - Initial release
// =============================================================================

(function () {
    'use strict';

    // 2026-05-24 — PDA Android GM polyfill. TM's @grant occasionally fails
    // to bind GM_xxx as local vars on Android (xentac repro). Defining on
    // window lets the bare GM_xxx(...) call fall through to the global via
    // scope chain. Harmless on iOS — TM's local var always shadows window.
    // Skipped GM_xmlhttpRequest (fetch can't reliably emulate cross-origin).
    (function polyfillGM() {
        const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (typeof w.GM_addStyle !== 'function') {
            w.GM_addStyle = function (css) {
                const s = document.createElement('style');
                s.textContent = String(css || '');
                (document.head || document.documentElement).appendChild(s);
                return s;
            };
        }
        if (typeof w.GM_setValue !== 'function') {
            w.GM_setValue = function (k, v) { try { localStorage.setItem('cc:' + k, JSON.stringify(v)); } catch (_) {} };
        }
        if (typeof w.GM_getValue !== 'function') {
            w.GM_getValue = function (k, d) {
                try { const raw = localStorage.getItem('cc:' + k); return raw == null ? d : JSON.parse(raw); }
                catch (_) { return d; }
            };
        }
    })();

    // =========================================================================
    // SECTION 1: CONFIGURATION
    // =========================================================================

    // --- Torn PDA Detection ---
    const IS_PDA = typeof window.flutter_inappwebview !== 'undefined';
    const PDA_API_KEY = '###PDA-APIKEY###';

    const CONFIG = {
        VERSION: '4.8.4',
        SERVER_URL: GM_getValue('factionops_server', 'https://tornwar.com'),
        API_KEY: GM_getValue('factionops_apikey', '') || (IS_PDA ? PDA_API_KEY : ''),
        THEME: GM_getValue('factionops_theme', 'dark'),
        AUTO_SORT: GM_getValue('factionops_autosort', true),
        CHAIN_ALERT: GM_getValue('factionops_chain_alert', true),
        CHAIN_ALERT_THRESHOLD: GM_getValue('factionops_chain_alert_threshold', 60),
        PDA_NOTIFICATIONS: GM_getValue('factionops_pda_notif', IS_PDA),
        KEEP_ALIVE: GM_getValue('factionops_keep_alive', false),
        CALL_TIMEOUT: 5 * 60 * 1000,       // 5 minute call expiry
        DEAL_TIMEOUT: 15 * 60 * 1000,      // 15 minute deal call expiry
        REFRESH_INTERVAL: 30 * 1000,        // 30 second status refresh
        IS_PDA: IS_PDA,
    };

    // Auto-save PDA key on first detection
    if (IS_PDA && !GM_getValue('factionops_apikey', '')) {
        GM_setValue('factionops_apikey', PDA_API_KEY);
    }

    /** Persist a config key and update the live CONFIG object. */
    function setConfig(key, value) {
        CONFIG[key] = value;
        const gmKeys = {
            SERVER_URL: 'factionops_server',
            API_KEY: 'factionops_apikey',
            THEME: 'factionops_theme',
            AUTO_SORT: 'factionops_autosort',
            CHAIN_ALERT: 'factionops_chain_alert',
            CHAIN_ALERT_THRESHOLD: 'factionops_chain_alert_threshold',
            PDA_NOTIFICATIONS: 'factionops_pda_notif',
            KEEP_ALIVE: 'factionops_keep_alive',
        };
        if (gmKeys[key]) {
            GM_setValue(gmKeys[key], value);
        }
    }

    // =========================================================================
    // SECTION 1B: PDA-COMPATIBLE HTTP WRAPPER
    // =========================================================================

    /**
     * Cross-platform HTTP request wrapper.
     * Uses PDA_httpGet/PDA_httpPost on Torn PDA, GM_xmlhttpRequest elsewhere.
     * PDA bridge functions support headers: PDA_httpGet(url, headers), PDA_httpPost(url, headers, body)
     */
    function httpRequest(opts) {
        if (IS_PDA) {
            const method = (opts.method || 'GET').toUpperCase();
            if (method === 'GET' && typeof PDA_httpGet === 'function') {
                PDA_httpGet(opts.url, opts.headers || {})
                    .then(r => {
                        const resp = typeof r === 'string'
                            ? { status: 200, responseText: r, statusText: 'OK' }
                            : r;
                        opts.onload && opts.onload(resp);
                    })
                    .catch(e => opts.onerror && opts.onerror(e));
            } else if (method === 'POST' && typeof PDA_httpPost === 'function') {
                PDA_httpPost(opts.url, opts.headers || {}, opts.data || '')
                    .then(r => {
                        const resp = typeof r === 'string'
                            ? { status: 200, responseText: r, statusText: 'OK' }
                            : r;
                        opts.onload && opts.onload(resp);
                    })
                    .catch(e => opts.onerror && opts.onerror(e));
            } else {
                // Fallback: try fetch on PDA if bridge functions unavailable
                fetch(opts.url, {
                    method,
                    headers: opts.headers || {},
                    body: method !== 'GET' ? opts.data : undefined,
                }).then(async (r) => {
                    const text = await r.text();
                    opts.onload && opts.onload({ status: r.status, responseText: text, statusText: r.statusText });
                }).catch(e => opts.onerror && opts.onerror(e));
            }
            return;
        }
        GM_xmlhttpRequest(opts);
    }

    // =========================================================================
    // SECTION 1C: PDA NATIVE NOTIFICATIONS
    // =========================================================================

    /**
     * PDA native notification via flutter_inappwebview.callHandler('scheduleNotification').
     * Uses unique notification IDs per event type (0–9999 range).
     * On non-PDA or when PDA_NOTIFICATIONS is off, this is a no-op.
     *
     * ID ranges (to avoid collisions):
     *   100–199  target_called
     *   200–299  chain_alert
     *   300–399  hospital_pop
     *   400–409  bonus_imminent
     *   600–699  call_stolen
     *   800      war_target
     */
    const pdaNotifCounters = {};
    const pdaNotifFired = new Set(); // dedupe keys like 'chain_alert' or 'call_123'

    function firePdaNotification(type, title, body, urlCallback) {
        if (!IS_PDA || !CONFIG.PDA_NOTIFICATIONS) return;
        if (!window.flutter_inappwebview?.callHandler) return;

        // ID ranges per type
        const ranges = {
            target_called:  [100, 199],
            chain_alert:    [200, 299],
            hospital_pop:   [300, 399],
            bonus_imminent: [400, 409],
            call_stolen:    [600, 699],
            war_target:     [800, 800],
            assist_request: [900, 999],
        };

        const range = ranges[type];
        if (!range) return;

        // Rotating ID within range
        if (!pdaNotifCounters[type]) pdaNotifCounters[type] = range[0];
        const id = pdaNotifCounters[type];
        pdaNotifCounters[type] = id >= range[1] ? range[0] : id + 1;

        // Schedule 1 second from now (minimum future timestamp required)
        const timestamp = Date.now() + 1000;

        window.flutter_inappwebview.callHandler('scheduleNotification', {
            title: title,
            subtitle: body,
            id: id,
            timestamp: timestamp,
            overwriteID: true,
            launchNativeToast: false,
            urlCallback: urlCallback || '',
        }).then(() => {
            log(`[PDA-Notif] Scheduled: ${type} (id=${id})`);
        }).catch(err => {
            warn(`[PDA-Notif] Failed: ${type}`, err);
        });
    }

    /** Clear PDA dedup set — called when data changes significantly (e.g. new war). */
    function resetPdaNotifDedup() {
        pdaNotifFired.clear();
    }

    // =========================================================================
    // SECTION 2: LOGGING UTILITIES
    // =========================================================================

    const LOG_PREFIX = '[FactionOps]';

    function log(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function warn(...args) {
        console.warn(LOG_PREFIX, ...args);
    }

    function error(...args) {
        console.error(LOG_PREFIX, ...args);
    }

    // =========================================================================
    // SECTION 3: CSS INJECTION
    // =========================================================================

    function injectStyles() {
        const css = `
/* =====================================================================
   FactionOps CSS — all selectors prefixed with wb- to avoid Torn conflicts
   ===================================================================== */

/* Theme variables — dark by default, light via .wb-theme-light on <html> */
:root {
    --wb-bg: #1a1a2e;
    --wb-bg-secondary: #16213e;
    --wb-text: #e0e0e0;
    --wb-text-muted: #a0a0b8;
    --wb-accent: #0f3460;
    --wb-accent-15: rgba(15,52,96,0.15);
    --wb-accent-20: rgba(15,52,96,0.2);
    --wb-accent-30: rgba(15,52,96,0.3);
    --wb-call-green: #00b894;
    --wb-call-red: #e17055;
    --wb-call-blue: #0984e3;
    --wb-hospital-red: #d63031;
    --wb-travel-blue: #0984e3;
    --wb-jail-gray: #636e72;
    --wb-online-green: #00b894;
    --wb-idle-yellow: #fdcb6e;
    --wb-offline-gray: #636e72;
    --wb-bonus-warning: #ff7675;
    --wb-border: #2d3436;
    --wb-shadow: rgba(0,0,0,0.5);
    --wb-inset-glow: rgba(255,255,255,0.04);
    --wb-inset-border: rgba(255,255,255,0.03);
}

html.wb-theme-light {
    --wb-bg: #f5f5f5;
    --wb-bg-secondary: #ffffff;
    --wb-text: #2d3436;
    --wb-text-muted: #636e72;
    --wb-accent: #d6eaf8;
    --wb-accent-15: rgba(52,152,219,0.08);
    --wb-accent-20: rgba(52,152,219,0.1);
    --wb-accent-30: rgba(52,152,219,0.15);
    --wb-border: #dfe6e9;
    --wb-shadow: rgba(0,0,0,0.12);
    --wb-inset-glow: rgba(0,0,0,0.02);
    --wb-inset-border: rgba(0,0,0,0.05);
}

/* ----- Settings gear icon (bottom-right FAB) ----- */
.wb-settings-gear {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--wb-accent);
    color: var(--wb-text);
    border: 2px solid var(--wb-border);
    cursor: pointer;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    transition: transform 0.2s ease, background 0.2s ease;
    font-family: Arial, sans-serif;
}
.wb-settings-gear:hover {
    transform: scale(1.1);
    background: var(--wb-call-green);
}

/* ----- Settings modal overlay ----- */
.wb-settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
}
.wb-settings-modal {
    background: var(--wb-bg);
    border: 1px solid var(--wb-border);
    border-radius: 8px;
    width: 420px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
    color: var(--wb-text);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.wb-settings-modal h2 {
    margin: 0 0 18px;
    font-size: 18px;
    color: var(--wb-call-green);
    display: flex;
    align-items: center;
    gap: 8px;
}
.wb-settings-modal label {
    display: block;
    font-size: 12px;
    color: var(--wb-text);
    margin-bottom: 4px;
    opacity: 0.8;
}
.wb-settings-modal input[type="text"],
.wb-settings-modal input[type="password"] {
    width: 100%;
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid var(--wb-border);
    background: var(--wb-bg-secondary);
    color: var(--wb-text);
    font-size: 13px;
    margin-bottom: 14px;
    box-sizing: border-box;
    font-family: monospace;
}
.wb-settings-modal input:focus {
    outline: none;
    border-color: var(--wb-call-green);
}
.wb-settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}
.wb-settings-row span {
    font-size: 13px;
}

/* Toggle switch */
.wb-toggle {
    position: relative;
    width: 44px;
    height: 24px;
    cursor: pointer;
}
.wb-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}
.wb-toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--wb-border);
    border-radius: 24px;
    transition: background 0.2s;
}
.wb-toggle-slider::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    left: 3px;
    bottom: 3px;
    background: var(--wb-text);
    border-radius: 50%;
    transition: transform 0.2s;
}
.wb-toggle input:checked + .wb-toggle-slider {
    background: var(--wb-call-green);
}
.wb-toggle input:checked + .wb-toggle-slider::before {
    transform: translateX(20px);
}

/* Buttons in settings */
.wb-btn {
    padding: 6px 14px;
    border-radius: 4px;
    border: 1px solid var(--wb-border);
    background: var(--wb-accent);
    color: var(--wb-text);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: Arial, sans-serif;
}
.wb-btn:hover {
    background: var(--wb-call-green);
    color: #fff;
}
.wb-btn-danger {
    background: var(--wb-call-red);
}
.wb-btn-danger:hover {
    background: #c0392b;
}
.wb-btn-sm {
    padding: 3px 8px;
    font-size: 11px;
}
.wb-settings-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 18px;
}

/* Connection status indicator */
.wb-connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-bottom: 14px;
    padding: 6px 10px;
    border-radius: 4px;
    background: var(--wb-bg-secondary);
}
.wb-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
}
.wb-status-dot.connected    { background: var(--wb-call-green); }
.wb-status-dot.disconnected { background: var(--wb-call-red); }
.wb-status-dot.connecting   { background: var(--wb-idle-yellow); animation: wb-pulse 1s ease-in-out infinite; }

/* ----- Chain monitor bar (fixed at top) ----- */
.wb-chain-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999999 !important;
    padding: 8px 16px;
    background: linear-gradient(135deg, var(--wb-bg) 0%, var(--wb-accent) 100%);
    color: var(--wb-text);
    font-family: Arial, sans-serif;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 2px solid var(--wb-border);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: background 0.3s;
}
.wb-chain-bar.wb-chain-safe {
    border-bottom-color: var(--wb-call-green);
}
.wb-chain-bar.wb-chain-approaching {
    border-bottom-color: var(--wb-idle-yellow);
    background: linear-gradient(135deg, #2d2a0e 0%, #3b3a0c 100%);
}
.wb-chain-bar.wb-chain-imminent {
    border-bottom-color: var(--wb-bonus-warning);
    background: linear-gradient(135deg, #2e0f0f 0%, #4a1010 100%);
    animation: wb-chain-pulse 0.6s ease-in-out infinite alternate;
}
.wb-chain-section {
    display: flex;
    align-items: center;
    gap: 8px;
}
.wb-chain-count {
    font-weight: bold;
    font-size: 16px;
}
.wb-chain-timeout {
    font-family: monospace;
    font-size: 14px;
}
.wb-chain-bonus {
    padding: 2px 8px;
    border-radius: 3px;
    background: var(--wb-bonus-warning);
    color: #000;
    font-weight: bold;
    font-size: 11px;
    text-transform: uppercase;
}
.wb-chain-bar .wb-chain-minimize {
    cursor: pointer;
    font-size: 16px;
    opacity: 0.7;
    transition: opacity 0.15s;
}
.wb-chain-bar .wb-chain-minimize:hover {
    opacity: 1;
}

/* ----- Standalone Next Up bar (replaces chain bar) ----- */
.wb-next-up-standalone {
    padding: 6px 12px;
    background: var(--wb-bg);
    border-bottom: 1px solid var(--wb-border);
    font-family: Arial, sans-serif;
}
.wb-next-up-standalone:empty,
.wb-next-up-standalone .wb-next-up:empty {
    display: none;
}

/* ----- Next Up queue ----- */
.wb-next-up {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--wb-text);
    opacity: 0.85;
}
.wb-next-up-label {
    font-weight: 600;
    color: var(--wb-idle-yellow);
    white-space: nowrap;
}
.wb-next-up-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    padding: 2px 6px;
    white-space: nowrap;
}
.wb-next-up-item .wb-next-timer {
    font-family: monospace;
    color: #e74c3c;
    font-weight: 700;
}
.wb-next-up-item.wb-next-imminent {
    background: rgba(214,48,49,0.2);
    animation: wb-pulse 1s ease-in-out infinite;
}
.wb-next-up-item.wb-next-imminent .wb-next-timer {
    color: #ff4444;
}
.wb-next-up-call {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--wb-call-blue);
    background: transparent;
    color: var(--wb-call-blue);
    cursor: pointer;
    line-height: 1.2;
    margin-left: 2px;
}
.wb-next-up-call:hover {
    background: var(--wb-call-blue);
    color: #fff;
}

/* ----- FactionOps cell container — right-aligned in each row ----- */
.wb-cell-container {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 6px;
    align-items: center;
    z-index: 5;
    flex-shrink: 0;
}

/* Ensure rows have room for our right-aligned cells */
.wb-sortable-row {
    position: relative !important;
    padding-right: 300px !important;
    transition: transform 0.3s ease, opacity 0.3s ease;
}

/* ----- Call / Status elements in member rows ----- */
.wb-cell {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    font-family: Arial, sans-serif;
    font-size: 11px;
    vertical-align: middle;
}
/* Attack button */
.wb-attack-btn {
    padding: 2px 10px;
    border-radius: 12px;
    border: 1px solid var(--wb-call-red);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.1s;
    font-family: Arial, sans-serif;
    white-space: nowrap;
    background: rgba(225,112,85,0.15);
    color: var(--wb-call-red);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
}
.wb-attack-btn:hover {
    background: var(--wb-call-red);
    color: #fff;
    transform: scale(1.05);
}

.wb-call-btn {
    padding: 2px 10px;
    border-radius: 12px;
    border: 1px solid var(--wb-border);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.1s;
    font-family: Arial, sans-serif;
    white-space: nowrap;
}
.wb-call-btn {
    background: rgba(9,132,227,0.15);
    color: var(--wb-call-blue);
    border-color: var(--wb-call-blue);
}
.wb-call-btn:hover {
    background: var(--wb-call-blue);
    color: #fff;
    transform: scale(1.05);
}
.wb-call-btn.wb-called-self {
    background: var(--wb-call-green);
    color: #fff;
    font-weight: bold;
}
.wb-call-btn.wb-called-other {
    background: rgba(225,112,85,0.15);
    color: var(--wb-call-red);
    border-color: var(--wb-call-red);
    cursor: default;
}
.wb-uncall-btn {
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid var(--wb-call-red);
    background: transparent;
    color: var(--wb-call-red);
    font-size: 10px;
    cursor: pointer;
    margin-left: 4px;
    transition: background 0.15s;
    font-family: Arial, sans-serif;
}
.wb-uncall-btn:hover {
    background: var(--wb-call-red);
    color: #fff;
}

/* Priority tag badges */
.wb-priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    font-family: Arial, sans-serif;
    cursor: default;
}
.wb-priority-high {
    background: rgba(214,48,49,0.2);
    color: var(--wb-hospital-red);
    border: 1px solid rgba(214,48,49,0.4);
}
.wb-priority-medium {
    background: rgba(253,203,110,0.15);
    color: var(--wb-idle-yellow);
    border: 1px solid rgba(253,203,110,0.3);
}
.wb-priority-low {
    background: rgba(9,132,227,0.15);
    color: var(--wb-travel-blue);
    border: 1px solid rgba(9,132,227,0.3);
}
/* Priority selector (leader only) */
.wb-priority-select {
    padding: 1px 4px;
    border-radius: 10px;
    border: 1px solid var(--wb-border);
    background: var(--wb-bg-secondary);
    color: var(--wb-text);
    font-size: 9px;
    font-family: Arial, sans-serif;
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    text-align: center;
    min-width: 52px;
}
.wb-priority-select:focus {
    border-color: var(--wb-call-green);
}
.wb-priority-select option {
    background: var(--wb-bg);
    color: var(--wb-text);
}

/* Status badges */
.wb-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: bold;
    white-space: nowrap;
    font-family: Arial, sans-serif;
}
.wb-status-ok       { background: rgba(0,184,148,0.15); color: var(--wb-call-green); }
.wb-status-hospital { background: rgba(214,48,49,0.15); color: var(--wb-hospital-red); }
.wb-status-travel   { background: rgba(9,132,227,0.15); color: var(--wb-travel-blue); }
.wb-status-jail     { background: rgba(99,110,114,0.15); color: var(--wb-jail-gray); }

/* Online activity dot */
.wb-activity-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 3px;
    flex-shrink: 0;
}
.wb-activity-online  { background: var(--wb-online-green); }
.wb-activity-idle    { background: var(--wb-idle-yellow); }
.wb-activity-offline { background: var(--wb-offline-gray); }

/* Row highlights */
.wb-row-called {
    background: rgba(0,184,148,0.06) !important;
}


/* (transition rule merged into .wb-sortable-row above) */



/* ----- Group attack / viewers indicator ----- */
.wb-viewers-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(108,92,231,0.2);
    border: 1px solid rgba(108,92,231,0.4);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10px;
    font-weight: 600;
    color: #a29bfe;
    white-space: nowrap;
    animation: wb-pulse 1.5s ease-in-out infinite;
}
.wb-viewers-badge.wb-viewers-multi {
    background: rgba(214,48,49,0.2);
    border-color: rgba(214,48,49,0.5);
    color: #ff7675;
}

/* ----- BSP / FFS stat display ----- */
.wb-bsp-cell {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    min-width: 48px;
    font-family: monospace;
}
.wb-bsp-value {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    line-height: 1.2;
}
.wb-bsp-value.wb-bsp-tier-s {
    color: var(--wb-call-red);
}
.wb-bsp-value.wb-bsp-tier-a {
    color: var(--wb-idle-yellow);
}
.wb-bsp-value.wb-bsp-tier-b {
    color: var(--wb-call-green);
}
.wb-bsp-value.wb-bsp-tier-c {
    color: var(--wb-text-muted);
}
.wb-bsp-value.wb-bsp-tier-unknown {
    color: var(--wb-jail-gray);
    font-weight: 400;
}
.wb-bsp-source {
    font-size: 7px;
    font-weight: 400;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.45;
    line-height: 1;
}

/* ----- Attack page overlay ----- */
.wb-attack-overlay {
    position: fixed;
    top: 60px;
    right: 16px;
    z-index: 999997;
    background: var(--wb-bg);
    border: 1px solid var(--wb-border);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--wb-text);
    font-family: Arial, sans-serif;
    font-size: 12px;
    min-width: 200px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.wb-attack-overlay h4 {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--wb-call-green);
}
.wb-attack-overlay .wb-attack-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}
#wb-assist-btn {
    position: fixed;
    bottom: 72px;
    right: 14px;
    z-index: 9999999 !important;
    background: linear-gradient(135deg, #ff6b52, #e03a3a);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 6px 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Open Sans", Arial, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(214, 48, 49, 0.35), inset 0 1px 0 rgba(255,255,255,0.12);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
}
#wb-assist-btn .wb-assist-icon {
    width: 12px;
    height: 12px;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 0 rgba(0,0,0,0.25));
}
#wb-assist-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(214, 48, 49, 0.5), inset 0 1px 0 rgba(255,255,255,0.18);
}
#wb-assist-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 4px rgba(214, 48, 49, 0.4), inset 0 1px 0 rgba(0,0,0,0.12);
}
#wb-assist-btn:disabled {
    background: linear-gradient(135deg, #4a5258, #2d3436);
    color: #b0b8bc;
    border-color: rgba(255,255,255,0.04);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: not-allowed;
    transform: none;
}

/* ----- Animations ----- */
@keyframes wb-pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
}
@keyframes wb-chain-pulse {
    from { box-shadow: 0 0 8px rgba(255,118,117,0.3); }
    to   { box-shadow: 0 0 20px rgba(255,118,117,0.7); }
}

/* Ensure Torn content doesn't sit under our chain bar */
body.wb-chain-active {
    padding-top: 42px !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   FactionOps Full Overlay (fo- prefix)
   ══════════════════════════════════════════════════════════════════════════ */

/* ── War Board Container ── */
.fo-overlay {
    width: 100%;
    max-width: 1000px;
    background: var(--wb-bg);
    border: 1px solid var(--wb-border);
    border-radius: 10px;
    box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.03),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
    overflow: hidden;
    height: fit-content;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: var(--wb-text);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 10px auto;
    box-sizing: border-box;
}
.fo-overlay *, .fo-overlay *::before, .fo-overlay *::after { box-sizing: border-box; }

/* ── Header Bar ── */
.fo-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--wb-bg-secondary);
    border-bottom: 1px solid var(--wb-border);
    gap: 4px 10px;
}

.fo-header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 1;
    min-width: 0;
    overflow: visible;
}

.fo-header-center {
    flex: 0 0 100%;
    justify-content: center;
    order: 10;
}

.fo-logo-mark {
    display: flex;
    align-items: center;
    gap: 6px;
}

.fo-logo-icon { width: 20px; height: 20px; }

.fo-logo-text {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--wb-text);
    white-space: nowrap;
}

.fo-status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #00b894;
    box-shadow: 0 0 6px rgba(0,184,148,0.6);
    animation: fo-pulse-glow 2s ease-in-out infinite;
    flex-shrink: 0;
}
.fo-status-dot.disconnected {
    background: #e17055;
    box-shadow: 0 0 6px rgba(225,112,85,0.6);
}

@keyframes fo-pulse-glow {
    0%, 100% { box-shadow: 0 0 6px rgba(0,184,148,0.4); }
    50% { box-shadow: 0 0 10px rgba(0,184,148,0.8); }
}

.fo-header-center {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--wb-text-muted);
    white-space: nowrap;
    /* flex/order/width set in .fo-header > .fo-header-center rule above */
}

.fo-header-center strong { color: var(--wb-text); font-weight: 600; }

.fo-war-badge {
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 6px; border-radius: 4px;
    background: rgba(225,112,85,0.15);
    color: #e17055;
    border: 1px solid rgba(225,112,85,0.25);
}

.fo-header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 1;
    flex-wrap: nowrap;
    overflow: visible;
}

.fo-online-badge {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500;
    color: #00b894;
    background: rgba(0,184,148,0.1);
    border: 1px solid rgba(0,184,148,0.2);
    padding: 3px 8px; border-radius: 20px;
}

.fo-online-badge .fo-dot {
    width: 6px; height: 6px;
    border-radius: 50%; background: #00b894;
}

/* ── Torn native chain bar in header ── */
.fo-torn-chain {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
.fo-torn-chain #barChain,
.fo-torn-chain a#barChain,
.fo-torn-chain [id="barChain"] {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: relative !important;
    width: auto !important;
    min-width: 160px;
    max-width: 260px;
    height: auto !important;
    min-height: 20px;
    border-radius: 12px;
    overflow: visible !important;
    background: rgba(44,62,80,0.6) !important;
    padding: 2px 10px !important;
    align-items: center;
    gap: 4px;
}
.fo-torn-chain #barChain p,
.fo-torn-chain #barChain span {
    display: inline !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: relative !important;
    font-size: 11px !important;
    line-height: 18px !important;
    color: #dfe6e9 !important;
    white-space: nowrap !important;
}
/* Make the timer text stand out */
.fo-torn-chain #barChain p[class*="bar-timeleft"] {
    color: #fdcb6e !important;
    font-weight: 600 !important;
}
/* Make the chain count stand out */
.fo-torn-chain #barChain p[class*="bar-stats"] {
    color: #00b894 !important;
    font-weight: 700 !important;
}
/* Energy bar display in overlay header */
.fo-energy-display {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600;
    padding: 3px 10px; border-radius: 20px;
    background: rgba(44,62,80,0.7);
    border: 1px solid rgba(116,185,255,0.25);
    white-space: nowrap;
    cursor: default;
}
.fo-energy-label { color: rgba(255,255,255,0.45); font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
.fo-energy-value { color: #74b9ff; font-weight: 700; font-variant-numeric: tabular-nums; }
.fo-energy-value.full { color: #55efc4; }
.fo-energy-timer { color: #fdcb6e; font-size: 10px; font-weight: 500; font-variant-numeric: tabular-nums; }

/* Live chain count + timer display */
.fo-chain-live {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600;
    padding: 3px 12px; border-radius: 20px;
    background: rgba(44,62,80,0.7);
    border: 1px solid rgba(0,184,148,0.25);
    white-space: nowrap;
}
.fo-chain-live-count { color: #00b894; font-weight: 700; }
.fo-chain-live-sep { color: rgba(255,255,255,0.3); font-weight: 400; }
.fo-chain-live-timer { color: #fdcb6e; font-weight: 600; font-variant-numeric: tabular-nums; }
.fo-chain-live-timer.danger { color: #e17055; animation: fo-pulse 0.6s infinite alternate; }
.fo-chain-live-bonus { color: #e17055; font-weight: 700; font-size: 10px; margin-left: 2px; }
@keyframes fo-pulse { from { opacity: 1; } to { opacity: 0.4; } }

/* Ranked war timer (estimated time to target drop win) */
.fo-war-timer {
    display: flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 600;
    padding: 3px 8px; border-radius: 20px;
    flex-shrink: 0;
    background: rgba(108,92,231,0.15);
    border: 1px solid rgba(108,92,231,0.3);
    white-space: nowrap;
    cursor: pointer;
}
.fo-war-timer-icon { font-size: 12px; }
.fo-war-timer-label { opacity: 0.6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.fo-war-timer-value { font-variant-numeric: tabular-nums; font-weight: 700; }
.fo-war-timer.safe .fo-war-timer-value { color: #00b894; }
.fo-war-timer.warning .fo-war-timer-value { color: #fdcb6e; }
.fo-war-timer.danger .fo-war-timer-value { color: #e17055; animation: fo-pulse 0.6s infinite alternate; }
.fo-war-timer.waiting .fo-war-timer-value { color: #e17055; font-size: 10px; }
.fo-war-timer { position: relative; }
.fo-war-timer-detail {
    display: none; position: absolute; top: calc(100% + 6px); left: 0;
    background: #1e272e !important; border: 1px solid rgba(108,92,231,0.4);
    border-radius: 8px; padding: 10px 14px; min-width: 200px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 9999;
    font-size: 11px; font-weight: 400; white-space: normal; color: #dfe6e9 !important;
}
.fo-war-timer-detail.open { display: block; }
.fo-war-timer-detail-row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
.fo-war-timer-detail-label { color: rgba(255,255,255,0.5) !important; }
.fo-war-timer-detail-val { color: #dfe6e9 !important; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }


/* Fallback: custom chain info when Torn bar not found */
.fo-chain-info {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 500;
    padding: 3px 10px; border-radius: 20px;
    background: rgba(0,184,148,0.1);
    border: 1px solid rgba(0,184,148,0.2);
    color: var(--wb-text);
}
.fo-chain-info .fo-chain-label { opacity: 0.6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.fo-chain-info .fo-chain-count { color: #00b894; font-weight: 700; }
.fo-chain-info .fo-chain-timeout { color: #fdcb6e; font-weight: 600; }
.fo-chain-info .fo-chain-timeout.danger { color: var(--wb-hospital-red); }
.fo-chain-info .fo-chain-bonus { color: var(--wb-bonus-warning); font-weight: 700; font-size: 10px; }

/* ── Settings button in header ── */
.fo-settings-btn {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(99,110,114,0.2);
    border: 1px solid rgba(99,110,114,0.3);
    color: #b0b0c0; font-size: 15px;
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: all 0.15s ease; padding: 0; line-height: 1;
}
.fo-settings-btn:hover {
    background: rgba(99,110,114,0.35);
    color: var(--wb-text);
}

/* ── Next Up bar (inside overlay) ── */
.fo-next-up-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 12px;
    background: var(--wb-accent-15);
    border-bottom: 1px solid rgba(45,52,54,0.4);
    font-size: 11px; min-height: 0;
    overflow-x: auto; overflow-y: hidden;
    white-space: nowrap;
}
.fo-next-up-bar:empty { display: none; }
.fo-next-up-label {
    font-weight: 600; color: #fdcb6e;
    white-space: nowrap; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.05em;
}
.fo-next-up-item {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(45,52,54,0.5);
    border-radius: 14px; padding: 2px 8px;
    white-space: nowrap; font-size: 11px; color: #b0b0c0;
}
.fo-next-up-item a { text-decoration: none; color: var(--wb-text); font-weight: 500; }
.fo-next-up-timer {
    font-family: 'JetBrains Mono', monospace;
    color: #e74c3c; font-weight: 700; font-size: 10px;
}
.fo-next-up-item.imminent {
    background: rgba(214,48,49,0.15);
    border-color: rgba(214,48,49,0.3);
}
.fo-next-up-item.imminent .fo-next-up-timer {
    color: #ff4444;
}
.fo-next-up-call {
    font-size: 8px; font-weight: 700;
    padding: 1px 5px; border-radius: 10px;
    border: 1px solid rgba(0,184,148,0.35);
    background: transparent; color: #00b894;
    cursor: pointer; line-height: 1.2;
}
.fo-next-up-call:hover {
    background: rgba(0,184,148,0.15);
}

/* ── Activate FactionOps button (compact pill, left-aligned) ── */
#fo-activate-btn {
    position: fixed !important;
    top: 38px !important;
    left: 10px !important;
    z-index: 99999 !important;
    display: flex !important; align-items: center !important; gap: 4px !important;
    padding: 4px 10px !important;
    font-family: Arial, sans-serif !important;
    font-size: 11px !important; font-weight: 600 !important;
    border: 1px solid #555 !important;
    border-radius: 12px !important;
    background: rgba(30,30,30,0.9) !important; color: #e0e0e0 !important;
    cursor: pointer !important; transition: all 0.2s ease !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
}
#fo-activate-btn:hover {
    background: rgba(50,50,50,0.95) !important;
    border-color: #777 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
}
#fo-activate-btn .fo-activate-icon {
    font-size: 12px; line-height: 1;
}

/* ── Column labels ── */
.fo-col-headers {
    display: grid;
    grid-template-columns: 58px 1fr 52px 82px 130px 44px 180px 72px;
    gap: 0; padding: 7px 16px;
    background: var(--wb-accent-20);
    border-bottom: 1px solid var(--wb-border);
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: #636e72; user-select: none;
}

.fo-col-header { padding: 0 4px; white-space: nowrap; }
.fo-col-header.center { text-align: center; }
.fo-col-header.right { text-align: right; }

/* ── Target Rows ── */
.fo-target-list { list-style: none; margin: 0; padding: 0; }

.fo-row {
    display: grid;
    grid-template-columns: 58px 1fr 52px 82px 130px 44px 180px 72px;
    gap: 0; align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(45,52,54,0.5);
    background: var(--wb-bg);
    transition: background 0.15s ease;
    position: relative;
}

.fo-row.is-called::before {
    content: '';
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px; border-radius: 0 2px 2px 0;
}

.fo-row:hover { background: var(--wb-accent-20); }
.fo-row:last-child { border-bottom: none; }

.fo-row.is-hospital,
.fo-row.is-jail,
.fo-row.is-travel { opacity: 0.5; }

.fo-row.is-hospital:hover,
.fo-row.is-jail:hover,
.fo-row.is-travel:hover { opacity: 0.7; }

.fo-row.is-called::before { background: #00b894; }
.fo-row.is-called { background: rgba(0,184,148,0.04); }

/* ── Cell styles ── */
.fo-cell { padding: 0 4px; display: flex; align-items: center; min-width: 0; overflow: hidden; }
.fo-cell.center { justify-content: center; }

.fo-priority-badge {
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 4px;
    white-space: nowrap; line-height: 1.4;
}

.fo-priority-badge.high {
    background: rgba(225,112,85,0.15); color: #e17055;
    border: 1px solid rgba(225,112,85,0.3);
}
.fo-priority-badge.med {
    background: rgba(253,203,110,0.12); color: #fdcb6e;
    border: 1px solid rgba(253,203,110,0.25);
}
.fo-priority-badge.low {
    background: rgba(9,132,227,0.12); color: #0984e3;
    border: 1px solid rgba(9,132,227,0.25);
}

.fo-priority-select {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em;
    background: var(--wb-accent-30); color: var(--wb-text-muted);
    border: 1px solid rgba(45,52,54,0.8); border-radius: 4px;
    padding: 2px 4px; cursor: pointer; outline: none;
    -webkit-appearance: none; appearance: none;
    width: 50px; text-align: center;
}
.fo-priority-select:hover { border-color: rgba(99,110,114,0.6); }
.fo-priority-select option { background: var(--wb-bg-secondary); color: var(--wb-text); }

/* Player Name */
.fo-player-name { display: flex; flex-direction: column; gap: 0; min-width: 0; }

.fo-player-name .fo-name-row {
    display: flex; align-items: center; gap: 6px;
}

.fo-player-name .fo-name {
    font-weight: 600; font-size: 12.5px; color: var(--wb-text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}


.fo-player-name .fo-pid { font-size: 10px; color: #636e72; font-weight: 400; }
.fo-sub-row { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.fo-bsp-inline {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 600;
    padding: 1px 4px; border-radius: 8px;
    background: rgba(255,255,255,0.06);
    line-height: 1;
}
.fo-bsp-inline.tier-s { color: #e17055; }
.fo-bsp-inline.tier-a { color: #fdcb6e; }
.fo-bsp-inline.tier-b { color: #00b894; }
.fo-bsp-inline.tier-c { color: var(--wb-text-muted); }
.fo-bsp-inline.tier-unknown { color: #4a4a5a; }

/* ── Group Attack Eye Badge ── */
.fo-eye-badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 9px; font-weight: 600;
    color: #fdcb6e;
    background: rgba(253,203,110,0.12);
    border: 1px solid rgba(253,203,110,0.25);
    border-radius: 3px; padding: 1px 5px;
    white-space: nowrap; cursor: default; line-height: 1.3;
}

.fo-eye-badge .fo-eye-icon { font-size: 10px; line-height: 1; }

/* Level */
.fo-level {
    font-size: 11px; font-weight: 500; color: var(--wb-text-muted);
    text-align: center; white-space: nowrap;
}

/* BSP Stats */
.fo-bsp-stat {
    font-size: 11px; font-weight: 600; text-align: center;
    white-space: nowrap; letter-spacing: 0.02em;
}
.fo-bsp-stat.tier-s { color: #e17055; text-shadow: 0 0 8px rgba(225,112,85,0.3); }
.fo-bsp-stat.tier-a { color: #fdcb6e; }
.fo-bsp-stat.tier-b { color: #00b894; }
.fo-bsp-stat.tier-c { color: var(--wb-text-muted); }
.fo-bsp-stat.tier-unknown { color: #4a4a5a; font-weight: 400; font-style: italic; }

.fo-bsp-source {
    font-size: 8px; font-weight: 400;
    letter-spacing: 0.04em; text-transform: uppercase;
    opacity: 0.5; display: block; margin-top: 1px;
}

/* Fair Fight inline badge (sits in sub-row next to BSP) */
.fo-ff-inline {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 700;
    padding: 1px 5px; border-radius: 8px;
    line-height: 1; white-space: nowrap;
    display: inline-block;
}

/* Status Pill */
.fo-status-pill {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500;
    padding: 3px 8px; border-radius: 20px;
    white-space: nowrap; line-height: 1;
}
.fo-status-pill .fo-s-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.fo-status-pill.ok { background: rgba(0,184,148,0.1); color: #00b894; border: 1px solid rgba(0,184,148,0.2); }
.fo-status-pill.ok .fo-s-dot { background: #00b894; }
.fo-status-pill.hosp { background: rgba(225,112,85,0.1); color: #e17055; border: 1px solid rgba(225,112,85,0.2); }
.fo-status-pill.hosp .fo-s-dot { background: #e17055; }
.fo-status-pill.travel { background: rgba(9,132,227,0.1); color: #0984e3; border: 1px solid rgba(9,132,227,0.2); }
.fo-status-pill.travel .fo-s-dot { background: #0984e3; }
.fo-status-pill.jail { background: rgba(99,110,114,0.15); color: #b2bec3; border: 1px solid rgba(99,110,114,0.25); }
.fo-status-pill.jail .fo-s-dot { background: #636e72; }

/* Online indicator */
.fo-online-dot { width: 8px; height: 8px; border-radius: 50%; margin: 0 auto; }
.fo-online-dot.on { background: #4CAF50; box-shadow: 0 0 5px rgba(76,175,80,0.4); }
.fo-online-dot.idle { background: #fdcb6e; box-shadow: 0 0 5px rgba(253,203,110,0.3); }
.fo-online-dot.off { background: #636e72; }
.fo-rt-badge { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.04em; line-height: 1.3; display: none; }
.fo-rt-badge.rt { display: inline-block; background: rgba(0,184,148,0.18); color: #00b894; }
.fo-rt-badge.poll { display: inline-block; background: rgba(253,203,110,0.18); color: #fdcb6e; }

/* Call column */
.fo-call-cell { display: flex; align-items: center; gap: 4px; padding: 0 4px; min-width: 0; overflow: hidden; }

.fo-call-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em;
    padding: 4px 10px; border-radius: 20px;
    border: 1px solid rgba(9,132,227,0.4);
    background: rgba(9,132,227,0.1); color: #0984e3;
    cursor: pointer; transition: all 0.15s ease;
    white-space: nowrap; line-height: 1;
}
.fo-call-btn:hover {
    background: rgba(9,132,227,0.22);
    border-color: rgba(9,132,227,0.6);
    box-shadow: 0 0 8px rgba(9,132,227,0.2);
}

.fo-called-tag {
    display: flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 500;
    padding: 3px 8px; border-radius: 20px;
    white-space: nowrap; line-height: 1;
    min-width: 0; overflow: hidden; flex-shrink: 1;
}
.fo-called-tag.fo-called-mine {
    background: rgba(0,184,148,0.12);
    border: 1px solid rgba(0,184,148,0.25);
    color: #00b894;
}
.fo-called-tag.fo-called-other {
    background: rgba(225,112,85,0.12);
    border: 1px solid rgba(225,112,85,0.25);
    color: #e17055;
}
.fo-called-tag .fo-caller-name { max-width: 90px; overflow: hidden; text-overflow: ellipsis; }

.fo-uncall-btn {
    display: flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%;
    border: 1px solid rgba(225,112,85,0.3);
    background: rgba(225,112,85,0.1); color: #e17055;
    font-size: 10px; cursor: pointer;
    transition: all 0.15s ease; flex-shrink: 0; line-height: 1;
}
.fo-uncall-btn:hover {
    background: rgba(225,112,85,0.25);
    border-color: rgba(225,112,85,0.5);
}

/* Deal call styling */
.fo-called-tag.fo-called-deal {
    border-color: rgba(253,203,110,0.4);
    background: rgba(253,203,110,0.1);
}
.fo-called-tag.fo-called-deal.fo-called-mine {
    border-color: rgba(253,203,110,0.4);
    background: rgba(253,203,110,0.1);
    color: #fdcb6e;
}
.fo-called-tag.fo-called-deal.fo-called-other {
    border-color: rgba(253,203,110,0.4);
    background: rgba(253,203,110,0.1);
    color: #fdcb6e;
}
.fo-deal-badge {
    font-size: 9px; font-weight: 700;
    padding: 1px 5px; border-radius: 8px;
    background: rgba(253,203,110,0.2);
    color: #fdcb6e;
    white-space: nowrap; flex-shrink: 0;
}

/* Attack button */
.fo-attack-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em;
    padding: 4px 10px; border-radius: 20px;
    border: 1px solid rgba(225,112,85,0.4);
    background: transparent; color: #e17055;
    cursor: pointer; transition: all 0.15s ease;
    text-decoration: none;
    display: inline-flex; align-items: center; gap: 4px;
    line-height: 1; white-space: nowrap;
}
.fo-attack-btn:hover {
    background: rgba(225,112,85,0.15);
    border-color: rgba(225,112,85,0.6);
    box-shadow: 0 0 10px rgba(225,112,85,0.15);
    color: #e17055;
}
.fo-attack-btn .fo-arrow { font-size: 11px; line-height: 1; }

/* ── Footer ── */
.fo-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px;
    background: var(--wb-accent-15);
    border-top: 1px solid var(--wb-border);
    font-size: 10px; color: #636e72;
}
.fo-footer-stats { display: flex; gap: 16px; }
.fo-footer-stat { display: flex; align-items: center; gap: 4px; }
.fo-footer-stat .fo-val { color: var(--wb-text-muted); font-weight: 600; }
.fo-footer-version { font-size: 9px; color: #4a4a5a; letter-spacing: 0.04em; }

/* ── Scrollbar inside overlay ── */
.fo-overlay ::-webkit-scrollbar { width: 6px; }
.fo-overlay ::-webkit-scrollbar-track { background: transparent; }
.fo-overlay ::-webkit-scrollbar-thumb { background: var(--wb-border); border-radius: 3px; }
.fo-overlay ::-webkit-scrollbar-thumb:hover { background: #636e72; }

/* ── Responsive ── */
@media (max-width: 700px) {
    .fo-overlay { border-radius: 6px; margin: 4px 0; }
    .fo-header { gap: 4px 8px; padding: 6px 10px; }
    .fo-col-headers, .fo-row {
        /* Prior | Target | (Lvl hidden) | (BSP hidden) | Status | On | Call | Action */
        grid-template-columns: 30px 1fr 0px 0px 40px 18px 56px 52px;
        padding: 7px 8px;
        column-gap: 6px;
        font-size: 11px;
    }
    /* Hide level and BSP columns on mobile (keep in grid flow) */
    .fo-col-headers > :nth-child(3),
    .fo-row > :nth-child(3),
    .fo-col-headers > :nth-child(4),
    .fo-row > :nth-child(4) { visibility: hidden; overflow: hidden; padding: 0 !important; margin: 0; min-width: 0; max-width: 0; font-size: 0; }
    .fo-footer { padding: 6px 12px; flex-wrap: wrap; gap: 4px; }
    .fo-footer-stats { gap: 10px; flex-wrap: wrap; }
    .fo-attack-btn { padding: 3px 8px; font-size: 9px; }
    .fo-call-btn { padding: 3px 8px; font-size: 9px; }
    .fo-called-tag { padding: 2px 6px; font-size: 9px; }
    .fo-called-tag .fo-caller-name { max-width: 34px; }
    .fo-call-cell { overflow: hidden; max-width: 100%; }
    .fo-status-pill { padding: 2px 4px; font-size: 9px; min-width: 0; max-width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fo-player-name .fo-name { font-size: 11.5px; }
    .fo-player-name .fo-pid { font-size: 9px; }
    .fo-bsp-stat { font-size: 10px; }
    .fo-priority-badge { font-size: 8px; padding: 2px 6px; }
    .fo-priority-select { width: 38px; font-size: 8px; }
    /* Center status pill and online dot */
    .fo-row > :nth-child(5) { justify-content: center; }
    .fo-online-dot { margin: 0 auto; }
    .fo-col-headers > :nth-child(5) { text-align: center; }
    .fo-col-headers > :nth-child(6) { text-align: center; }
}

/* ----- Heatmap toggle button (fixed bottom-right, next to settings gear) ----- */
.wb-heatmap-btn {
    position: fixed;
    bottom: 20px;
    right: 70px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--wb-accent);
    color: var(--wb-text);
    border: 2px solid var(--wb-border);
    cursor: pointer;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    transition: transform 0.2s ease, background 0.2s ease;
    font-family: Arial, sans-serif;
}
.wb-heatmap-btn:hover {
    transform: scale(1.1);
    background: var(--wb-call-green);
}

/* ----- Heatmap floating panel ----- */
.wb-heatmap-panel {
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--wb-bg);
    border: 1px solid var(--wb-border);
    border-radius: 8px;
    z-index: 1000000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    color: var(--wb-text);
    font-family: monospace;
    min-width: 420px;
    max-width: 95vw;
}
.wb-heatmap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: grab;
    border-bottom: 1px solid var(--wb-border);
    font-size: 14px;
    font-weight: bold;
    color: var(--wb-call-green);
    user-select: none;
}
.wb-heatmap-close {
    background: none;
    border: none;
    color: var(--wb-text);
    font-size: 20px;
    cursor: pointer;
    opacity: 0.6;
    padding: 0 4px;
}
.wb-heatmap-close:hover { opacity: 1; }

.wb-heatmap-grid {
    display: grid;
    grid-template-columns: 36px repeat(24, 16px);
    gap: 2px;
    padding: 10px 14px;
    justify-content: center;
}
.wb-heatmap-label {
    font-size: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
}
.wb-heatmap-day {
    justify-content: flex-end;
    padding-right: 4px;
}
.wb-heatmap-cell {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    cursor: default;
}
.wb-heatmap-footer {
    padding: 8px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--wb-border);
}
/* ----- Scout Report modal ----- */
.wb-scout-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 1000001;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
}
.wb-scout-modal {
    background: var(--wb-bg);
    border: 1px solid var(--wb-border);
    border-radius: 8px;
    width: 750px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    color: var(--wb-text);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.wb-scout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--wb-border);
}
.wb-scout-header h2 {
    margin: 0;
    font-size: 16px;
    color: var(--wb-call-green);
}
.wb-scout-close {
    background: none;
    border: none;
    color: var(--wb-text);
    font-size: 22px;
    cursor: pointer;
    opacity: 0.6;
    padding: 0 4px;
}
.wb-scout-close:hover { opacity: 1; }
.wb-scout-body {
    padding: 16px 20px;
}
.wb-scout-section {
    margin-bottom: 16px;
}
.wb-scout-section h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: var(--wb-call-green);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--wb-border);
    padding-bottom: 4px;
}
.wb-scout-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    font-size: 12px;
}
.wb-scout-grid .wb-scout-label {
    color: var(--wb-text-muted);
}
.wb-scout-grid .wb-scout-value {
    font-weight: 600;
    text-align: right;
}
.wb-scout-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 4px;
}
.wb-scout-table th {
    text-align: left;
    font-size: 10px;
    color: var(--wb-text-muted);
    padding: 3px 6px;
    border-bottom: 1px solid var(--wb-border);
    text-transform: uppercase;
}
.wb-scout-table td {
    padding: 3px 6px;
    border-bottom: 1px solid var(--wb-border);
    color: var(--wb-text);
}
.wb-scout-table tr:last-child td { border-bottom: none; }
.wb-scout-bar {
    height: 6px;
    border-radius: 3px;
    background: var(--wb-accent);
    overflow: hidden;
    margin-top: 2px;
}
.wb-scout-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}
.wb-scout-threat {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
}
.wb-scout-threat.critical { background: #d63031; color: #fff; }
.wb-scout-threat.high { background: #e17055; color: #fff; }
.wb-scout-threat.medium { background: #fdcb6e; color: #2d3436; }
.wb-scout-threat.low { background: #636e72; color: #fff; }
.wb-scout-summary-box {
    background: var(--wb-bg-secondary);
    border: 1px solid var(--wb-border);
    border-radius: 6px;
    padding: 12px;
    font-size: 12px;
    line-height: 1.5;
}
.wb-scout-summary-box .wb-scout-pill {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    margin: 1px 2px;
}
.wb-scout-pill.strength { background: rgba(0,184,148,0.2); color: #00b894; }
.wb-scout-pill.weakness { background: rgba(214,48,49,0.2); color: #ff7675; }
.wb-scout-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 12px;
    color: var(--wb-text-muted);
    font-size: 13px;
}
.wb-scout-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--wb-border);
    border-top-color: var(--wb-call-green);
    border-radius: 50%;
    animation: wb-spin 0.8s linear infinite;
}
@keyframes wb-spin { to { transform: rotate(360deg); } }
.wb-scout-compare {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0;
    font-size: 12px;
    margin-bottom: 8px;
}
.wb-scout-compare-side {
    padding: 8px;
    border-radius: 6px;
}
.wb-scout-compare-side.ours { background: rgba(0,184,148,0.08); }
.wb-scout-compare-side.theirs { background: rgba(214,48,49,0.08); }
.wb-scout-compare-vs {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11px;
    color: var(--wb-text-muted);
    padding: 0 8px;
}
.wb-scout-compare-side h4 {
    margin: 0 0 6px 0;
    font-size: 12px;
    font-weight: 700;
}
.wb-scout-compare-side.ours h4 { color: #00b894; }
.wb-scout-compare-side.theirs h4 { color: #d63031; }
.wb-scout-compare-row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
}
.wb-scout-compare-row .lbl { color: var(--wb-text-muted); }
.wb-scout-compare-row .val { font-weight: 600; }
.wb-scout-win-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    margin: 4px 0;
}
.wb-scout-win-badge.high { background: rgba(0,184,148,0.25); color: #00b894; }
.wb-scout-win-badge.mid { background: rgba(253,203,110,0.25); color: #fdcb6e; }
.wb-scout-win-badge.low { background: rgba(214,48,49,0.25); color: #ff7675; }
.wb-scout-matchup-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: 4px;
}
.wb-scout-matchup-table th {
    text-align: center;
    font-size: 10px;
    color: var(--wb-text-muted);
    padding: 3px 4px;
    border-bottom: 1px solid var(--wb-border);
    text-transform: uppercase;
}
.wb-scout-matchup-table td {
    padding: 3px 4px;
    border-bottom: 1px solid rgba(45,52,54,0.3);
    text-align: center;
}
.wb-scout-matchup-table tr:last-child td { border-bottom: none; }
.wb-scout-matchup-table .adv-ours { color: #00b894; }
.wb-scout-matchup-table .adv-theirs { color: #ff7675; }
.wb-scout-matchup-table .adv-even { color: #636e72; }
.wb-scout-tier-row {
    display: grid;
    grid-template-columns: 50px 1fr 30px 30px 1fr;
    gap: 4px;
    align-items: center;
    font-size: 11px;
    padding: 2px 0;
}
.wb-scout-tier-bar {
    height: 10px;
    border-radius: 3px;
    transition: width 0.3s ease;
}
.wb-scout-tier-bar.ours { background: #00b894; justify-self: end; }
.wb-scout-tier-bar.theirs { background: #d63031; justify-self: start; }
.wb-scout-tier-label {
    font-weight: 700;
    text-align: center;
}
.wb-scout-tier-count { text-align: center; font-weight: 600; font-size: 10px; }
.wb-scout-phase {
    background: var(--wb-bg-secondary);
    border: 1px solid var(--wb-border);
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 8px;
}
.wb-scout-phase h4 {
    margin: 0 0 4px 0;
    font-size: 12px;
    color: var(--wb-call-green);
}
.wb-scout-phase p {
    margin: 0 0 6px 0;
    font-size: 11px;
    color: var(--wb-text-muted);
    line-height: 1.4;
}
.wb-scout-target-list {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 4px;
}
.wb-scout-target-chip {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    background: rgba(45,52,54,0.5);
    color: var(--wb-text);
}
.wb-scout-target-chip.weak { background: rgba(0,184,148,0.15); color: #00b894; }
.wb-scout-target-chip.mid { background: rgba(253,203,110,0.15); color: #fdcb6e; }
.wb-scout-target-chip.threat { background: rgba(214,48,49,0.15); color: #ff7675; }
.wb-scout-target-chip.ignore { background: rgba(99,110,114,0.15); color: #636e72; }
.wb-scout-safe-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: 4px;
}
.wb-scout-safe-table th {
    text-align: left;
    font-size: 10px;
    color: var(--wb-text-muted);
    padding: 3px 6px;
    border-bottom: 1px solid var(--wb-border);
    text-transform: uppercase;
}
.wb-scout-safe-table td {
    padding: 3px 6px;
    border-bottom: 1px solid rgba(45,52,54,0.3);
}
.wb-scout-safe-table tr:last-child td { border-bottom: none; }
.wb-scout-pct-bar {
    display: inline-block;
    height: 16px;
    border-radius: 3px;
    line-height: 16px;
    font-size: 10px;
    font-weight: 600;
    padding: 0 6px;
    min-width: 30px;
    text-align: center;
}

/* ── Post-War Report Styles ── */
.wb-postwar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 1000001;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
}
.wb-postwar-modal {
    background: var(--wb-bg);
    border: 1px solid var(--wb-border);
    border-radius: 8px;
    width: 800px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    color: var(--wb-text);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.wb-postwar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--wb-border);
}
.wb-postwar-header h2 {
    margin: 0;
    font-size: 16px;
    color: #fdcb6e;
}
.wb-postwar-close {
    background: none;
    border: none;
    color: var(--wb-text);
    font-size: 22px;
    cursor: pointer;
    opacity: 0.6;
    padding: 0 4px;
}
.wb-postwar-close:hover { opacity: 1; }
.wb-postwar-body {
    padding: 16px 20px;
}
.wb-postwar-section {
    margin-bottom: 16px;
}
.wb-postwar-section h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #fdcb6e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--wb-border);
    padding-bottom: 4px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
}
.wb-postwar-section h3::after {
    content: ' \u25BC';
    font-size: 9px;
    opacity: 0.5;
}
.wb-postwar-section h3.collapsed::after {
    content: ' \u25B6';
}
.wb-postwar-section-body {
    overflow: hidden;
    transition: max-height 0.3s ease;
}
.wb-postwar-section-body.collapsed {
    max-height: 0 !important;
    overflow: hidden;
}
.wb-postwar-result-badge {
    display: inline-block;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 700;
    margin: 4px 0;
}
.wb-postwar-result-badge.victory { background: rgba(0,184,148,0.25); color: #00b894; }
.wb-postwar-result-badge.defeat { background: rgba(214,48,49,0.25); color: #ff7675; }
.wb-postwar-result-badge.unknown { background: rgba(99,110,114,0.25); color: #636e72; }
.wb-postwar-score {
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    margin: 8px 0;
}
.wb-postwar-score .our-score { color: #00b894; }
.wb-postwar-score .enemy-score { color: #ff7675; }
.wb-postwar-score .score-sep { color: var(--wb-text-muted); margin: 0 8px; }
.wb-postwar-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    font-size: 12px;
}
.wb-postwar-stat-grid .lbl { color: var(--wb-text-muted); }
.wb-postwar-stat-grid .val { font-weight: 600; text-align: right; }
.wb-postwar-card {
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 6px;
    font-size: 12px;
}
.wb-postwar-card.positive {
    background: rgba(0,184,148,0.08);
    border: 1px solid rgba(0,184,148,0.2);
}
.wb-postwar-card.negative {
    background: rgba(253,203,110,0.08);
    border: 1px solid rgba(253,203,110,0.2);
}
.wb-postwar-card .card-name {
    font-weight: 700;
    font-size: 13px;
}
.wb-postwar-card.positive .card-name { color: #00b894; }
.wb-postwar-card.negative .card-name { color: #fdcb6e; }
.wb-postwar-card .card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--wb-text-muted);
}
.wb-postwar-card .card-stats span { white-space: nowrap; }
.wb-postwar-achievement {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(0,184,148,0.15);
    color: #00b894;
    margin: 2px;
}
.wb-postwar-recommendation {
    background: var(--wb-bg-secondary);
    border: 1px solid var(--wb-border);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 6px;
    font-size: 12px;
}
.wb-postwar-recommendation .rec-category {
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 2px;
}
.wb-postwar-recommendation .rec-category.high { color: #ff7675; }
.wb-postwar-recommendation .rec-category.medium { color: #fdcb6e; }
.wb-postwar-recommendation .rec-text {
    color: var(--wb-text-muted);
    line-height: 1.4;
}
.wb-postwar-member-table-wrap {
    max-height: 400px;
    overflow: auto;
    border: 1px solid var(--wb-border);
    border-radius: 6px;
}
.wb-postwar-member-table {
    min-width: 520px;
    border-collapse: collapse;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}
.wb-postwar-member-table th {
    text-align: left;
    font-size: 10px;
    color: var(--wb-text-muted);
    padding: 6px 8px;
    border-bottom: 1px solid var(--wb-border);
    text-transform: uppercase;
    position: sticky;
    top: 0;
    background: var(--wb-bg);
    z-index: 1;
    white-space: nowrap;
}
.wb-postwar-member-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--wb-border);
    color: var(--wb-text);
    white-space: nowrap;
}
.wb-postwar-member-table td:first-child {
    color: var(--wb-text);
    font-weight: 700;
}
.wb-postwar-member-table tr:last-child td { border-bottom: none; }
.wb-postwar-member-table .eff-green { color: #00b894; }
.wb-postwar-member-table .eff-yellow { color: #fdcb6e; }
.wb-postwar-member-table .eff-red { color: #ff7675; }
.wb-postwar-energy-bar {
    height: 20px;
    background: var(--wb-bg-secondary);
    border-radius: 4px;
    overflow: hidden;
    margin: 8px 0;
    position: relative;
}
.wb-postwar-energy-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
}
.wb-postwar-energy-bar-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--wb-text);
}

.fo-unavailable-section {
    border-top: 1px solid var(--wb-border);
    margin-top: 2px;
}
.fo-unavail-header {
    padding: 8px 12px;
    font-size: 11px;
    color: #636e72;
    font-weight: 600;
    letter-spacing: 0.3px;
    user-select: none;
    -webkit-user-select: none;
}
.fo-unavail-header:hover {
    color: var(--wb-text);
    background: var(--wb-accent-10);
}
.fo-unavail-list .fo-row {
    opacity: 0.45;
}

/* ── Strategy Indicator Bar ── */
.fo-strategy-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 12px;
    background: rgba(20,20,30,0.85);
    border-bottom: 1px solid rgba(45,52,54,0.4);
    font-size: 11px; min-height: 0;
}
.fo-strategy-bar:empty, .fo-strategy-bar.hidden { display: none; }
.fo-strategy-badge {
    font-size: 14px; font-weight: 800; letter-spacing: 1px;
    padding: 2px 10px; border-radius: 4px;
    text-transform: uppercase; line-height: 1.3;
}
.fo-strategy-badge.push { background: rgba(0,184,148,0.2); color: #00b894; border: 1px solid rgba(0,184,148,0.4); }
.fo-strategy-badge.hold { background: rgba(253,203,110,0.2); color: #fdcb6e; border: 1px solid rgba(253,203,110,0.4); }
.fo-strategy-badge.turtle { background: rgba(116,185,255,0.2); color: #74b9ff; border: 1px solid rgba(116,185,255,0.4); }
.fo-strategy-confidence {
    font-size: 10px; color: var(--wb-text-muted); font-weight: 600;
}
.fo-strategy-timing {
    font-size: 10px; padding: 1px 6px; border-radius: 8px;
    font-weight: 600;
}
.fo-strategy-timing.good { background: rgba(0,184,148,0.15); color: #00b894; }
.fo-strategy-timing.neutral { background: rgba(99,110,114,0.15); color: #b2bec3; }
.fo-strategy-timing.bad { background: rgba(214,48,49,0.15); color: #ff7675; }
.fo-strategy-reasons {
    flex: 1; font-size: 10px; color: #b0b0c0;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.fo-strategy-phase {
    font-size: 9px; color: var(--wb-text-muted); text-transform: uppercase;
    letter-spacing: 0.5px; font-weight: 600;
}

/* ── Enemy Activity Sparkline ── */
.fo-activity-chart {
    display: flex; align-items: flex-end; gap: 1px;
    height: 24px; min-width: 96px;
}
.fo-activity-chart-bar {
    flex: 1; min-width: 3px; border-radius: 1px 1px 0 0;
    background: rgba(116,185,255,0.3); transition: background 0.2s;
}
.fo-activity-chart-bar.current { background: #74b9ff; }
.fo-activity-chart-bar.peak { background: rgba(214,48,49,0.5); }
.fo-activity-chart-bar.dead { background: rgba(0,184,148,0.5); }
.fo-activity-chart-label {
    font-size: 7px; color: var(--wb-text-muted); text-align: center;
    line-height: 1;
}

/* Broadcast entry bar */
.fo-broadcast-entry-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 16px; background: var(--wb-bg-secondary);
    border-bottom: 1px solid var(--wb-border);
}
.fo-broadcast-entry-bar input {
    flex: 1; background: var(--wb-bg); border: 1px solid var(--wb-border);
    color: var(--wb-text); padding: 5px 12px; border-radius: 4px; font-size: 13px;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
}
.fo-broadcast-entry-bar button {
    background: var(--wb-hospital-red); color: white; border: none;
    padding: 5px 16px; border-radius: 4px; cursor: pointer;
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    transition: all 0.2s ease;
}
.fo-broadcast-entry-bar button:hover {
    filter: brightness(1.2); transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(214,48,49,0.3);
}
`;
        GM_addStyle(css);
        log('Styles injected');
    }

    // =========================================================================
    // SECTION 4: STATE MANAGEMENT
    // =========================================================================

    /** Centralised reactive state for the entire extension. */
    const state = {
        connected: false,
        connecting: false,
        jwtToken: GM_getValue('factionops_jwt', ''),
        myPlayerId: null,
        myPlayerName: null,
        myFactionId: null,
        myFactionName: null,
        myFactionPosition: null,
        enemyFactionId: null,
        enemyFactionName: null,
        onlinePlayers: [],
        ourFactionOnline: null, // { online, idle, total } from server

        // Map of targetId -> { calledBy: { id, name }, calledAt: timestamp }
        calls: {},

        // Map of targetId -> { level, setBy: { id, name }, timestamp }
        priorities: {},

        // Map of targetId -> { status, until, description, activity }
        statuses: {},

        // Map of targetId -> [ { id, name } ] — faction members viewing that attack page
        viewers: {},

        // Chain data
        chain: {
            current: 0,
            max: 0,
            timeout: 0,
            cooldown: 0,
        },

        // Chain alert fired flag (resets when timeout goes back above threshold)
        chainAlertFired: false,
        chainPanicFired: false,

        // Whether a faction API key has been saved on the server
        factionKeyStored: false,

        // Custom war target (server-synced, set by leader)
        warTarget: null,
        warScores: null,  // { myScore, enemyScore } from server-side ranked war polling
        warEta: null,     // { etaTimestamp, hoursRemaining, currentTarget, calculatedAt } from server
        warEnded: false,
        warResult: null,  // 'victory' | 'defeat' | 'draw'
        warPercentage: null,

        // Strategy recommendation from server
        strategy: null,   // { recommendation, confidence, reasons, timing, enemyPeak, enemyDead, currentPhase }
        enemyActivityByHour: null, // { 0: avgOnline, 1: avgOnline, ... 23: avgOnline }

        // UI references
        ui: {
            chainBar: null,
            settingsOpen: false,
        },
    };

    // Bonus hit milestones used by the chain monitor
    const BONUS_MILESTONES = [
        10, 25, 50, 100, 250, 500, 1000, 2500,
        5000, 10000, 25000, 50000, 100000,
    ];

    /** Return the next bonus milestone at or after `count`, or null. */
    function nextBonusMilestone(count) {
        for (const m of BONUS_MILESTONES) {
            if (m >= count) return m;
        }
        return null;
    }

    // =========================================================================
    // SECTION 5: UTILITY HELPERS
    // =========================================================================

    /**
     * Normalize a raw status string to one of: 'ok', 'hospital', 'jail', 'traveling', 'fallen'.
     * Handles both server-normalized states ("traveling") and raw descriptions ("Traveling to Mexico").
     */
    function normalizeStatus(raw) {
        if (!raw) return 'ok';
        const s = raw.toLowerCase();
        if (s === 'hospital' || s.includes('hospital')) return 'hospital';
        if (s === 'federal' || s.includes('federal')) return 'federal';
        if (s === 'jail' || s.includes('jail')) return 'jail';
        if (s === 'abroad' || s.includes('abroad')) return 'abroad';
        if (s === 'traveling' || s.includes('traveling')) return 'traveling';
        if (s === 'okay' || s === 'ok') return 'ok';
        if (s === 'fallen') return 'fallen';
        return 'ok';
    }

    /**
     * Merge incoming statuses into state.statuses with a monotonic guard
     * on `until` timers. Prevents server polls from bumping hospital/jail
     * timers UP when a stale Torn API cache is served.
     *
     * Rules:
     *  - If the status CHANGED (e.g. ok→hospital), accept the new until.
     *  - If the status is the same and the new until is HIGHER, keep the
     *    current (lower) value — it's been counting down locally.
     *  - Zero tolerance: timers only go down, never up (even by 1s).
     */
    function mergeStatusesMonotonic(incoming) {
        for (const [targetId, newData] of Object.entries(incoming)) {
            const existing = state.statuses[targetId];
            if (!existing) {
                state.statuses[targetId] = newData;
                maybeAutoUncallOnHospital(targetId, null, normalizeStatus(newData.status));
                continue;
            }
            const oldStatus = normalizeStatus(existing.status);
            const newStatus = normalizeStatus(newData.status);
            const statusChanged = oldStatus !== newStatus;

            // Merge all fields
            state.statuses[targetId] = {
                ...existing,
                ...newData,
            };

            if (statusChanged) {
                maybeAutoUncallOnHospital(targetId, oldStatus, newStatus);
            }

            // Monotonic guard on `until` — timer may only count DOWN while
            // the status is unchanged. Previously this only applied when
            // existing.until > 0, so once the local tick reached 0 a
            // slightly-stale server push (Torn cache lag: e.g. "2s left")
            // would bump the countdown back up to 2s, causing the Next Up
            // bar to visibly rebound 0 → 2 → tick down → 0 → rebound again
            // until Torn's cache finally reported the release.
            if (!statusChanged && Object.prototype.hasOwnProperty.call(newData, 'until')) {
                const existingUntil = typeof existing.until === 'number' ? existing.until : 0;
                const newUntil      = typeof newData.until === 'number' ? newData.until : existingUntil;
                state.statuses[targetId].until = Math.min(existingUntil, newUntil);
            }
        }
    }

    /**
     * Parse a duration out of a human-readable string from Torn tooltips.
     * Handles: "1h 23m", "45 minutes", "In hospital for 2 hours 10 mins",
     * "45:23" (MM:SS), "1:23:45" (HH:MM:SS). Returns seconds or 0.
     */
    function parseDurationFromText(text) {
        if (!text) return 0;
        const t = String(text).toLowerCase();
        // HH:MM:SS or MM:SS forms
        const clock = t.match(/(\d+):(\d{2})(?::(\d{2}))?/);
        if (clock) {
            const a = Number(clock[1]) || 0;
            const b = Number(clock[2]) || 0;
            const c = Number(clock[3]) || 0;
            if (clock[3] != null) return a * 3600 + b * 60 + c;
            // Two-group form: MM:SS if first < 60, else HH:MM
            return a < 60 ? a * 60 + b : a * 3600 + b * 60;
        }
        // "1h 23m" / "1 hour 23 minutes"
        const hm = t.match(/(\d+)\s*(?:hour|hr|h)[a-z]*\s*(?:(\d+)\s*(?:minute|min|m))?/);
        if (hm) return (Number(hm[1]) || 0) * 3600 + (Number(hm[2]) || 0) * 60;
        // "45 minutes" / "45 mins" / "45m"
        const mOnly = t.match(/(\d+)\s*(?:minute|min|m)\b/);
        if (mOnly) return Number(mOnly[1]) * 60;
        return 0;
    }

    /**
     * Build a name anchor that mimics Torn's native `.user.name` element as
     * closely as possible by cloning a live example from the page. This
     * preserves whatever wrapper/sub-span structure Torn's own profile-card
     * handler expects — even when that structure changes between Torn
     * releases. Player-specific sub-elements (honor icons, cipher badges,
     * rank chips) are stripped before cloning so we don't leak someone
     * else's data into our overlay row.
     */
    let _nativeNameTemplate = null;
    function getNativeNameTemplate() {
        if (_nativeNameTemplate) return _nativeNameTemplate.cloneNode(true);
        const src = document.querySelector('a.user.name[href^="/profiles.php"]:not(.fo-name):not([data-fo-built])');
        if (!src) return null;
        const template = src.cloneNode(true);
        // Strip player-specific child content
        template.querySelectorAll(
            '.user-information-cipher, .honor-text-wrap, [class*="honor"], [class*="rank"], svg, img'
        ).forEach((el) => el.remove());
        _nativeNameTemplate = template;
        return template.cloneNode(true);
    }

    function buildNameAnchor(playerId, playerName) {
        const template = getNativeNameTemplate();
        let anchor;
        if (template) {
            template.setAttribute('href', `/profiles.php?XID=${playerId}`);
            template.setAttribute('data-placeholder', `${playerName || 'Unknown'} [${playerId}]`);
            template.setAttribute('data-fo-built', '1');
            template.classList.add('fo-name');
            template.style.textDecoration = 'none';
            template.style.color = 'inherit';
            const inner = template.querySelector('.name') || template.querySelector('span');
            if (inner) {
                inner.textContent = playerName || `#${playerId}`;
            } else {
                template.textContent = playerName || `#${playerId}`;
            }
            anchor = template;
        } else {
            // Fallback: manual construction matching the most common pattern.
            anchor = document.createElement('a');
            anchor.className = 'fo-name user name';
            anchor.setAttribute('href', `/profiles.php?XID=${playerId}`);
            anchor.dataset.placeholder = `${playerName || 'Unknown'} [${playerId}]`;
            anchor.style.textDecoration = 'none';
            anchor.style.color = 'inherit';
            const inner = document.createElement('span');
            inner.className = 'name';
            inner.textContent = playerName || `#${playerId}`;
            anchor.appendChild(inner);
        }

        // Copy Torn's native jQuery event handlers onto this anchor. Torn
        // typically binds mouse/touch handlers directly to each `.user.name`
        // element at page load (not via document delegation), so cloned
        // elements don't inherit them. When jQuery is exposed on window, we
        // can read the handler table from a live native element via
        // `$._data(el, 'events')` and re-attach each binding.
        copyNativeUserNameHandlers(anchor);

        return anchor;
    }

    function copyNativeUserNameHandlers(target) {
        try {
            const jq = window.jQuery || window.$;
            if (!jq || !jq._data) return false;
            const source = document.querySelector('a.user.name[href^="/profiles.php"]:not(.fo-name):not([data-fo-built])');
            if (!source) return false;
            const events = jq._data(source, 'events');
            if (!events) return false;
            for (const type in events) {
                const list = events[type];
                if (!list) continue;
                for (const h of list) {
                    const ns = h.namespace ? `.${h.namespace}` : '';
                    try {
                        if (h.selector) {
                            jq(target).on(type + ns, h.selector, h.data, h.handler);
                        } else {
                            jq(target).on(type + ns, h.data, h.handler);
                        }
                    } catch (_) { /* one handler's failure shouldn't block others */ }
                }
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Auto-uncall hook: when a target that I've called transitions into
     * hospital (from any detection path — server push, attacks-feed, peer
     * relay, DOM reader, intercepted attack result), clear my call. Scoped
     * to my own calls so a teammate's call is never stomped. Runs from
     * mergeStatusesMonotonic so it sits at the single chokepoint where all
     * status updates flow through, instead of sprinkled across every
     * detection path.
     */
    function maybeAutoUncallOnHospital(targetId, oldStatus, newStatus) {
        if (newStatus !== 'hospital') return;
        if (oldStatus === 'hospital') return; // not a transition
        const call = state.calls && state.calls[targetId];
        if (!call) {
            log(`[auto-uncall] #${targetId} → hospital: no call exists`);
            return;
        }
        if (!call.calledBy) {
            log(`[auto-uncall] #${targetId} → hospital: call has no calledBy`);
            return;
        }
        const caller = String(call.calledBy.id);
        const me = String(state.myPlayerId || '');
        if (caller !== me) {
            log(`[auto-uncall] #${targetId} → hospital: call is ${caller}'s (I am ${me}), skipping`);
            return;
        }
        try {
            emitUncallTarget(targetId);
            log(`[auto-uncall] #${targetId} hospitalized → cleared my call`);
        } catch (e) {
            warn(`[auto-uncall] failed for #${targetId}:`, e);
        }
    }

    /** Format seconds into compact timer: "Xd Yh", "Xh Ym", or "Xm Ys". */
    function formatTimer(seconds) {
        if (seconds <= 0) return '0s';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
        return `${s}s`;
    }

    /** Debounce helper — returns a debounced wrapper. */
    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // ── Peer Relay: report observed enemy status changes to server ──────────
    // Batches intercepted status changes and sends them to the server every 2s.
    // Other connected clients receive the update instantly via SSE/Socket.IO,
    // giving near-real-time enemy status without any Torn API calls.
    let peerRelayBatch = {};
    let peerRelayTimer = null;

    function queuePeerRelay(statusBatch) {
        if (!statusBatch || Object.keys(statusBatch).length === 0) return;
        Object.assign(peerRelayBatch, statusBatch);
        if (peerRelayTimer) return; // already scheduled
        // CommandCenter: shortened from 2000ms so peer-observed status
        // changes (e.g. a teammate viewing a target that just got
        // hospitalized) reach the rest of the faction faster.
        peerRelayTimer = setTimeout(flushPeerRelay, 500);
    }

    function flushPeerRelay() {
        peerRelayTimer = null;
        const batch = peerRelayBatch;
        peerRelayBatch = {};
        if (Object.keys(batch).length === 0) return;
        const warId = deriveWarId();
        if (!warId || !state.jwtToken) return;
        log(`[peer-relay] Sending ${Object.keys(batch).length} status updates`);
        postAction('/api/status', { warId, statuses: batch }).catch(err => {
            warn('[peer-relay] Failed to send:', err.message);
        });
    }

    /** Extract a Torn player ID from a URL or href string. */
    function extractPlayerId(url) {
        if (!url) return null;
        const m = url.match(/(?:user2ID=|XID=|user=|userId=|ID=)(\d+)/i)
            || url.match(/profiles\.php\?XID=(\d+)/)
            || url.match(/loader\.php\?sid=attack&user2ID=(\d+)/);
        return m ? m[1] : null;
    }

    /** Extract target ID from the current attack page URL or DOM. */
    function getAttackTargetId() {
        // 1. Try URL first
        const m = window.location.href.match(/(?:user2ID=|XID=|user=|userId=|ID=)(\d+)/i);
        if (m) return m[1];
        
        // 2. Try DOM (Torn React attack page hides ID from URL when resuming)
        // Look for defender's profile link
        const defenderLinks = document.querySelectorAll('[class*="defender"] a[href*="XID="], div[class^="playerArea"] a[href*="XID="]');
        for (const link of defenderLinks) {
            const href = link.getAttribute('href');
            if (href) {
                const domMatch = href.match(/XID=(\d+)/i);
                if (domMatch) return domMatch[1];
            }
        }
        
        // 3. Fallback to extracting from the player image URL
        const images = document.querySelectorAll('img[src*="images.torn.com/profile"]');
        for (const img of images) {
            // Usually attackers are on the left, defenders on the right. We just want any ID that isn't the user's
            const src = img.getAttribute('src');
            const imgMatch = src.match(/\/(\d+)\//);
            if (imgMatch && imgMatch[1] !== state.myPlayerId) {
                return imgMatch[1];
            }
        }

        return null;
    }

    /** Safely parse JSON, returning null on failure. */
    function safeParse(text) {
        try { return JSON.parse(text); } catch { return null; }
    }

    // ── BSP / FFS stat helpers ──────────────────────────────────────────────

    /**
     * Read BSP prediction from localStorage (sync).
     * Key: tdup.battleStatsPredictor.cache.prediction.<userId>
     * Returns the parsed object (has .TBS) or null.
     */
    function fetchBspPrediction(userId) {
        try {
            const raw = localStorage.getItem(
                'tdup.battleStatsPredictor.cache.prediction.' + userId
            );
            if (!raw) return null;
            const pred = JSON.parse(raw);
            return pred || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Read FF Scouter estimate from IndexedDB (async).
     * DB "ffscouter-cache", store "cache", key = parseInt(userId).
     * Resolves { total, human } or null.
     */
    function getFfScouterEstimate(userId) {
        return new Promise((resolve) => {
            try {
                const req = window.indexedDB.open('ffscouter-cache', 1);
                req.onerror = () => resolve(null);
                req.onsuccess = () => {
                    try {
                        const db = req.result;
                        const tx = db.transaction('cache', 'readonly');
                        const store = tx.objectStore('cache');
                        const get = store.get(parseInt(userId, 10));
                        get.onerror = () => resolve(null);
                        get.onsuccess = () => {
                            const r = get.result;
                            if (!r || r.no_data || typeof r.bs_estimate === 'undefined') {
                                resolve(null);
                            } else {
                                resolve({
                                    total: r.bs_estimate,
                                    human: r.bs_estimate_human || null,
                                });
                            }
                        };
                    } catch (_) {
                        resolve(null);
                    }
                };
            } catch (_) {
                resolve(null);
            }
        });
    }

    /**
     * Format a raw battle-stats number into a compact human string.
     * e.g. 3_200_000_000 → "3.20B", 750_000_000 → "750M".
     */
    function formatBspNumber(n) {
        if (n == null || isNaN(n)) return '\u2014';
        if (n >= 1e12)  return (n / 1e12).toFixed(2)  + 'T';
        if (n >= 1e9)   return (n / 1e9).toFixed(2)   + 'B';
        if (n >= 1e6)   return (n / 1e6).toFixed(1)    + 'M';
        if (n >= 1e3)   return (n / 1e3).toFixed(0)    + 'K';
        return String(Math.round(n));
    }

    /**
     * Classify a raw stat number into a tier for colour coding.
     * S (red, 3 B+), A (yellow, 1-3 B), B (green, 500 M-1 B), C (gray, <500 M).
     */
    function bspTier(n) {
        if (n == null || isNaN(n)) return 'unknown';
        if (n >= 3e9)   return 's';
        if (n >= 1e9)   return 'a';
        if (n >= 5e8)   return 'b';
        return 'c';
    }

    // ── Fair Fight (ffscouter.com) ─────────────────────────────────────────

    /** In-memory FF cache: targetId → { value, lastUpdated, bsHuman, fetchedAt } */
    const ffCache = {};
    const FF_CACHE_TTL = 60 * 60 * 1000; // 1 hour
    let ffFetchInFlight = false;

    /**
     * Batch-fetch FF values from ffscouter.com for all current enemy targets.
     * Caches results in memory for 1 hour. Skips targets already cached.
     */
    function fetchFairFightBatch() {
        if (ffFetchInFlight) return;
        const apiKey = CONFIG.API_KEY;
        if (!apiKey) return;

        const allIds = Object.keys(state.statuses);
        const now = Date.now();
        const needed = allIds.filter((id) => {
            const c = ffCache[id];
            return !c || (now - c.fetchedAt) > FF_CACHE_TTL;
        });
        if (needed.length === 0) return;

        // ffscouter API accepts comma-separated target IDs
        const batchSize = 50;
        const batch = needed.slice(0, batchSize);
        const url = `https://ffscouter.com/api/v1/get-stats?key=${encodeURIComponent(apiKey)}&targets=${batch.join(',')}`;

        ffFetchInFlight = true;
        log('FF: fetching', batch.length, 'targets from ffscouter.com');

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 15000,
            onload: function (resp) {
                ffFetchInFlight = false;
                if (resp.status !== 200) {
                    log('FF: API returned', resp.status);
                    return;
                }
                try {
                    const data = JSON.parse(resp.responseText);
                    if (data && data.error) {
                        log('FF: API error:', data.error);
                        return;
                    }
                    if (!Array.isArray(data)) return;
                    const ts = Date.now();
                    for (const entry of data) {
                        if (!entry || !entry.player_id) continue;
                        const id = String(entry.player_id);
                        if (entry.fair_fight == null) {
                            ffCache[id] = { value: null, lastUpdated: 0, bsHuman: null, fetchedAt: ts };
                        } else {
                            ffCache[id] = {
                                value: entry.fair_fight,
                                lastUpdated: entry.last_updated || 0,
                                bsHuman: entry.bs_estimate_human || null,
                                fetchedAt: ts,
                            };
                        }
                    }
                    // Re-render inline FF badges
                    updateAllFfBadges();
                } catch (e) {
                    log('FF: parse error', e);
                }
            },
            onerror: function () { ffFetchInFlight = false; },
            ontimeout: function () { ffFetchInFlight = false; },
        });
    }

    /** Colour for FF value — blue→green→red gradient matching FF Scouter V2. */
    function ffColor(value) {
        let r, g, b;
        if (value <= 1) {
            r = 0x28; g = 0x28; b = 0xc6;
        } else if (value <= 3) {
            const t = (value - 1) / 2;
            r = 0x28;
            g = Math.round(0x28 + (0xc6 - 0x28) * t);
            b = Math.round(0xc6 - (0xc6 - 0x28) * t);
        } else if (value <= 5) {
            const t = (value - 3) / 2;
            r = Math.round(0x28 + (0xc6 - 0x28) * t);
            g = Math.round(0xc6 - (0xc6 - 0x28) * t);
            b = 0x28;
        } else {
            r = 0xc6; g = 0x28; b = 0x28;
        }
        return `rgb(${r},${g},${b})`;
    }

    /** Render an inline FF badge element. */
    function renderInlineFf(el, targetId) {
        const cached = ffCache[targetId];
        if (!cached || cached.value == null) {
            if (el.dataset.foCache === 'empty') return; // already empty
            el.dataset.foCache = 'empty';
            el.textContent = '';
            el.className = 'fo-ff-inline';
            el.style.color = '';
            el.style.background = '';
            return;
        }
        const ff = cached.value;
        const now = Date.now() / 1000;
        const age = now - cached.lastUpdated;
        const stale = age > 14 * 24 * 60 * 60; // >14 days
        const key = `ff_${ff.toFixed(2)}_${stale}`;
        if (el.dataset.foCache === key) return; // no change
        el.dataset.foCache = key;
        const label = `FF:${ff.toFixed(2)}${stale ? '?' : ''}`;
        el.className = 'fo-ff-inline';
        el.textContent = label;
        el.style.color = ffColor(ff);
        el.style.background = 'rgba(255,255,255,0.06)';
        el.title = stale
            ? `Fair Fight ${ff.toFixed(2)} (stale data)`
            : `Fair Fight ${ff.toFixed(2)}`;
    }

    /** Update all rendered FF badges from cache. */
    function updateAllFfBadges() {
        const badges = document.querySelectorAll('[id^="fo-ff-inline-"]');
        badges.forEach((el) => {
            const tid = el.id.replace('fo-ff-inline-', '');
            renderInlineFf(el, tid);
        });
    }

    /**
     * Estimated one-way travel times in minutes (standard / airstrip).
     * Used as a rough fallback when the API doesn't provide an exact timer.
     * Returns midpoint between standard and airstrip as a reasonable guess.
     */
    const TRAVEL_ESTIMATES = {
        'mexico':              17, // 20 std / 14 air
        'canada':              32, // 37 / 26
        'cayman islands':      49, // 57 / 40
        'cayman':              49,
        'hawaii':              103, // 121 / 85
        'united kingdom':      130, // 152 / 107
        'uk':                  130,
        'argentina':           161, // 189 / 133
        'switzerland':         144, // 169 / 118
        'japan':               173, // 203 / 142
        'china':               186, // 219 / 153
        'united arab emirates':220, // 259 / 181
        'uae':                 220,
        'south africa':        264, // 311 / 217
    };

    /**
     * Estimate when a traveling opponent will be back in Torn and attackable.
     * - "Returning to Torn from X" → one-way flight time (they're on their way back)
     * - "Traveling to X" → two-way minimum (outbound + return, not counting time abroad)
     * - "In X" / abroad → one-way return flight at minimum
     * Returns a string like "~2h 10m" or null if unknown destination.
     */
    function estimateTravelReturn(description) {
        if (!description) return null;
        const desc = description.toLowerCase();
        let dest = null;
        let mins = 0;
        for (const [d, m] of Object.entries(TRAVEL_ESTIMATES)) {
            if (desc.includes(d)) { dest = d; mins = m; break; }
        }
        if (!dest) return null;

        let estimate;
        if (desc.includes('returning')) {
            // Already heading back — one-way flight time
            estimate = mins;
        } else if (desc.includes('traveling to')) {
            // Still outbound — outbound remainder unknown + full return
            // Show at minimum the return flight
            estimate = mins;
            return formatEstimate(estimate) + '+';
        } else {
            // "In X" — abroad, needs to fly back
            estimate = mins;
            return formatEstimate(estimate) + '+';
        }
        return formatEstimate(estimate);
    }



    function formatEstimate(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
    }

    // =========================================================================
    // SECTION 6: HTTP POLLING CLIENT
    // =========================================================================

    // ── Polling-based server communication ──────────────────────────────

    // PDA: polling is the primary transport (Socket.IO blocked by WebView)
    // Desktop: polling is a fallback — Socket.IO handles real-time push
    // 200ms was tried and caused client-side "Network error" cascades when
    // requests overlapped and GM_xmlhttpRequest queue filled up. 1000ms is
    // the sweet spot — feels live, stays well under the browser's
    // concurrent-socket limit and the server global rate limiter.
    const POLL_FAST_MS  = 1000;  // War active: 1s (CommandCenter; only used when Socket.IO is unavailable)
    const POLL_IDLE_MS  = 5000;  // No war: 5s
    let currentPollInterval = POLL_IDLE_MS;

    let pollTimer = null;
    let pollErrorCount = 0;
    const MAX_POLL_BACKOFF = 30000;

    /** Check if a war is actively running (enemy statuses present = war data flowing). */
    function isWarActive() {
        return Object.keys(state.statuses || {}).length > 0;
    }

    /** Derive a stable warId from factionId (convention: "war_<factionId>"). */
    function deriveWarId() {
        return state.myFactionId ? `war_${state.myFactionId}` : null;
    }

    /**
     * POST a JSON action to the server.
     * On PDA uses fetch(); elsewhere uses GM_xmlhttpRequest.
     * Auto-retries once on network error after 1s delay.
     */
    function postAction(endpoint, body, _retried) {
        return new Promise((resolve, reject) => {
            if (!state.jwtToken) return reject(new Error('Not authenticated'));
            const url = `${CONFIG.SERVER_URL}${endpoint}`;
            const json = JSON.stringify(body);

            httpRequest({
                method: 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.jwtToken}`,
                },
                data: json,
                timeout: 15000,
                onload(res) {
                    const data = safeParse(res.responseText);
                    if (res.status >= 200 && res.status < 300) resolve(data);
                    else reject(new Error((data && data.error) || `HTTP ${res.status}`));
                },
                onerror() {
                    if (!_retried) {
                        // Retry once after 1s
                        setTimeout(() => {
                            postAction(endpoint, body, true).then(resolve, reject);
                        }, 1000);
                    } else {
                        reject(new Error('Network error'));
                    }
                },
                ontimeout() {
                    if (!_retried) {
                        setTimeout(() => {
                            postAction(endpoint, body, true).then(resolve, reject);
                        }, 1000);
                    } else {
                        reject(new Error('Request timed out'));
                    }
                },
            });
        });
    }

    /** POST-based remove action with auth header (PDA compatible — no DELETE method). Auto-retries once. */
    function removeAction(endpoint, _retried) {
        return new Promise((resolve, reject) => {
            if (!state.jwtToken) return reject(new Error('Not authenticated'));
            const url = `${CONFIG.SERVER_URL}${endpoint}`;

            httpRequest({
                method: 'POST',
                url,
                headers: {
                    'Authorization': `Bearer ${state.jwtToken}`,
                    'Content-Type': 'application/json',
                },
                data: '{}',
                timeout: 15000,
                onload(res) {
                    const data = safeParse(res.responseText);
                    if (res.status >= 200 && res.status < 300) resolve(data);
                    else reject(new Error((data && data.error) || `HTTP ${res.status}`));
                },
                onerror() {
                    if (!_retried) {
                        setTimeout(() => removeAction(endpoint, true).then(resolve, reject), 1000);
                    } else {
                        reject(new Error('Network error'));
                    }
                },
                ontimeout() {
                    if (!_retried) {
                        setTimeout(() => removeAction(endpoint, true).then(resolve, reject), 1000);
                    } else {
                        reject(new Error('Request timed out'));
                    }
                },
            });
        });
    }

    /**
     * GET with auth header.
     * Uses httpRequest wrapper which routes through PDA_httpGet (with headers)
     * on Torn PDA, or GM_xmlhttpRequest on desktop.
     */
    function getAction(endpoint) {
        if (!state.jwtToken) return Promise.reject(new Error('Not authenticated'));

        const url = `${CONFIG.SERVER_URL}${endpoint}`;
        return new Promise((resolve, reject) => {
            httpRequest({
                method: 'GET',
                url,
                headers: { 'Authorization': `Bearer ${state.jwtToken}` },
                onload(res) {
                    const data = safeParse(res.responseText);
                    if (res.status >= 200 && res.status < 300) resolve(data);
                    else reject(new Error((data && data.error) || `HTTP ${res.status}`));
                },
                onerror() { reject(new Error('Network error')); },
            });
        });
    }

    /**
     * Single poll cycle: fetch server state, diff against local, fire notifications.
     */
    async function pollOnce() {
        const warId = deriveWarId();
        if (!warId || !state.jwtToken) {
            if (IS_PDA) log('pollOnce skip — warId:', warId, 'jwt:', !!state.jwtToken, 'factionId:', state.myFactionId);
            return;
        }

        try {
            const qs = `warId=${encodeURIComponent(warId)}` +
                (state.enemyFactionId ? `&enemyFactionId=${encodeURIComponent(state.enemyFactionId)}` : '');
            const data = await getAction(`/api/poll?${qs}`);

            if (!state.connected) {
                state.connected = true;
                state.connecting = false;
                pollErrorCount = 0;
                updateConnectionUI();
                log('Polling connected');
            }

            applyServerData(data);

        } catch (err) {
            pollErrorCount++;
            // Only flip to Offline after 3 consecutive failures to avoid flicker on PDA
            if (state.connected && pollErrorCount >= 3) {
                state.connected = false;
                updateConnectionUI();
                warn('Poll failed (3+ consecutive):', err.message);
            } else if (state.connected) {
                log('Poll hiccup (' + pollErrorCount + '/3):', err.message);
            }

            // Re-authenticate on 401
            if (err.message && err.message.includes('401')) {
                try {
                    await authenticate();
                    pollErrorCount = 0;
                } catch (authErr) {
                    warn('Re-auth failed:', authErr.message);
                }
            }
        } finally {
            // Schedule next poll only if still polling and NOT connected via SSE/Socket.IO
            if (pollTimer && !sseConnected && !(realtimeSocket && realtimeSocket.connected)) {
                scheduleNextPoll();
            }
        }
    }

    /** Start the polling loop. */
    function startPolling() {
        if (pollTimer) return; // already running
        if (sseConnected || (realtimeSocket && realtimeSocket.connected)) {
            log('Skipping startPolling — real-time connection active');
            return;
        }
        if (!state.jwtToken) {
            warn('No JWT token — cannot start polling');
            state.connected = false;
            state.connecting = false;
            updateConnectionUI();
            return;
        }

        state.connecting = true;
        updateConnectionUI();
        log('Starting adaptive poll loop (fast=' + POLL_FAST_MS + 'ms, idle=' + POLL_IDLE_MS + 'ms)');

        // Initialize timer placeholder
        pollTimer = true;

        // Immediate first poll
        pollOnce();
    }

    function scheduleNextPoll() {
        if (!pollTimer || sseConnected || (realtimeSocket && realtimeSocket.connected)) return;

        const desired = isWarActive() ? POLL_FAST_MS : POLL_IDLE_MS;
        if (desired !== currentPollInterval) {
            log('Poll interval changed: ' + currentPollInterval + 'ms → ' + desired + 'ms');
            currentPollInterval = desired;
        }
        const backoff = pollErrorCount > 0
            ? Math.min(currentPollInterval * Math.pow(2, pollErrorCount), MAX_POLL_BACKOFF)
            : currentPollInterval;

        pollTimer = setTimeout(() => {
            // Skip this tick if in backoff (simple jitter)
            if (pollErrorCount > 0 && Math.random() > (currentPollInterval / backoff)) {
                scheduleNextPoll();
                return;
            }
            pollOnce();
        }, backoff);
    }

    /** Stop the polling loop. keepState=true preserves connection state (used when Socket.IO takes over). */
    function stopPolling(keepState) {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        if (!keepState) {
            state.connected = false;
            state.connecting = false;
            updateConnectionUI();
        }
        pollErrorCount = 0;
        log('Polling stopped' + (keepState ? ' (Socket.IO active)' : ''));
    }

    // ── Socket.IO real-time push (primary) ─────────────────────────────────

    let realtimeSocket = null;
    let hasReceivedInitialData = false;

    /**
     * Apply server data to local state and re-render.
     * Used by both pollOnce() and Socket.IO war_update handler.
     */
    function applyServerData(data) {
        // ── Statuses FIRST (so target names are available for call toasts) ──
        if (data.enemyStatuses) {
            mergeStatusesMonotonic(data.enemyStatuses);
        }

        // ── Priorities ──
        if (data.priorities) {
            state.priorities = data.priorities;
        }

        // ── Diff & notify: calls ──
        if (data.calls) {
            const oldCalls = state.calls;
            for (const [tid, callData] of Object.entries(data.calls)) {
                if (!oldCalls[tid]) {
                    // Only toast for NEW calls after initial load (skip on page refresh)
                    if (hasReceivedInitialData && String(callData.calledBy.id) !== state.myPlayerId) {
                        const targetName = state.statuses[tid]?.name
                            || (data.enemyStatuses && data.enemyStatuses[tid]?.name)
                            || `Target #${tid}`;
                        const dealLabel = callData.isDeal ? ' \uD83D\uDD12 Deal' : '';
                        showCallToast(tid, `${callData.calledBy.name} called ${targetName}${dealLabel}`);
                        firePdaNotification('target_called',
                            callData.isDeal ? '\uD83D\uDD12 Deal Call' : '\uD83C\uDFAF Target Called',
                            `${callData.calledBy.name} called ${targetName}${dealLabel}`,
                            `https://www.torn.com/loader.php?sid=attack&user2ID=${tid}`);
                    }
                    broadcastStateChange({ type: 'call_update', targetId: tid });
                }
            }
            for (const tid of Object.keys(oldCalls)) {
                if (!data.calls[tid]) {
                    removeCallToast(tid);
                    broadcastStateChange({ type: 'call_update', targetId: tid });
                }
            }
            state.calls = data.calls;
        }

        // ── Chain ──
        if (data.chainData) {
            const oldCurrent = state.chain.current;
            const chainChanged = data.chainData.current !== oldCurrent;
            state.chain.current = data.chainData.current ?? state.chain.current;
            state.chain.max = data.chainData.max ?? state.chain.max;
            const serverTimeout = data.chainData.timeout ?? 0;
            if (chainChanged || state.chain.timeout <= 0 || Math.abs(serverTimeout - state.chain.timeout) > 3) {
                setChainTimeout(serverTimeout);
            }
            state.chain.cooldown = data.chainData.cooldown ?? 0;
            chainCooldownSetAt = Date.now();
            chainCooldownSetVal = data.chainData.cooldown ?? 0;
            updateChainBar();

            if (data.chainData.current && chainChanged) {
                const next = nextBonusMilestone(data.chainData.current + 1);
                const hitsToBonus = next ? next - data.chainData.current : null;
                const isCoolingDown = state.chain.cooldown > 0;
                // Only notify for bonuses above 10 (skip the first bonus at 10 since chain hasn't 'started' yet)
                // Also only fire when already past the first bonus or very close to a meaningful one
                if (!isCoolingDown && hitsToBonus !== null && hitsToBonus <= 3 && hitsToBonus > 0 && data.chainData.current >= 10) {
                    showToast(`BONUS HIT in ${hitsToBonus}! Target: ${next}`, 'error');
                    firePdaNotification('bonus_imminent',
                        '\uD83D\uDCA5 Bonus Hit Imminent',
                        `Chain at ${data.chainData.current}/${next} \u2014 ${hitsToBonus} hit${hitsToBonus > 1 ? 's' : ''} to bonus!`);
                }
            }
        }

        // ── Online players ──
        if (data.onlinePlayers) {
            state.onlinePlayers = data.onlinePlayers;
        }

        // ── Viewers ──
        if (data.viewers) {
            state.viewers = data.viewers;
        }

        // ── Our faction online counts ──
        if (data.ourFactionOnline) {
            state.ourFactionOnline = data.ourFactionOnline;
        }

        // Store enemyFactionId from server if we didn't have it
        if (data.enemyFactionId && !state.enemyFactionId) {
            state.enemyFactionId = data.enemyFactionId;
        }
        if (data.enemyFactionName) {
            state.enemyFactionName = data.enemyFactionName;
            const enemyEl = document.getElementById('fo-enemy-name');
            if (enemyEl) enemyEl.textContent = data.enemyFactionName;
        }

        // Faction key status
        if (data.factionKeyStored !== undefined) {
            state.factionKeyStored = !!data.factionKeyStored;
        }

        // War target (server-synced)
        if (data.warTarget !== undefined) {
            state.warTarget = data.warTarget;
        }
        if (data.warScores !== undefined) {
            state.warScores = data.warScores;
        }
        if (data.warEta !== undefined) {
            state.warEta = data.warEta;
            // Immediately refresh timer display when server ETA arrives
            if (typeof updateWarTimerDisplay === 'function') updateWarTimerDisplay();
        }
        if (data.warPercentage !== undefined && data.warPercentage !== null) {
            state.warPercentage = data.warPercentage;
        }
        // Show toast for broadcasts received via polling
        if (data.lastBroadcast && data.lastBroadcast.timestamp) {
            const lb = data.lastBroadcast;
            if (!state._lastBroadcastTs || lb.timestamp > state._lastBroadcastTs) {
                // Only show if broadcast is less than 60 seconds old
                if (Date.now() - lb.timestamp < 60000) {
                    showToast(`\uD83D\uDCE3 ${lb.message}`, lb.type || 'info');
                    if (typeof firePdaNotification === 'function') {
                        firePdaNotification('admin_broadcast', 'FactionOps Broadcast', lb.message);
                    }
                }
                state._lastBroadcastTs = lb.timestamp;
            }
        }
        // Show toast for assist requests received via polling
        if (data.lastAssistRequest && data.lastAssistRequest.timestamp) {
            const ar = data.lastAssistRequest;
            if (!state._lastAssistRequestTs || ar.timestamp > state._lastAssistRequestTs) {
                if (Date.now() - ar.timestamp < 60000) {
                    showAssistToast(ar.playerName, ar.targetName, ar.attackUrl);
                    if (typeof firePdaNotification === 'function') {
                        firePdaNotification('assist_request', '⚔️ Assist Needed!',
                            `${ar.playerName} needs help attacking ${ar.targetName}!`,
                            ar.attackUrl);
                    }
                }
                state._lastAssistRequestTs = ar.timestamp;
            }
        }

        if (data.warEnded !== undefined) {
            state.warEnded = data.warEnded;
            state.warResult = data.warResult;
            if (data.warEnded) showWarEndedBanner();
        }

        // ── Removed strategy engine ──
        updateStrategyBar();

        // Refresh UI rows
        refreshAllRows();

        // Trigger FF fetch if we have new targets without cached FF data
        fetchFairFightBatch();

        // After first data load, enable call toasts for subsequent updates
        hasReceivedInitialData = true;

        // Broadcast state to other tabs if we're the active tab
        if (!document.hidden) {
            broadcastStateChange({
                type: 'state_update',
                warScores: data.warScores,
                warEta: data.warEta,
                chainData: data.chainData,
                strategy: data.strategy,
                enemyActivityByHour: data.enemyActivityByHour,
            });
        }
    }

    /**
     * Connect Socket.IO for real-time push updates.
     * Falls back to polling if connection fails.
     */
    function connectRealtime() {
        if (realtimeSocket) return; // already connected or connecting
        if (!state.jwtToken) return;

        // --- Real-time Connection Strategy (v4.8.4) ---
        
        // 1. Always attempt SSE via GM_xmlhttpRequest on desktop.
        // This is the most reliable way to bypass Torn's Page CSP.
        if (canUseSSEStream() && !sseConnected) {
            log('Starting SSE Stream (CSP-bypass)...');
            connectSSEStream();
        }

        // 2. Also attempt standard Socket.IO (now "unblocked").
        // Note: On desktop, this may still be blocked by browser CSP, but will work on PDA
        // or if the user has specific browser permissions.
        if (IS_PDA) {
            log('PDA detected — skipping Socket.IO (blocked by WebView). Using HTTP polling.');
            // (Note: Socket.IO is blocked in PDA's specific sandbox, SSE/Poll is preferred there)
            return;
        }

        const ioFn = (typeof io === 'function') ? io
            : (typeof io === 'object' && io !== null && typeof io.io === 'function') ? io.io
            : (typeof window !== 'undefined' && typeof window.io === 'function') ? window.io
            : (typeof globalThis !== 'undefined' && typeof globalThis.io === 'function') ? globalThis.io
            : (typeof self !== 'undefined' && typeof self.io === 'function') ? self.io
            : null;
        if (!ioFn) {
            warn('Socket.IO client not found');
            updateRtBadge(false);
            return;
        }
        log('Connecting Socket.IO to', CONFIG.SERVER_URL);

        realtimeSocket = ioFn(CONFIG.SERVER_URL, {
            auth: { token: state.jwtToken },
            transports: ['polling', 'websocket'],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            timeout: 15000,
        });

        realtimeSocket.on('connect', () => {
            const transport = realtimeSocket.io?.engine?.transport?.name || 'unknown';
            log('Socket.IO connected:', realtimeSocket.id, 'transport:', transport);
            updateRtBadge(true);

            state.connected = true;
            state.connecting = false;
            updateConnectionUI();

            // Join the war room
            const warId = deriveWarId();
            if (warId && state.myFactionId) {
                realtimeSocket.emit('join_war', {
                    warId,
                    factionId: state.myFactionId,
                    enemyFactionId: state.enemyFactionId || null,
                });
            }

            // Keep polling running as a safety net — Socket.IO provides instant updates
            // but polling ensures data is never stale/missing. Polling is infrequent (5s)
            // so the overhead is minimal.
        });

        // Instant updates from server
        realtimeSocket.on('war_update', (data) => {
            applyServerData(data);
        });

        // Listen for Admin Broadcasts
        realtimeSocket.on('global_toast', (data) => {
            showToast(`📣 ${data.message}`, data.type);
            if (typeof firePdaNotification === 'function') {
                firePdaNotification('admin_broadcast', 'FactionOps Broadcast', data.message);
            }
        });

        // Listen for Assist Requests
        realtimeSocket.on('assist_request', (data) => {
            showAssistToast(data.playerName, data.targetName, data.attackUrl);
            if (typeof firePdaNotification === 'function') {
                firePdaNotification('assist_request', '⚔️ Assist Needed!',
                    `${data.playerName} needs help attacking ${data.targetName}!`,
                    data.attackUrl);
            }
        });

        // Also handle the initial state sent on join
        realtimeSocket.on('war_state', (data) => {
            applyServerData(data);
        });

        realtimeSocket.on('war_ended', (data) => {
            state.warEnded = true;
            state.warResult = data.result;
            showWarEndedBanner();
        });

        realtimeSocket.on('disconnect', (reason) => {
            log('Socket.IO disconnected:', reason);
            updateRtBadge(false);
            // Polling is always running as safety net, no action needed
        });

        let socketErrorCount = 0;
        realtimeSocket.on('connect_error', (err) => {
            socketErrorCount++;
            warn('Socket.IO connection error (' + socketErrorCount + '):', err.message);
            // After 3 failures, give up on Socket.IO and try SSE stream
            if (socketErrorCount >= 3 && canUseSSEStream()) {
                log('Socket.IO failed 3 times — switching to SSE stream');
                disconnectRealtime();
                connectSSEStream();
            }
        });

        realtimeSocket.io?.on('reconnect_attempt', () => {
            log('Socket.IO reconnect attempt');
        });
    }

    /** Disconnect Socket.IO. */
    function disconnectRealtime() {
        if (realtimeSocket) {
            realtimeSocket.disconnect();
            realtimeSocket = null;
            log('Socket.IO disconnected');
            updateRtBadge(false);
        }
    }

    // ── SSE stream via GM_xmlhttpRequest (Tampermonkey on Chrome) ─────────

    let sseAbort = null;       // abort handle from GM_xmlhttpRequest
    let sseLastLength = 0;     // track how much of responseText we've parsed
    let sseConnected = false;
    let sseRetryTimer = null;
    const SSE_RETRY_MS = 5000; // retry after 5s on disconnect

    /**
     * Can we use GM_xmlhttpRequest streaming?
     * Must be on Tampermonkey (not PDA), and Socket.IO must not already be connected.
     */
    function canUseSSEStream() {
        if (IS_PDA) return false;
        if (realtimeSocket && realtimeSocket.connected) return false;
        if (typeof GM_xmlhttpRequest !== 'function') return false;
        return true;
    }

    /** Connect SSE stream via GM_xmlhttpRequest onprogress. */
    function connectSSEStream() {
        if (!canUseSSEStream()) return;
        if (sseAbort) return; // already connected
        if (!state.jwtToken) return;

        const warId = deriveWarId();
        if (!warId || !state.myFactionId) return;

        const url = CONFIG.SERVER_URL + '/api/stream?warId=' + encodeURIComponent(warId)
            + '&token=' + encodeURIComponent(state.jwtToken)
            + (state.enemyFactionId ? '&enemyFactionId=' + encodeURIComponent(state.enemyFactionId) : '');

        log('Connecting SSE stream to', CONFIG.SERVER_URL + '/api/stream');
        sseLastLength = 0;
        sseConnected = false;

        sseAbort = GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'text',
            onloadstart: () => { sseConnected = true; log("SSE stream started"); updateRtBadge("sse"); if (pollTimer) stopPolling(true); },
            timeout: 0,
            onprogress: (resp) => {
                if (!resp || resp.responseText === undefined || resp.responseText === null) {
                    return;
                }
                if (!sseConnected) {
                    sseConnected = true;
                    log('SSE stream connected');
                    updateRtBadge('sse');
                    // Stop polling — SSE is now handling updates
                    if (pollTimer) {
                        stopPolling(true);
                    }
                }

                // Append new data to buffer (using the existing sseLastLength method)
                const responseText = resp.responseText || '';
                const newText = responseText.substring(sseLastLength);
                sseLastLength = responseText.length;
                
                // Initialize buffer if missing
                if (typeof window.sseBuffer === 'undefined') window.sseBuffer = '';
                window.sseBuffer += newText;

                // Process full events separated by double newline
                let boundary;
                while ((boundary = window.sseBuffer.indexOf('\n\n')) !== -1) {
                    const chunk = window.sseBuffer.slice(0, boundary).trim();
                    window.sseBuffer = window.sseBuffer.slice(boundary + 2); // Remove processed chunk

                    if (!chunk) continue; // Empty heartbeat

                    const match = chunk.match(/^data:\s*(.+)$/s);
                    if (!match) continue; // Skip non-data lines (like : keepalive)

                    try {
                        const data = JSON.parse(match[1]);
                        if (data && data.type === 'global_toast') {
                            showToast(`📣 ${data.message}`, data.type || 'info');
                            if (typeof firePdaNotification === 'function') {
                                firePdaNotification('admin_broadcast', 'FactionOps Broadcast', data.message);
                            }
                        } else if (data && data.type === 'assist_request') {
                            showAssistToast(data.playerName, data.targetName, data.attackUrl);
                            if (typeof firePdaNotification === 'function') {
                                firePdaNotification('assist_request', '⚔️ Assist Needed!',
                                    `${data.playerName} needs help attacking ${data.targetName}!`,
                                    data.attackUrl);
                            }
                        } else {
                            applyServerData(data);
                        }
                    } catch (_) {}
                }
            },
            onload: () => {
                // Stream ended (server closed)
                log('SSE stream ended by server');
                cleanupSSE();
                scheduleSSERetry();
            },
            onerror: (err) => {
                warn('SSE stream error:', err?.error || err?.statusText || 'unknown');
                cleanupSSE();
                scheduleSSERetry();
            },
            ontimeout: () => {
                warn('SSE stream timeout');
                cleanupSSE();
                scheduleSSERetry();
            }
        });
    }

    function cleanupSSE() {
        sseConnected = false;
        sseAbort = null;
        sseLastLength = 0;
        
        // Only restart polling if we aren't currently trying to reconnect
        // and no other real-time connection exists.
        if (!sseRetryTimer && !sseConnected && !(realtimeSocket && realtimeSocket.connected)) {
            updateRtBadge(false);
            if (state.jwtToken) startPolling();
        }
    }

    function disconnectSSEStream() {
        if (sseRetryTimer) { clearTimeout(sseRetryTimer); sseRetryTimer = null; }
        if (sseAbort && typeof sseAbort.abort === 'function') {
            sseAbort.abort();
        }
        sseConnected = false;
        sseAbort = null;
        sseLastLength = 0;
        updateRtBadge(false);
    }

    function scheduleSSERetry() {
        if (sseRetryTimer) return;
        sseRetryTimer = setTimeout(() => {
            sseRetryTimer = null;
            if (canUseSSEStream() && state.jwtToken) {
                connectSSEStream();
            }
        }, SSE_RETRY_MS);
    }

    /** Update the realtime/polling badge. */
    function updateRtBadge(mode) {
        const badge = document.getElementById('fo-rt-badge');
        if (!badge) return;

        const isSocketActive = realtimeSocket && realtimeSocket.connected;
        const isSseActive = sseConnected;

        if (mode === 'sse' || isSseActive) {
            badge.className = 'fo-rt-badge rt';
            badge.textContent = 'RT';
            badge.title = 'SSE stream active';
        } else if (mode === true || mode === 'rt' || isSocketActive) {
            badge.className = 'fo-rt-badge rt';
            badge.textContent = 'RT';
            badge.title = 'Socket.IO realtime active';
        } else {
            badge.className = 'fo-rt-badge poll';
            badge.textContent = 'POLL';
            badge.title = 'Falling back to polling';
        }
    }

    // =========================================================================
    // SECTION 7: AUTH MANAGER
    // =========================================================================

    /**
     * Authenticate with the FactionOps server.
     * Sends the Torn API key to POST /api/auth, receives a JWT.
     */
    function authenticate() {
        return new Promise((resolve, reject) => {
            if (!CONFIG.API_KEY) {
                return reject(new Error('No API key configured'));
            }
            log('Authenticating with server...', IS_PDA ? '(PDA mode)' : '(desktop)');
            if (IS_PDA) log('API key starts with:', CONFIG.API_KEY.substring(0, 4));

            httpRequest({
                method: 'POST',
                url: `${CONFIG.SERVER_URL}/api/auth`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ apiKey: CONFIG.API_KEY }),
                onload(res) {
                    log('Auth response status:', res.status);
                    const body = safeParse(res.responseText);
                    if (res.status >= 200 && res.status < 300 && body && body.token) {
                        state.jwtToken = body.token;
                        GM_setValue('factionops_jwt', body.token);
                        if (body.player) {
                            state.myPlayerId = String(body.player.playerId || body.player.id);
                            state.myPlayerName = body.player.playerName || body.player.name;
                            state.myFactionId = String(body.player.factionId || '0');
                            state.myFactionName = body.player.factionName || '';
                            state.myFactionPosition = (body.player.factionPosition || '').toLowerCase();
                        }
                        state.subscriptionExpiresAt = (body.subscriptionExpiresAt !== undefined)
                            ? body.subscriptionExpiresAt
                            : null;
                        log('Authenticated as', state.myPlayerName || 'unknown',
                            '— factionId:', state.myFactionId);
                        resolve(body);
                    } else {
                        const msg = (body && body.error) || `HTTP ${res.status}`;
                        warn('Auth failed:', msg);
                        reject(new Error(msg));
                    }
                },
                onerror(e) {
                    warn('Auth network error:', e);
                    reject(new Error('Network error — is the server running?'));
                },
            });
        });
    }

    /**
     * Verify current API key against the server.
     * Returns { valid: true, player: {...} } or throws.
     */
    function verifyApiKey() {
        return new Promise(async (resolve, reject) => {
            if (!CONFIG.API_KEY) {
                return reject(new Error('No API key'));
            }

            if (IS_PDA) {
                try {
                    const resp = await fetch(`${CONFIG.SERVER_URL}/api/auth/verify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.jwtToken}`,
                        },
                        body: JSON.stringify({ apiKey: CONFIG.API_KEY }),
                    });
                    const body = await resp.json();
                    if (resp.ok && body && body.valid) {
                        resolve(body);
                    } else {
                        reject(new Error((body && body.error) || 'Verification failed'));
                    }
                } catch (e) {
                    reject(new Error('Network error'));
                }
                return;
            }

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${CONFIG.SERVER_URL}/api/auth/verify`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.jwtToken}`,
                },
                data: JSON.stringify({ apiKey: CONFIG.API_KEY }),
                onload(res) {
                    const body = safeParse(res.responseText);
                    if (res.status === 200 && body && body.valid) {
                        resolve(body);
                    } else {
                        reject(new Error((body && body.error) || 'Verification failed'));
                    }
                },
                onerror() {
                    reject(new Error('Network error'));
                },
            });
        });
    }

    // =========================================================================
    // SECTION 8: ACTION HELPERS (HTTP POST)
    // =========================================================================

    function emitCallTarget(targetId, isDeal) {
        if (!state.connected) return;
        const warId = deriveWarId();
        if (!warId) return;
        // Optimistic update
        const tid = String(targetId);
        state.calls[tid] = {
            calledBy: { id: state.myPlayerId, name: state.myPlayerName || 'You' },
            calledAt: Date.now(),
            isDeal: !!isDeal,
        };
        updateTargetRow(tid);
        if (CONFIG.AUTO_SORT) debouncedSort();
        const targetName = state.statuses[tid]?.name || null;
        const payload = { warId, targetId: tid, targetName };
        if (isDeal) payload.isDeal = true;
        postAction('/api/call', payload)
            .catch(e => {
                warn('Call failed:', e.message);
                delete state.calls[tid];
                updateTargetRow(tid);
                showToast(e.message || 'Call failed', 'error');
            });
    }

    function emitUncallTarget(targetId) {
        if (!state.connected) return;
        const warId = deriveWarId();
        if (!warId) return;
        // Optimistic update
        const tid = String(targetId);
        const prev = state.calls[tid];
        delete state.calls[tid];
        updateTargetRow(tid);
        if (CONFIG.AUTO_SORT) debouncedSort();
        postAction('/api/call', { warId, targetId: tid, action: 'uncall' })
            .catch(e => {
                warn('Uncall failed:', e.message);
                if (prev) state.calls[tid] = prev;
                updateTargetRow(tid);
            });
    }

    /** Set or clear a priority tag on a target (leader/co-leader only). */
    function emitSetPriority(targetId, priority) {
        if (!state.connected) return;
        const warId = deriveWarId();
        if (!warId) return;
        postAction('/api/priority', { warId, targetId: String(targetId), priority })
            .then(() => {
                // Optimistic update
                if (priority === null) {
                    delete state.priorities[targetId];
                } else {
                    state.priorities[targetId] = {
                        level: priority,
                        setBy: { id: state.myPlayerId, name: state.myPlayerName },
                        timestamp: Date.now(),
                    };
                }
                updateTargetRow(String(targetId));
                broadcastStateChange({ type: 'state_update', priorities: state.priorities });
            })
            .catch(e => {
                warn('Set priority failed:', e.message);
                showToast(e.message || 'Failed to set priority', 'error');
            });
    }

    /** Check if current user has an elevated faction role (leader, co-leader, war leader, banker). */
    function isLeader() {
        const isAdmin = String(state.myPlayerId) === '137558';
        if (isAdmin) return true;

        const pos = state.myFactionPosition || '';
        return pos === 'leader' || pos === 'co-leader' || pos === 'war leader' || pos === 'banker';
    }

    // =========================================================================
    // SECTION 9: SETTINGS PANEL
    // =========================================================================

    /** Create and inject the floating gear icon. */
    function createSettingsGear() {
        const gear = document.createElement('div');
        gear.className = 'wb-settings-gear';
        gear.textContent = '\u2699'; // gear unicode
        gear.title = 'FactionOps Settings';
        gear.addEventListener('click', toggleSettings);
        document.body.appendChild(gear);
    }

    /** Toggle the settings modal open/closed. */
    function toggleSettings() {
        if (state.ui.settingsOpen) {
            closeSettings();
        } else {
            openSettings();
        }
    }

    function openSettings() {
        if (state.ui.settingsOpen) return;
        state.ui.settingsOpen = true;

        const overlay = document.createElement('div');
        overlay.className = 'wb-settings-overlay';
        overlay.id = 'wb-settings-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSettings();
        });

        const modal = document.createElement('div');
        modal.className = 'wb-settings-modal';

        // Determine connection state string
        let connText = 'Disconnected';
        let connClass = 'disconnected';
        if (state.connected) { connText = 'Connected'; connClass = 'connected'; }
        else if (state.connecting) { connText = 'Connecting...'; connClass = 'connecting'; }

        const exp = state.subscriptionExpiresAt;
        let subLabel = 'Subscription: unknown';
        let subColor = '#9ca3af';
        if (exp === 'permanent') {
            subLabel = 'Subscription: \u2605 Permanent';
            subColor = '#4ade80';
        } else if (typeof exp === 'number' && exp > 0) {
            const ms = exp - Date.now();
            if (ms <= 0) {
                subLabel = 'Subscription: expired';
                subColor = '#ef4444';
            } else {
                const days = Math.floor(ms / 86400000);
                const hours = Math.floor((ms % 86400000) / 3600000);
                const text = days >= 1 ? (days + ' day' + (days === 1 ? '' : 's')) : (hours + 'h');
                subLabel = 'Subscription: ' + text + ' remaining';
                subColor = days < 7 ? '#fbbf24' : '#4ade80';
            }
        }

        modal.innerHTML = `
            <h2>\u2699 FactionOps Settings</h2>

            <div class="wb-connection-status">
                <span class="wb-status-dot ${connClass}" id="wb-settings-conn-dot"></span>
                <span id="wb-settings-conn-text">${connText}</span>
            </div>

            <div style="font-size:12px;color:${subColor};margin:-8px 0 14px 0;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:4px;border-left:3px solid ${subColor};">
                ${escapeHtml(subLabel)}
            </div>

            <label for="wb-input-server">Server URL</label>
            <input type="text" id="wb-input-server" value="${escapeHtml(CONFIG.SERVER_URL)}" placeholder="http://localhost:3000">

            <label for="wb-input-apikey">Torn API Key</label>
            <div style="display:flex;gap:6px;margin-bottom:14px;">
                <input type="password" id="wb-input-apikey" value="${escapeHtml(CONFIG.API_KEY)}" placeholder="Your Torn API key" style="margin-bottom:0;flex:1;" ${CONFIG.IS_PDA && CONFIG.API_KEY === PDA_API_KEY ? 'disabled' : ''}>
                <button class="wb-btn wb-btn-sm" id="wb-btn-verify">Verify</button>
            </div>
            ${CONFIG.IS_PDA ? '<div style="font-size:11px;color:#87ceeb;margin-bottom:8px;">\u2705 Torn PDA detected — using PDA-managed API key.</div>' : ''}
            <div id="wb-verify-result" style="font-size:11px;margin-bottom:10px;min-height:14px;"></div>

            <div class="wb-settings-row">
                <span>Theme</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:11px;opacity:0.6;">Dark</span>
                    <label class="wb-toggle">
                        <input type="checkbox" id="wb-toggle-theme" ${CONFIG.THEME === 'light' ? 'checked' : ''}>
                        <span class="wb-toggle-slider"></span>
                    </label>
                    <span style="font-size:11px;opacity:0.6;">Light</span>
                </div>
            </div>

            <div class="wb-settings-row">
                <span>Auto-Sort Targets</span>
                <label class="wb-toggle">
                    <input type="checkbox" id="wb-toggle-autosort" ${CONFIG.AUTO_SORT ? 'checked' : ''}>
                    <span class="wb-toggle-slider"></span>
                </label>
            </div>

            <div class="wb-settings-row">
                <span>Chain Break Alert</span>
                <label class="wb-toggle">
                    <input type="checkbox" id="wb-toggle-chain-alert" ${CONFIG.CHAIN_ALERT ? 'checked' : ''}>
                    <span class="wb-toggle-slider"></span>
                </label>
            </div>
            <div id="wb-chain-alert-threshold-row" style="display:${CONFIG.CHAIN_ALERT ? 'flex' : 'none'};align-items:center;gap:8px;margin-bottom:14px;">
                <span style="font-size:12px;opacity:0.8;">Alert when chain timer below</span>
                <input type="text" id="wb-input-chain-threshold" value="${CONFIG.CHAIN_ALERT_THRESHOLD}" style="width:50px;margin-bottom:0;text-align:center;">
                <span style="font-size:12px;opacity:0.8;">seconds</span>
            </div>

            <div class="wb-settings-row">
                <span>Stay Active</span>
                <label class="wb-toggle">
                    <input type="checkbox" id="wb-toggle-keep-alive" ${CONFIG.KEEP_ALIVE ? 'checked' : ''}>
                    <span class="wb-toggle-slider"></span>
                </label>
            </div>

            <div class="wb-settings-row">
                <span>Share my API key with faction pool</span>
                <label class="wb-toggle">
                    <input type="checkbox" id="wb-toggle-pool-opt">
                    <span class="wb-toggle-slider"></span>
                </label>
            </div>
            <div style="font-size:11px;opacity:0.6;margin-bottom:14px;">
                When on, your key is used alongside other officers' keys to
                spread the faction's server-side polling load (chain, war
                status, hospital events). Rate limits stop cascading.
                Please use a <strong>Limited</strong> key — never a Full
                key — for sharing. Opt out at any time.
            </div>

            <div style="margin: 14px 0;">
                <label for="wb-input-broadcast-roles">Custom Admin Roles (comma-separated)</label>
                <div style="display:flex;gap:6px;">
                    <input type="text" id="wb-input-broadcast-roles" placeholder="e.g. leader,co-leader,banker,warmaster" style="margin-bottom:0;flex:1;">
                    <button class="wb-btn wb-btn-sm" id="wb-btn-save-roles">Save</button>
                </div>
                <div style="font-size:11px;opacity:0.6;margin-top:4px;">
                    Faction positions counted as admins. Admins can use "Shout"
                    and view post-war reports. <br>
                    <span id="fo-enabled-roles-label">Loading enabled roles...<br></span>
                    <em>Note: Saving a list replaces the defaults. Clear and save to reset.</em>
                </div>
            </div>
            <div style="font-size:11px;opacity:0.6;margin-bottom:14px;">
                Keeps your Torn activity fresh while the warboard is open, so enemies can't tell you're idle.
            </div>

            <div class="wb-settings-row">
                <span>PDA Notifications</span>
                <label class="wb-toggle">
                    <input type="checkbox" id="wb-toggle-pda-notif" ${CONFIG.PDA_NOTIFICATIONS ? 'checked' : ''}>
                    <span class="wb-toggle-slider"></span>
                </label>
            </div>
            <div style="font-size:11px;opacity:0.6;margin-bottom:8px;">
                Native push notifications for calls, chain alerts, bonus hits, and war targets.
            </div>
            <button class="wb-btn wb-btn-sm" id="fo-btn-test-pda-notif" style="margin-bottom:14px;font-size:11px;">Test PDA Notification</button>
            <div id="fo-pda-notif-result" style="font-size:11px;margin-bottom:10px;min-height:14px;"></div>

            <button class="wb-btn wb-btn-sm" id="fo-btn-test-toast" style="margin-bottom:14px;font-size:11px;">Test Toast Notification</button>

            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;">

            ${isLeader() ? `
            <label>War Target (Respect)</label>
            <div style="font-size:11px;opacity:0.7;margin-bottom:8px;">
                Set a custom respect target for terms/ranked wars. All faction members will see progress toward this goal.
            </div>
            <div style="display:flex;gap:6px;margin-bottom:14px;">
                <input type="text" id="fo-input-war-target" value="${state.warTarget ? state.warTarget.value : ''}" placeholder="e.g. 10000" style="margin-bottom:0;flex:1;" inputmode="numeric">
                <button class="wb-btn wb-btn-sm" id="fo-btn-set-war-target">Set</button>
                <button class="wb-btn wb-btn-sm wb-btn-danger" id="fo-btn-clear-war-target" ${state.warTarget ? '' : 'disabled'}>Clear</button>
            </div>
            <div id="fo-war-target-result" style="font-size:11px;margin-bottom:10px;min-height:14px;"></div>
            ` : (state.warTarget ? `
            <div style="font-size:11px;margin-bottom:14px;">
                <span style="opacity:0.6;">War Target:</span> <strong style="color:#74b9ff;">${parseInt(state.warTarget.value).toLocaleString()}</strong>
                <span style="opacity:0.5;"> (set by ${escapeHtml(state.warTarget.setBy.name)})</span>
            </div>
            ` : '')}

            <label>Faction API Key</label>
            <div style="font-size:11px;opacity:0.7;margin-bottom:8px;">
                Provide a Limited API key for server-side war status updates. This lets the server poll Torn directly instead of relying on page data.
            </div>
            <div style="font-size:11px;margin-bottom:8px;">
                <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" rel="noopener" style="color:#87ceeb;text-decoration:underline;">Create a Limited key on Torn</a>
            </div>
            <div id="wb-faction-key-status" style="font-size:11px;margin-bottom:8px;min-height:14px;"></div>
            <div id="wb-faction-key-input-row" style="display:flex;gap:6px;margin-bottom:14px;">
                <input type="text" id="wb-input-faction-key" placeholder="Paste faction API key" style="margin-bottom:0;flex:1;">
                <button class="wb-btn wb-btn-sm" id="wb-btn-save-faction-key">Save Key</button>
            </div>
            <div id="wb-faction-key-saved-row" style="display:none;align-items:center;gap:8px;margin-bottom:14px;">
                <span style="color:var(--wb-call-green);font-size:12px;">Key saved \u2713</span>
                <button class="wb-btn wb-btn-sm wb-btn-danger" id="wb-btn-remove-faction-key">Remove</button>
            </div>

            ${state.myPlayerId === '137558' ? `
            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;">
            <div style="margin-bottom:14px;">
                <label>Admin Tools</label>
                <button class="wb-btn wb-btn-sm" id="wb-btn-view-logs" style="width:100%;">View PM2 Server Logs</button>
            </div>
            ` : ''}

            <div class="wb-settings-actions">
                <button class="wb-btn wb-btn-danger" id="wb-btn-disconnect">Disconnect</button>
                <button class="wb-btn" id="wb-btn-save">Save &amp; Connect</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // ---- Event listeners inside modal ----

        document.getElementById('wb-btn-verify').addEventListener('click', async () => {
            const resultEl = document.getElementById('wb-verify-result');
            const apiKey = document.getElementById('wb-input-apikey').value.trim();
            if (!apiKey) {
                resultEl.textContent = 'Please enter an API key.';
                resultEl.style.color = 'var(--wb-call-red)';
                return;
            }
            resultEl.textContent = 'Verifying...';
            resultEl.style.color = 'var(--wb-idle-yellow)';
            try {
                setConfig('API_KEY', apiKey);
                setConfig('SERVER_URL', document.getElementById('wb-input-server').value.trim() || 'http://localhost:3000');
                await authenticate();
                resultEl.textContent = `Verified! Player: ${state.myPlayerName || state.myPlayerId}`;
                resultEl.style.color = 'var(--wb-call-green)';
            } catch (e) {
                resultEl.textContent = `Error: ${e.message}`;
                resultEl.style.color = 'var(--wb-call-red)';
            }
        });

        document.getElementById('wb-toggle-theme').addEventListener('change', (e) => {
            const theme = e.target.checked ? 'light' : 'dark';
            setConfig('THEME', theme);
            applyTheme();
        });

        document.getElementById('wb-toggle-autosort').addEventListener('change', (e) => {
            setConfig('AUTO_SORT', e.target.checked);
            if (e.target.checked) debouncedSort();
        });

        document.getElementById('wb-toggle-chain-alert').addEventListener('change', (e) => {
            setConfig('CHAIN_ALERT', e.target.checked);
            const thresholdRow = document.getElementById('wb-chain-alert-threshold-row');
            if (thresholdRow) thresholdRow.style.display = e.target.checked ? 'flex' : 'none';
        });

        document.getElementById('wb-input-chain-threshold').addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (val > 0 && val <= 300) {
                setConfig('CHAIN_ALERT_THRESHOLD', val);
            } else {
                e.target.value = CONFIG.CHAIN_ALERT_THRESHOLD;
            }
        });

        document.getElementById('wb-toggle-keep-alive').addEventListener('change', (e) => {
            setConfig('KEEP_ALIVE', e.target.checked);
            if (e.target.checked) {
                startKeepAlive();
            } else {
                stopKeepAlive();
            }
        });

        // Key-pool opt-in: hydrate current value from server, then wire toggle.
        const poolToggle = document.getElementById('wb-toggle-pool-opt');
        if (poolToggle) {
            getAction('/api/pool-opt')
                .then((r) => { poolToggle.checked = !!(r && r.enabled); })
                .catch(() => { /* unauthenticated or network — leave default */ });
            poolToggle.addEventListener('change', (e) => {
                postAction('/api/pool-opt', { enabled: e.target.checked })
                    .catch((err) => {
                        warn('pool-opt toggle failed:', err && err.message);
                        // revert visually
                        e.target.checked = !e.target.checked;
                    });
            });
        }

        const pdaNotifToggle = document.getElementById('wb-toggle-pda-notif');
        if (pdaNotifToggle) {
            pdaNotifToggle.addEventListener('change', (e) => {
                setConfig('PDA_NOTIFICATIONS', e.target.checked);
            });
        }

        const testPdaBtn = document.getElementById('fo-btn-test-pda-notif');
        if (testPdaBtn) {
            testPdaBtn.addEventListener('click', () => {
                const resultEl = document.getElementById('fo-pda-notif-result');
                if (!window.flutter_inappwebview?.callHandler) {
                    if (resultEl) resultEl.innerHTML = '<span style="color:#e17055;">Not running in PDA — handler not available</span>';
                    return;
                }
                const testId = 9999; // Use ID 9999 for test (won't collide with real notifications)
                const timestamp = Date.now() + 3000; // 3 seconds from now
                if (resultEl) resultEl.innerHTML = '<span style="color:#74b9ff;">Scheduling test notification (3s)...</span>';
                window.flutter_inappwebview.callHandler('scheduleNotification', {
                    title: '\uD83D\uDD14 FactionOps Test',
                    subtitle: 'PDA notifications are working!',
                    id: testId,
                    timestamp: timestamp,
                    overwriteID: true,
                    launchNativeToast: true,
                    toastMessage: 'Test notification scheduled — fires in 3 seconds',
                    toastColor: 'green',
                    toastDurationSeconds: 3,
                    urlCallback: '',
                }).then((resp) => {
                    log('[PDA-Test] scheduleNotification response:', resp);
                    if (resultEl) resultEl.innerHTML = '<span style="color:#00b894;">\u2713 Scheduled! Check for notification in ~3s. Response: ' + JSON.stringify(resp) + '</span>';
                }).catch((err) => {
                    warn('[PDA-Test] scheduleNotification error:', err);
                    if (resultEl) resultEl.innerHTML = '<span style="color:#e17055;">\u2717 Error: ' + (err?.message || err) + '</span>';
                });
            });
        }

        // Test Toast button
        const testToastBtn = document.getElementById('fo-btn-test-toast');
        if (testToastBtn) {
            testToastBtn.addEventListener('click', () => {
                showToast('Toast notifications are working!', 'success');
            });
        }


        // War target — set/clear (leader only)
        const warTargetSetBtn = document.getElementById('fo-btn-set-war-target');
        const warTargetClearBtn = document.getElementById('fo-btn-clear-war-target');
        if (warTargetSetBtn) {
            warTargetSetBtn.addEventListener('click', async () => {
                const resultEl = document.getElementById('fo-war-target-result');
                const input = document.getElementById('fo-input-war-target');
                const val = input.value.trim().replace(/,/g, '');
                const num = parseInt(val, 10);
                if (!val || isNaN(num) || num <= 0) {
                    resultEl.textContent = 'Enter a valid positive number.';
                    resultEl.style.color = 'var(--wb-call-red)';
                    return;
                }
                resultEl.textContent = 'Saving...';
                resultEl.style.color = 'var(--wb-idle-yellow)';
                try {
                    const resp = await postAction('/api/war-target', { warId: deriveWarId(), target: num });
                    if (resp && resp.ok) {
                        state.warTarget = resp.warTarget;
                        resultEl.textContent = 'Target set: ' + num.toLocaleString() + ' respect';
                        resultEl.style.color = 'var(--wb-call-green)';
                        if (warTargetClearBtn) warTargetClearBtn.disabled = false;
                    } else {
                        resultEl.textContent = (resp && resp.error) || 'Failed to set target';
                        resultEl.style.color = 'var(--wb-call-red)';
                    }
                } catch (e) {
                    resultEl.textContent = 'Error: ' + e.message;
                    resultEl.style.color = 'var(--wb-call-red)';
                }
            });
        }
        if (warTargetClearBtn) {
            warTargetClearBtn.addEventListener('click', async () => {
                const resultEl = document.getElementById('fo-war-target-result');
                resultEl.textContent = 'Clearing...';
                resultEl.style.color = 'var(--wb-idle-yellow)';
                try {
                    const resp = await postAction('/api/war-target', { warId: deriveWarId(), target: null });
                    if (resp && resp.ok) {
                        state.warTarget = null;
                        const input = document.getElementById('fo-input-war-target');
                        if (input) input.value = '';
                        resultEl.textContent = 'Target cleared.';
                        resultEl.style.color = 'var(--wb-call-green)';
                        warTargetClearBtn.disabled = true;
                    } else {
                        resultEl.textContent = (resp && resp.error) || 'Failed to clear target';
                        resultEl.style.color = 'var(--wb-call-red)';
                    }
                } catch (e) {
                    resultEl.textContent = 'Error: ' + e.message;
                    resultEl.style.color = 'var(--wb-call-red)';
                }
            });
        }

        // Faction API key — check if one already exists
        (async () => {
            if (state.factionKeyStored) {
                showFactionKeySaved();
            }

            // Fetch current broadcast roles
            try {
                const resp = await getAction('/api/broadcast/roles');
                if (resp && resp.roles) {
                    const label = document.getElementById('fo-enabled-roles-label');
                    const input = document.getElementById('wb-input-broadcast-roles');
                    if (label) label.innerHTML = 'Enabled roles: <span style="color:#00b894;">' + resp.roles.join(', ') + '</span><br>';
                    
                    const defaults = ['leader', 'co-leader', 'war leader', 'banker'];
                    const isDefault = resp.roles.length === 4 && resp.roles.every(r => defaults.includes(r));
                    if (input && !isDefault) input.value = resp.roles.join(', ');
                }
            } catch (_) {}
        })();

        document.getElementById('wb-btn-save-roles').addEventListener('click', async () => {
            const rolesInput = document.getElementById('wb-input-broadcast-roles').value.trim();
            const roles = rolesInput ? rolesInput.split(',').map(r => r.trim().toLowerCase()) : [];
            
            try {
                const resp = await postAction('/api/broadcast/roles', { roles });
                if (resp && resp.success) {
                    showToast('Broadcast roles updated!', 'success');
                    const label = document.getElementById('fo-enabled-roles-label');
                    if (label && resp.roles) {
                        label.innerHTML = 'Enabled roles: <span style="color:#00b894;">' + resp.roles.join(', ') + '</span><br>';
                    }
                } else {
                    showToast(resp.error || 'Failed to update roles', 'error');
                }
            } catch (e) {
                showToast('Failed to connect to server.', 'error');
            }
        });

        document.getElementById('wb-btn-save-faction-key').addEventListener('click', async () => {
            const statusEl = document.getElementById('wb-faction-key-status');
            const keyVal = document.getElementById('wb-input-faction-key').value.trim();
            if (!keyVal) {
                statusEl.textContent = 'Please paste an API key.';
                statusEl.style.color = 'var(--wb-call-red)';
                return;
            }
            statusEl.textContent = 'Saving...';
            statusEl.style.color = 'var(--wb-idle-yellow)';
            try {
                const resp = await postAction('/api/faction-key', { apiKey: keyVal });
                if (resp && resp.ok) {
                    statusEl.textContent = '';
                    state.factionKeyStored = true;
                    showFactionKeySaved();
                } else {
                    statusEl.textContent = (resp && resp.error) || 'Failed to save key';
                    statusEl.style.color = 'var(--wb-call-red)';
                }
            } catch (e) {
                statusEl.textContent = 'Error: ' + e.message;
                statusEl.style.color = 'var(--wb-call-red)';
            }
        });

        document.getElementById('wb-btn-remove-faction-key').addEventListener('click', async () => {
            const statusEl = document.getElementById('wb-faction-key-status');
            statusEl.textContent = 'Removing...';
            statusEl.style.color = 'var(--wb-idle-yellow)';
            try {
                const resp = await removeAction('/api/faction-key/remove');
                if (resp && resp.ok) {
                    statusEl.textContent = '';
                    state.factionKeyStored = false;
                    showFactionKeyInput();
                } else {
                    statusEl.textContent = (resp && resp.error) || 'Failed to remove key';
                    statusEl.style.color = 'var(--wb-call-red)';
                }
            } catch (e) {
                statusEl.textContent = 'Error: ' + e.message;
                statusEl.style.color = 'var(--wb-call-red)';
            }
        });

        function showFactionKeySaved() {
            const inputRow = document.getElementById('wb-faction-key-input-row');
            const savedRow = document.getElementById('wb-faction-key-saved-row');
            if (inputRow) inputRow.style.display = 'none';
            if (savedRow) savedRow.style.display = 'flex';
        }

        function showFactionKeyInput() {
            const inputRow = document.getElementById('wb-faction-key-input-row');
            const savedRow = document.getElementById('wb-faction-key-saved-row');
            if (inputRow) inputRow.style.display = 'flex';
            if (savedRow) savedRow.style.display = 'none';
        }

        const viewLogsBtn = document.getElementById('wb-btn-view-logs');


        if (viewLogsBtn) {
            viewLogsBtn.addEventListener('click', async () => {
                viewLogsBtn.textContent = 'Loading...';
                viewLogsBtn.disabled = true;
                try {
                    const resp = await getAction('/api/admin/pm2-logs');
                    if (resp && resp.ok !== false) {
                        const logsModal = document.createElement('div');
                        logsModal.className = 'wb-settings-modal';
                        logsModal.style.width = '800px';
                        logsModal.style.maxWidth = '95vw';
                        logsModal.innerHTML = `
                            <h2>PM2 Server Logs</h2>
                            <label>Out Log</label>
                            <pre style="background:#111;color:#0f0;padding:10px;border-radius:4px;overflow-x:auto;max-height:300px;font-size:11px;margin-bottom:14px;">${escapeHtml(resp.out || 'Empty')}</pre>
                            <label>Error Log</label>
                            <pre style="background:#111;color:#f00;padding:10px;border-radius:4px;overflow-x:auto;max-height:300px;font-size:11px;margin-bottom:14px;">${escapeHtml(resp.err || 'Empty')}</pre>
                            <button class="wb-btn" id="wb-btn-close-logs">Close</button>
                        `;
                        const overlay2 = document.createElement('div');
                        overlay2.className = 'wb-settings-overlay';
                        overlay2.style.zIndex = '1000001'; // Above settings modal
                        overlay2.appendChild(logsModal);
                        document.body.appendChild(overlay2);
                        document.getElementById('wb-btn-close-logs').addEventListener('click', () => {
                            document.body.removeChild(overlay2);
                        });
                    } else {
                        alert('Failed to fetch logs: ' + (resp.error || 'Unknown error'));
                    }
                } catch (e) {
                    alert('Error: ' + e.message);
                } finally {
                    viewLogsBtn.textContent = 'View PM2 Server Logs';
                    viewLogsBtn.disabled = false;
                }
            });
        }

        document.getElementById('wb-btn-disconnect').addEventListener('click', () => {
            stopPolling();
            disconnectRealtime();
            disconnectSSEStream();
            stopKeepAlive();
            closeSettings();
        });

        document.getElementById('wb-btn-save').addEventListener('click', async () => {
            const serverUrl = document.getElementById('wb-input-server').value.trim() || 'http://localhost:3000';
            const apiKey = document.getElementById('wb-input-apikey').value.trim();

            setConfig('SERVER_URL', serverUrl);
            setConfig('API_KEY', apiKey);

            stopPolling();
            disconnectRealtime();
            disconnectSSEStream();
            if (apiKey) {
                try {
                    await authenticate();
                    startPolling();
                    connectRealtime();
                } catch (e) {
                    warn('Auth failed on save:', e.message);
                    if (state.jwtToken) { startPolling(); connectRealtime(); }
                }
            }
            closeSettings();
        });
    }

    function closeSettings() {
        state.ui.settingsOpen = false;
        const overlay = document.getElementById('wb-settings-overlay');
        if (overlay) overlay.remove();
    }

    /** Escape HTML for safe insertion into innerHTML. */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /** Update connection indicators wherever they appear. */
    function updateConnectionUI() {
        // Settings modal indicator
        const dot = document.getElementById('wb-settings-conn-dot');
        const text = document.getElementById('wb-settings-conn-text');
        if (dot && text) {
            dot.className = 'wb-status-dot ' +
                (state.connected ? 'connected' : state.connecting ? 'connecting' : 'disconnected');
            text.textContent = state.connected ? 'Connected' : state.connecting ? 'Connecting...' : 'Offline';
        }

        // Gear icon color hint
        const gear = document.querySelector('.wb-settings-gear');
        if (gear) {
            gear.style.borderColor = state.connected
                ? 'var(--wb-call-green)'
                : state.connecting
                    ? 'var(--wb-idle-yellow)'
                    : 'var(--wb-call-red)';
        }
    }

    /** Apply theme class to html element. */
    function applyTheme() {
        document.documentElement.classList.toggle('wb-theme-light', CONFIG.THEME === 'light');
    }

    // =========================================================================
    // SECTION 10: CHAIN MONITOR BAR
    // =========================================================================

    /** Create a standalone Next Up bar (no chain info) inserted into the page flow. */
    function createStandaloneNextUp() {
        if (document.getElementById('wb-next-up-standalone')) return;

        const bar = document.createElement('div');
        bar.id = 'wb-next-up-standalone';
        bar.className = 'wb-next-up-standalone';
        bar.innerHTML = '<div class="wb-next-up" id="wb-next-up"></div>';

        // Insert before the member list or at top of content
        const content = document.querySelector('.faction-war') || document.querySelector('.content-wrapper') || document.querySelector('#mainContainer');
        if (content && content.firstChild) {
            content.insertBefore(bar, content.firstChild);
        } else {
            document.body.prepend(bar);
        }
    }

    /** Create or update the chain monitor bar fixed to the top of the page. */
    function createChainBar() {
        if (state.ui.chainBar) return; // already exists

        const bar = document.createElement('div');
        bar.className = 'wb-chain-bar wb-chain-safe';
        bar.id = 'wb-chain-bar';

        bar.innerHTML = `
            <div class="wb-chain-section">
                <span>Chain:</span>
                <span class="wb-chain-count" id="wb-chain-count">0/0</span>
                <span id="wb-chain-bonus-badge" class="wb-chain-bonus" style="display:none;"></span>
            </div>
            <div class="wb-next-up" id="wb-next-up"></div>
            <div class="wb-chain-section">
                <span>Timeout:</span>
                <span class="wb-chain-timeout" id="wb-chain-timeout">--:--</span>
            </div>
            <div class="wb-chain-section">
                <span class="wb-chain-minimize" id="wb-chain-minimize" title="Minimize">\u2715</span>
            </div>
        `;

        document.body.appendChild(bar);
        document.body.classList.add('wb-chain-active');

        state.ui.chainBar = bar;

        document.getElementById('wb-chain-minimize').addEventListener('click', () => {
            bar.style.display = 'none';
            document.body.classList.remove('wb-chain-active');
        });

        updateChainBar();
    }



    /**
     * Forward intercepted chain data to the server so all faction members
     * see the update instantly (instead of waiting for the 30s poll).
     */
    // Chain data forwarding removed — server polls Torn API directly for chain alerts.
    // Client only handles local audio beep + PDA notification.

    /** Update chain bar contents and styling. */
    function updateChainBar() {
        // Compute chain display values
        const countText = `${state.chain.current || 0}/${state.chain.max || '??'}`;
        let timeoutText = '--:--';
        if (state.chain.timeout > 0) {
            timeoutText = formatTimer(state.chain.timeout);
        } else if (state.chain.cooldown > 0) {
            timeoutText = `CD: ${formatTimer(state.chain.cooldown)}`;
        }
        const next = nextBonusMilestone(state.chain.current + 1);
        const hitsToBonus = next ? next - state.chain.current : null;
        let bonusText = '';
        let showBonus = false;
        // Only show bonus indicator when chain >= 10 (past first bonus or approaching a real one)
        if (hitsToBonus !== null && hitsToBonus <= 10 && state.chain.current >= 10) {
            showBonus = true;
            bonusText = hitsToBonus <= 0 ? `BONUS ${next}!` : `BONUS in ${hitsToBonus}`;
        }
        const isDanger = state.chain.timeout > 0 && state.chain.timeout <= 30;

        // Update floating chain bar (if visible)
        const bar = state.ui.chainBar;
        if (bar && bar.style.display !== 'none') {
            const countEl = document.getElementById('wb-chain-count');
            const timeoutEl = document.getElementById('wb-chain-timeout');
            const bonusBadge = document.getElementById('wb-chain-bonus-badge');
            if (countEl) countEl.textContent = countText;
            if (timeoutEl) timeoutEl.textContent = timeoutText;
            if (bonusBadge) {
                bonusBadge.style.display = showBonus ? 'inline' : 'none';
                if (showBonus) bonusBadge.textContent = bonusText;
            }
            bar.classList.remove('wb-chain-safe', 'wb-chain-approaching', 'wb-chain-imminent');
            if (hitsToBonus !== null && hitsToBonus <= 3) {
                bar.classList.add('wb-chain-imminent');
            } else if (hitsToBonus !== null && hitsToBonus <= 10) {
                bar.classList.add('wb-chain-approaching');
            } else {
                bar.classList.add('wb-chain-safe');
            }
        }

        // Update live chain display in overlay header
        const liveCount = document.getElementById('fo-chain-live-count');
        const liveTimer = document.getElementById('fo-chain-live-timer');
        const liveBonus = document.getElementById('fo-chain-live-bonus');
        if (liveCount) liveCount.textContent = countText;
        if (liveTimer) {
            liveTimer.textContent = timeoutText;
            liveTimer.classList.toggle('danger', isDanger);
        }
        if (liveBonus) {
            liveBonus.style.display = showBonus ? 'inline' : 'none';
            if (showBonus) liveBonus.textContent = bonusText;
        }

        // Update overlay header fallback chain info (only when Torn native bar wasn't found)
        const fallback = document.getElementById('fo-chain-fallback');
        if (fallback && fallback.style.display !== 'none') {
            const foCount = document.getElementById('fo-chain-count');
            const foTimeout = document.getElementById('fo-chain-timeout');
            const foBonus = document.getElementById('fo-chain-bonus');
            if (foCount) foCount.textContent = countText;
            if (foTimeout) {
                foTimeout.textContent = timeoutText;
                foTimeout.classList.toggle('danger', isDanger);
            }
            if (foBonus) {
                foBonus.style.display = showBonus ? 'inline' : 'none';
                if (showBonus) foBonus.textContent = bonusText;
            }
        }
    }

    // ---- Chain break sound alert via Web Audio API ----
    function playChainAlert() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const beep = (startTime) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                osc.type = 'square';
                gain.gain.value = 0.3;
                osc.start(startTime);
                osc.stop(startTime + 0.1);
            };
            const now = ctx.currentTime;
            beep(now);
            beep(now + 0.2);
            beep(now + 0.4);
        } catch (e) {
            warn('Chain alert audio failed:', e);
        }
    }

    // Client-side countdown for chain timeout/cooldown
    let chainTimerRAF = null;
    // Wall-clock anchor for chain timeout — any source (intercepted API, server
    // poll, BroadcastChannel) calls setChainTimeout(); tick() derives current
    // timeout from elapsed wall-clock time so the countdown never jumps.
    let chainTimeoutAnchor = 0;    // timeout value when last set (seconds)
    let chainTimeoutAnchorAt = 0;  // Date.now() when last set
    let lastChainCurrent = -1;     // track chain count for monotonic guard

    function setChainTimeout(value) {
        // Monotonic guard: chain timers only count DOWN, so reject values
        // that are HIGHER than our current countdown — they come from stale
        // cached API responses. Allow higher values only when chain count
        // changed (a new hit legitimately resets the timer).
        const chainCountChanged = state.chain.current !== lastChainCurrent;
        if (!chainCountChanged && chainTimeoutAnchorAt > 0 && chainTimeoutAnchor > 0) {
            const elapsed = (Date.now() - chainTimeoutAnchorAt) / 1000;
            const currentCountdown = Math.max(0, chainTimeoutAnchor - elapsed);
            // Only accept if new value is at or below current countdown (+2s tolerance)
            if (value > currentCountdown + 2) {
                return; // stale/cached — ignore
            }
        }
        lastChainCurrent = state.chain.current;
        state.chain.timeout = value;
        chainTimeoutAnchor = value;
        chainTimeoutAnchorAt = Date.now();
    }
    // Cooldown wall-clock anchors (cooldown only comes from server, no conflict)
    let chainCooldownSetAt = 0;
    let chainCooldownSetVal = 0;

    function startChainTimer() {
        if (chainTimerRAF) return; // already running

        function tick() {
            // Derive timeout from wall-clock since last anchor — never
            // decrement state.chain.timeout directly (prevents jump when
            // multiple sources set different values).
            if (chainTimeoutAnchorAt > 0 && chainTimeoutAnchor > 0) {
                const elapsed = (Date.now() - chainTimeoutAnchorAt) / 1000;
                state.chain.timeout = Math.max(0, chainTimeoutAnchor - elapsed);
            }
            // Chain break sound + notification alerts (only during active wars)
            // Only alert if chain data is fresh (anchor set within last 60s — avoids stale countdown alerts)
            const anchorAge = chainTimeoutAnchorAt > 0 ? (Date.now() - chainTimeoutAnchorAt) / 1000 : Infinity;
            const chainDataFresh = anchorAge < 120; // anchor less than 2 min old
            if (CONFIG.CHAIN_ALERT && isWarActive() && chainDataFresh && state.chain.timeout > 0 && state.chain.current >= 10) {
                // Panic at 30s
                if (state.chain.timeout <= 30 && !state.chainPanicFired) {
                    playChainAlert();
                    firePdaNotification('chain_alert',
                        '\uD83D\uDD34 CHAIN DYING! ' + Math.round(state.chain.timeout) + 's!',
                        `Chain ${state.chain.current} is about to break! ${Math.round(state.chain.timeout)}s left \u2014 HIT NOW!`);
                    state.chainPanicFired = true;
                // Warning at 60s
                } else if (state.chain.timeout <= CONFIG.CHAIN_ALERT_THRESHOLD && !state.chainAlertFired) {
                    playChainAlert();
                    firePdaNotification('chain_alert',
                        '\uD83D\uDEA8 CHAIN BREAKING!',
                        `Chain ${state.chain.current} \u2014 ${Math.round(state.chain.timeout)}s remaining! Attack now!`);
                    state.chainAlertFired = true;
                }
            }
            if (state.chain.timeout > CONFIG.CHAIN_ALERT_THRESHOLD) {
                state.chainAlertFired = false;
                state.chainPanicFired = false;
            }
            if (chainCooldownSetAt > 0 && chainCooldownSetVal > 0) {
                const elapsed = (Date.now() - chainCooldownSetAt) / 1000;
                state.chain.cooldown = Math.max(0, chainCooldownSetVal - elapsed);
            }

            updateChainBar();
            updateEnergyDisplay();
            chainTimerRAF = requestAnimationFrame(tick);
        }

        chainTimerRAF = requestAnimationFrame(tick);
    }

    // Re-sync chain timer immediately when the tab becomes visible again.
    // Wall-clock approach already gives the correct value; just force a repaint.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updateChainBar();
            // Immediately refresh war stats and poll server when tab becomes visible
            if (typeof updateWarTimer === 'function') updateWarTimer();
            if (typeof updateWarTimerDisplay === 'function') updateWarTimerDisplay();
            pollOnce();
        }
    });

    // Direct Torn API chain polling — uses the player's own API key to get
    // chain data every 5 seconds, independent of the server poll.
    let chainPollInterval = null;
    const CHAIN_POLL_MS = 30000; // 30 seconds (Torn API caches for 29s anyway)

    function startDirectChainPoll() {
        if (chainPollInterval) return; // already running

        function pollChain() {
            if (!CONFIG.API_KEY || !state.myFactionId) return;

            const url = `https://api.torn.com/faction/${state.myFactionId}?selections=chain&key=${encodeURIComponent(CONFIG.API_KEY)}`;

            httpRequest({
                method: 'GET',
                url,
                onload(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) return;
                        if (data.chain) {
                            const chain = data.chain;
                            const oldCurrent = state.chain.current;
                            state.chain.current = chain.current || 0;
                            state.chain.max = chain.max || 0;
                            let adjustedTimeout = chain.timeout || 0;
                            if (data.timestamp && adjustedTimeout > 0) {
                                const cacheAge = Math.floor(Date.now() / 1000) - data.timestamp;
                                if (cacheAge > 0 && cacheAge < 300) {
                                    adjustedTimeout = Math.max(0, adjustedTimeout - cacheAge);
                                }
                            }
                            setChainTimeout(adjustedTimeout);
                            state.chain.cooldown = chain.cooldown || 0;
                            updateChainBar();

                            if (chain.current !== oldCurrent) {
                            }
                        }
                    } catch (e) {
                        // Parse error — skip silently
                    }
                },
                onerror() {
                    // Network error — skip silently
                },
            });
        }

        pollChain();
        chainPollInterval = setInterval(pollChain, CHAIN_POLL_MS);
        log(`Direct chain poll started (every ${CHAIN_POLL_MS / 1000}s)`);
    }

    function stopDirectChainPoll() {
        if (chainPollInterval) {
            clearInterval(chainPollInterval);
            chainPollInterval = null;
            log('Direct chain poll stopped');
        }
    }

    // ---- Energy bar via API ----
    const ENERGY_POLL_MS = 60000; // 60 seconds
    let energyPollInterval = null;
    let energyState = { current: 0, max: 0, ticktime: 0, fulltime: 0 };
    let energyTickAnchorAt = 0; // wall-clock when we last set ticktime
    let energyTickAnchorVal = 0; // ticktime value at anchor


    function pollEnergy() {
        if (!CONFIG.API_KEY) return;
        const url = `https://api.torn.com/user/?selections=bars&key=${encodeURIComponent(CONFIG.API_KEY)}`;
        httpRequest({
            method: 'GET',
            url,
            onload(res) {
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.error) return;
                    if (data.energy) {
                        energyState.current = data.energy.current || 0;
                        energyState.max = data.energy.maximum || 0;
                        energyState.ticktime = data.energy.ticktime || 0;
                        energyState.fulltime = data.energy.fulltime || 0;
                        energyTickAnchorVal = energyState.ticktime;
                        energyTickAnchorAt = Date.now();
                        updateEnergyDisplay();
                    }
                } catch (e) { /* silent */ }
            },
            onerror() { /* silent */ },
        });
    }

    function startEnergyPoll() {
        if (energyPollInterval) return;
        pollEnergy();
        energyPollInterval = setInterval(pollEnergy, ENERGY_POLL_MS);
        log('Energy poll started (every 60s)');
    }

    function stopEnergyPoll() {
        if (energyPollInterval) {
            clearInterval(energyPollInterval);
            energyPollInterval = null;
        }
    }

    // ---- Attack telemetry via personal API ----
    // Polls /user/?selections=attacks every 60s and POSTs the last-100
    // fight history to warboard so post-war reports get rich per-attack
    // data (mug $, modifiers, defends) the faction attacks-feed misses.
    const ATTACKS_POLL_MS = 60000;
    let attacksPollInterval = null;

    function pollAttacks() {
        if (!CONFIG.API_KEY || !state.jwtToken) return;
        const url = `https://api.torn.com/user/?selections=attacks&key=${encodeURIComponent(CONFIG.API_KEY)}&comment=warboard-attacks`;
        httpRequest({
            method: 'GET',
            url,
            onload(res) {
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.error || !data.attacks) return;
                    if (Object.keys(data.attacks).length === 0) return;
                    postAction('/api/me/attacks', { attacks: data.attacks }).catch(() => {});
                } catch (e) { /* silent */ }
            },
            onerror() { /* silent */ },
        });
    }

    function startAttacksPoll() {
        if (attacksPollInterval) return;
        pollAttacks();
        attacksPollInterval = setInterval(pollAttacks, ATTACKS_POLL_MS);
        log('Attack telemetry poll started (every 60s)');
    }

    function stopAttacksPoll() {
        if (attacksPollInterval) {
            clearInterval(attacksPollInterval);
            attacksPollInterval = null;
        }
    }

    function updateEnergyDisplay() {
        const valEl = document.getElementById('fo-energy-value');
        const timerEl = document.getElementById('fo-energy-timer');
        if (!valEl) return;

        valEl.textContent = `${energyState.current}/${energyState.max}`;
        valEl.classList.toggle('full', energyState.current >= energyState.max);

        if (timerEl) {
            if (energyState.current >= energyState.max) {
                timerEl.textContent = '';
            } else if (energyState.fulltime > 0) {
                // Show time until full
                const elapsed = (Date.now() - energyTickAnchorAt) / 1000;
                const remaining = Math.max(0, energyState.fulltime - elapsed);
                if (remaining > 0) {
                    const mins = Math.floor(remaining / 60);
                    const secs = Math.floor(remaining % 60);
                    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                } else {
                    timerEl.textContent = '';
                }
            } else {
                timerEl.textContent = '';
            }
        }
    }

    // ---- DOM-based chain reader (zero API calls) ----
    // Watches Torn's native #barChain element for changes and extracts
    // chain count + timer directly from the DOM text content.
    let chainDOMObserver = null;
    let chainDOMReadInterval = null;

    let chainBarRef = null; // cached reference to the moved #barChain element

    function parseChainFromDOM() {
        const bar = chainBarRef || document.getElementById('barChain');
        if (!bar) return false;

        // bar-stats contains text like "1/10" or "Chain: 1,234/100,000"
        const statsEl = bar.querySelector('p[class*="bar-stats"]');
        // bar-timeleft contains text like "04:21" or "4:21"
        const timeleftEl = bar.querySelector('p[class*="bar-timeleft"]');
        // bar-value may contain the progress bar fill

        let changed = false;

        if (statsEl) {
            const text = statsEl.textContent.trim();
            // Extract numbers from "Chain: 1,234 / 100,000" or "1/10" etc.
            const match = text.match(/(\d[\d,.\s]*)\s*\/\s*(\d[\d,.\s]*)/);
            if (match) {
                const current = parseInt(match[1].replace(/[^\d]/g, ''), 10);
                const max = parseInt(match[2].replace(/[^\d]/g, ''), 10);
                if (!isNaN(current) && current !== state.chain.current) {
                    state.chain.current = current;
                    changed = true;
                }
                if (!isNaN(max)) state.chain.max = max;
            }
        }

        if (timeleftEl) {
            const text = timeleftEl.textContent.trim();
            // Parse "MM:SS" or "M:SS" or "HH:MM:SS" into seconds
            const parts = text.split(':').map(p => parseInt(p, 10));
            let seconds = 0;
            if (parts.length === 2 && parts.every(p => !isNaN(p))) {
                seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 3 && parts.every(p => !isNaN(p))) {
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            if (seconds > 0) {
                setChainTimeout(seconds);
            } else if (text === '' || text === '00:00') {
                // Chain not active or expired
                state.chain.timeout = 0;
                chainTimeoutAnchor = 0;
                chainTimeoutAnchorAt = 0;
            }
        }

        if (changed) {
        }

        return true;
    }

    function startChainDOMObserver(barElement) {
        if (chainDOMObserver) return; // already running

        const bar = barElement || chainBarRef || document.getElementById('barChain');
        if (!bar) {
            log('Cannot start chain DOM observer — #barChain not found');
            return false;
        }
        chainBarRef = bar; // cache for parseChainFromDOM

        // Initial read
        parseChainFromDOM();

        // Watch for mutations (Torn's JS updates text content)
        chainDOMObserver = new MutationObserver(() => {
            parseChainFromDOM();
        });
        chainDOMObserver.observe(bar, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        // Backup: poll every 2s in case MutationObserver misses something
        // (e.g. Torn replaces elements instead of updating text)
        chainDOMReadInterval = setInterval(parseChainFromDOM, 2000);

        log('Chain DOM observer started (zero API calls)');
        return true;
    }

    function stopChainDOMObserver() {
        if (chainDOMObserver) {
            chainDOMObserver.disconnect();
            chainDOMObserver = null;
        }
        if (chainDOMReadInterval) {
            clearInterval(chainDOMReadInterval);
            chainDOMReadInterval = null;
        }
        chainBarRef = null;
    }

    // =========================================================================
    // SECTION 11: STATUS COUNTDOWN TIMERS
    // =========================================================================

    // We keep a set of active timers that decrement `until` fields in
    // state.statuses. A single rAF loop handles all of them.
    let statusTimerRAF = null;
    let statusTimerLast = 0;

    function startStatusTimers() {
        if (statusTimerRAF) return;
        statusTimerLast = performance.now();
        let nextUpAccum = 0; // throttle next-up DOM writes to ~1s

        function tick(now) {
            const dt = (now - statusTimerLast) / 1000;
            statusTimerLast = now;
            let anyActive = false;

            for (const targetId of Object.keys(state.statuses)) {
                const s = state.statuses[targetId];
                if (s.until && s.until > 0) {
                    s.until = Math.max(0, s.until - dt);
                    anyActive = true;
                    // Update just the timer text in the DOM for efficiency
                    const timerEl = document.getElementById(`wb-timer-${targetId}`);
                    if (timerEl) {
                        timerEl.textContent = formatTimer(s.until);
                    }
                    // Also update overlay timer element
                    const foTimerEl = document.getElementById(`fo-timer-${targetId}`);
                    if (foTimerEl) {
                        foTimerEl.textContent = formatTimer(s.until);
                    }
                }
            }

            // Update the Next Up queue roughly once per second
            nextUpAccum += dt;
            if (nextUpAccum >= 1) {
                nextUpAccum = 0;
                updateNextUp();
            }

            statusTimerRAF = requestAnimationFrame(tick);
        }

        statusTimerRAF = requestAnimationFrame(tick);
    }

    /**
     * Update the "Next Up" queue in the chain bar.
     * Shows the top 3 hospital targets closest to being released.
     * Excludes called targets (they're already claimed).
     */
    function updateNextUp() {
        // Update both chain-bar version and overlay version
        const wbContainer = document.getElementById('wb-next-up');
        const foContainer = document.getElementById('fo-next-up');
        if (wbContainer) updateNextUpContainer(wbContainer, 'wb');
        if (foContainer) updateNextUpContainer(foContainer, 'fo');
    }

    function updateNextUpContainer(container, prefix) {
        // Collect hospital targets that aren't called and still have a timer
        const hospitalTargets = [];
        for (const [targetId, s] of Object.entries(state.statuses)) {
            if (normalizeStatus(s.status) === 'hospital' && s.until > 0 && !state.calls[targetId]) {
                hospitalTargets.push({ targetId, until: s.until, name: s.name || `#${targetId}` });
            }
        }

        // Sort by shortest timer first, take top 3
        hospitalTargets.sort((a, b) => a.until - b.until);
        const top3 = hospitalTargets.slice(0, 3);

        if (top3.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Check if the same targets are already rendered — only update timers
        const currentIds = Array.from(container.querySelectorAll('[data-nu-id]')).map(el => el.dataset.nuId);
        const newIds = top3.map(t => t.targetId);
        const sameSet = currentIds.length === newIds.length && currentIds.every((id, i) => id === newIds[i]);

        if (sameSet) {
            for (const t of top3) {
                const item = container.querySelector(`[data-nu-id="${t.targetId}"]`);
                if (!item) continue;
                const timerSpan = item.querySelector(`.${prefix}-next-timer, .fo-next-up-timer, .wb-next-timer`);
                if (timerSpan) timerSpan.textContent = formatTimer(t.until);
                const imminent = t.until <= 120;
                if (prefix === 'fo') {
                    item.classList.toggle('imminent', imminent);
                } else {
                    item.classList.toggle('wb-next-imminent', imminent);
                }
            }
            return;
        }

        // Full rebuild
        container.innerHTML = '';

        const label = document.createElement('span');
        label.className = prefix === 'fo' ? 'fo-next-up-label' : 'wb-next-up-label';
        label.textContent = 'Next Up:';
        container.appendChild(label);

        for (const t of top3) {
            // Try to get the name from the overlay row or status data
            const foRow = document.querySelector(`[data-fo-id="${t.targetId}"]`);
            const wbRow = document.querySelector(`[data-wb-target-id="${t.targetId}"]`);
            let name = t.name;
            if (foRow) {
                const n = foRow.querySelector('.fo-name');
                if (n) name = n.textContent;
            } else if (wbRow) {
                name = getPlayerNameFromRow(wbRow) || name;
            }
            const imminent = t.until <= 120;

            const item = document.createElement('span');
            if (prefix === 'fo') {
                item.className = 'fo-next-up-item' + (imminent ? ' imminent' : '');
            } else {
                item.className = imminent ? 'wb-next-up-item wb-next-imminent' : 'wb-next-up-item';
            }
            item.dataset.nuId = t.targetId;

            const nameLink = buildNameAnchor(t.targetId, name);
            nameLink.title = name;
            nameLink.style.cssText = 'text-decoration:none;color:inherit;';
            item.appendChild(nameLink);

            const timerSpan = document.createElement('span');
            timerSpan.className = prefix === 'fo' ? 'fo-next-up-timer' : 'wb-next-timer';
            timerSpan.textContent = formatTimer(t.until);
            item.appendChild(timerSpan);

            const callBtn = document.createElement('button');
            callBtn.className = prefix === 'fo' ? 'fo-next-up-call' : 'wb-next-up-call';
            callBtn.textContent = 'Call';
            callBtn.title = `Call ${name}`;
            callBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                emitCallTarget(t.targetId);
            });
            item.appendChild(callBtn);

            container.appendChild(item);
        }
    }

    // =========================================================================
    // SECTION 12: DOM MANIPULATION — WAR PAGE ENHANCEMENT
    // =========================================================================

    // Track which rows we've already enhanced to avoid double-injection.
    const enhancedRows = new WeakSet();

    /**
     * Multiple possible selectors for member rows across different Torn pages.
     * Torn frequently changes its HTML, so we try several patterns.
     */
    const MEMBER_LIST_SELECTORS = [
        '.members-list .table-body > li',
        '.faction-war .members-list li',
        '.ranked-war-list li',
        '.enemy-faction .member-list li',
        '.f-war-list .table-body > li',
        '.war-list li.table-row',
        '.faction-war-list .table-body li',
        '#faction-war-list li',
        '.war-main .members-cont li',
    ];

    const MEMBER_CONTAINER_SELECTORS = [
        '.members-list',
        '.faction-war',
        '.ranked-war-list',
        '.enemy-faction .member-list',
        '.f-war-list',
        '.war-list',
        '.faction-war-list',
        '#faction-war-list',
        '.war-main .members-cont',
        '#war-root',
        '#factions-page-wrap',
        '#mainContainer',
    ];

    /** Try to find member rows using multiple selectors. */
    function findMemberRows() {
        for (const sel of MEMBER_LIST_SELECTORS) {
            const rows = document.querySelectorAll(sel);
            if (rows.length > 0) {
                log(`Found ${rows.length} member rows with selector: ${sel}`);
                return rows;
            }
        }
        return [];
    }

    /** Find the container element to observe for mutations. */
    function findMemberContainer() {
        for (const sel of MEMBER_CONTAINER_SELECTORS) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return document.getElementById('mainContainer') || document.body;
    }

    /**
     * Try to extract a player ID from a member row element.
     * We look for links, data attributes, and other common patterns.
     */
    function getPlayerIdFromRow(row) {
        // Check data attributes
        if (row.dataset.id) return row.dataset.id;
        if (row.dataset.user) return row.dataset.user;

        // Check href links within the row
        const links = row.querySelectorAll('a[href]');
        for (const link of links) {
            const id = extractPlayerId(link.href);
            if (id) return id;
        }

        // Check for attack link specifically
        const attackLink = row.querySelector('a[href*="loader.php?sid=attack"]');
        if (attackLink) return extractPlayerId(attackLink.href);

        // Check for profile link
        const profileLink = row.querySelector('a[href*="profiles.php"]');
        if (profileLink) return extractPlayerId(profileLink.href);

        return null;
    }

    /** Get the player name from a row. */
    function getPlayerNameFromRow(row) {
        // Try common selectors for player names
        const nameSelectors = [
            '.user.name',
            '.member-name',
            '.honorWrap a',
            'a[href*="profiles.php"]',
            '.name-wrap a',
            '.userName',
        ];

        for (const sel of nameSelectors) {
            const el = row.querySelector(sel);
            if (el && el.textContent.trim()) {
                return el.textContent.trim();
            }
        }
        return 'Unknown';
    }

    /**
     * Enhance a single member row with FactionOps columns.
     * Injects Attack, Call, and Status cells into the row.
     */
    function enhanceRow(row) {
        if (enhancedRows.has(row)) return;

        const targetId = getPlayerIdFromRow(row);
        if (!targetId) {
            // Might be a header row or empty — skip silently
            return;
        }

        enhancedRows.add(row);
        row.classList.add('wb-sortable-row');
        row.dataset.wbTargetId = targetId;

        // Create a container for our injected cells (absolutely positioned right)
        const wbContainer = document.createElement('div');
        wbContainer.className = 'wb-cell-container';
        wbContainer.id = `wb-cells-${targetId}`;

        // --- Status cell ---
        const statusCell = document.createElement('span');
        statusCell.className = 'wb-cell';
        statusCell.id = `wb-status-${targetId}`;
        renderStatusCell(statusCell, targetId);

        // --- Attack button ---
        const attackCell = document.createElement('span');
        attackCell.className = 'wb-cell';
        const attackLink = document.createElement('a');
        attackLink.className = 'wb-attack-btn';
        attackLink.textContent = 'Attack';
        attackLink.href = `https://www.torn.com/loader.php?sid=attack&user2ID=${targetId}`;
        attackLink.target = '_blank';
        attackLink.rel = 'noopener';
        attackLink.addEventListener('click', (e) => e.stopPropagation());
        attackCell.appendChild(attackLink);

        // --- Call cell ---
        const callCell = document.createElement('span');
        callCell.className = 'wb-cell';
        callCell.id = `wb-call-${targetId}`;
        renderCallCell(callCell, targetId);

        // --- Priority cell ---
        const priorityCell = document.createElement('span');
        priorityCell.className = 'wb-cell';
        priorityCell.id = `wb-priority-${targetId}`;
        renderPriorityCell(priorityCell, targetId);

        // --- BSP / FFS estimated stats cell ---
        const bspCell = document.createElement('span');
        bspCell.className = 'wb-cell';
        bspCell.id = `wb-bsp-${targetId}`;
        renderBspCell(bspCell, targetId);

        // --- Viewers (group attack) badge ---
        const viewersCell = document.createElement('span');
        viewersCell.className = 'wb-cell';
        viewersCell.id = `wb-viewers-${targetId}`;
        renderViewersBadge(viewersCell, targetId);

        wbContainer.appendChild(priorityCell);
        wbContainer.appendChild(viewersCell);
        wbContainer.appendChild(bspCell);
        wbContainer.appendChild(statusCell);
        wbContainer.appendChild(attackCell);
        wbContainer.appendChild(callCell);

        // Always append to the row directly — CSS handles positioning
        row.appendChild(wbContainer);

        // Apply initial row highlights
        applyRowHighlights(row, targetId);
    }

    // ---- Cell renderers ----

    function renderCallCell(container, targetId) {
        container.innerHTML = '';
        const callData = state.calls[targetId];

        if (!callData) {
            // Not called — show Call button
            const btn = document.createElement('button');
            btn.className = 'wb-call-btn';
            btn.textContent = 'Call';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                emitCallTarget(targetId);
            });
            container.appendChild(btn);
        } else if (callData.calledBy && String(callData.calledBy.id) === state.myPlayerId) {
            // Called by us
            const btn = document.createElement('span');
            btn.className = 'wb-call-btn wb-called-self';
            btn.textContent = callData.isDeal ? '\uD83D\uDD12 DEAL' : 'CALLED';
            container.appendChild(btn);

            const uncallBtn = document.createElement('button');
            uncallBtn.className = 'wb-uncall-btn';
            uncallBtn.textContent = '\u2715';
            uncallBtn.title = 'Uncall';
            uncallBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                emitUncallTarget(targetId);
            });
            container.appendChild(uncallBtn);
        } else {
            // Called by someone else
            const badge = document.createElement('span');
            badge.className = 'wb-call-btn wb-called-other';
            const nameText = callData.calledBy ? callData.calledBy.name : 'Called';
            badge.textContent = callData.isDeal ? `\uD83D\uDD12 ${nameText}` : nameText;
            badge.title = `${callData.isDeal ? 'Deal call' : 'Called'} by ${callData.calledBy ? callData.calledBy.name : 'unknown'}`;
            container.appendChild(badge);
        }
    }

    function renderStatusCell(container, targetId) {
        container.innerHTML = '';
        const statusData = state.statuses[targetId];

        if (!statusData) {
            // No status data yet — show placeholder
            const badge = document.createElement('span');
            badge.className = 'wb-status-badge wb-status-ok';
            badge.innerHTML = '<span class="wb-activity-dot wb-activity-offline"></span> --';
            container.appendChild(badge);
            return;
        }

        const badge = document.createElement('span');
        let activityClass = 'wb-activity-offline';
        if (statusData.activity === 'online') activityClass = 'wb-activity-online';
        else if (statusData.activity === 'idle') activityClass = 'wb-activity-idle';

        const dot = `<span class="wb-activity-dot ${activityClass}"></span>`;
        const timerSpan = statusData.until && statusData.until > 0
            ? `<span id="wb-timer-${targetId}">${formatTimer(statusData.until)}</span>`
            : '';

        const normalizedSt = normalizeStatus(statusData.status);
        switch (normalizedSt) {
            case 'ok':
                badge.className = 'wb-status-badge wb-status-ok';
                badge.innerHTML = `${dot} OK`;
                break;
            case 'hospital':
                badge.className = 'wb-status-badge wb-status-hospital';
                badge.innerHTML = `${dot} Hosp: ${timerSpan}`;
                break;
            case 'traveling': {
                badge.className = 'wb-status-badge wb-status-travel';
                const travelTimer = timerSpan || '';
                const estimate = !travelTimer ? estimateTravelReturn(statusData.description) : null;
                const timeStr = travelTimer || (estimate ? `<span style="opacity:0.6">${estimate}</span>` : '');
                badge.innerHTML = `${dot} Travel: ${statusData.description || ''} ${timeStr}`;
                break;
            }
            case 'jail':
                badge.className = 'wb-status-badge wb-status-jail';
                badge.innerHTML = `${dot} Jail: ${timerSpan}`;
                break;
            default:
                badge.className = 'wb-status-badge wb-status-ok';
                badge.innerHTML = `${dot} ${statusData.status || '??'}`;
        }

        container.appendChild(badge);
    }

    /**
     * Render the priority cell for a target.
     * Leaders/co-leaders see a dropdown; others see a read-only badge (or nothing).
     */
    function renderPriorityCell(container, targetId) {
        container.innerHTML = '';
        const prioData = state.priorities[targetId];
        const level = prioData ? prioData.level : null;

        if (isLeader()) {
            // Show a dropdown selector for leaders
            const select = document.createElement('select');
            select.className = 'wb-priority-select';
            select.title = 'Set target priority';

            const options = [
                { value: '', label: '\u2014' },
                { value: 'high', label: '\u{1F534} High' },
                { value: 'medium', label: '\u{1F7E1} Med' },
                { value: 'low', label: '\u{1F535} Low' },
            ];
            for (const opt of options) {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.label;
                if (opt.value === (level || '')) el.selected = true;
                select.appendChild(el);
            }

            select.addEventListener('change', (e) => {
                e.stopPropagation();
                const val = select.value || null;
                emitSetPriority(targetId, val);
            });
            select.addEventListener('click', (e) => e.stopPropagation());

            container.appendChild(select);
        } else if (level) {
            // Non-leaders see a read-only badge
            const badge = document.createElement('span');
            badge.className = `wb-priority-badge wb-priority-${level}`;
            const labels = { high: '\u{1F534} HIGH', medium: '\u{1F7E1} MED', low: '\u{1F535} LOW' };
            badge.textContent = labels[level] || level.toUpperCase();
            badge.title = prioData.setBy ? `Set by ${prioData.setBy.name}` : '';
            container.appendChild(badge);
        }
    }

    /**
     * Render the BSP/FFS estimated-stats cell for a target.
     * Tries BSP prediction (sync localStorage) first, then FFS (async IndexedDB).
     * Shows the formatted number + a tiny "bsp" / "ffs" source label underneath.
     */
    function renderBspCell(container, targetId) {
        container.innerHTML = '';

        const wrapper = document.createElement('span');
        wrapper.className = 'wb-bsp-cell';

        // 1. Try BSP prediction (synchronous)
        const pred = fetchBspPrediction(targetId);
        if (pred && pred.TBS != null) {
            const num = Number(pred.TBS);
            const tier = bspTier(num);

            const val = document.createElement('span');
            val.className = `wb-bsp-value wb-bsp-tier-${tier}`;
            val.textContent = formatBspNumber(num);
            val.title = num.toLocaleString() + ' (BSP prediction)';
            wrapper.appendChild(val);

            const src = document.createElement('span');
            src.className = 'wb-bsp-source';
            src.textContent = 'bsp';
            wrapper.appendChild(src);

            container.appendChild(wrapper);
            return;
        }

        // 2. FFS fallback (async) — show dash while loading
        const val = document.createElement('span');
        val.className = 'wb-bsp-value wb-bsp-tier-unknown';
        val.textContent = '\u2014';
        wrapper.appendChild(val);
        container.appendChild(wrapper);

        getFfScouterEstimate(targetId).then((ffs) => {
            if (!ffs) return;                       // leave dash
            const num = Number(ffs.total);
            if (isNaN(num)) return;

            const tier = bspTier(num);
            val.className = `wb-bsp-value wb-bsp-tier-${tier}`;
            val.textContent = ffs.human || formatBspNumber(num);
            val.title = num.toLocaleString() + ' (FF Scouter)';

            const src = document.createElement('span');
            src.className = 'wb-bsp-source';
            src.textContent = 'ffs';
            wrapper.appendChild(src);
        });
    }

    /**
     * Render a small badge showing how many faction members are viewing
     * this target's attack page. Shows nothing if 0 viewers.
     */
    function renderViewersBadge(container, targetId) {
        container.innerHTML = '';
        const viewers = state.viewers[targetId];
        if (!viewers || viewers.length === 0) return;

        const badge = document.createElement('span');
        badge.className = 'wb-viewers-badge' + (viewers.length >= 2 ? ' wb-viewers-multi' : '');
        const names = viewers.map(v => v.name).join(', ');
        badge.textContent = `\uD83D\uDC41 ${viewers.length}`;
        badge.title = `Attacking: ${names}`;
        container.appendChild(badge);
    }

    /** Apply/remove row highlight classes based on call state. */
    function applyRowHighlights(row, targetId) {
        const isCalled = !!state.calls[targetId];
        row.classList.toggle('wb-row-called', isCalled);
    }

    /** Re-render all FactionOps cells for a specific target. */
    function updateTargetRow(targetId) {
        // Update overlay row if overlay is active
        const foRow = document.querySelector(`[data-fo-id="${targetId}"]`);
        if (foRow) {
            updateOverlayRow(foRow, targetId);
        }

        // Also update old-style enhanced row cells
        const callEl = document.getElementById(`wb-call-${targetId}`);
        if (callEl) renderCallCell(callEl, targetId);

        const statusEl = document.getElementById(`wb-status-${targetId}`);
        if (statusEl) renderStatusCell(statusEl, targetId);

        const prioEl = document.getElementById(`wb-priority-${targetId}`);
        if (prioEl) renderPriorityCell(prioEl, targetId);

        const bspEl = document.getElementById(`wb-bsp-${targetId}`);
        if (bspEl) renderBspCell(bspEl, targetId);

        const viewersEl = document.getElementById(`wb-viewers-${targetId}`);
        if (viewersEl) renderViewersBadge(viewersEl, targetId);

        // Update row highlight
        const row = document.querySelector(`[data-wb-target-id="${targetId}"]`);
        if (row) applyRowHighlights(row, targetId);
    }

    let warEndedBannerShown = false;

    /** Re-render all enhanced rows (after bulk state update). */
    function refreshAllRows() {
        // Check war-ended state on every refresh cycle
        if (state.warEnded && !warEndedBannerShown) showWarEndedBanner();

        const overlayActive = !!document.getElementById('fo-overlay');
        // If the overlay is active, re-render it (renderOverlay already sorts)
        if (overlayActive) {
            renderOverlay();
        }

        // Also update any old-style enhanced rows (e.g. non-war pages)
        const rows = document.querySelectorAll('[data-wb-target-id]');
        rows.forEach((row) => {
            const targetId = row.dataset.wbTargetId;
            updateTargetRow(targetId);
        });
        // Only trigger sort when overlay is NOT active — overlay handles its own sorting
        if (CONFIG.AUTO_SORT && !overlayActive) debouncedSort();
        updateNextUp();

        // Update online counts in header
        const usOnlineEl = document.getElementById('fo-online-count');
        if (usOnlineEl) {
            const usCount = state.ourFactionOnline ? state.ourFactionOnline.online : state.onlinePlayers.length;
            usOnlineEl.textContent = `${usCount} us`;
        }
        const enemyOnlineEl = document.getElementById('fo-enemy-online-count');
        if (enemyOnlineEl) {
            const enemyOnline = Object.values(state.statuses).filter(
                (s) => s.activity && s.activity.toLowerCase() === 'online'
            ).length;
            enemyOnlineEl.textContent = `${enemyOnline} enemy`;
        }
    }

    /**
     * Scan the page for member rows and enhance any new ones.
     * Called on initial load and whenever the DOM mutates.
     */
    function scanAndEnhanceRows() {
        const rows = findMemberRows();
        let count = 0;
        rows.forEach((row) => {
            if (!enhancedRows.has(row)) {
                enhanceRow(row);
                count++;
            }
        });
        if (count > 0) {
            log(`Enhanced ${count} new member rows`);
            if (CONFIG.AUTO_SORT) debouncedSort();
        }
    }

    // =========================================================================
    // SECTION 12B: FULL OVERLAY — WAR PAGE REPLACEMENT
    // =========================================================================

    /** Show an "Activate FactionOps" button on any faction/war page. */
    function showActivateButton() {
        if (document.getElementById('fo-activate-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'fo-activate-btn';
        btn.innerHTML = '<span class="fo-activate-icon">&#x2694;</span> Activate FactionOps';
        btn.addEventListener('click', () => {
            btn.remove();
            initWarOverlay();
        });

        // Fixed-position banner — append to body to avoid Torn layout interference
        document.body.appendChild(btn);
    }

    // ── Move / restore Torn's native chain bar ──
    let tornChainOriginalParent = null; // remember where #barChain came from
    let tornChainOriginalNext = null;   // sibling reference for restore

    function moveTornChainBar(retryCount) {
        retryCount = retryCount || 0;
        const container = document.getElementById('fo-torn-chain');
        if (!container) return;

        // Try multiple selectors for Torn's chain bar
        // Desktop: a#barChain  |  PDA may use different structure
        const chainBar = document.getElementById('barChain')
            || document.querySelector('a#barChain')
            || document.querySelector('[class*="chain-bar"]')
            || document.querySelector('[class*="chainBar"]');

        if (chainBar) {
            // Remember original position so we can put it back on cleanup
            tornChainOriginalParent = chainBar.parentNode;
            tornChainOriginalNext = chainBar.nextSibling;
            // Move (not clone) — Torn's JS keeps updating it in place
            container.appendChild(chainBar);
            log('Moved Torn chain bar into overlay header');

            // Cache reference before Torn's JS can lose the ID
            chainBarRef = chainBar;

            // If API poll was started as a fallback, stop it now
            stopDirectChainPoll();

            // Give PDA's DOM a tick to settle after the move, then start observer
            // Pass the element directly — getElementById may fail after move in PDA
            setTimeout(() => {
                if (startChainDOMObserver(chainBar)) {
                    usingChainDOM = true;
                    log('Using DOM chain reader — no API calls for chain data');
                } else {
                    // Observer couldn't start even though bar was found — fall back
                    log('DOM observer failed after move — falling back to API poll');
                    startDirectChainPoll();
                }
            }, 50);
        } else if (retryCount < 10) {
            // Chain bar may not have loaded yet — retry with increasing delay
            const delay = 500 * (retryCount + 1);
            log(`Torn chain bar not found yet, retry ${retryCount + 1}/10 in ${delay}ms`);
            setTimeout(() => moveTornChainBar(retryCount + 1), delay);
        } else {
            // All retries exhausted — show fallback custom chain display
            log('Torn chain bar not found after 10 retries — falling back to API poll');
            container.style.display = 'none';
            const fallback = document.getElementById('fo-chain-fallback');
            if (fallback) fallback.style.display = '';
            // Fall back to API-based chain polling
            startDirectChainPoll();

            // Keep watching — bar might appear later (PDA slow load)
            watchForLateChainBar(container);
        }
    }

    /** Watch for #barChain appearing late (after retries exhausted) */
    let lateChainWatcher = null;
    function watchForLateChainBar(container) {
        if (lateChainWatcher) return;
        lateChainWatcher = new MutationObserver(() => {
            const chainBar = document.getElementById('barChain');
            if (!chainBar || chainBar.closest('#fo-torn-chain')) return; // already moved

            // Found it late — move it and switch to DOM reader
            log('Late-detected #barChain — moving into overlay and switching to DOM reader');
            lateChainWatcher.disconnect();
            lateChainWatcher = null;

            tornChainOriginalParent = chainBar.parentNode;
            tornChainOriginalNext = chainBar.nextSibling;
            container.appendChild(chainBar);
            chainBarRef = chainBar;
            container.style.display = '';
            const fallback = document.getElementById('fo-chain-fallback');
            if (fallback) fallback.style.display = 'none';

            stopDirectChainPoll();
            setTimeout(() => {
                if (startChainDOMObserver(chainBar)) {
                    usingChainDOM = true;
                    log('Switched to DOM chain reader after late detection');
                } else {
                    startDirectChainPoll();
                }
            }, 50);
        });
        lateChainWatcher.observe(document.body, { childList: true, subtree: true });
        // Auto-stop after 60s to avoid indefinite watching
        setTimeout(() => {
            if (lateChainWatcher) {
                lateChainWatcher.disconnect();
                lateChainWatcher = null;
            }
        }, 60000);
    }

    function restoreTornChainBar() {
        if (!tornChainOriginalParent) return;
        const chainBar = document.getElementById('barChain');
        if (chainBar && tornChainOriginalParent) {
            // Put it back where it was
            if (tornChainOriginalNext) {
                tornChainOriginalParent.insertBefore(chainBar, tornChainOriginalNext);
            } else {
                tornChainOriginalParent.appendChild(chainBar);
            }
            log('Restored Torn #barChain to original location');
        }
        tornChainOriginalParent = null;
        tornChainOriginalNext = null;
    }

    // Track whether we're using DOM-based chain reading (no API calls)
    let usingChainDOM = false;

    // =========================================================================
    // SECTION 11B: WAR STATS & TIMER
    // =========================================================================

    let warTargetNotifiedThisSession = false;
    let warTimerEtaMs = null;
    let warTimerLastCalc = null;

    function warTimerDetailRow(label, val) {
        return '<div class="fo-war-timer-detail-row">'
            + '<span class="fo-war-timer-detail-label">' + label + '</span>'
            + '<span class="fo-war-timer-detail-val">' + val + '</span>'
            + '</div>';
    }

    function updateWarTimer() {
        if (state.warEnded) return;
        const warTimerEl = document.getElementById('fo-war-timer');
        const warTimerValue = document.getElementById('fo-war-timer-value');
        const warTimerDetail = document.getElementById('fo-war-timer-detail');
        if (!warTimerEl || !warTimerValue) return;

        // ── Read timer + score from DOM (Bulletproof Text Scanner) ──
        let lead = null, currentTarget = null, totalElapsedHours = null;
        let timerDays = 0, timerHours = 0, timerMinutes = 0;

        const warHeader = document.querySelector('[class*="rankedWar"]') || document.querySelector('[class*="rankBox"]') || document.querySelector('.faction-war');
        const timerEl = warHeader ? warHeader.querySelector('[class*="timer_"]') : null;
        const targetBox = warHeader ? warHeader.querySelector('[class*="target_"]') : null;

        // 1. Try standard desktop React classes first
        if (targetBox) {
            const match = targetBox.innerText.match(/(\d[\d,.\s]*)\s*\/\s*(\d[\d,.\s]*)/);
            if (match) {
                lead = parseInt(match[1].replace(/[^\d]/g, ''), 10);
                currentTarget = parseInt(match[2].replace(/[^\d]/g, ''), 10);
            }
        }
        if (timerEl) {
            const text = timerEl.textContent.trim();
            const timeParts = text.match(/\d+/g);
            if (timeParts) {
                if (timeParts.length >= 4) {
                    timerDays = parseInt(timeParts[0], 10) || 0;
                    timerHours = parseInt(timeParts[1], 10) || 0;
                    timerMinutes = parseInt(timeParts[2], 10) || 0;
                } else if (timeParts.length === 3) {
                    const hh = parseInt(timeParts[0], 10) || 0;
                    timerDays = Math.floor(hh / 24);
                    timerHours = hh % 24;
                    timerMinutes = parseInt(timeParts[1], 10) || 0;
                }
            }
        }

        // 2. PDA Fallback / Hidden Tab Fallback: Scan the raw text of the hidden Torn page
        if (lead === null || currentTarget === null || timerDays + timerHours + timerMinutes === 0) {
            // Only scan text if we are actually on the main faction war page where the timer exists
            const isMainWarPage = document.querySelector('.faction-war') !== null || document.querySelector('#factions') !== null;
            
            if (isMainWarPage) {
                const hiddenContainer = document.querySelector('[data-fo-hidden="true"]') || document.body;
                const allText = hiddenContainer.textContent || "";
                
                // Extract target: Look for "number / number" where right side is >= 1000
                const targetMatch = allText.match(/([\d,]{1,})\s*\/\s*([\d,]{4,})/);
                if (targetMatch) {
                    lead = parseInt(targetMatch[1].replace(/[^\d]/g, ''), 10);
                    currentTarget = parseInt(targetMatch[2].replace(/[^\d]/g, ''), 10);
                }

                // Extract elapsed time: Torn timers usually have 3 segments like "34:50:12" or "1 days 10:50:12"
                const timeMatches = [...allText.matchAll(/(?:WAR\s*)?(?:(\d+)\s*[dD]\s*)?(\d{1,3})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?/g)];
                for (let m of timeMatches) {
                    const p1 = parseInt(m[1]) || 0; // days
                    const p2 = parseInt(m[2]) || 0; // hours (or days)
                    const p3 = parseInt(m[3]) || 0; // mins (or hours)
                    const p4 = parseInt(m[4]) || 0; // secs (or mins)
                    
                    if (m[4] || p2 > 5) {
                        timerDays = p1; timerHours = p2; timerMinutes = p3;
                        break;
                    }
                }
            }
        }
        
        // 3. Server Fallback: If DOM scanning completely failed (e.g. we are on the Armory tab)
        if (lead === null || currentTarget === null || timerDays + timerHours + timerMinutes === 0) {
            // Abort local calculation and just let the background sync handle it
            if (state.warEta && state.warScores) {
                warTimerEtaMs = null; // Forces updateWarTimerDisplay to use state.warEta.etaTimestamp
                // Also update the pct if needed
                const effectiveScore = state.warScores.myScore != null ? state.warScores.myScore : (Math.max(state.warScores.myScore, state.warScores.enemyScore) || 0);
                const currentPct = (effectiveScore != null && state.warEta.currentTarget) ? Math.min(100, Math.round((effectiveScore / state.warEta.currentTarget) * 100)) : 0;
                if (currentPct !== null && !document.hidden && state.warPercentage !== currentPct) {
                    state.warPercentage = currentPct;
                    broadcastStateChange({ type: 'war_update', pct: currentPct });
                }
            } else {
                document.getElementById('fo-war-timer-value').textContent = "SYNCING...";
            }
            return;
        }

        totalElapsedHours = (timerDays * 24) + timerHours + (timerMinutes / 60);

        const myFactionScore = (state.warScores && state.warScores.myScore != null) ? state.warScores.myScore : lead;
        const effectiveScore = myFactionScore;

        if (effectiveScore === null || currentTarget === null || totalElapsedHours === null) return;

        // Calculate our scoring rate from the very start
        const ourScoreRate = totalElapsedHours > 0 ? (effectiveScore / totalElapsedHours) : 0;

        // "Waiting" state for new wars
        if (lead === 0 && currentTarget > 0 && totalElapsedHours < 2) {
            const display = timerDays > 0 ? `${timerDays}d ${timerHours}h ${timerMinutes}m`
                : timerHours > 0 ? `${timerHours}h ${timerMinutes}m`
                : `${timerMinutes}m`;
            warTimerEl.className = 'fo-war-timer waiting';
            warTimerValue.textContent = display;
            if (warTimerDetail) warTimerDetail.innerHTML =
                warTimerDetailRow('Status', 'War not started')
                + warTimerDetailRow('Starts in', display)
                + warTimerDetailRow('Target', currentTarget.toLocaleString());
            return;
        }

        // Reverted ETA Logic: Pure decay against whoever is currently winning
        const calculateHoursRemaining = (goal, isDecaying) => {
            // 'lead' is the highest score extracted directly from Torn's UI
            const scoreToUse = lead !== null ? lead : effectiveScore;
            const currentGap = goal - scoreToUse;
            if (currentGap <= 0) return 0;

            const dropHours = Math.max(0, Math.floor(totalElapsedHours - 24));
            const originalTarget = currentTarget / (1 - (dropHours * 0.01));
            const DROP_PER_HOUR = isDecaying ? (originalTarget * 0.01) : 0;

            if (totalElapsedHours >= 24) {
                // Ignore our scoring momentum, just calculate pure decay to the lead score
                const closingSpeed = DROP_PER_HOUR;
                return closingSpeed > 0 ? (currentGap / closingSpeed) : 999;
            } else {
                // If under 24 hours, add the time until decay actually starts
                const timeTo24h = 24 - totalElapsedHours;
                return timeTo24h + (DROP_PER_HOUR > 0 ? (currentGap / DROP_PER_HOUR) : 999);
            }
        };

        let currentPct = null;

        if (state.warTarget && state.warTarget.value) {
            const goal = state.warTarget.value;
            const remaining = goal - effectiveScore;
            const pct = Math.min(100, Math.round((effectiveScore / goal) * 100));
            currentPct = pct;

            if (remaining <= 0) {
                // Custom goal reached, show prediction to actual Ranked War target
                const notifiedKey = 'fo_notified_' + deriveWarId() + '_' + goal;
                if (!warTargetNotifiedThisSession) {
                    warTargetNotifiedThisSession = true;
                    if (GM_getValue(notifiedKey, false) !== true) {
                        GM_setValue(notifiedKey, true);
                        postAction('/api/war-target-reached', { warId: deriveWarId(), lead: effectiveScore }).catch(() => {});
                        firePdaNotification('war_target', '🎯 War Target Reached!', `Faction hit ${effectiveScore.toLocaleString()} / ${goal.toLocaleString()} respect — hold the line!`);
                        postAction('/api/set-war-target', { warId: deriveWarId(), value: null }).catch(() => {});
                        state.warTarget = null;
                    }
                }

                const hoursRemainingFloat = calculateHoursRemaining(currentTarget, true);
                warTimerEtaMs = Date.now() + (hoursRemainingFloat * 3600000);
                warTimerLastCalc = Date.now();

                if (hoursRemainingFloat <= 0) {
                    const isLosing = state.warScores && (state.warScores.enemyScore > state.warScores.myScore);
                    warTimerEl.className = 'fo-war-timer ' + (isLosing ? 'danger' : 'safe');
                    warTimerValue.textContent = isLosing ? '✗ LOST' : '✓ WON';
                } else {
                    const totalMin = Math.floor(hoursRemainingFloat * 60);
                    const hh = Math.floor(totalMin / 60).toString().padStart(2, '0');
                    const mm = (totalMin % 60).toString().padStart(2, '0');
                    const urgency = hoursRemainingFloat <= 2 ? 'danger' : hoursRemainingFloat <= 6 ? 'warning' : 'safe';
                    warTimerEl.className = 'fo-war-timer ' + urgency;
                    warTimerValue.textContent = hh + ':' + mm;
                }
            } else {
                // Custom goal NOT reached, show progress + prediction to goal
                const hoursRemainingFloat = calculateHoursRemaining(goal, false);
                // Only set ETA if estimate is reasonable (< 96h) — otherwise display loop would show nonsense
                if (hoursRemainingFloat <= 96) {
                    warTimerEtaMs = Date.now() + (hoursRemainingFloat * 3600000);
                    warTimerLastCalc = Date.now();
                } else {
                    warTimerEtaMs = null;
                }
                const totalMin = Math.floor(hoursRemainingFloat * 60);
                const urgency = pct >= 80 ? 'safe' : pct >= 50 ? 'warning' : 'danger';
                warTimerEl.className = 'fo-war-timer ' + urgency;
                // Hide time estimate if it exceeds 96h (longer than any war) — rate is too unreliable
                if (hoursRemainingFloat > 96) {
                    warTimerValue.textContent = pct + '%';
                } else {
                    const hh = Math.floor(totalMin / 60).toString().padStart(2, '0');
                    const mm = (totalMin % 60).toString().padStart(2, '0');
                    warTimerValue.textContent = pct + '% (' + hh + ':' + mm + ')';
                }
                // Populate tooltip with custom war target details
                if (warTimerDetail) {
                    const ourScore = state.warScores ? state.warScores.myScore : (lead || 0);
                    const enemyScore = state.warScores ? state.warScores.enemyScore : 0;
                    warTimerDetail.innerHTML =
                        warTimerDetailRow('Custom Target', goal.toLocaleString())
                        + warTimerDetailRow('Our Score', ourScore.toLocaleString())
                        + warTimerDetailRow('Enemy Score', enemyScore.toLocaleString())
                        + warTimerDetailRow('Progress', pct + '%')
                        + warTimerDetailRow('War Target', currentTarget ? currentTarget.toLocaleString() : '\u2014')
                        + warTimerDetailRow('Elapsed', elapsedStr || '\u2014');
                }
            }
        } else {
            // Main Ranked War Block (Target Decay + Our Rate)
            const hoursRemainingFloat = calculateHoursRemaining(currentTarget, true);
            warTimerEtaMs = Date.now() + (hoursRemainingFloat * 3600000);
            warTimerLastCalc = Date.now();
            // Report DOM-sourced ETA to server so other clients (OC tab, Armory, etc.) stay in sync
            if (hoursRemainingFloat > 0 && state.jwtToken) {
                postAction('/api/war-timer-report', {
                    warId: deriveWarId(),
                    etaTimestamp: warTimerEtaMs,
                    calculatedAt: Date.now(),
                }).catch(() => {});
            }

            if (hoursRemainingFloat <= 0) {
                const isLosing = state.warScores && (state.warScores.enemyScore > state.warScores.myScore);
                warTimerEl.className = 'fo-war-timer ' + (isLosing ? 'danger' : 'safe');
                warTimerValue.textContent = isLosing ? 'LOST' : 'WON';
            } else {
                const totalMin = Math.floor(hoursRemainingFloat * 60);
                const hh = Math.floor(totalMin / 60).toString().padStart(2, '0');
                const mm = (totalMin % 60).toString().padStart(2, '0');
                const urgency = hoursRemainingFloat <= 2 ? 'danger' : hoursRemainingFloat <= 6 ? 'warning' : 'safe';
                warTimerEl.className = 'fo-war-timer ' + urgency;
                warTimerValue.textContent = hh + ':' + mm;
            }

            // Populate the detail popup box
            if (warTimerDetail) {
                const dropHrs = Math.max(0, Math.floor(totalElapsedHours - 24));
                const origTarget = currentTarget / (1 - (dropHrs * 0.01));
                const dropPerHr = origTarget * 0.01;
                const gap = currentTarget - (lead !== null ? lead : effectiveScore);

                warTimerDetail.innerHTML =
                    warTimerDetailRow('Target Score', Math.round(currentTarget).toLocaleString()) +
                    warTimerDetailRow('Lead Score', Math.round(lead !== null ? lead : effectiveScore).toLocaleString()) +
                    warTimerDetailRow('Score Gap', Math.round(gap).toLocaleString()) +
                    warTimerDetailRow('Target Decay/hr', Math.round(dropPerHr).toLocaleString());
            }
        }

        if (currentPct !== null && !document.hidden && state.warPercentage !== currentPct) {
            state.warPercentage = currentPct;
            broadcastStateChange({ type: 'war_update', pct: currentPct });
        }
    }

    function updateWarTimerDisplay() {
        if (state.warEnded) return;
        const warTimerEl = document.getElementById('fo-war-timer');
        const warTimerValue = document.getElementById('fo-war-timer-value');
        if (!warTimerEl || !warTimerValue) return;

        const eta = state.warEta;
        const etaMs = warTimerEtaMs !== null ? warTimerEtaMs : (eta && eta.etaTimestamp !== undefined && eta.etaTimestamp !== null ? eta.etaTimestamp : null);
        if (etaMs === null && !eta?.preDropPhase && !eta?.preWarPhase) return;

        if (eta?.preWarPhase) {
            warTimerEl.className = 'fo-war-timer waiting';
            warTimerValue.textContent = 'Pre-War';
            return;
        }

        if (eta?.preDropPhase) {
            if (state.warTarget && state.warTarget.value && state.warPercentage !== null) {
                // Show server-cached percentage on non-war pages
                const pct = state.warPercentage;
                const urgency = pct >= 80 ? 'safe' : pct >= 50 ? 'warning' : 'danger';
                warTimerEl.className = 'fo-war-timer ' + urgency;
                warTimerValue.textContent = pct + '%';
                // Populate tooltip from server data
                const detail = document.getElementById('fo-war-timer-detail');
                if (detail && state.warScores) {
                    detail.innerHTML =
                        warTimerDetailRow('Custom Target', state.warTarget.value.toLocaleString())
                        + warTimerDetailRow('Our Score', (state.warScores.myScore || 0).toLocaleString())
                        + warTimerDetailRow('Enemy Score', (state.warScores.enemyScore || 0).toLocaleString())
                        + warTimerDetailRow('Progress', pct + '%')
                        + warTimerDetailRow('Phase', 'Pre-24h (no decay yet)');
                }
                return;
            }
            warTimerEl.className = 'fo-war-timer waiting';
            warTimerValue.textContent = 'Pre-24h';
            return;
        }

        const msLeft = etaMs - Date.now();
        const totalSec = Math.floor(msLeft / 1000);
        
        // Show LOST/WON when war is confirmed ended OR when server computed hoursRemaining=0
        // (which means enemy has exceeded the decayed target — war is effectively over)
        if (totalSec <= 0) {
            const serverConfirmsOver = state.warEnded || (eta && eta.hoursRemaining === 0);
            if (serverConfirmsOver) {
                const isLosing = state.warScores && (state.warScores.enemyScore > state.warScores.myScore);
                warTimerEl.className = 'fo-war-timer ' + (isLosing ? 'danger' : 'safe');
                warTimerValue.textContent = isLosing ? 'LOST' : 'WON';
            } else {
                // ETA expired but war not confirmed over — stale data
                if (warTimerValue.textContent === '--:--') {
                    warTimerValue.textContent = 'SYNCING...';
                }
            }
            return;
        }

        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        
        let timeStr = '';
        if (hrs > 0) {
            timeStr = hrs.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
        } else {
            timeStr = mins + 'm ' + secs.toString().padStart(2, '0') + 's';
        }

        if (state.warTarget && state.warTarget.value && state.warPercentage !== null && state.warPercentage < 100) {
            // Hide time if estimate exceeds 96h (rate too unreliable early in war)
            warTimerValue.textContent = hrs > 96 ? state.warPercentage + '%' : state.warPercentage + '% (' + timeStr + ')';
        } else {
            warTimerValue.textContent = timeStr;
        }

        const hrsLeft = totalSec / 3600;
        const urg = state.warPercentage !== null && state.warPercentage < 100 
            ? (state.warPercentage >= 80 ? 'safe' : state.warPercentage >= 50 ? 'warning' : 'danger')
            : (hrsLeft <= 2 ? 'danger' : hrsLeft <= 6 ? 'warning' : 'safe');
        warTimerEl.className = 'fo-war-timer ' + urg;
    }

    function initWarOverlay() {
        startChainTimer();
        // Chain data source will be decided after overlay is built
        // (we need #barChain to be in the DOM first)
        startStatusTimers();
        startCallPruner();
        startKeepAlive();
        updateChainBar();

        // Hide Torn's main content but keep the container itself visible so
        // we can insert the overlay INSIDE it. Torn typically scopes its
        // native profile-card delegation to #mainContainer; nesting the
        // overlay inside lets those handlers fire on our name elements.
        const mainContent = document.getElementById('mainContainer')
            || document.querySelector('.content-wrapper');
        if (mainContent) {
            mainContent.dataset.foHidden = 'true';
            for (const child of Array.from(mainContent.children)) {
                if (child.id === 'fo-overlay') continue;
                if (!('foPrevDisplay' in child.dataset)) {
                    child.dataset.foPrevDisplay = child.style.display || '';
                }
                child.style.display = 'none';
            }
        }

        // Create the overlay if it doesn't already exist
        if (document.getElementById('fo-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'fo-overlay';
        overlay.className = 'fo-overlay';

        // ── Header ──
        overlay.innerHTML = `
            <div class="fo-header">
                <div class="fo-header-left">
                    <div class="fo-logo-mark">
                        <svg class="fo-logo-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="FactionOps">
                            <rect x="1" y="1" width="18" height="18" rx="3" stroke="#e17055" stroke-width="1.5" fill="none"/>
                            <path d="M6 6h8M6 10h5M6 14h8" stroke="#e0e0e0" stroke-width="1.5" stroke-linecap="round"/>
                            <circle cx="15" cy="14" r="2" fill="#00b894"/>
                        </svg>
                        <span class="fo-logo-text">FactionOps</span>
                    </div>
                    <div class="fo-status-dot${state.connected ? '' : ' disconnected'}" id="fo-conn-dot" title="${state.connected ? 'Connected' : 'Disconnected'}"></div>
                    <span class="fo-rt-badge" id="fo-rt-badge"></span>
                    <button class="fo-settings-btn" id="fo-heatmap-header-btn" title="Activity Heatmap">&#x1F4CA;</button>
                    <button class="fo-settings-btn" id="fo-settings-btn" title="Settings">&#x2699;</button>
                    <div class="fo-energy-display" id="fo-energy-display" title="Energy">
                        <span class="fo-energy-label">E</span>
                        <span class="fo-energy-value" id="fo-energy-value">--/--</span>
                        <span class="fo-energy-timer" id="fo-energy-timer"></span>
                    </div>
                </div>
                <div class="fo-header-center">
                    <span class="fo-war-badge" id="fo-war-type">War</span>
                    <span>vs</span>
                    <strong id="fo-enemy-name">${escapeHtml(state.enemyFactionName || state.enemyFactionId || 'Enemy Faction')}</strong>
                </div>
                <div class="fo-header-right">
                    <div class="fo-torn-chain" id="fo-torn-chain">
                        <!-- Torn's native #barChain will be moved here -->
                    </div>
                    <div class="fo-chain-info" id="fo-chain-fallback" style="display:none;">
                        <span class="fo-chain-label">Chain</span>
                        <span class="fo-chain-count" id="fo-chain-count">${state.chain.current || 0}/${state.chain.max || '??'}</span>
                        <span class="fo-chain-timeout" id="fo-chain-timeout">${state.chain.timeout > 0 ? formatTimer(state.chain.timeout) : '--:--'}</span>
                        <span class="fo-chain-bonus" id="fo-chain-bonus" style="display:none;"></span>
                    </div>
                    <div class="fo-war-timer waiting" id="fo-war-timer" title="Ranked War Timer">
                        <span class="fo-war-timer-icon">🕓</span>
                        <span class="fo-war-timer-label">War</span>
                        <span class="fo-war-timer-value" id="fo-war-timer-value">--:--</span>
                        <div class="fo-war-timer-detail" id="fo-war-timer-detail"></div>
                    </div>
                    <button class="fo-settings-btn" id="fo-enemy-heatmap-btn" title="Enemy Activity Heatmap">&#x1F4C8;</button>
                    <button class="fo-settings-btn" id="fo-scout-btn" title="War Analysis">&#x1F50D;</button>
                    <button class="fo-settings-btn" id="fo-postwar-btn" title="Post-War Report">&#x1F4CB;</button>
                    <div class="fo-online-badge"><span class="fo-dot"></span><span id="fo-online-count">${state.ourFactionOnline ? state.ourFactionOnline.online : state.onlinePlayers.length} us</span> · <span id="fo-enemy-online-count">0 enemy</span></div>
                </div>
            </div>
            <div class="fo-next-up-bar" id="fo-next-up"></div>
            ${isLeader() ? `
            <div class="fo-broadcast-entry-bar">
                <input type="text" id="fo-input-broadcast" placeholder="Broadcast message to faction..." maxlength="150">
                <button id="fo-btn-send-broadcast">Shout</button>
            </div>
            ` : ''}
            <div class="fo-col-headers">
                <div class="fo-col-header">Prior.</div>
                <div class="fo-col-header">Target</div>
                <div class="fo-col-header center">Lvl</div>
                <div class="fo-col-header center">BSP</div>
                <div class="fo-col-header">Status</div>
                <div class="fo-col-header center">On</div>
                <div class="fo-col-header">Call</div>
                <div class="fo-col-header right">Action</div>
            </div>
            <ul class="fo-target-list" id="fo-target-list"></ul>
            <div class="fo-footer">
                <div class="fo-footer-stats">
                    <span class="fo-footer-stat">Targets: <span class="fo-val" id="fo-stat-targets">0</span></span>
                    <span class="fo-footer-stat">Available: <span class="fo-val" id="fo-stat-available">0</span></span>
                    <span class="fo-footer-stat">Called: <span class="fo-val" id="fo-stat-called">0</span></span>
                    <span class="fo-footer-stat">Hosp: <span class="fo-val" id="fo-stat-hosp">0</span></span>
                </div>
                <span class="fo-footer-version">v${CONFIG.VERSION || '3.0.0'}</span>
            </div>
        `;

        // Insert the overlay INSIDE the hidden main container so Torn's
        // delegated event handlers (profile-card tooltips in particular,
        // which are scoped to #mainContainer) fire on our name elements.
        const hiddenMain = document.querySelector('[data-fo-hidden="true"]');
        if (hiddenMain) {
            hiddenMain.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }

        renderOverlay();

        // Check if war already ended (persisted state from server)
        if (state.warEnded) {
            setTimeout(showWarEndedBanner, 500);
        }

        // Set RT badge initial state
        updateRtBadge();
        setInterval(updateRtBadge, 5000);

        // Move Torn's native #barChain into our overlay header
        moveTornChainBar();
        startEnergyPoll();
        startAttacksPoll();

        // Fetch Fair Fight data from ffscouter.com (initial + periodic refresh)
        fetchFairFightBatch();
        setInterval(fetchFairFightBatch, 5 * 60 * 1000); // refresh every 5 min

        // Wire up heatmap button in overlay header
        const heatmapHeaderBtn = document.getElementById('fo-heatmap-header-btn');
        if (heatmapHeaderBtn) {
            heatmapHeaderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHeatmapPanel(state.myFactionId, state.myFactionName);
            });
        }

        // Wire up enemy heatmap button in overlay header
        const enemyHeatmapBtn = document.getElementById('fo-enemy-heatmap-btn');
        if (enemyHeatmapBtn) {
            enemyHeatmapBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHeatmapPanel(state.enemyFactionId, state.enemyFactionName);
            });
        }

        // Wire up scout report button in overlay header
        const scoutBtn = document.getElementById('fo-scout-btn');
        if (scoutBtn) {
            scoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openScoutReport();
            });
        }

        // Wire up post-war report button in overlay header
        const postwarBtn = document.getElementById('fo-postwar-btn');
        if (postwarBtn) {
            postwarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openPostWarReport();
            });
        }

        // Wire up settings button in overlay header
        const settingsBtn = document.getElementById('fo-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSettings();
            });
        }

        // Hide the floating gear and heatmap FABs when overlay is active
        const fab = document.querySelector('.wb-settings-gear');
        if (fab) fab.style.display = 'none';
        const heatmapFab = document.getElementById('wb-heatmap-toggle');
        if (heatmapFab) heatmapFab.style.display = 'none';

        // ── Ranked War Timer ───────────────────────────────────────────
        const warTimerEl = document.getElementById('fo-war-timer');
        const warTimerDetail = document.getElementById('fo-war-timer-detail');
        if (warTimerEl && warTimerDetail) {
            // Click toggles the detail popup
            warTimerEl.addEventListener('click', (e) => {
                e.stopPropagation();
                warTimerDetail.classList.toggle('open');
            });
            // Close detail popup when clicking anywhere else
            document.addEventListener('click', () => {
                warTimerDetail.classList.remove('open');
            });
        }

        if (typeof updateWarTimer === 'function') {
            updateWarTimer();
            setInterval(updateWarTimer, 30000);
            setInterval(updateWarTimerDisplay, 1000);
        }

        // Wire up broadcast button in overlay (leader/banker only)
        const shoutBtn = document.getElementById('fo-btn-send-broadcast');
        if (shoutBtn) {
            shoutBtn.addEventListener('click', () => {
                const msgInput = document.getElementById('fo-input-broadcast');
                const msg = msgInput.value.trim();
                
                if (msg) {
                    const currentWarId = deriveWarId();
                    if (!currentWarId) {
                        showToast('Error: Could not determine war ID.', 'error');
                        return;
                    }
                    postAction('/api/broadcast', { message: msg, type: 'warning', warId: currentWarId })
                    .then(data => {
                        if (data.success) {
                            msgInput.value = '';
                            showToast('Broadcast sent to faction!', 'success');
                        } else {
                            showToast(data.error || 'Failed to send broadcast.', 'error');
                        }
                    })
                    .catch(e => {
                        warn('Broadcast failed:', e.message);
                        showToast('Failed to send broadcast (Server Error).', 'error');
                    });
                }
            });
            // Also support Enter key
            const msgInput = document.getElementById('fo-input-broadcast');
            if (msgInput) {
                msgInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') shoutBtn.click();
                });
            }
        }

        log('War overlay initialised');
    }

    /** Simple HTML escape. */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Full render/re-render of all overlay rows from state.statuses.
     * Uses DOM diffing: updates existing rows in-place, adds new ones,
     * removes stale ones.
     */
    function renderOverlay() {
        const list = document.getElementById('fo-target-list');
        if (!list) return;

        const allIds = Object.keys(state.statuses);
        const unavailableStatuses = ['traveling', 'abroad', 'jail'];
        const hiddenStatuses = ['federal', 'fallen'];

        const targetIds = [];      // attackable: ok, hospital
        const unavailableIds = []; // collapsed section: traveling, abroad, jail
        // federal/fallen are simply excluded from everything

        for (const tid of allIds) {
            const s = state.statuses[tid];
            const status = normalizeStatus(s ? s.status : 'ok');
            if (hiddenStatuses.includes(status)) {
                // Completely hidden — skip
                continue;
            } else if (unavailableStatuses.includes(status)) {
                unavailableIds.push(tid);
            } else {
                targetIds.push(tid);
            }
        }

        // Build a set of current attackable targets for stale-removal
        const currentSet = new Set(targetIds);

        // Remove stale rows (including members who transitioned to traveling/hidden)
        const existingRows = list.querySelectorAll('[data-fo-id]');
        existingRows.forEach((row) => {
            if (!currentSet.has(row.dataset.foId)) {
                row.remove();
            }
        });

        // Sort targets
        const sorted = targetIds.map((tid) => ({
            targetId: tid,
            priority: sortPriority(tid),
            timer: sortTimerValue(tid),
        }));

        sorted.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.timer - b.timer;
        });

        // Build a map of existing rows for O(1) lookup instead of O(n) querySelectorAll
        const existingMap = new Map();
        for (const child of list.querySelectorAll('[data-fo-id]')) {
            existingMap.set(child.dataset.foId, child);
        }

        // Phase 1: Update row content (classes, text, etc.) without moving DOM nodes
        const orderedRows = [];
        for (const item of sorted) {
            let row = existingMap.get(item.targetId);
            if (row) {
                updateOverlayRow(row, item.targetId);
            } else {
                row = renderOverlayRow(item.targetId);
            }
            orderedRows.push(row);
        }

        // Phase 2: Reorder DOM nodes only if the order actually differs.
        // Compare current DOM order to desired order — skip reordering entirely
        // if they already match, preventing layout thrashing and CSS transition flicker.
        const currentChildren = Array.from(list.querySelectorAll('[data-fo-id]'));
        let orderChanged = currentChildren.length !== orderedRows.length;
        if (!orderChanged) {
            for (let i = 0; i < orderedRows.length; i++) {
                if (currentChildren[i] !== orderedRows[i]) { orderChanged = true; break; }
            }
        }
        if (orderChanged) {
            let prevNode = null;
            for (const row of orderedRows) {
                const expectedNext = prevNode ? prevNode.nextSibling : list.firstChild;
                if (row !== expectedNext) {
                    list.insertBefore(row, expectedNext);
                }
                prevNode = row;
            }
        }

        // Render collapsed unavailable section (traveling + jail)
        let unavailSection = document.getElementById('fo-unavailable-section');
        if (unavailableIds.length > 0) {
            if (!unavailSection) {
                unavailSection = document.createElement('div');
                unavailSection.id = 'fo-unavailable-section';
                unavailSection.className = 'fo-unavailable-section';
                list.parentElement.appendChild(unavailSection);
            }

            // Count by status type
            const counts = {};
            for (const tid of unavailableIds) {
                const s = state.statuses[tid];
                const status = normalizeStatus(s ? s.status : 'ok');
                counts[status] = (counts[status] || 0) + 1;
            }

            const countParts = [];
            if (counts.traveling) countParts.push(`${counts.traveling} traveling`);
            if (counts.abroad) countParts.push(`${counts.abroad} abroad`);
            if (counts.jail) countParts.push(`${counts.jail} jailed`);

            const isExpanded = unavailSection.dataset.expanded === 'true';
            const toggleIcon = isExpanded ? '\u25BC' : '\u25B6';

            // Header toggle
            let header = unavailSection.querySelector('.fo-unavail-header');
            if (!header) {
                header = document.createElement('div');
                header.className = 'fo-unavail-header';
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    const section = document.getElementById('fo-unavailable-section');
                    const expanded = section.dataset.expanded === 'true';
                    section.dataset.expanded = expanded ? 'false' : 'true';
                    renderOverlay(); // re-render to toggle visibility
                });
                unavailSection.appendChild(header);
            }
            header.innerHTML = `<span style="margin-right:6px;">${toggleIcon}</span>Unavailable (${unavailableIds.length})${countParts.length ? ': ' + countParts.join(', ') : ''}`;

            // Render unavailable rows if expanded
            let unavailList = unavailSection.querySelector('.fo-unavail-list');
            if (!unavailList) {
                unavailList = document.createElement('div');
                unavailList.className = 'fo-unavail-list';
                unavailSection.appendChild(unavailList);
            }

            if (isExpanded) {
                unavailList.style.display = '';
                // Remove stale
                unavailList.querySelectorAll('[data-fo-id]').forEach(r => {
                    if (!unavailableIds.includes(r.dataset.foId)) r.remove();
                });
                // Add/update
                for (const tid of unavailableIds) {
                    let row = unavailList.querySelector(`[data-fo-id="${tid}"]`);
                    if (row) {
                        updateOverlayRow(row, tid);
                    } else {
                        row = renderOverlayRow(tid);
                        row.style.opacity = '0.45';
                        unavailList.appendChild(row);
                    }
                }
            } else {
                unavailList.style.display = 'none';
            }
        } else if (unavailSection) {
            unavailSection.remove();
        }

        // Update footer stats
        updateOverlayFooter();

        // Update header connection dot
        const dot = document.getElementById('fo-conn-dot');
        if (dot) {
            dot.classList.toggle('disconnected', !state.connected);
            dot.title = state.connected ? 'Connected' : 'Disconnected';
        }

        // Update online counts (us = server-side Torn API poll, enemy = Torn online status)
        const onlineEl = document.getElementById('fo-online-count');
        if (onlineEl) {
            const usCount = state.ourFactionOnline ? state.ourFactionOnline.online : state.onlinePlayers.length;
            onlineEl.textContent = `${usCount} us`;
        }

        const enemyOnlineEl = document.getElementById('fo-enemy-online-count');
        if (enemyOnlineEl) {
            const enemyOnline = Object.values(state.statuses).filter(
                (s) => s.activity && s.activity.toLowerCase() === 'online'
            ).length;
            enemyOnlineEl.textContent = `${enemyOnline} enemy`;
        }

        // Update enemy name
        const enemyEl = document.getElementById('fo-enemy-name');
        if (enemyEl && state.enemyFactionName) {
            enemyEl.textContent = state.enemyFactionName;
        }
    }

    /**
     * Build a single overlay row <li> for a target.
     */
    function renderOverlayRow(targetId) {
        const li = document.createElement('li');
        li.className = 'fo-row';
        li.dataset.foId = targetId;

        const s = state.statuses[targetId] || {};
        const prio = state.priorities[targetId];
        const callData = state.calls[targetId];
        const viewers = state.viewers[targetId];

        // Row status classes
        applyOverlayRowClasses(li, targetId);

        // 1. Priority cell
        const prioCell = document.createElement('div');
        prioCell.className = 'fo-cell';
        prioCell.id = `fo-priority-${targetId}`;
        renderOverlayPriorityCell(prioCell, targetId);
        li.appendChild(prioCell);

        // 2. Target cell (name + id + eye badge)
        const targetCell = document.createElement('div');
        targetCell.className = 'fo-cell';
        const playerName = document.createElement('div');
        playerName.className = 'fo-player-name';

        const nameRow = document.createElement('div');
        nameRow.className = 'fo-name-row';

        const nameSpan = buildNameAnchor(targetId, s.name);
        nameRow.appendChild(nameSpan);

        // Eye badge for viewers
        if (viewers && viewers.length > 0) {
            const eye = document.createElement('span');
            eye.className = 'fo-eye-badge';
            eye.title = viewers.map((v) => v.name).join(', ') + ' viewing';
            eye.innerHTML = `<span class="fo-eye-icon">\uD83D\uDC41</span>${viewers.length}`;
            nameRow.appendChild(eye);
        }

        playerName.appendChild(nameRow);

        // Sub-row: ID + inline BSP badge
        const subRow = document.createElement('div');
        subRow.className = 'fo-sub-row';

        const pid = document.createElement('span');
        pid.className = 'fo-pid';
        pid.textContent = `[${targetId}]`;
        subRow.appendChild(pid);

        // Inline BSP badge
        const bspBadge = document.createElement('span');
        bspBadge.className = 'fo-bsp-inline';
        bspBadge.id = `fo-bsp-inline-${targetId}`;
        renderInlineBsp(bspBadge, targetId);
        subRow.appendChild(bspBadge);

        // Inline FF badge
        const ffBadge = document.createElement('span');
        ffBadge.className = 'fo-ff-inline';
        ffBadge.id = `fo-ff-inline-${targetId}`;
        renderInlineFf(ffBadge, targetId);
        subRow.appendChild(ffBadge);

        playerName.appendChild(subRow);

        targetCell.appendChild(playerName);
        li.appendChild(targetCell);

        // 3. Level cell
        const lvlCell = document.createElement('div');
        lvlCell.className = 'fo-cell center';
        const lvlSpan = document.createElement('span');
        lvlSpan.className = 'fo-level';
        lvlSpan.textContent = s.level != null ? String(s.level) : '\u2014';
        lvlCell.appendChild(lvlSpan);
        li.appendChild(lvlCell);

        // 4. BSP cell
        const bspCell = document.createElement('div');
        bspCell.className = 'fo-cell center';
        bspCell.id = `fo-bsp-${targetId}`;
        renderOverlayBspCell(bspCell, targetId);
        li.appendChild(bspCell);

        // 5. Status cell
        const statusCell = document.createElement('div');
        statusCell.className = 'fo-cell';
        statusCell.id = `fo-status-${targetId}`;
        renderOverlayStatusCell(statusCell, targetId);
        li.appendChild(statusCell);

        // 6. Online cell
        const onlineCell = document.createElement('div');
        onlineCell.className = 'fo-cell center';
        onlineCell.id = `fo-online-${targetId}`;
        const onlineDot = document.createElement('span');
        const activity = (s.activity || 'offline').toLowerCase();
        const onlineClass = activity === 'online' ? 'on' : (activity === 'idle' ? 'idle' : 'off');
        onlineDot.className = `fo-online-dot ${onlineClass}`;
        onlineDot.title = activity.charAt(0).toUpperCase() + activity.slice(1);
        onlineCell.appendChild(onlineDot);
        li.appendChild(onlineCell);

        // 7. Call cell
        const callCell = document.createElement('div');
        callCell.className = 'fo-call-cell';
        callCell.id = `fo-call-${targetId}`;
        renderOverlayCallCell(callCell, targetId);
        li.appendChild(callCell);

        // 8. Action cell
        const actionCell = document.createElement('div');
        actionCell.className = 'fo-cell';
        actionCell.style.justifyContent = 'flex-end';
        const atkLink = document.createElement('a');
        atkLink.className = 'fo-attack-btn';
        atkLink.href = `https://www.torn.com/loader.php?sid=attack&user2ID=${targetId}`;
        atkLink.target = '_blank';
        atkLink.rel = 'noopener';
        atkLink.innerHTML = 'Atk<span class="fo-arrow">\u203A</span>';
        atkLink.addEventListener('click', (e) => e.stopPropagation());
        actionCell.appendChild(atkLink);
        li.appendChild(actionCell);

        return li;
    }

    /** Apply status/call/priority classes to an overlay row.
     *  Uses conditional toggle to avoid re-triggering CSS transitions
     *  when the class state hasn't actually changed.
     */
    function applyOverlayRowClasses(row, targetId) {
        const s = state.statuses[targetId] || {};
        const status = normalizeStatus(s.status);
        const isCalled = !!state.calls[targetId];
        const prio = state.priorities[targetId];
        const isHigh = prio && prio.level === 'high';

        // Only toggle when the desired state differs from current — prevents
        // CSS transition flicker caused by remove-then-readd of the same class.
        const pairs = [
            ['is-hospital', status === 'hospital'],
            ['is-jail', status === 'jail' || status === 'federal'],
            ['is-travel', status === 'traveling' || status === 'abroad'],
            ['is-called', isCalled],
            ['is-high-priority', isHigh],
        ];
        for (const [cls, want] of pairs) {
            const has = row.classList.contains(cls);
            if (has !== want) row.classList.toggle(cls, want);
        }
    }

    /** Render the priority cell for overlay rows. */
    function renderOverlayPriorityCell(cell, targetId) {
        cell.innerHTML = '';
        const prio = state.priorities[targetId];
        const level = prio ? prio.level : null;

        if (isLeader()) {
            // Leaders get a dropdown — hidden until a priority is set or cell is tapped
            const sel = document.createElement('select');
            sel.className = 'fo-priority-select';
            sel.title = 'Set priority';
            if (!level) sel.style.opacity = '0'; // invisible when no priority
            ['', 'high', 'med', 'low'].forEach((val) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val ? val.toUpperCase() : '';
                if (val === (level || '')) opt.selected = true;
                sel.appendChild(opt);
            });
            // Show on interaction
            sel.addEventListener('focus', () => { sel.style.opacity = '1'; cell.dataset.foActive = '1'; });
            sel.addEventListener('mousedown', () => { sel.style.opacity = '1'; cell.dataset.foActive = '1'; });
            sel.addEventListener('change', () => {
                delete cell.dataset.foActive;
                emitSetPriority(targetId, sel.value || null);
            });
            sel.addEventListener('blur', () => {
                delete cell.dataset.foActive;
                if (!sel.value) sel.style.opacity = '0';
            });
            cell.appendChild(sel);
        } else if (level) {
            const badge = document.createElement('span');
            badge.className = `fo-priority-badge ${level}`;
            badge.textContent = level.charAt(0).toUpperCase() + level.slice(1);
            cell.appendChild(badge);
        }
    }

    /** Render the status pill for overlay rows. */
    function renderOverlayStatusCell(cell, targetId) {
        cell.innerHTML = '';
        const s = state.statuses[targetId] || {};
        const status = normalizeStatus(s.status);

        let pillClass = 'ok';
        let label = 'OK';

        if (status === 'hospital') {
            pillClass = 'hosp';
            // Show timer instead of "Hosp" text
            if (s.until && s.until > 0) {
                label = formatTimer(s.until);
            } else {
                label = 'Hosp';
            }
        } else if (status === 'federal') {
            pillClass = 'jail';
            label = 'Federal';
        } else if (status === 'jail') {
            pillClass = 'jail';
            label = 'Jail';
        } else if (status === 'traveling' || status === 'abroad') {
            pillClass = 'travel';
            label = 'Travel';
        }

        const pill = document.createElement('span');
        pill.className = `fo-status-pill ${pillClass}`;
        // For hospital, the label IS the timer — give it the timer ID for live ticking
        const labelId = (status === 'hospital' && s.until && s.until > 0) ? `fo-timer-${targetId}` : '';
        pill.innerHTML = `<span class="fo-s-dot"></span><span class="fo-s-label"${labelId ? ` id="${labelId}"` : ''}>${label}</span>`;

        // Timer (for non-hospital statuses that have timers)
        if (status !== 'hospital' && s.until && s.until > 0) {
            const timer = document.createElement('span');
            timer.id = `fo-timer-${targetId}`;
            timer.style.marginLeft = '4px';
            timer.textContent = formatTimer(s.until);
            pill.appendChild(timer);
        }

        cell.appendChild(pill);
    }

    /** Render the BSP cell for overlay rows. */
    /** Render compact inline BSP badge (next to player name). */
    function renderInlineBsp(el, targetId) {
        // 1. BSP prediction (sync)
        const pred = fetchBspPrediction(targetId);
        if (pred && pred.TBS != null) {
            const num = Number(pred.TBS);
            const key = `bsp_${num}`;
            if (el.dataset.foCache === key) return; // no change
            el.dataset.foCache = key;
            const tier = bspTier(num);
            el.className = `fo-bsp-inline tier-${tier}`;
            el.textContent = formatBspNumber(num);
            el.title = `~${num.toLocaleString()} total stats (BSP)`;
            return;
        }

        // If already has content, don't wipe for async reload
        if (el.dataset.foCache && el.dataset.foCache !== 'empty') return;

        // 2. FFS fallback (async)
        el.dataset.foCache = 'loading';
        el.className = 'fo-bsp-inline tier-unknown';
        getFfScouterEstimate(targetId).then((ffs) => {
            if (!ffs) return;
            const num = Number(ffs.total);
            if (isNaN(num)) return;
            el.dataset.foCache = `ffs_${num}`;
            const tier = bspTier(num);
            el.className = `fo-bsp-inline tier-${tier}`;
            el.textContent = ffs.human || formatBspNumber(num);
            el.title = `~${num.toLocaleString()} total stats (FFS)`;
        });
    }

    function renderOverlayBspCell(cell, targetId) {
        // 1. Try BSP prediction (synchronous)
        const pred = fetchBspPrediction(targetId);
        if (pred && pred.TBS != null) {
            const num = Number(pred.TBS);
            const tier = bspTier(num);
            const key = `bsp_${num}`;
            if (cell.dataset.foCache === key) return; // no change
            cell.innerHTML = '';
            cell.dataset.foCache = key;
            const span = document.createElement('span');
            span.className = `fo-bsp-stat tier-${tier}`;
            span.title = `~${num.toLocaleString()} total stats (BSP)`;
            span.innerHTML = `${formatBspNumber(num)}<span class="fo-bsp-source">bsp</span>`;
            cell.appendChild(span);
            return;
        }

        // If cell already has content, don't wipe it for async FFS reload
        if (cell.dataset.foCache && cell.dataset.foCache !== 'empty') return;

        // 2. FFS fallback (async) — show dash while loading
        cell.innerHTML = '';
        cell.dataset.foCache = 'loading';
        const span = document.createElement('span');
        span.className = 'fo-bsp-stat tier-unknown';
        span.textContent = '\u2014';
        cell.appendChild(span);

        getFfScouterEstimate(targetId).then((ffs) => {
            if (!ffs) return;
            const num = Number(ffs.total);
            if (isNaN(num)) return;
            const tier = bspTier(num);
            cell.dataset.foCache = `ffs_${num}`;
            span.className = `fo-bsp-stat tier-${tier}`;
            span.title = `~${num.toLocaleString()} total stats (FFS)`;
            span.innerHTML = `${ffs.human || formatBspNumber(num)}<span class="fo-bsp-source">ffs</span>`;
        });
    }

    /** Render the call cell for overlay rows. */
    function renderOverlayCallCell(cell, targetId) {
        cell.innerHTML = '';
        const callData = state.calls[targetId];

        if (callData) {
            const tag = document.createElement('span');
            const isMine = callData.calledBy && String(callData.calledBy.id) === state.myPlayerId;
            tag.className = 'fo-called-tag ' + (isMine ? 'fo-called-mine' : 'fo-called-other')
                + (callData.isDeal ? ' fo-called-deal' : '');
            const callerName = document.createElement('span');
            callerName.className = 'fo-caller-name';
            if (callData.isDeal) {
                callerName.textContent = (isMine ? 'Mine' : (callData.calledBy ? callData.calledBy.name : 'Someone'));
            } else {
                callerName.textContent = isMine ? 'Mine' : (callData.calledBy ? callData.calledBy.name : 'Someone');
            }
            tag.appendChild(callerName);

            // Deal badge
            if (callData.isDeal) {
                const dealBadge = document.createElement('span');
                dealBadge.className = 'fo-deal-badge';
                dealBadge.textContent = '\uD83D\uDD12 Deal';
                dealBadge.title = 'Multi-hit deal \u2014 15 min timeout';
                tag.appendChild(dealBadge);
            }
            cell.appendChild(tag);

            // Only the caller can uncall their own target
            if (isMine) {
                const uncallBtn = document.createElement('button');
                uncallBtn.className = 'fo-uncall-btn';
                uncallBtn.title = 'Uncall';
                uncallBtn.textContent = '\u2715';
                uncallBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    emitUncallTarget(targetId);
                });
                cell.appendChild(uncallBtn);
            }
        } else {
            const btn = document.createElement('button');
            btn.className = 'fo-call-btn';
            btn.textContent = 'Call';

            // Long-press / right-click = deal call
            let longPressTimer = null;
            let longPressTriggered = false;

            btn.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // only left button
                longPressTriggered = false;
                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    emitCallTarget(targetId, true);
                    showToast('\uD83D\uDD12 Deal call placed (15 min)', 'info');
                }, 600);
            });
            btn.addEventListener('mouseup', () => {
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            });
            btn.addEventListener('mouseleave', () => {
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            });

            // Touch support for PDA
            btn.addEventListener('touchstart', (e) => {
                longPressTriggered = false;
                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    emitCallTarget(targetId, true);
                    showToast('\uD83D\uDD12 Deal call placed (15 min)', 'info');
                }, 600);
            }, { passive: true });
            btn.addEventListener('touchend', (e) => {
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                if (longPressTriggered) { e.preventDefault(); return; }
            });
            btn.addEventListener('touchmove', () => {
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            }, { passive: true });

            // Normal click = regular call
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (longPressTriggered) return; // already handled by long-press
                emitCallTarget(targetId, false);
            });

            // Right-click = deal call (desktop)
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                emitCallTarget(targetId, true);
                showToast('\uD83D\uDD12 Deal call placed (15 min)', 'info');
            });

            cell.appendChild(btn);
        }
    }

    /** Update an existing overlay row in-place. */
    function updateOverlayRow(row, targetId) {
        if (!row) return;

        applyOverlayRowClasses(row, targetId);

        const s = state.statuses[targetId] || {};

        // Update name
        const nameEl = row.querySelector('.fo-name');
        if (nameEl && s.name) {
            nameEl.textContent = s.name;
            nameEl.dataset.placeholder = `${s.name} [${targetId}]`;
        }

        // Update level
        const lvlEl = row.querySelector('.fo-level');
        if (lvlEl) lvlEl.textContent = s.level != null ? String(s.level) : '\u2014';

        // Update online dot
        const onlineCell = document.getElementById(`fo-online-${targetId}`);
        if (onlineCell) {
            const dot = onlineCell.querySelector('.fo-online-dot');
            if (dot) {
                const activity = (s.activity || 'offline').toLowerCase();
                const cls = activity === 'online' ? 'on' : (activity === 'idle' ? 'idle' : 'off');
                dot.className = `fo-online-dot ${cls}`;
                dot.title = activity.charAt(0).toUpperCase() + activity.slice(1);
            }
        }

        // Update viewers badge
        const targetCell = row.children[1]; // second cell is target
        if (targetCell) {
            const existingEye = targetCell.querySelector('.fo-eye-badge');
            const viewers = state.viewers[targetId];
            if (viewers && viewers.length > 0) {
                if (existingEye) {
                    existingEye.innerHTML = `<span class="fo-eye-icon">\uD83D\uDC41</span>${viewers.length}`;
                    existingEye.title = viewers.map((v) => v.name).join(', ') + ' viewing';
                } else {
                    const nameRow = targetCell.querySelector('.fo-name-row');
                    if (nameRow) {
                        const eye = document.createElement('span');
                        eye.className = 'fo-eye-badge';
                        eye.title = viewers.map((v) => v.name).join(', ') + ' viewing';
                        eye.innerHTML = `<span class="fo-eye-icon">\uD83D\uDC41</span>${viewers.length}`;
                        nameRow.appendChild(eye);
                    }
                }
            } else if (existingEye) {
                existingEye.remove();
            }
        }

        // Re-render volatile cells (skip priority if user is interacting with dropdown)
        const prioCell = document.getElementById(`fo-priority-${targetId}`);
        if (prioCell && !prioCell.dataset.foActive) {
            renderOverlayPriorityCell(prioCell, targetId);
        }

        const statusCell = document.getElementById(`fo-status-${targetId}`);
        if (statusCell) renderOverlayStatusCell(statusCell, targetId);

        const callCell = document.getElementById(`fo-call-${targetId}`);
        if (callCell) renderOverlayCallCell(callCell, targetId);

        const bspCell = document.getElementById(`fo-bsp-${targetId}`);
        if (bspCell) renderOverlayBspCell(bspCell, targetId);

        const bspInline = document.getElementById(`fo-bsp-inline-${targetId}`);
        if (bspInline) renderInlineBsp(bspInline, targetId);
    }

    /** Update footer stats. */
    function updateOverlayFooter() {
        const ids = Object.keys(state.statuses);
        const hiddenStatuses = ['federal', 'fallen', 'traveling', 'abroad'];
        let total = 0, available = 0, called = 0, hosp = 0;

        for (const tid of ids) {
            const s = state.statuses[tid] || {};
            const status = normalizeStatus(s.status);
            if (hiddenStatuses.includes(status)) continue; // skip traveling/hidden from counts
            total++;
            if (status === 'ok') available++;
            if (status === 'hospital') hosp++;
            if (state.calls[tid]) called++;
        }

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val);
        };
        set('fo-stat-targets', total);
        set('fo-stat-available', available);
        set('fo-stat-called', called);
        set('fo-stat-hosp', hosp);
    }

    // =========================================================================
    // SECTION 13: AUTO-SORT
    // =========================================================================

    /**
     * Sort priority for a target. Lower number = higher in the list.
     *  -1: Called by ME (pinned to top)
     *   0: High priority + online (uncalled)
     *   1: OK + online
     *   1.5: OK + idle/offline
     *   2: Hospital
     *   3: Traveling
     *   4: Jail
     *   5: Called by others (sinks to bottom)
     */
    function sortPriority(targetId) {
        const s = state.statuses[targetId];
        const status = normalizeStatus(s ? s.status : 'ok');
        const callData = state.calls[targetId];
        const isCalled = !!callData;
        const prio = state.priorities[targetId];
        const isHighPriority = prio && prio.level === 'high';
        const isOnline = s && s.activity === 'online';

        // Called by ME → pin to top
        if (isCalled && callData.calledBy && String(callData.calledBy.id) === state.myPlayerId) return -1;
        // Called by others → sink to bottom
        if (isCalled) return 5;

        // High priority + OK status floats above everything
        if (isHighPriority && status === 'ok') return 0;

        switch (status) {
            case 'ok':
                return isOnline ? 1 : 1.5;
            case 'hospital':
                return 2;
            case 'traveling':
            case 'abroad':
                return 3;
            case 'jail':
                return 4;
            case 'federal':
            case 'fallen':
                return 7;
            default:
                return 6;
        }
    }

    /** Secondary sort: remaining timer (ascending). */
    function sortTimerValue(targetId) {
        const s = state.statuses[targetId];
        return s && s.until ? s.until : 0;
    }

    /**
     * Re-order the DOM rows based on sort priorities.
     * Uses CSS transitions for smooth re-ordering by manipulating `order`
     * on a flex container, or by physically moving DOM nodes.
     */
    function sortMemberList() {
        // If the overlay is active, re-render it (renderOverlay handles sorting)
        if (document.getElementById('fo-overlay')) {
            renderOverlay();
            return;
        }
        const rows = Array.from(document.querySelectorAll('[data-wb-target-id]'));
        if (rows.length === 0) return;

        // Determine the parent container
        const parent = rows[0].parentElement;
        if (!parent) return;

        // Build sort array
        const sorted = rows.map((row) => {
            const tid = row.dataset.wbTargetId;
            return {
                row,
                targetId: tid,
                priority: sortPriority(tid),
                timer: sortTimerValue(tid),
            };
        });

        sorted.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.timer - b.timer;
        });

        // Use CSS order property if parent is flex/grid, otherwise re-append nodes
        const computedDisplay = window.getComputedStyle(parent).display;
        const isFlex = computedDisplay === 'flex' || computedDisplay === 'inline-flex'
            || computedDisplay === 'grid' || computedDisplay === 'inline-grid';

        if (isFlex) {
            sorted.forEach((item, index) => {
                item.row.style.order = String(index);
            });
        } else {
            // Physically re-order DOM nodes in-place (no detach/reattach flicker).
            let prev = null;
            for (const item of sorted) {
                const expected = prev ? prev.nextSibling : parent.firstChild;
                if (item.row !== expected) {
                    parent.insertBefore(item.row, expected);
                }
                prev = item.row;
            }
        }
    }

    const debouncedSort = debounce(sortMemberList, 300);

    // =========================================================================
    // SECTION 14: ATTACK PAGE ENHANCEMENT
    // =========================================================================

    /**
     * When on the attack page (loader.php?sid=attack), show a small overlay
     * with call info for the current target.
     */
    function createAttackOverlay() {
        const targetId = getAttackTargetId();
        if (!targetId) {
            console.warn('[FactionOps] Could not find target ID in URL for Assist button.');
            return;
        }

        log('Attack page detected — target:', targetId);

        const overlay = document.createElement('div');
        overlay.className = 'wb-attack-overlay';
        overlay.id = 'wb-attack-overlay';

        overlay.innerHTML = `
            <h4>FactionOps</h4>
            <div class="wb-attack-row">
                <span>Target:</span>
                <span id="wb-atk-target">#${escapeHtml(targetId)}</span>
            </div>
            <div class="wb-attack-row">
                <span>Call:</span>
                <span id="wb-atk-call">--</span>
            </div>
            <div class="wb-attack-row">
                <span>Also here:</span>
                <span id="wb-atk-viewers" style="color:#a29bfe;">--</span>
            </div>
            <div style="margin-top:8px;">
                <button class="wb-btn wb-btn-sm" id="wb-atk-uncall">Quick Uncall</button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('wb-atk-uncall').addEventListener('click', () => {
            emitUncallTarget(targetId);
        });

        updateAttackOverlay(targetId);
    }

    /** Update attack overlay with current state for the given target. */
    function updateAttackOverlay(targetId) {
        const callEl = document.getElementById('wb-atk-call');
        if (!callEl) return;

        const callData = state.calls[targetId];
        if (callData && callData.calledBy) {
            callEl.textContent = `Called by ${callData.calledBy.name}`;
            callEl.style.color = 'var(--wb-call-green)';
        } else {
            callEl.textContent = 'Uncalled';
            callEl.style.color = 'var(--wb-text)';
        }

        // Update viewers (others on this same attack page)
        const viewersEl = document.getElementById('wb-atk-viewers');
        if (viewersEl) {
            const viewers = (state.viewers[targetId] || []).filter(
                v => String(v.id) !== state.myPlayerId
            );
            if (viewers.length > 0) {
                viewersEl.textContent = viewers.map(v => v.name).join(', ');
                viewersEl.style.color = viewers.length >= 2 ? '#ff7675' : '#a29bfe';
            } else {
                viewersEl.textContent = 'None';
                viewersEl.style.color = 'var(--wb-text)';
            }
        }
    }

    /**
     * Create the floating ASSIST button on attack pages.
     * Sends a request for backup to all faction members.
     */
    function createAssistButton() {
        if (document.getElementById('wb-assist-btn')) return;

        const targetId = getAttackTargetId();
        if (!targetId) {
            // Torn React takes a moment to render the DOM, retry a few times
            if (window.location.href.includes('sid=attack') || window.location.href.includes('profiles.php')) {
                setTimeout(createAssistButton, 1000);
            }
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'wb-assist-btn';
        btn.innerHTML = `
            <svg class="wb-assist-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6.92 5 5 6.92l6.31 6.31-2.18 2.18a2.4 2.4 0 1 0 1.06 1.06l2.18-2.18 2.17 2.17a2.4 2.4 0 1 0 1.06-1.06L13.43 13.3 19.74 7 17.82 5.08l-5.51 5.51-5.39-5.59Z"/>
            </svg>
            <span>Assist</span>
        `;

        let cooldownTimer = null;

        btn.addEventListener('click', async () => {
            if (btn.disabled) return;

            const warId = deriveWarId();
            if (!warId) {
                showToast('Not connected to a war', 'warning');
                return;
            }

            // Try to extract target name from page DOM
            let targetName = null;
            const defenderEl = document.querySelector('.defender .username, [class*="defender"] [class*="userName"], .playersModelWrap .right .username');
            if (defenderEl) {
                targetName = defenderEl.textContent.trim();
            }

            try {
                await postAction('/api/assist-request', {
                    warId,
                    targetId,
                    targetName: targetName || `Player [${targetId}]`,
                });
                showToast('Assist request sent!', 'success');
            } catch (err) {
                showToast('Failed to send assist request', 'error');
                return;
            }

            // Disable for 30 seconds to prevent spam
            btn.disabled = true;
            let remaining = 30;
            btn.innerHTML = `⏳ ${remaining}s`;
            cooldownTimer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(cooldownTimer);
                    cooldownTimer = null;
                    btn.disabled = false;
                    btn.innerHTML = '⚔️ ASSIST';
                } else {
                    btn.innerHTML = `⏳ ${remaining}s`;
                }
            }, 1000);
        });

        document.body.appendChild(btn);
    }

    // =========================================================================
    // SECTION 15: FETCH / XHR INTERCEPTION
    // =========================================================================

    /**
     * Intercept window.fetch to passively capture Torn's own API responses.
     * This lets us extract status data, attack results, and chain info without
     * making our own API calls (saving rate-limit budget).
     */
    function installFetchInterceptor() {
        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
            const response = await originalFetch.apply(this, args);
            try {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
                if (typeof url === 'string' && (url.includes('api.torn.com') || url.includes('torn.com'))) {
                    const clone = response.clone();
                    clone.json().then((data) => {
                        handleInterceptedData(url, data);
                    }).catch(() => { /* ignore parse failures */ });
                }
            } catch (e) {
                // Interception must never break the page
            }
            return response;
        };
        log('Fetch interceptor installed');
    }

    /**
     * Intercept XMLHttpRequest for older Torn code paths that still use XHR.
     */
    function installXHRInterceptor() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._wbUrl = url;
            return originalOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            if (this._wbUrl && typeof this._wbUrl === 'string' && this._wbUrl.includes('api.torn.com')) {
                this.addEventListener('load', function () {
                    try {
                        const data = JSON.parse(this.responseText);
                        handleInterceptedData(this._wbUrl, data);
                    } catch (e) {
                        // Ignore
                    }
                });
            }
            return originalSend.apply(this, args);
        };
        log('XHR interceptor installed');
    }

    /**
     * Process intercepted Torn API data.
     * We look for faction member data, chain status, and attack results.
     */
    function handleInterceptedData(url, data) {
        if (!data || data.error) return;

        // Faction member data (may contain member statuses)
        // GUARD: Only update members the server already told us are enemy targets.
        // Without this, Torn's own-faction member list (loaded on factions.php?step=your)
        // leaks into state.statuses before the server has sent enemyStatuses,
        // causing the overlay to briefly show our own faction members.
        if (data.members) {
            const statusBatch = {};
            for (const [memberId, member] of Object.entries(data.members)) {
                const mid = String(memberId);
                // Skip members not already known as enemy targets
                if (!state.statuses[mid]) continue;
                const statusInfo = parseInterceptedMemberStatus(member);
                if (statusInfo) {
                    // Preserve existing name/level if this payload doesn't provide them
                    const existing = state.statuses[mid] || {};
                    if (!statusInfo.name && existing.name) statusInfo.name = existing.name;
                    if (statusInfo.level == null && existing.level != null) statusInfo.level = existing.level;
                    statusBatch[mid] = statusInfo;
                }
            }

            // Use monotonic merge so intercepted API can't bump timers up
            if (Object.keys(statusBatch).length > 0) {
                mergeStatusesMonotonic(statusBatch);

                // Peer relay — report changes to server for other faction members
                queuePeerRelay(statusBatch);
            }

            // Update DOM for each affected target
            for (const targetId of Object.keys(statusBatch)) {
                updateTargetRow(targetId);
            }

            // Refresh the Next Up queue after status changes
            updateNextUp();
        }

        // Chain data — intercepted API is the fast path for timeout
        if (data.chain) {
            const chain = data.chain;
            state.chain.current = chain.current || 0;
            state.chain.max = chain.max || 0;
            let adjustedTimeout = chain.timeout || 0;
            // Compensate for Torn API cache age
            if (data.timestamp && adjustedTimeout > 0) {
                const cacheAge = Math.floor(Date.now() / 1000) - data.timestamp;
                if (cacheAge > 0 && cacheAge < 300) {
                    adjustedTimeout = Math.max(0, adjustedTimeout - cacheAge);
                }
            }
            setChainTimeout(adjustedTimeout);
            state.chain.cooldown = chain.cooldown || 0;
            chainCooldownSetAt = Date.now();
            chainCooldownSetVal = state.chain.cooldown;
            updateChainBar();
            // Forward chain data to server so all faction members see it instantly
        }

        // Ranked war data — extract enemy faction
        if (data.rankedwars && typeof data.rankedwars === 'object') {
            for (const [wid, warData] of Object.entries(data.rankedwars)) {
                const factions = warData.factions;
                if (!factions || typeof factions !== 'object') continue;
                const fids = Object.keys(factions);
                if (fids.length !== 2) continue;
                const myFid = state.myFactionId;
                if (!myFid) continue;
                const enemyFid = fids.find(f => String(f) !== String(myFid));
                if (enemyFid && state.enemyFactionId !== enemyFid) {
                    // WIPE STALE WAR DATA if enemy changed (bug fix)
                    state.statuses = {};
                    state.calls = {};
                    state.priorities = {};

                    state.enemyFactionId = enemyFid;
                    state.enemyFactionName = factions[enemyFid]?.name || null;
                    log('Intercepted ranked war — enemy faction:', enemyFid, state.enemyFactionName);
                    const enemyEl = document.getElementById('fo-enemy-name');
                    if (enemyEl && state.enemyFactionName) enemyEl.textContent = state.enemyFactionName;

                    refreshAllRows();
                    pollOnce();
                }
            }
        }

        // Single-player profile data — shape returned by /user/:id?selections=profile
        // and a few of Torn's internal profile fetches. Near-zero-latency update
        // for whichever enemy a teammate is currently looking at.
        if (data.player_id && data.status && typeof data.status === 'object' && !data.members) {
            const mid = String(data.player_id);
            // Only update enemies we already track — don't leak arbitrary profile views.
            if (state.statuses[mid]) {
                const statusInfo = parseInterceptedMemberStatus(data);
                if (statusInfo) {
                    const existing = state.statuses[mid];
                    if (!statusInfo.name && existing.name) statusInfo.name = existing.name;
                    if (statusInfo.level == null && existing.level != null) statusInfo.level = existing.level;
                    const batch = { [mid]: statusInfo };
                    mergeStatusesMonotonic(batch);
                    queuePeerRelay(batch);
                    updateTargetRow(mid);
                    updateNextUp();
                    log(`[profile-intercept] Updated ${mid} from profile response`);
                }
            }
        }

        // Attack result — a teammate's attack just resolved; if the target
        // was hospitalized this is the single fastest signal we will ever
        // get (no Torn API cache between us and ground truth). Flip the
        // target's status locally and peer-relay so the rest of the faction
        // stops showing them as "available" within ~500ms.
        if (data.result) {
            log('Attack result intercepted:', data.result);
            const targetId = getAttackTargetId();
            if (targetId && data.result.hospitalized) {
                // Try multiple shapes Torn has used for hospital duration.
                const minutesFromResult =
                    (typeof data.result.hospitalized === 'object' && data.result.hospitalized.minutes) ||
                    data.result.hospital_time ||
                    data.result.hospitalTime ||
                    (data.result.hospital && data.result.hospital.minutes) ||
                    0;
                // If duration is unknown, use a conservative placeholder so
                // the row flips away from "ok"; the next real status update
                // will refine the countdown.
                const untilSec = minutesFromResult > 0
                    ? minutesFromResult * 60
                    : 30 * 60;
                const existing = state.statuses[targetId] || {};
                const statusInfo = {
                    status: 'hospital',
                    until: untilSec,
                    description: 'Hospitalized',
                    activity: 'offline',
                };
                if (existing.name) statusInfo.name = existing.name;
                if (existing.level != null) statusInfo.level = existing.level;

                const batch = { [targetId]: statusInfo };
                mergeStatusesMonotonic(batch);
                queuePeerRelay(batch);
                updateTargetRow(targetId);
                updateNextUp();
                log(`[attack-result] Target ${targetId} marked hospital (${minutesFromResult || '~30'}m)`);
                // Auto-uncall happens centrally via maybeAutoUncallOnHospital
                // inside mergeStatusesMonotonic — no per-path logic needed.
            }
        }
    }

    /**
     * Parse a Torn member object into our status format.
     */
    function parseInterceptedMemberStatus(member) {
        if (!member) return null;

        let status = 'ok';
        let until = 0;
        let description = '';
        let activity = 'offline';
        const name = member.name || null;
        const level = member.level != null ? Number(member.level) : null;

        // Status
        if (member.status) {
            const s = member.status;
            const state_str = (s.state || '').toLowerCase();
            // Use Date.now()/1000 (not Math.floor) for sub-second precision —
            // avoids rounding that causes timers to jump up by ~1s.
            const nowSec = Date.now() / 1000;
            if (state_str === 'hospital') {
                status = 'hospital';
                until = s.until ? Math.max(0, s.until - nowSec) : 0;
            } else if (state_str === 'federal' || state_str === 'fallen') {
                status = state_str;
            } else if (state_str === 'jail') {
                status = 'jail';
                until = s.until ? Math.max(0, s.until - nowSec) : 0;
            } else if (state_str === 'traveling' || state_str === 'abroad') {
                status = state_str;
                description = s.description || '';
                until = s.until ? Math.max(0, s.until - nowSec) : 0;
            } else {
                status = 'ok';
            }
        }

        // Activity (online/idle/offline)
        if (member.last_action) {
            const la = member.last_action;
            if (la.status) {
                activity = la.status.toLowerCase();
            }
        }

        return { status, until, description, activity, name, level };
    }

    // =========================================================================
    // SECTION 16: MUTATION OBSERVER
    // =========================================================================

    let observer = null;

    /**
     * Read a member's status directly from Torn's DOM row.
     * Torn uses icon classes and text to indicate hospital/jail/travel/ok.
     * Returns { status, until } or null if unreadable.
     */
    function readStatusFromDOM(row) {
        if (!row) return null;

        // Clone the row but exclude our injected FactionOps elements
        // so we only read Torn's original DOM.
        const clone = row.cloneNode(true);
        const injected = clone.querySelectorAll('.wb-cell-container, .wb-sortable-row-overlay');
        injected.forEach((el) => el.remove());
        const text = clone.textContent.toLowerCase();

        // Pass 1: title attributes (most information-dense — Torn's icon
        // tooltips carry BOTH the status word and the remaining duration).
        const titled = [];
        if (row.getAttribute && row.getAttribute('title')) titled.push(row.getAttribute('title'));
        clone.querySelectorAll('[title]').forEach((el) => {
            const t = el.getAttribute('title');
            if (t) titled.push(t);
        });
        for (const raw of titled) {
            const t = raw.toLowerCase();
            if (t.includes('hospital')) return { status: 'hospital', until: parseDurationFromText(raw) };
            if (t.includes('jail'))     return { status: 'jail',     until: parseDurationFromText(raw) };
            if (t.includes('federal'))  return { status: 'federal',  until: 0 };
            if (t.includes('travel'))   return { status: 'traveling', until: 0 };
            if (t.includes('abroad'))   return { status: 'abroad',   until: 0 };
            if (t.includes('fallen'))   return { status: 'fallen',   until: 0 };
        }

        // Pass 2: SVG <title> elements (some Torn layouts use these
        // instead of attribute titles).
        const svgTitles = clone.querySelectorAll('svg title');
        for (const el of svgTitles) {
            const t = (el.textContent || '').toLowerCase();
            if (t.includes('hospital')) return { status: 'hospital', until: parseDurationFromText(el.textContent) };
            if (t.includes('jail'))     return { status: 'jail',     until: parseDurationFromText(el.textContent) };
            if (t.includes('federal'))  return { status: 'federal',  until: 0 };
            if (t.includes('travel'))   return { status: 'traveling', until: 0 };
            if (t.includes('abroad'))   return { status: 'abroad',   until: 0 };
            if (t.includes('fallen'))   return { status: 'fallen',   until: 0 };
        }

        // Pass 3: row text content (catches status words that aren't
        // in tooltips but are rendered inline).
        if (text.includes('hospital')) return { status: 'hospital', until: parseDurationFromText(text) };
        if (text.includes('jail'))     return { status: 'jail',     until: parseDurationFromText(text) };
        if (text.includes('federal'))  return { status: 'federal',  until: 0 };
        if (text.includes('traveling') || text.includes('abroad')) return { status: 'traveling', until: 0 };
        if (text.includes('fallen'))   return { status: 'fallen',   until: 0 };

        // Pass 4: status-indicating class names on the row or children.
        const allEls = [clone, ...clone.querySelectorAll('*')];
        for (const el of allEls) {
            const cls = el.className;
            if (typeof cls !== 'string') continue;
            if (cls.includes('hospital')) return { status: 'hospital', until: 0 };
            if (cls.includes('jail'))     return { status: 'jail',     until: 0 };
            if (cls.includes('travel'))   return { status: 'traveling', until: 0 };
        }

        // Nothing indicative — treat as OK.
        return { status: 'ok', until: 0 };
    }

    /**
     * Check all enhanced member rows for DOM status changes.
     * Compares DOM-read status against state.statuses and forwards
     * any changes to the server so all faction members see them instantly.
     */
    let _lastDomStatusCheck = 0;
    function checkDOMStatusChanges() {
        const now = Date.now();
        // Throttle to at most once per 500ms
        if (now - _lastDomStatusCheck < 500) return;
        _lastDomStatusCheck = now;

        const rows = document.querySelectorAll('.wb-sortable-row');
        const changedStatuses = {};
        let changeCount = 0;

        rows.forEach((row) => {
            const targetId = row.dataset.wbTargetId;
            if (!targetId) return;

            const domStatus = readStatusFromDOM(row);
            if (!domStatus) return;

            const current = state.statuses[targetId] || {};
            const currentNorm = normalizeStatus(current.status || 'ok');
            const domNorm = normalizeStatus(domStatus.status);
            const statusChanged = currentNorm !== domNorm;

            // Build a merge payload. Force until=0 on "ok" so lingering
            // timers don't stick around when a target gets released.
            const payload = { status: domNorm };
            if (domNorm === 'ok') {
                payload.until = 0;
            } else if (typeof domStatus.until === 'number') {
                payload.until = domStatus.until;
            }

            // Cheap change detection — skip DOM reads where nothing of
            // interest moved. We care about status transitions and any
            // meaningful timer change (>2s to absorb rounding).
            const currentUntil = typeof current.until === 'number' ? current.until : 0;
            const timerDelta = Math.abs(currentUntil - (payload.until ?? currentUntil));
            if (!statusChanged && timerDelta < 2) return;

            // Route through the monotonic merge so stale tooltip durations
            // can't bump a decrementing timer back up (same guard that
            // fixes the "Next Up rebounds 0 → 2s" bug for server pushes).
            const prevUntil = state.statuses[targetId]?.until;
            mergeStatusesMonotonic({ [targetId]: payload });
            const postUntil = state.statuses[targetId]?.until;

            if (statusChanged || prevUntil !== postUntil) {
                log(`[dom-status] #${targetId} ${currentNorm} → ${domNorm}${payload.until ? ` (${Math.round(payload.until/60)}m)` : ''}`);
                changedStatuses[targetId] = {
                    status: state.statuses[targetId].status,
                    until: state.statuses[targetId].until || 0,
                };
                changeCount++;
                updateTargetRow(targetId);
            }
        });

        if (changeCount > 0) {
            log(`Forwarding ${changeCount} DOM-detected status change(s) to server`);
            // Forward to server so all faction members see it instantly
            const warId = deriveWarId();
            if (warId && state.jwtToken) {
                postAction('/api/status', {
                    warId,
                    statuses: changedStatuses,
                }).catch((e) => warn('Failed to forward DOM status:', e.message));
            }
            if (CONFIG.AUTO_SORT) debouncedSort();
            updateNextUp();
        }
    }

    /**
     * Set up MutationObserver to watch for Torn dynamically loading faction
     * member lists AND for status changes within existing rows.
     * Torn uses AJAX to load content, so we can't just run once
     * on page load — we need to continuously watch.
     */
    function setupMutationObserver() {
        if (observer) {
            observer.disconnect();
        }

        const container = findMemberContainer();
        log('Setting up MutationObserver on:', container.tagName, container.id || container.className);

        const debouncedScan = debounce(scanAndEnhanceRows, 200);
        const debouncedStatusCheck = debounce(checkDOMStatusChanges, 300);

        observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            let shouldCheckStatus = false;
            for (const mutation of mutations) {
                // Skip mutations caused by our own injected elements
                const target = mutation.target;
                if (target && target.closest && (
                    target.closest('.wb-cell-container') ||
                    target.closest('.fo-overlay') ||
                    target.closest('#wb-chain-bar')
                )) continue;

                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldScan = true;
                    shouldCheckStatus = true;
                } else if (mutation.type === 'characterData' || mutation.type === 'attributes') {
                    shouldCheckStatus = true;
                }
            }
            if (shouldScan) {
                debouncedScan();
            }
            if (shouldCheckStatus) {
                debouncedStatusCheck();
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'title'],
        });

        // Initial scan
        scanAndEnhanceRows();
    }

    // =========================================================================
    // SECTION 17: PERIODIC REFRESH
    // =========================================================================

    // Periodic refresh is handled by the polling loop (Section 6).

    /**
     * Periodically prune expired calls (calls older than CALL_TIMEOUT).
     */
    function startCallPruner() {
        setInterval(() => {
            const now = Date.now();
            let pruned = 0;
            for (const [targetId, callData] of Object.entries(state.calls)) {
                const timeout = callData.isDeal ? CONFIG.DEAL_TIMEOUT : CONFIG.CALL_TIMEOUT;
                if (callData.calledAt && (now - callData.calledAt) > timeout) {
                    delete state.calls[targetId];
                    updateTargetRow(targetId);
                    pruned++;
                }
            }
            if (pruned > 0) {
                log(`Pruned ${pruned} expired calls`);
            }
        }, 30000); // check every 30s
    }

    // =========================================================================
    // SECTION 17B: TORN KEEP-ALIVE (ANTI-IDLE)
    // =========================================================================

    /**
     * Periodically pings the Torn API to keep the user's last_action timestamp
     * fresh while the warboard is open, preventing enemies from seeing them as
     * idle on their profile. Uses a lightweight /user/?selections=timestamp call.
     */
    let keepAliveTimer = null;
    const KEEP_ALIVE_INTERVAL = 75 * 1000; // 75 seconds

    function startKeepAlive() {
        if (keepAliveTimer) return; // already running
        if (!CONFIG.KEEP_ALIVE || !CONFIG.API_KEY) return;

        // Only run when overlay is active and war is ongoing
        if (!document.getElementById('fo-overlay') || !isWarActive()) return;

        log('Keep-alive started (interval: ' + (KEEP_ALIVE_INTERVAL / 1000) + 's)');
        keepAliveTimer = setInterval(() => {
            // Stop if overlay was removed or war ended or setting toggled off
            if (!document.getElementById('fo-overlay') || !isWarActive() || !CONFIG.KEEP_ALIVE) {
                stopKeepAlive();
                return;
            }
            keepAlivePing();
        }, KEEP_ALIVE_INTERVAL);

        // Fire one immediately so the user is marked active right away
        keepAlivePing();
    }

    function stopKeepAlive() {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
            log('Keep-alive stopped');
        }
    }

    function keepAlivePing() {
        const apiKey = CONFIG.API_KEY;
        if (!apiKey) return;

        httpRequest({
            method: 'GET',
            url: 'https://api.torn.com/user/?selections=timestamp&key=' + apiKey,
            onload(res) {
                if (res.status === 200) {
                    log('Keep-alive ping OK');
                } else {
                    warn('Keep-alive ping failed: HTTP ' + res.status);
                }
            },
            onerror() {
                warn('Keep-alive ping network error');
            },
        });
    }

    // =========================================================================
    // SECTION 18: PAGE DETECTION & ROUTER
    // =========================================================================

    /**
     * Detect if the current page is a war page vs a regular faction page.
     * Torn war pages have specific URL hashes or DOM elements that distinguish
     * them from the member list, info tab, etc.
     */
    function isWarContext() {
        const hash = window.location.hash.toLowerCase();
        const url = window.location.href.toLowerCase();

        // war.php is always a war page
        if (url.includes('war.php')) return true;

        // Hash-based war indicators on factions.php
        if (hash.includes('war') || hash.includes('ranked')) return true;

        // DOM-based detection: look for war-specific elements
        const warDomIndicators = [
            '.faction-war',
            '.ranked-war-list',
            '.f-war-list',
            '#faction-war-list',
            '#war-root',
            '.war-main',
            '.war-list',
            '[class*="warList"]',
            '[class*="rankedWar"]',
            '[class*="raidWar"]',
            '.enemy-faction',
        ];
        for (const sel of warDomIndicators) {
            if (document.querySelector(sel)) return true;
        }

        return false;
    }

    function detectPageAndInit() {
        const url = window.location.href;

        if (url.includes('sid=attack') || url.includes('profiles.php')) {
            log('Page: Attack');
            initAttackPage();
        } else if (url.includes('factions.php') || url.includes('war.php')) {
            log('Page: Faction/War — showing activate button');
            showActivateButton();
        } else {
            log('Page: Unknown — running in passive mode');
            // Re-create settings/heatmap if they were removed on an attack page
            if (!document.querySelector('.wb-settings-gear')) createSettingsGear();
            if (!document.getElementById('wb-heatmap-toggle')) createHeatmapButton();
        }
    }

    /** Initialise war/faction page enhancements. */
    function initWarPage() {
        createStandaloneNextUp();
        setupMutationObserver();
        startStatusTimers();
        startCallPruner();
    }

    /** Initialise attack page enhancements. */
    function initAttackPage() {
        // Remove FactionOps overlay if it exists (shouldn't be on attack pages)
        const foOverlay = document.getElementById('fo-overlay');
        if (foOverlay) {
            foOverlay.remove();
        }
        const foActivateBtn = document.getElementById('fo-activate-btn');
        if (foActivateBtn) {
            foActivateBtn.remove();
        }
        // Remove settings gear and heatmap button from attack pages
        const settingsGear = document.querySelector('.wb-settings-gear');
        if (settingsGear) settingsGear.remove();
        const heatmapBtn = document.getElementById('wb-heatmap-toggle');
        if (heatmapBtn) heatmapBtn.remove();
        const heatmapPanel = document.getElementById('wb-heatmap-panel');
        if (heatmapPanel) heatmapPanel.remove();
        // Restore Torn's main content if it was hidden
        const mainContent = document.getElementById('mainContainer')
            || document.querySelector('.content-wrapper');
        if (mainContent && mainContent.dataset.foHidden === 'true') {
            for (const child of Array.from(mainContent.children)) {
                if (child.id === 'fo-overlay') continue;
                if ('foPrevDisplay' in child.dataset) {
                    child.style.display = child.dataset.foPrevDisplay;
                    delete child.dataset.foPrevDisplay;
                } else {
                    child.style.display = '';
                }
            }
            delete mainContent.dataset.foHidden;
        }

        startStatusTimers();

        // Report viewing target to server (so war page shows who's on which attack)
        const targetId = getAttackTargetId();
        if (targetId) {
            reportViewing(targetId);
        }

        // Show the floating Assist button
        createAssistButton();

        // Scrape the attack-page DOM for the target's visible status. Torn
        // populates this sidebar text lazily, so retry a handful of times
        // over ~15s to catch it once it renders.
        scheduleAttackPageStatusScrape();
    }

    /**
     * Retry-driven scrape of the attack page's visible target status.
     * Zero API cost — we already loaded this page. Peer-relays whatever
     * we parse so the rest of the faction sees the update within ~500ms.
     */
    function scheduleAttackPageStatusScrape() {
        let attempts = 0;
        // Scrape every 1s for 60s so we catch the target's post-attack
        // status transition (hospital/mugged/etc.) whenever Torn's sidebar
        // updates. Don't early-exit on first success — the first read just
        // reflects pre-attack state, and we need subsequent reads to catch
        // the transition that triggers auto-uncall.
        const maxAttempts = 60;
        const intervalMs = 1000;
        const timer = setInterval(() => {
            readAttackTargetStatusFromDOM();
            attempts += 1;
            if (attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, intervalMs);
        // Also try once immediately in case the DOM is already there.
        setTimeout(readAttackTargetStatusFromDOM, 250);
    }

    /**
     * Parse the attack page sidebar for target status text (hospital / jail /
     * okay / traveling / fallen). Returns true if a status was extracted.
     * Narrow: only updates an enemy we already track, so rogue DOM reads
     * can't pollute state.
     */
    function readAttackTargetStatusFromDOM() {
        const targetId = getAttackTargetId();
        if (!targetId || !state.statuses[targetId]) return false;

        const raw = extractAttackPageStatusText();
        if (!raw) return false;

        const lower = raw.toLowerCase();
        let status = null;
        let until = 0;
        let description = raw.length < 120 ? raw : '';

        if (lower.includes('hospital')) {
            status = 'hospital';
            // Parse durations: "1h 23m", "45m", "23 minutes", etc.
            const hm = lower.match(/(\d+)\s*h(?:our)?s?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?/);
            if (hm) {
                const h = Number(hm[1]) || 0;
                const mm = Number(hm[2]) || 0;
                until = (h * 60 + mm) * 60;
            } else {
                const mOnly = lower.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
                if (mOnly) until = Number(mOnly[1]) * 60;
            }
        } else if (lower.includes('jail')) {
            status = 'jail';
            const mOnly = lower.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
            if (mOnly) until = Number(mOnly[1]) * 60;
        } else if (lower.includes('traveling') || lower.includes('abroad')
                   || lower.includes('in ') && /in\s+(mexico|japan|canada|hawaii|uk|switzerland|china|argentina|south africa|cayman)/i.test(raw)) {
            status = lower.includes('traveling') ? 'traveling' : 'abroad';
        } else if (lower.includes('federal')) {
            status = 'federal';
        } else if (lower.includes('fallen')) {
            status = 'fallen';
        } else if (lower.includes('okay') || /^\s*ok\b/i.test(raw)) {
            status = 'ok';
        } else {
            return false;
        }

        const existing = state.statuses[targetId];
        const statusInfo = {
            status, until, description,
            activity: existing.activity || 'offline',
            name: existing.name || null,
            level: existing.level != null ? existing.level : null,
        };

        const batch = { [targetId]: statusInfo };
        mergeStatusesMonotonic(batch);
        queuePeerRelay(batch);
        log(`[attack-dom] Target ${targetId} status from DOM: ${status}${until ? ` (${Math.round(until/60)}m)` : ''}`);
        return true;
    }

    function extractAttackPageStatusText() {
        // Torn's attack page renders the opponent status in a couple of
        // places depending on version. Try several; take the first that
        // contains one of the recognisable status words.
        const needles = ['hospital', 'jail', 'okay', 'traveling', 'abroad', 'federal', 'fallen'];
        const candidates = [
            ...document.querySelectorAll('[class*="playerStatus"]'),
            ...document.querySelectorAll('[class*="userStatus"]'),
            ...document.querySelectorAll('[class*="statusText"]'),
            ...document.querySelectorAll('.info-table [class*="status"]'),
            ...document.querySelectorAll('[class*="user-info"] [class*="status"]'),
            ...document.querySelectorAll('.status-display'),
            ...document.querySelectorAll('[class*="status"][class*="wrap"]'),
        ];
        for (const el of candidates) {
            const text = (el.textContent || '').trim();
            if (!text || text.length > 200) continue;
            const lower = text.toLowerCase();
            if (needles.some(n => lower.includes(n))) return text;
        }
        return null;
    }

    /** Report to the server which target we're currently viewing. */
    function reportViewing(targetId) {
        if (!state.connected) return;
        postAction('/api/viewing', { targetId }).catch(() => {});
    }

    /** Clear viewing status when leaving the attack page. */
    function clearViewing() {
        if (!state.connected) return;
        postAction('/api/viewing', { targetId: null }).catch(() => {});
    }

    // =========================================================================
    // SECTION 19: CALL EXPIRY VISUAL FEEDBACK
    // =========================================================================

    /**
     * Provides visual feedback showing how close a call is to expiring.
     * Fades the call badge as it ages.
     */
    function updateCallAges() {
        const now = Date.now();
        for (const [targetId, callData] of Object.entries(state.calls)) {
            if (!callData.calledAt) continue;
            const age = now - callData.calledAt;
            const timeout = callData.isDeal ? CONFIG.DEAL_TIMEOUT : CONFIG.CALL_TIMEOUT;
            const ratio = Math.min(age / timeout, 1);

            const el = document.getElementById(`wb-call-${targetId}`);
            if (el) {
                // Fade opacity as call ages
                const opacity = 1 - (ratio * 0.5); // fade from 1.0 to 0.5
                el.style.opacity = String(opacity);
            }
        }
        requestAnimationFrame(updateCallAges);
    }

    // =========================================================================
    // SECTION 20: TAB COORDINATION
    // =========================================================================

    /**
     * Use BroadcastChannel to coordinate between multiple Torn tabs running
     * FactionOps. This prevents duplicate socket connections and keeps state in
     * sync across tabs.
     */
    let broadcastChannel = null;

    function setupTabCoordination() {
        try {
            broadcastChannel = new BroadcastChannel('factionops_sync');
            broadcastChannel.onmessage = (event) => {
                const msg = event.data;
                if (!msg || !msg.type) return;

                switch (msg.type) {
                    case 'state_update':
                        // Another tab pushed a state change
                        if (msg.calls) state.calls = { ...state.calls, ...msg.calls };
                        if (msg.priorities) state.priorities = { ...state.priorities, ...msg.priorities };
                        if (msg.statuses) mergeStatusesMonotonic(msg.statuses);
                        if (msg.warScores) state.warScores = msg.warScores;
                        if (msg.warEta) state.warEta = msg.warEta;

                        if (msg.chain || msg.chainData) {                            const c = msg.chain || msg.chainData;
                            const { timeout, cooldown, ...rest } = c;
                            Object.assign(state.chain, rest);
                            if (timeout != null) {
                                setChainTimeout(timeout);
                            }
                            if (cooldown != null) {
                                state.chain.cooldown = cooldown;
                                chainCooldownSetAt = Date.now();
                                chainCooldownSetVal = cooldown;
                            }
                        }
                        refreshAllRows();
                        updateChainBar();
                        if (typeof updateWarTimer === 'function') updateWarTimer();
                        if (typeof updateWarTimerDisplay === 'function') updateWarTimerDisplay();
                        break;
                    case 'call_update':
                        if (msg.targetId) updateTargetRow(msg.targetId);
                        break;
                    case 'war_update':
                        if (msg.pct !== undefined) {
                            state.warPercentage = msg.pct;
                            const val = document.getElementById('fo-war-timer-value');
                            if (val) val.textContent = msg.pct + '%';
                        }
                        break;
                }
            };
            log('Tab coordination via BroadcastChannel active');
        } catch (e) {
            warn('BroadcastChannel not available — tab sync disabled');
        }
    }

    /** Broadcast a state change to other tabs. */
    function broadcastStateChange(data) {
        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage(data);
            } catch (e) {
                // Ignore — might fail if channel is closed
            }
        }
    }

    // =========================================================================
    // SECTION 21: KEYBOARD SHORTCUTS
    // =========================================================================

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt+W: toggle settings
            if (e.altKey && e.key === 'w') {
                e.preventDefault();
                toggleSettings();
            }
            // Alt+S: toggle auto-sort
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                setConfig('AUTO_SORT', !CONFIG.AUTO_SORT);
                if (CONFIG.AUTO_SORT) debouncedSort();
                log('Auto-sort:', CONFIG.AUTO_SORT ? 'ON' : 'OFF');
            }
            // Escape: close settings
            if (e.key === 'Escape' && state.ui.settingsOpen) {
                closeSettings();
            }
        });
    }

    // =========================================================================
    // SECTION 22: NOTIFICATION HELPERS
    // =========================================================================

    /**
     * Show a brief toast notification at the top of the page.
     * Used for events like "Target called" or "Chain approaching bonus".
     */
    // ── Persistent call toasts (stay until uncalled) ──
    const activeCallToasts = new Map(); // targetId → toast element

    function ensureCallToastContainer() {
        let container = document.getElementById('fo-call-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'fo-call-toast-container';
            container.style.cssText = `
                position: fixed;
                top: ${state.ui.chainBar ? '52px' : '10px'};
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000001;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    function showCallToast(targetId, message) {
        // Remove existing toast for this target if any
        removeCallToast(targetId);

        const container = ensureCallToastContainer();
        const toast = document.createElement('div');
        toast.style.cssText = `
            padding: 8px 18px;
            border-radius: 6px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            color: #fff;
            background: var(--wb-accent);
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            white-space: nowrap;
        `;
        toast.textContent = message;
        container.appendChild(toast);
        activeCallToasts.set(targetId, toast);

        requestAnimationFrame(() => { toast.style.opacity = '1'; });
    }

    function removeCallToast(targetId) {
        const toast = activeCallToasts.get(targetId);
        if (toast) {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
            activeCallToasts.delete(targetId);
        }
    }

    // =========================================================================
    // WAR ENDED BANNER
    // =========================================================================

    function showWarEndedBanner() {
        if (warEndedBannerShown) return;

        // Don't mark as shown until we actually insert the banner
        const nextUp = document.getElementById('fo-next-up');
        if (!nextUp) return; // overlay not ready yet, will retry on next refresh

        warEndedBannerShown = true;

        const result = state.warResult || 'unknown';
        const isVictory = result === 'victory';
        const isDefeat = result === 'defeat';
        const myScore = state.warScores?.myScore || 0;
        const enemyScore = state.warScores?.enemyScore || 0;
        const color = isVictory ? '#00b894' : isDefeat ? '#ff7675' : '#fdcb6e';
        const label = isVictory ? 'VICTORY' : isDefeat ? 'DEFEAT' : 'WAR OVER';

        // Update war timer to show result
        const timerEl = document.getElementById('fo-war-timer');
        const timerVal = document.getElementById('fo-war-timer-value');
        if (timerEl && timerVal) {
            timerEl.className = 'fo-war-timer ' + (isVictory ? 'safe' : 'danger');
            timerVal.textContent = label;
        }

        // Hide strategy bar and scout button
        const stratBar = document.getElementById('fo-strategy-bar');
        if (stratBar) stratBar.style.display = 'none';
        const scoutBtn = document.getElementById('fo-scout-btn');
        if (scoutBtn) scoutBtn.style.display = 'none';

        // Show banner above target list
        if (nextUp && !document.getElementById('fo-war-ended-banner')) {
            const banner = document.createElement('div');
            banner.id = 'fo-war-ended-banner';
            banner.style.cssText = `
                text-align:center; padding:12px 16px; margin:0;
                background:${isVictory ? 'rgba(0,184,148,0.12)' : 'rgba(214,48,49,0.12)'};
                border-bottom:1px solid ${color}40;
            `;
            banner.innerHTML = `
                <div style="font-size:20px;font-weight:800;color:${color};letter-spacing:0.1em;">${label}</div>
                <div style="font-size:13px;color:var(--wb-text);margin-top:4px;">
                    ${myScore.toLocaleString()} \u2013 ${enemyScore.toLocaleString()}
                </div>
                <div style="font-size:11px;color:var(--wb-text-muted);margin-top:4px;">Tap the clipboard icon to view the post-war report</div>
            `;
            nextUp.parentElement.insertBefore(banner, nextUp.nextSibling);
        }

        // Gray out target list
        const targetList = document.getElementById('fo-target-list');
        if (targetList) {
            targetList.style.opacity = '0.4';
            targetList.style.pointerEvents = 'none';
        }
        // Hide NEXT UP bar
        const nextUpBar = document.getElementById('fo-next-up');
        if (nextUpBar) nextUpBar.style.display = 'none';

        log('War ended: ' + label + ' (' + myScore + ' vs ' + enemyScore + ')');
    }

    // =========================================================================
    // STRATEGY INDICATOR
    // =========================================================================

    function updateStrategyBar() {
        const bar = document.getElementById('fo-strategy-bar');
        if (bar) bar.remove();
    }

    // =========================================================================
    // SCOUT REPORT
    // =========================================================================

    function openScoutReport() {
        // Don't open if already open
        if (document.getElementById('wb-scout-overlay')) return;

        const warId = deriveWarId();
        if (!warId) {
            showToast('Not connected to a war', 'error');
            return;
        }
        if (!state.enemyFactionId) {
            showToast('No enemy faction detected yet', 'error');
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'wb-scout-overlay';
        overlay.id = 'wb-scout-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeScoutReport();
        });

        const modal = document.createElement('div');
        modal.className = 'wb-scout-modal';
        modal.innerHTML = `
            <div class="wb-scout-header">
                <h2>\u2694\uFE0F War Analysis</h2>
                <button class="wb-scout-close" id="wb-scout-close">\u00D7</button>
            </div>
            <div class="wb-scout-body" id="wb-scout-body">
                <div class="wb-scout-loading">
                    <div class="wb-scout-spinner"></div>
                    <span>Analyzing both factions...</span>
                </div>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('wb-scout-close').addEventListener('click', closeScoutReport);

        // Fetch report
        fetchScoutReport(warId);
    }

    function closeScoutReport() {
        const overlay = document.getElementById('wb-scout-overlay');
        if (overlay) overlay.remove();
    }

    /** Gather all BSP/FFS stat estimates from client caches. */
    function gatherStatEstimates() {
        const estimates = {};

        // BSP predictions from localStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tdup.battleStatsPredictor.cache.prediction.')) {
                    const userId = key.replace('tdup.battleStatsPredictor.cache.prediction.', '');
                    try {
                        const pred = JSON.parse(localStorage.getItem(key));
                        if (pred && pred.TBS != null) {
                            estimates[userId] = { total: Number(pred.TBS), source: 'bsp' };
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {}

        // FF Scouter from in-memory cache — override BSP if FFS has data
        for (const [id, entry] of Object.entries(ffCache)) {
            if (entry && entry.bsHuman) {
                // Parse human-readable like "3.5B", "750M" into a number
                const parsed = parseHumanStats(entry.bsHuman);
                if (parsed != null) {
                    // Only override if no BSP estimate exists (BSP is usually more accurate)
                    if (!estimates[id]) {
                        estimates[id] = { total: parsed, source: 'ffs' };
                    }
                }
            }
        }

        return estimates;
    }

    /** Parse human stat strings like "3.5B", "750M", "250K" to numbers. */
    function parseHumanStats(str) {
        if (!str || typeof str !== 'string') return null;
        const match = str.trim().match(/^([\d.]+)\s*([TGBMK])?/i);
        if (!match) return null;
        const num = parseFloat(match[1]);
        if (isNaN(num)) return null;
        const suffix = (match[2] || '').toUpperCase();
        if (suffix === 'T') return num * 1e12;
        if (suffix === 'G' || suffix === 'B') return num * 1e9;
        if (suffix === 'M') return num * 1e6;
        if (suffix === 'K') return num * 1e3;
        return num;
    }

    async function fetchScoutReport(warId) {
        try {
            const url = `${CONFIG.SERVER_URL}/api/war/${encodeURIComponent(warId)}/scout-report`;
            const estimates = gatherStatEstimates();
            const body = JSON.stringify({ estimates });
            const data = await new Promise((resolve, reject) => {
                httpRequest({
                    method: 'POST',
                    url,
                    headers: {
                        'Authorization': `Bearer ${state.jwtToken}`,
                        'Content-Type': 'application/json',
                    },
                    data: body,
                    timeout: 30000,
                    onload(r) {
                        const d = safeParse(r.responseText);
                        if (r.status >= 200 && r.status < 300) resolve(d);
                        else reject(new Error((d && d.error) || `HTTP ${r.status}`));
                    },
                    onerror() { reject(new Error('Network error')); },
                    ontimeout() { reject(new Error('Request timed out')); },
                });
            });

            if (data && data.report) {
                renderScoutReport(data.report);
            } else {
                throw new Error('Invalid response');
            }
        } catch (e) {
            warn('Scout report failed:', e.message);
            const body = document.getElementById('wb-scout-body');
            if (body) {
                body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--wb-call-red);">
                    <div style="font-size:24px;margin-bottom:8px;">\u26A0</div>
                    <div>${escapeHtml(e.message)}</div>
                </div>`;
            }
        }
    }

    function formatDuration(seconds) {
        if (seconds < 60) return seconds + 's';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
        return Math.floor(seconds / 86400) + 'd';
    }

    function renderScoutReport(report) {
        const body = document.getElementById('wb-scout-body');
        if (!body) return;

        const wo = report.warOverview;
        const te = report.topEnd;
        const st = report.statTiers;
        const sh = report.safeHits;
        const act = report.activity;
        const comp = report.composition;
        const bp = report.battlePlan;
        const wp = report.winProbability;
        const wr = report.winReasoning;
        const sw = report.strengthsWeaknesses;
        const ev = report.enemyVulnerabilities;

        const winClass = wp >= 70 ? 'high' : wp >= 40 ? 'mid' : 'low';

        function fmtNum(n) { return n != null ? Number(n).toLocaleString() : '\u2014'; }
        function chipClass(m) {
            if (!m) return '';
            if (m.stats != null) {
                if (m.stats >= 1e9) return 'threat';
                if (m.stats >= 250e6) return 'mid';
                return 'weak';
            }
            if (m.level >= 75) return 'threat';
            if (m.level >= 50) return 'mid';
            return 'weak';
        }
        function renderChips(list, cls) {
            if (!list || list.length === 0) return '<span style="color:var(--wb-text-muted);font-size:10px;">None</span>';
            return list.map(m => {
                const statStr = m.statsFormatted ? ` (${m.statsFormatted})` : '';
                return `<span class="wb-scout-target-chip ${cls || chipClass(m)}">${escapeHtml(m.name)} Lv${m.level}${statStr}</span>`;
            }).join('');
        }

        let html = '';

        // ── A. WAR OVERVIEW ──
        html += `<div class="wb-scout-section">
            <h3>War Overview</h3>
            <div style="text-align:center;margin-bottom:8px;">
                <span class="wb-scout-win-badge ${winClass}">Win Probability: ${wp}%</span>
            </div>
            <div class="wb-scout-compare">
                <div class="wb-scout-compare-side ours">
                    <h4>${escapeHtml(wo.our.name)}</h4>
                    <div class="wb-scout-compare-row"><span class="lbl">Members</span><span class="val">${wo.our.memberCount}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Respect</span><span class="val">${fmtNum(wo.our.respect)}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Best Chain</span><span class="val">${fmtNum(wo.our.bestChain)}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Age</span><span class="val">${fmtNum(wo.our.age)}d</span></div>
                </div>
                <div class="wb-scout-compare-vs">VS</div>
                <div class="wb-scout-compare-side theirs">
                    <h4>${escapeHtml(wo.enemy.name)}</h4>
                    <div class="wb-scout-compare-row"><span class="lbl">Members</span><span class="val">${wo.enemy.memberCount}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Respect</span><span class="val">${fmtNum(wo.enemy.respect)}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Best Chain</span><span class="val">${fmtNum(wo.enemy.bestChain)}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Age</span><span class="val">${fmtNum(wo.enemy.age)}d</span></div>
                </div>
            </div>
            ${wr.length > 0 ? `<div style="font-size:10px;color:var(--wb-text-muted);text-align:center;">${wr.map(r => escapeHtml(r)).join(' \u2022 ')}</div>` : ''}
        </div>`;

        // ── B. TOP-END COMPARISON ──
        html += `<div class="wb-scout-section">
            <h3>Top-End Comparison</h3>
            <table class="wb-scout-matchup-table">
                <tr>
                    <th>#</th>
                    <th style="color:#00b894">Our Fighter</th>
                    <th>Lv</th>
                    <th>Stats</th>
                    <th></th>
                    <th style="color:#d63031">Their Fighter</th>
                    <th>Lv</th>
                    <th>Stats</th>
                    <th>Edge</th>
                </tr>
                ${te.matchups.map(mu => {
                    const o = mu.ours;
                    const t = mu.theirs;
                    const advClass = mu.advantage === 'ours' ? 'adv-ours' : mu.advantage === 'theirs' ? 'adv-theirs' : 'adv-even';
                    const advSymbol = mu.advantage === 'ours' ? '\u25C0' : mu.advantage === 'theirs' ? '\u25B6' : '\u2022';
                    return `<tr>
                        <td style="color:var(--wb-text-muted)">${mu.rank}</td>
                        <td style="text-align:left;color:#00b894">${o ? escapeHtml(o.name) : '\u2014'}</td>
                        <td>${o ? o.level : ''}</td>
                        <td>${o && o.statsFormatted ? o.statsFormatted : '\u2014'}${o && o.source ? ' <span style="font-size:9px;opacity:0.5">' + o.source + '</span>' : ''}</td>
                        <td class="${advClass}" style="font-size:10px">${advSymbol}</td>
                        <td style="text-align:left;color:#d63031">${t ? escapeHtml(t.name) : '\u2014'}</td>
                        <td>${t ? t.level : ''}</td>
                        <td>${t && t.statsFormatted ? t.statsFormatted : '\u2014'}${t && t.source ? ' <span style="font-size:9px;opacity:0.5">' + t.source + '</span>' : ''}</td>
                        <td class="${advClass}" style="font-weight:700">${mu.advantage === 'ours' ? '+' : mu.advantage === 'theirs' ? '\u2013' : '='}</td>
                    </tr>`;
                }).join('')}
            </table>
            ${!wo.hasEstimates ? '<div style="font-size:10px;color:var(--wb-text-muted);margin-top:4px;text-align:center;">No stat estimates available \u2014 ranked by level. Install BSP or FFS for stat-based comparison.</div>' : ''}
        </div>`;

        // ── C. STAT TIER BREAKDOWN ──
        const maxTier = Math.max(...st.labels.map(l => Math.max(st.our[l], st.enemy[l])), 1);
        html += `<div class="wb-scout-section">
            <h3>Stat Tier Breakdown</h3>
            <div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:6px;">${st.hasEstimates ? 'Based on BSP/FFS estimates' : 'Based on level (no stat estimates)'}</div>
            ${st.labels.map(label => {
                const ourW = Math.round((st.our[label] / maxTier) * 100);
                const enemyW = Math.round((st.enemy[label] / maxTier) * 100);
                return `<div class="wb-scout-tier-row">
                    <div class="wb-scout-tier-label">${label}</div>
                    <div style="display:flex;justify-content:flex-end;align-items:center;">
                        <span class="wb-scout-tier-count" style="color:#00b894;margin-right:4px;">${st.our[label]}</span>
                        <div class="wb-scout-tier-bar ours" style="width:${ourW}%;min-width:${st.our[label] > 0 ? 4 : 0}px;"></div>
                    </div>
                    <div style="text-align:center;font-size:9px;color:var(--wb-text-muted)">${st.descriptions[label]}</div>
                    <div style="display:flex;align-items:center;">
                        <div class="wb-scout-tier-bar theirs" style="width:${enemyW}%;min-width:${st.enemy[label] > 0 ? 4 : 0}px;"></div>
                        <span class="wb-scout-tier-count" style="color:#d63031;margin-left:4px;">${st.enemy[label]}</span>
                    </div>
                    <div></div>
                </div>`;
            }).join('')}
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--wb-text-muted);margin-top:4px;padding:0 4px;">
                <span style="color:#00b894">Us</span>
                <span style="color:#d63031">Them</span>
            </div>
        </div>`;

        // ── D. SAFE HIT THRESHOLDS ──
        html += `<div class="wb-scout-section">
            <h3>Safe Hit Thresholds</h3>
            ${!sh.hasEstimates ? '<div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:4px;">Estimated from levels (install BSP/FFS for accuracy)</div>' : ''}
            <table class="wb-scout-safe-table">
                <tr><th>Your Stats</th><th>Safe to Hit</th></tr>
                ${sh.thresholds.map(t => `<tr>
                    <td style="font-weight:600">${t.label}</td>
                    <td>${t.desc}</td>
                </tr>`).join('')}
            </table>
            <div style="display:flex;gap:12px;margin-top:8px;">
                <div style="flex:1;">
                    <div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:2px;">Your roster that can hit</div>
                    <div class="wb-scout-pct-bar" style="width:${sh.ourCanHitPct}%;background:rgba(0,184,148,0.3);color:#00b894;">${sh.ourCanHitPct}%</div>
                </div>
                <div style="flex:1;">
                    <div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:2px;">Their roster farmable</div>
                    <div class="wb-scout-pct-bar" style="width:${sh.enemyFarmablePct}%;background:rgba(214,48,49,0.3);color:#ff7675;">${sh.enemyFarmablePct}%</div>
                </div>
            </div>
        </div>`;

        // ── E. ACTIVITY & AVAILABILITY ──
        html += `<div class="wb-scout-section">
            <h3>Activity & Availability</h3>
            <div class="wb-scout-compare">
                <div class="wb-scout-compare-side ours">
                    <h4>Our Activity</h4>
                    <div class="wb-scout-compare-row"><span class="lbl">Online</span><span class="val" style="color:#00b894">${act.our.online}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Idle</span><span class="val" style="color:#fdcb6e">${act.our.idle}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Offline</span><span class="val" style="color:#636e72">${act.our.offline}</span></div>
                    <div class="wb-scout-compare-row" style="border-top:1px solid var(--wb-border);padding-top:4px;margin-top:4px;"><span class="lbl">Combat Ready</span><span class="val" style="color:#e17055;font-weight:700">${act.our.activeCombatRoster}</span></div>
                </div>
                <div class="wb-scout-compare-vs">VS</div>
                <div class="wb-scout-compare-side theirs">
                    <h4>Enemy Activity</h4>
                    <div class="wb-scout-compare-row"><span class="lbl">Online</span><span class="val" style="color:#00b894">${act.enemy.online}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Idle</span><span class="val" style="color:#fdcb6e">${act.enemy.idle}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Offline</span><span class="val" style="color:#636e72">${act.enemy.offline}</span></div>
                    <div class="wb-scout-compare-row" style="border-top:1px solid var(--wb-border);padding-top:4px;margin-top:4px;"><span class="lbl">Combat Ready</span><span class="val" style="color:#e17055;font-weight:700">${act.enemy.activeCombatRoster}</span></div>
                </div>
            </div>`;

        // Enemy vulnerability windows
        if (ev) {
            html += `<div style="margin-top:8px;">
                <div style="font-size:11px;font-weight:600;color:var(--wb-text-muted);margin-bottom:4px;">Enemy Vulnerabilities</div>
                <div class="wb-scout-grid">
                    <span class="wb-scout-label">Hospitalized</span><span class="wb-scout-value" style="color:#d63031">${ev.hospitalized.length}</span>
                    <span class="wb-scout-label">Jailed</span><span class="wb-scout-value" style="color:#636e72">${ev.jailed.length}</span>
                    <span class="wb-scout-label">Traveling</span><span class="wb-scout-value" style="color:#0984e3">${ev.traveling.length}</span>
                    <span class="wb-scout-label">Inactive (24h+)</span><span class="wb-scout-value" style="color:#636e72">${ev.inactive.length}</span>
                </div>`;
            if (ev.hospitalized.length > 0) {
                html += `<table class="wb-scout-table" style="margin-top:4px;">
                    <tr><th>Hospitalized Enemy</th><th style="text-align:center">Lvl</th><th style="text-align:right">Time Left</th></tr>
                    ${ev.hospitalized.slice(0, 8).map(m => `<tr>
                        <td style="color:#d63031">${escapeHtml(m.name)}</td>
                        <td style="text-align:center">${m.level}</td>
                        <td style="text-align:right">${formatDuration(m.remaining)}</td>
                    </tr>`).join('')}
                    ${ev.hospitalized.length > 8 ? `<tr><td colspan="3" style="opacity:0.5;font-size:10px">... and ${ev.hospitalized.length - 8} more</td></tr>` : ''}
                </table>`;
            }
            html += `</div>`;
        }
        html += `</div>`;

        // ── F. FACTION COMPOSITION ──
        html += `<div class="wb-scout-section">
            <h3>Faction Composition</h3>
            <div class="wb-scout-compare">
                <div class="wb-scout-compare-side ours">
                    <h4>Our Roster</h4>
                    <div class="wb-scout-compare-row"><span class="lbl">New (&lt;30d)</span><span class="val">${comp.our.newMembers}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Veterans (&gt;1y)</span><span class="val">${comp.our.veterans}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Avg Days</span><span class="val">${fmtNum(comp.our.avgDaysInFaction)}</span></div>
                </div>
                <div class="wb-scout-compare-vs">VS</div>
                <div class="wb-scout-compare-side theirs">
                    <h4>Their Roster</h4>
                    <div class="wb-scout-compare-row"><span class="lbl">New (&lt;30d)</span><span class="val">${comp.enemy.newMembers}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Veterans (&gt;1y)</span><span class="val">${comp.enemy.veterans}</span></div>
                    <div class="wb-scout-compare-row"><span class="lbl">Avg Days</span><span class="val">${fmtNum(comp.enemy.avgDaysInFaction)}</span></div>
                </div>
            </div>
        </div>`;

        // ── G. TACTICAL BATTLE PLAN ──
        const phaseLabel = bp.warPhase === 'pre' ? 'Pre-War Battle Plan' : 'Tactical Battle Plan';
        const phaseNote = bp.warPhase === 'pre'
            ? '<div style="font-size:11px;color:#74b9ff;margin-bottom:8px;padding:6px 8px;background:rgba(116,185,255,0.08);border-radius:4px;border:1px solid rgba(116,185,255,0.15);">War has not started yet \u2014 this is a pre-war scouting plan based on current enemy roster.</div>'
            : bp.warPhase === 'opening'
                ? '<div style="font-size:11px;color:#00b894;margin-bottom:8px;padding:6px 8px;background:rgba(0,184,148,0.08);border-radius:4px;border:1px solid rgba(0,184,148,0.15);">War is in opening phase \u2014 focus on building chain.</div>'
                : '';
        html += `<div class="wb-scout-section">
            <h3>${phaseLabel}</h3>
            ${phaseNote}
            <div class="wb-scout-phase">
                <h4>Phase 1: Opening (0\u2013200 hits)</h4>
                <p>${escapeHtml(bp.opening.description)}</p>
                <div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:2px;">Chain targets (their weak):</div>
                <div class="wb-scout-target-list">${renderChips(bp.opening.chainTargets, 'weak')}</div>
                ${bp.opening.ourChainers.length > 0 ? `<div style="font-size:10px;color:var(--wb-text-muted);margin:4px 0 2px;">Our chainers:</div><div class="wb-scout-target-list">${renderChips(bp.opening.ourChainers, 'weak')}</div>` : ''}
            </div>
            <div class="wb-scout-phase">
                <h4>Phase 2: Mid-War (200\u20131000 hits)</h4>
                <p>${escapeHtml(bp.midWar.description)}</p>
                <div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:2px;">Perma-hospital targets:</div>
                <div class="wb-scout-target-list">${renderChips(bp.midWar.permaTargets, 'mid')}</div>
            </div>
            <div class="wb-scout-phase">
                <h4>Phase 3: Endgame</h4>
                <p>${escapeHtml(bp.endgame.description)}</p>
                <div style="font-size:10px;color:var(--wb-text-muted);margin-bottom:2px;">Enemy threats to neutralize:</div>
                <div class="wb-scout-target-list">${renderChips(bp.endgame.enemyThreats, 'threat')}</div>
                ${bp.endgame.ourHitters.length > 0 ? `<div style="font-size:10px;color:var(--wb-text-muted);margin:4px 0 2px;">Deploy our top hitters:</div><div class="wb-scout-target-list">${renderChips(bp.endgame.ourHitters, 'threat')}</div>` : ''}
            </div>
            ${bp.keyPermaTargets.length > 0 ? `<div style="margin-top:6px;padding:8px;background:rgba(214,48,49,0.08);border-radius:6px;border:1px solid rgba(214,48,49,0.2);">
                <div style="font-size:11px;font-weight:700;color:#ff7675;margin-bottom:4px;">Priority Perma-Hospital Targets</div>
                <div class="wb-scout-target-list">${renderChips(bp.keyPermaTargets, 'threat')}</div>
            </div>` : ''}

        </div>`;

        // ── H. STRENGTHS & WEAKNESSES ──
        html += `<div class="wb-scout-section">
            <h3>Strengths & Weaknesses</h3>
            <div class="wb-scout-compare">
                <div class="wb-scout-compare-side ours">
                    <h4>Our Faction</h4>
                    ${sw.our.strengths.length > 0 ? `<div style="margin-bottom:4px;">${sw.our.strengths.map(s => `<span class="wb-scout-pill strength">${escapeHtml(s)}</span>`).join(' ')}</div>` : ''}
                    ${sw.our.weaknesses.length > 0 ? `<div>${sw.our.weaknesses.map(w => `<span class="wb-scout-pill weakness">${escapeHtml(w)}</span>`).join(' ')}</div>` : ''}
                    ${sw.our.strengths.length === 0 && sw.our.weaknesses.length === 0 ? '<div style="font-size:10px;color:var(--wb-text-muted)">No notable traits</div>' : ''}
                </div>
                <div class="wb-scout-compare-vs"></div>
                <div class="wb-scout-compare-side theirs">
                    <h4>Enemy Faction</h4>
                    ${sw.enemy.strengths.length > 0 ? `<div style="margin-bottom:4px;">${sw.enemy.strengths.map(s => `<span class="wb-scout-pill strength">${escapeHtml(s)}</span>`).join(' ')}</div>` : ''}
                    ${sw.enemy.weaknesses.length > 0 ? `<div>${sw.enemy.weaknesses.map(w => `<span class="wb-scout-pill weakness">${escapeHtml(w)}</span>`).join(' ')}</div>` : ''}
                    ${sw.enemy.strengths.length === 0 && sw.enemy.weaknesses.length === 0 ? '<div style="font-size:10px;color:var(--wb-text-muted)">No notable traits</div>' : ''}
                </div>
            </div>
        </div>`;

        // ── I. LIVE STRATEGY (Removed) ──

        body.innerHTML = html;
    }

    // =========================================================================
    // POST-WAR REPORT
    // =========================================================================

    function openPostWarReport() {
        if (document.getElementById('wb-postwar-overlay')) return;

        const warId = deriveWarId();
        if (!warId) {
            showToast('Not connected to a war', 'error');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'wb-postwar-overlay';
        overlay.id = 'wb-postwar-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePostWarReport();
        });

        const modal = document.createElement('div');
        modal.className = 'wb-postwar-modal';
        modal.innerHTML = `
            <div class="wb-postwar-header">
                <h2>\uD83C\uDFC6 Post-War Report</h2>
                <button class="wb-postwar-close" id="wb-postwar-close">\u00D7</button>
            </div>
            <div class="wb-postwar-body" id="wb-postwar-body">
                <div class="wb-scout-loading">
                    <div class="wb-scout-spinner"></div>
                    <span>Analyzing war performance...</span>
                </div>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('wb-postwar-close').addEventListener('click', closePostWarReport);
        fetchPostWarReport(warId);
    }

    function closePostWarReport() {
        const overlay = document.getElementById('wb-postwar-overlay');
        if (overlay) overlay.remove();
    }

    async function fetchPostWarReport(warId) {
        try {
            const url = `${CONFIG.SERVER_URL}/api/war/${encodeURIComponent(warId)}/post-war-report`;
            const estimates = gatherStatEstimates();
            const body = JSON.stringify({ estimates });
            const data = await new Promise((resolve, reject) => {
                httpRequest({
                    method: 'POST',
                    url,
                    headers: {
                        'Authorization': `Bearer ${state.jwtToken}`,
                        'Content-Type': 'application/json',
                    },
                    data: body,
                    timeout: 30000,
                    onload(r) {
                        const d = safeParse(r.responseText);
                        if (r.status >= 200 && r.status < 300) resolve(d);
                        else reject(new Error((d && d.error) || `HTTP ${r.status}`));
                    },
                    onerror() { reject(new Error('Network error')); },
                    ontimeout() { reject(new Error('Request timed out')); },
                });
            });

            if (data && data.report) {
                renderPostWarReport(data.report);
            } else {
                throw new Error('Invalid response');
            }
        } catch (e) {
            warn('Post-war report failed:', e.message);
            const body = document.getElementById('wb-postwar-body');
            if (body) {
                body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--wb-call-red);">
                    <div style="font-size:24px;margin-bottom:8px;">\u26A0</div>
                    <div>${escapeHtml(e.message)}</div>
                </div>`;
            }
        }
    }

    function renderPostWarReport(report) {
        const body = document.getElementById('wb-postwar-body');
        if (!body) return;

        const ws = report.warSummary || {};
        const fp = report.factionPerformance || {};
        const ee = report.energyEfficiency || {};
        const ph = report.positiveHighlights || {};
        const nh = report.negativeHighlights || {};
        const recs = report.recommendations || [];
        const mt = report.memberTable || [];

        function fmtNum(n) { return n != null ? Number(n).toLocaleString() : '\u2014'; }
        function fmtResp(n) { return n != null ? Number(n).toFixed(2) : '\u2014'; }

        function effClass(pct) {
            if (pct >= 120) return 'eff-green';
            if (pct >= 80) return 'eff-yellow';
            return 'eff-red';
        }

        function makeSection(title, contentHtml, collapsed) {
            const colClass = collapsed ? ' collapsed' : '';
            return `<div class="wb-postwar-section">
                <h3 class="wb-postwar-toggle${colClass}">${title}</h3>
                <div class="wb-postwar-section-body${colClass}">${contentHtml}</div>
            </div>`;
        }

        let html = '';

        // ── A. WAR SUMMARY ──
        const resultClass = ws.result === 'VICTORY' ? 'victory' : ws.result === 'DEFEAT' ? 'defeat' : 'unknown';
        let summaryContent = `
            <div style="text-align:center;">
                <span class="wb-postwar-result-badge ${resultClass}">${ws.result || 'UNKNOWN'}</span>
            </div>
            <div class="wb-postwar-score">
                <span class="our-score">${fmtNum(ws.ourScore)}</span>
                <span class="score-sep">-</span>
                <span class="enemy-score">${fmtNum(ws.enemyScore)}</span>
            </div>
            <div style="text-align:center;font-size:11px;color:var(--wb-text-muted);margin-bottom:8px;">
                ${escapeHtml(ws.ourName || 'Us')} vs ${escapeHtml(ws.enemyName || 'Enemy')}
            </div>
            <div class="wb-postwar-stat-grid">
                <span class="lbl">Our Total Hits</span><span class="val">${fmtNum(ws.totalOurHits)}</span>
                <span class="lbl">Enemy Total Hits</span><span class="val">${fmtNum(ws.totalEnemyHits)}</span>
                <span class="lbl">Total Respect Earned</span><span class="val">${fmtNum(ws.totalRespect)}</span>
                ${ws.durationFormatted ? `<span class="lbl">War Duration</span><span class="val">${escapeHtml(ws.durationFormatted)}</span>` : ''}
            </div>`;
        html += makeSection('War Summary', summaryContent, false);

        // ── B. OVERALL FACTION PERFORMANCE ──
        const effColor = fp.efficiencyRating >= 70 ? '#00b894' : fp.efficiencyRating >= 40 ? '#fdcb6e' : '#ff7675';
        let perfContent = `
            <div class="wb-postwar-stat-grid">
                <span class="lbl">Participating Members</span><span class="val">${fp.participationCount} / ${fp.totalRoster}</span>
                <span class="lbl">Participation Rate</span><span class="val" style="color:${fp.participationRate >= 70 ? '#00b894' : fp.participationRate >= 50 ? '#fdcb6e' : '#ff7675'}">${fp.participationRate}%</span>
                <span class="lbl">Avg Hits per Member</span><span class="val">${fp.avgHitsPerMember}</span>
                <span class="lbl">Avg Respect per Hit</span><span class="val">${fmtResp(fp.avgRespectPerHit)}</span>
                ${fp.avgFairFight != null ? `<span class="lbl">Avg Fair Fight</span><span class="val">${fp.avgFairFight.toFixed(2)}</span>` : ''}
                <span class="lbl">Efficiency Rating</span><span class="val" style="color:${effColor};font-size:14px;">${fp.efficiencyRating}/100</span>
            </div>`;
        html += makeSection('Overall Faction Performance', perfContent, false);

        // ── C. ENERGY EFFICIENCY ANALYSIS ──
        const barColor = ee.efficiencyPct >= 80 ? '#00b894' : ee.efficiencyPct >= 60 ? '#fdcb6e' : '#ff7675';
        let energyContent = `
            <div class="wb-postwar-stat-grid" style="margin-bottom:8px;">
                <span class="lbl">Total Estimated Energy</span><span class="val">${fmtNum(ee.totalEstimatedEnergy)}</span>
                <span class="lbl">Estimated Wasted Energy</span><span class="val" style="color:#ff7675">${fmtNum(ee.totalWastedEnergy)}</span>
                <span class="lbl">Faction Avg Respect/Hit</span><span class="val">${fmtResp(ee.factionAvgRespectPerHit)}</span>
            </div>
            <div class="wb-postwar-energy-bar">
                <div class="wb-postwar-energy-bar-fill" style="width:${ee.efficiencyPct}%;background:${barColor};"></div>
                <div class="wb-postwar-energy-bar-label">Energy Efficiency: ${ee.efficiencyPct}%</div>
            </div>`;
        if (ee.members && ee.members.filter(m => m.isBelowThreshold).length > 0) {
            energyContent += `<div style="font-size:10px;color:var(--wb-text-muted);margin-top:4px;">Members below 50% of faction avg respect/hit are flagged for energy waste.</div>`;
        }
        html += makeSection('Energy Efficiency Analysis', energyContent, false);

        // ── D. INDIVIDUAL HIGHLIGHTS: POSITIVE ──
        let posContent = '';
        if (ph.achievements && ph.achievements.length > 0) {
            posContent += `<div style="margin-bottom:8px;">${ph.achievements.map(a =>
                `<span class="wb-postwar-achievement">${escapeHtml(a.title)}: ${escapeHtml(a.name)} (${escapeHtml(a.value)})</span>`
            ).join('')}</div>`;
        }
        if (ph.topPerformers && ph.topPerformers.length > 0) {
            for (const m of ph.topPerformers) {
                posContent += `<div class="wb-postwar-card positive">
                    <div class="card-name">${escapeHtml(m.name)} <span style="font-size:10px;font-weight:400;color:var(--wb-text-muted)">Lv${m.level}</span></div>
                    <div class="card-stats">
                        <span>Hits: ${m.attacks}</span>
                        ${m.assists ? `<span>Assists: ${m.assists}</span>` : ''}
                        <span>Respect: ${fmtNum(m.respect)}</span>
                        <span>Resp/Hit: ${fmtResp(m.respectPerHit)}</span>
                        <span>Score: ${fmtNum(m.score)}</span>
                    </div>
                </div>`;
            }
        } else {
            posContent += '<div style="font-size:11px;color:var(--wb-text-muted);">No performance data available.</div>';
        }
        html += makeSection('Top Performers', posContent, false);

        // ── E. INDIVIDUAL HIGHLIGHTS: NEGATIVE ──
        let negContent = '';
        if (nh.areasToImprove && nh.areasToImprove.length > 0) {
            for (const m of nh.areasToImprove) {
                negContent += `<div class="wb-postwar-card negative">
                    <div class="card-name">${escapeHtml(m.name)} <span style="font-size:10px;font-weight:400;color:var(--wb-text-muted)">Lv${m.level}</span></div>
                    <div class="card-stats">
                        <span>Hits: ${m.attacks}</span>
                        <span>Respect: ${fmtNum(m.respect)}</span>
                        ${m.attacks > 0 ? `<span>Resp/Hit: ${fmtResp(m.respectPerHit)}</span>` : ''}
                        <span>Score: ${fmtNum(m.score)}</span>
                    </div>
                    <div style="font-size:10px;color:#fdcb6e;margin-top:3px;">${escapeHtml(m.issue)}</div>
                </div>`;
            }
        } else {
            negContent += '<div style="font-size:11px;color:var(--wb-text-muted);">No notable issues — great performance across the board!</div>';
        }
        html += makeSection('Areas to Improve', negContent, false);

        // ── F. AREAS FOR IMPROVEMENT ──
        let recContent = '';
        if (recs.length > 0) {
            for (const r of recs) {
                recContent += `<div class="wb-postwar-recommendation">
                    <div class="rec-category ${r.priority || 'medium'}">${escapeHtml(r.category)}</div>
                    <div class="rec-text">${escapeHtml(r.text)}</div>
                </div>`;
            }
        } else {
            recContent += '<div style="font-size:11px;color:var(--wb-text-muted);">No specific recommendations — solid performance overall.</div>';
        }
        html += makeSection('Recommendations', recContent, false);

        // ── G. MEMBER PERFORMANCE TABLE ──
        let tableContent = `<div class="wb-postwar-member-table-wrap">
            <table class="wb-postwar-member-table">
                <tr>
                    <th>Name</th>
                    <th style="text-align:center">Lv</th>
                    <th style="text-align:center">Hits</th>
                    <th style="text-align:right">Respect</th>
                    <th style="text-align:right">Resp/Hit</th>
                    <th style="text-align:center">Def</th>
                    <th style="text-align:right">Bled</th>
                    <th style="text-align:right">Net Score</th>
                </tr>`;
        for (const m of mt) {
            const ec = effClass(m.efficiencyPct);
            tableContent += `<tr>
                <td>${escapeHtml(m.name)}</td>
                <td style="text-align:center">${m.level}</td>
                <td style="text-align:center">${m.attacks}</td>
                <td style="text-align:right">${fmtNum(m.respect)}</td>
                <td style="text-align:right">${m.attacks > 0 ? fmtResp(m.respectPerHit) : '\u2014'}</td>
                <td style="text-align:center">${m.timesAttacked || 0}</td>
                <td style="text-align:right;color:#ff7675">${m.respectBled ? fmtResp(m.respectBled) : '\u2014'}</td>
                <td style="text-align:right;font-weight:600;color:${m.netScore < 0 ? '#ff7675' : m.netScore > 0 ? '#00b894' : 'inherit'}">${fmtResp(m.netScore)}</td>
            </tr>`;
        }
        tableContent += `</table></div>`;
        html += makeSection('Member Performance', tableContent, true);

        body.innerHTML = html;

        // Wire up collapsible sections
        body.querySelectorAll('.wb-postwar-toggle').forEach(h3 => {
            h3.addEventListener('click', () => {
                h3.classList.toggle('collapsed');
                const sectionBody = h3.nextElementSibling;
                if (sectionBody) sectionBody.classList.toggle('collapsed');
            });
        });
    }

    let toastContainer = null;

    function getToastContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'wb-toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: ${state.ui && state.ui.chainBar ? '52px' : '10px'};
                left: 50%;
                transform: translateX(-50%);
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }
        // Update position dynamically in case UI shifted
        toastContainer.style.top = state.ui && state.ui.chainBar ? '52px' : '10px';
        return toastContainer;
    }

    function showToast(message, type = 'info') {
        const container = getToastContainer();
        const toast = document.createElement('div');
        
        let bg, border, icon;
        switch (type) {
            case 'success':
                bg = 'rgba(0, 184, 148, 0.95)'; // var(--wb-call-green)
                border = '#00b894';
                icon = '✓';
                break;
            case 'warning':
                bg = 'rgba(253, 203, 110, 0.95)'; // var(--wb-idle-yellow)
                border = '#fdcb6e';
                icon = '⚠️';
                break;
            case 'error':
                bg = 'rgba(214, 48, 49, 0.95)'; // var(--wb-call-red)
                border = '#d63031';
                icon = '✕';
                break;
            case 'info':
            case 'global_toast':
            default:
                bg = 'rgba(9, 132, 227, 0.95)'; // var(--wb-accent)
                border = '#0984e3';
                icon = 'ℹ';
        }

        // Special handling for broadcasts
        if (message.startsWith('📣')) {
            icon = '📣';
            message = message.substring(1).trim();
            bg = 'rgba(108, 92, 231, 0.95)'; // Purple for broadcasts
            border = '#6c5ce7';
        }

        toast.style.cssText = `
            background: ${bg};
            border-left: 4px solid ${border};
            backdrop-filter: blur(4px);
            padding: 10px 16px 10px 12px;
            border-radius: 6px;
            font-family: 'Open Sans', Arial, sans-serif;
            font-size: 13px;
            color: ${type === 'warning' ? '#000' : '#fff'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            opacity: 0;
            transform: translateY(-15px) scale(0.95);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 200px;
            max-width: 450px;
            line-height: 1.4;
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
        `;

        toast.innerHTML = `
            <div style="font-size: 16px; display: flex; align-items: center; justify-content: center; width: 20px;">${icon}</div>
            <div style="flex: 1; word-wrap: break-word;">${message}</div>
        `;

        // Calculate duration based on text length (min 3.5s, max 10s)
        const duration = Math.min(Math.max(3500, message.length * 70), 10000);

        // Progress bar at the bottom
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: rgba(255,255,255,0.4);
            width: 100%;
            transition: width ${duration}ms linear;
        `;
        if (type === 'warning') progressBar.style.background = 'rgba(0,0,0,0.2)';
        toast.appendChild(progressBar);

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0) scale(1)';
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        });

        // Removal logic
        let removeTimeout;
        const removeToast = () => {
            clearTimeout(removeTimeout);
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-15px) scale(0.95)';
            toast.style.marginTop = `-${toast.offsetHeight}px`; // animate collapse
            setTimeout(() => toast.remove(), 300);
        };

        removeTimeout = setTimeout(removeToast, duration);
        toast.addEventListener('click', removeToast);
    }

    /**
     * Show a prominent assist request toast with an ATTACK button.
     * Stays for 15 seconds and includes a direct attack link.
     */
    function showAssistToast(playerName, targetName, attackUrl) {
        log('[ASSIST-TOAST] Firing assist toast:', playerName, targetName, attackUrl);
        const container = getToastContainer();
        const toast = document.createElement('div');

        toast.style.cssText = `
            background: rgba(214, 48, 49, 0.95);
            border-left: 4px solid #e17055;
            backdrop-filter: blur(4px);
            padding: 10px 16px 10px 12px;
            border-radius: 6px;
            font-family: 'Open Sans', Arial, sans-serif;
            font-size: 13px;
            color: #fff;
            box-shadow: 0 4px 16px rgba(214, 48, 49, 0.4);
            opacity: 0;
            transform: translateY(-15px) scale(0.95);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 280px;
            max-width: 500px;
            line-height: 1.4;
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
        `;

        const escapedPlayer = escapeHtml(playerName);
        const escapedTarget = escapeHtml(targetName);
        toast.innerHTML = `
            <div style="font-size: 18px; display: flex; align-items: center; justify-content: center; width: 24px;">⚔️</div>
            <div style="flex: 1; word-wrap: break-word;">
                <strong>${escapedPlayer}</strong> needs assist on <strong>${escapedTarget}</strong>!
            </div>
            <a href="${escapeHtml(attackUrl)}" target="_blank" rel="noopener" style="
                background: #fff;
                color: #d63031;
                font-weight: 700;
                font-size: 12px;
                padding: 6px 14px;
                border-radius: 4px;
                text-decoration: none;
                white-space: nowrap;
                flex-shrink: 0;
            ">ATK</a>
        `;

        const duration = 15000;
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: rgba(255,255,255,0.4);
            width: 100%;
            transition: width ${duration}ms linear;
        `;
        toast.appendChild(progressBar);
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0) scale(1)';
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        });

        let removeTimeout;
        const removeToast = () => {
            clearTimeout(removeTimeout);
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-15px) scale(0.95)';
            toast.style.marginTop = `-${toast.offsetHeight}px`;
            setTimeout(() => toast.remove(), 300);
        };

        removeTimeout = setTimeout(removeToast, duration);
        // Click anywhere except the ATK button to dismiss
        toast.addEventListener('click', (e) => {
            if (e.target.tagName !== 'A') removeToast();
        });
    }

    // Notifications are now driven by the polling diff logic in pollOnce() (Section 6).

    // =========================================================================
    // SECTION 23: MEMBER ACTIVITY HEATMAP
    // =========================================================================

    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    /** Fetch heatmap data from the server. Returns the heatmap object or {}. */
    async function fetchHeatmapData(factionId = null) {
        try {
            const qs = factionId ? `?factionId=${encodeURIComponent(factionId)}` : '';
            const url = `${CONFIG.SERVER_URL}/api/heatmap${qs}`;
            const res = await new Promise((resolve, reject) => {
                httpRequest({
                    method: 'GET',
                    url,
                    headers: { 'Authorization': `Bearer ${state.jwtToken}` },
                    onload(r) {
                        const d = safeParse(r.responseText);
                        if (r.status >= 200 && r.status < 300) resolve(d);
                        else reject(new Error((d && d.error) || `HTTP ${r.status}`));
                    },
                    onerror() { reject(new Error('Network error')); },
                });
            });
            return (res && res.heatmap) || {};
        } catch (e) {
            warn('Failed to fetch heatmap:', e.message);
            return {};
        }
    }

    /** Ask the server to reset heatmap data. */
    async function resetServerHeatmap(factionId = null) {
        try {
            const body = factionId ? { factionId } : {};
            await postAction('/api/heatmap/remove', body);
        } catch (e) {
            warn('Failed to reset heatmap:', e.message);
            showToast('Failed to reset heatmap: ' + e.message, 'error');
        }
    }

    /**
     * Convert server UTC heatmap data to the user's local timezone.
     * Shifts day/hour buckets by the local UTC offset.
     */
    function utcHeatmapToLocal(utcData) {
        const localData = {};
        const offsetHours = -(new Date().getTimezoneOffset() / 60); // e.g. EDT = -4 → offset = -4

        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const bucket = (utcData[d] && utcData[d][h]) || null;
                if (!bucket || bucket.samples === 0) continue;

                let localH = h + offsetHours;
                let localD = d;
                if (localH >= 24) { localH -= 24; localD = (localD + 1) % 7; }
                if (localH < 0) { localH += 24; localD = (localD + 6) % 7; }

                if (!localData[localD]) localData[localD] = {};
                if (!localData[localD][localH]) localData[localD][localH] = { total: 0, samples: 0 };
                localData[localD][localH].total += bucket.total;
                localData[localD][localH].samples += bucket.samples;
            }
        }
        return localData;
    }

    function createHeatmapButton() {
        if (document.getElementById('wb-heatmap-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'wb-heatmap-toggle';
        btn.className = 'wb-heatmap-btn';
        btn.textContent = '\uD83D\uDCCA';
        btn.title = 'Member Activity Heatmap';
        btn.style.display = 'block';
        btn.addEventListener('click', () => toggleHeatmapPanel());
        document.body.appendChild(btn);
    }

    function toggleHeatmapPanel(factionId = null, factionName = null) {
        const existing = document.getElementById('wb-heatmap-panel');
        if (existing) {
            const currentId = existing.dataset.factionId || '';
            const targetId = factionId ? String(factionId) : '';
            existing.remove();
            if (currentId === targetId) return;
        }
        renderHeatmapPanel(factionId, factionName);
    }

    async function renderHeatmapPanel(factionId = null, factionName = null) {
        const existing = document.getElementById('wb-heatmap-panel');
        if (existing) existing.remove();

        const data = await fetchHeatmapData(factionId); // Already in UTC = TCT

        // Find max average percentage for color scaling
        let maxPct = 0;
        let totalSamples = 0;
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const bucket = (data[d] && data[d][h]) || { total: 0, samples: 0, membersTotal: 0 };
                totalSamples += bucket.samples;
                if (bucket.samples > 0) {
                    // Use stored membersTotal if available, fallback to 1 to avoid div by zero
                    const membersTotal = bucket.membersTotal || 0;
                    if (membersTotal > 0) {
                        const pct = (bucket.total / membersTotal) * 100;
                        if (pct > maxPct) maxPct = pct;
                    } else {
                        // Compatibility for old data: use raw count for maxAvg (we'll handle scaling below)
                        const avg = bucket.total / bucket.samples;
                        if (avg > maxPct) maxPct = avg;
                    }
                }
            }
        }

        const panel = document.createElement('div');
        panel.id = 'wb-heatmap-panel';
        panel.className = 'wb-heatmap-panel';
        if (factionId) panel.dataset.factionId = factionId;

        // Restore saved position
        const savedPos = GM_getValue('factionops_heatmap_pos', null);
        if (savedPos) {
            try {
                const pos = typeof savedPos === 'string' ? JSON.parse(savedPos) : savedPos;
                panel.style.left = pos.left + 'px';
                panel.style.top = pos.top + 'px';
            } catch (e) { /* ignore */ }
        }

        // Header
        const header = document.createElement('div');
        header.className = 'wb-heatmap-header';
        const title = factionName ? `Activity: ${factionName}` : 'Member Activity Heatmap';
        header.innerHTML = `<span>${title} <span style="font-size:10px;opacity:0.5;">(TCT)</span></span>`;
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u00D7';
        closeBtn.className = 'wb-heatmap-close';
        closeBtn.addEventListener('click', () => panel.remove());
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // Make panel draggable by header
        let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn) return;
            isDragging = true;
            dragOffsetX = e.clientX - panel.offsetLeft;
            dragOffsetY = e.clientY - panel.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (e.clientX - dragOffsetX) + 'px';
            panel.style.top = (e.clientY - dragOffsetY) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                GM_setValue('factionops_heatmap_pos', JSON.stringify({
                    left: panel.offsetLeft,
                    top: panel.offsetTop,
                }));
            }
        });

        if (totalSamples === 0) {
            const msg = document.createElement('div');
            msg.style.cssText = 'padding:16px;font-size:12px;opacity:0.7;text-align:center;';
            msg.textContent = 'No activity data yet. The server collects data automatically when a faction API key is set.';
            panel.appendChild(msg);
            document.body.appendChild(panel);
            return;
        }

        // Grid container
        const grid = document.createElement('div');
        grid.className = 'wb-heatmap-grid';

        // Corner spacer
        const spacer = document.createElement('div');
        spacer.className = 'wb-heatmap-label';
        grid.appendChild(spacer);

        // Hour labels (every 3rd hour)
        for (let h = 0; h < 24; h++) {
            const lbl = document.createElement('div');
            lbl.className = 'wb-heatmap-label wb-heatmap-hour';
            lbl.textContent = h % 3 === 0 ? h : '';
            grid.appendChild(lbl);
        }

        // Rows
        for (let d = 0; d < 7; d++) {
            // Day label
            const dayLbl = document.createElement('div');
            dayLbl.className = 'wb-heatmap-label wb-heatmap-day';
            dayLbl.textContent = DAY_LABELS[d];
            grid.appendChild(dayLbl);

            for (let h = 0; h < 24; h++) {
                const cell = document.createElement('div');
                cell.className = 'wb-heatmap-cell';
                const bucket = (data[d] && data[d][h]) || { total: 0, samples: 0, membersTotal: 0 };
                
                const avg = bucket.samples > 0 ? bucket.total / bucket.samples : 0;
                const avgMembers = (bucket.membersTotal && bucket.samples > 0) ? bucket.membersTotal / bucket.samples : 0;
                const pct = avgMembers > 0 ? (avg / avgMembers) * 100 : 0;
                
                // Color intensity logic: scale based on percentage relative to maxPct
                // If no member data (old records), fallback to raw count intensity
                let intensity = 0;
                if (avgMembers > 0) {
                    intensity = maxPct > 0 ? pct / maxPct : 0;
                } else {
                    intensity = maxPct > 0 ? avg / maxPct : 0;
                }

                if (bucket.samples === 0) {
                    cell.style.backgroundColor = 'rgba(255,255,255,0.05)';
                } else if (intensity >= 0.95) {
                    // Top 5% peak activity - High contrast Red/Pink
                    cell.style.backgroundColor = `rgba(255, 118, 117, ${(intensity * 0.9 + 0.1).toFixed(2)})`;
                    cell.style.boxShadow = '0 0 8px rgba(255, 118, 117, 0.4)';
                    cell.style.zIndex = '1';
                } else if (intensity >= 0.8) {
                    // Very high activity - Yellow/Orange
                    cell.style.backgroundColor = `rgba(253, 203, 110, ${(intensity * 0.9 + 0.1).toFixed(2)})`;
                } else {
                    // Normal activity - Green gradient
                    cell.style.backgroundColor = `rgba(0, 184, 148, ${(intensity * 0.9 + 0.1).toFixed(2)})`;
                }
                
                let tooltip = `${DAY_LABELS[d]} ${String(h).padStart(2, '0')}:00 TCT\n`;
                tooltip += `Avg Active: ${avg.toFixed(1)}`;
                if (avgMembers > 0) {
                    tooltip += ` / ${Math.round(avgMembers)} (${pct.toFixed(1)}%)`;
                }
                tooltip += `\nTotal Samples: ${bucket.samples}`;
                
                cell.title = tooltip;
                grid.appendChild(cell);
            }
        }
        panel.appendChild(grid);

        // Legend
        const legend = document.createElement('div');
        legend.style.cssText = 'display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 10px 16px 2px; font-size: 11px; color: var(--wb-text-muted); border-top: 1px solid rgba(255,255,255,0.05); margin-top: 8px;';
        
        const p25 = (maxPct * 0.25).toFixed(0);
        const p50 = (maxPct * 0.50).toFixed(0);
        const p80 = (maxPct * 0.80).toFixed(0);
        const p95 = (maxPct * 0.95).toFixed(0);

        legend.innerHTML = `
            <div style="display:flex; align-items:center; gap:4px;">
                <div style="width:10px;height:10px;background:rgba(255,255,255,0.05);border-radius:2px;"></div>
                <span>No Data</span>
            </div>
            <div style="display:flex; align-items:center; gap:12px; margin-left: 8px;">
                <div style="display:flex; align-items:center; gap:4px;">
                    <div style="width:10px;height:10px;background:rgba(0,184,148,0.2);border-radius:2px;"></div>
                    <span>&gt;0%</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <div style="width:10px;height:10px;background:rgba(0,184,148,0.6);border-radius:2px;"></div>
                    <span>~${p25}%</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <div style="width:10px;height:10px;background:rgba(0,184,148,1.0);border-radius:2px;"></div>
                    <span>~${p50}%</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <div style="width:10px;height:10px;background:rgba(253,203,110,0.9);border-radius:2px;"></div>
                    <span>~${p80}%+</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <div style="width:10px;height:10px;background:rgba(255,118,117,1.0);box-shadow:0 0 4px rgba(255,118,117,0.5);border-radius:2px;"></div>
                    <span>Peak (${p95}%+)</span>
                </div>
            </div>
        `;
        panel.appendChild(legend);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'wb-heatmap-footer';
        footer.innerHTML = `<span style="font-size:11px;opacity:0.6;">Based on ${totalSamples} total samples</span>`;
        
        // Only show reset if viewing our own faction heatmap, or we are a leader viewing the current enemy's heatmap
        const isOwnFaction = !factionId || String(factionId) === String(state.myFactionId);
        const isCurrentEnemy = String(factionId) === String(state.enemyFactionId);
        const canReset = isLeader() && (isOwnFaction || isCurrentEnemy);
        
        const resetBtn = document.createElement('button');
        if (canReset) {
            resetBtn.className = 'wb-btn wb-btn-sm wb-btn-danger';
            resetBtn.textContent = 'Reset Data';
            resetBtn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to permanently reset this heatmap data?')) return;
                await resetServerHeatmap(factionId);
                panel.remove();
                renderHeatmapPanel(factionId, factionName);
            });
        }

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'wb-btn wb-btn-sm';
        refreshBtn.textContent = 'Refresh';
        refreshBtn.addEventListener('click', () => {
            panel.remove();
            renderHeatmapPanel(factionId, factionName);
        });
        footer.appendChild(refreshBtn);
        if (canReset) footer.appendChild(resetBtn);
        panel.appendChild(footer);

        document.body.appendChild(panel);
    }

    // =========================================================================
    // SECTION 27: MINI PROFILE CARDS (CommandCenter) — REMOVED
    // Using Torn's native profile card instead; see rebindTornProfileCards().
    // =========================================================================

    // =========================================================================
    // SECTION 26: MAIN INITIALISATION
    // =========================================================================

    async function main() {
        log('Initialising FactionOps v2.1.0');
        if (IS_PDA) log('Torn PDA detected — using PDA-managed API key');

        // 1. Inject CSS
        injectStyles();

        // 2. Apply theme
        applyTheme();

        // 3. Create settings gear (only on non-war, non-attack pages)
        const url = window.location.href;
        const isWarOrAttack = url.includes('factions.php') || url.includes('war.php') || url.includes('sid=attack');
        if (!isWarOrAttack) {
            createSettingsGear();
        }

        // 3b. Create heatmap toggle button (only on non-war, non-attack pages)
        if (!isWarOrAttack) {
            createHeatmapButton();
        }

        // 4. Set up keyboard shortcuts
        setupKeyboardShortcuts();

        // 5. Set up tab coordination
        setupTabCoordination();

        // 6. Install fetch/XHR interceptors for passive data collection
        installFetchInterceptor();
        installXHRInterceptor();

        // 7. Authenticate, start polling + Socket.IO
        if (CONFIG.API_KEY) {
            try {
                await authenticate();
                startPolling();
                connectRealtime();
            } catch (e) {
                warn('Initial auth failed:', e.message);
                if (state.jwtToken) {
                    startPolling();
                    connectRealtime();
                } else {
                    showToast('Not configured — click the gear icon to set up', 'warning');
                }
            }
        } else {
            log('No API key configured — open settings to get started');
            showToast('FactionOps: Click the gear icon to configure', 'info');
        }

        // 8. Detect page type and initialise appropriate enhancements
        detectPageAndInit();

        // 9. Start call age visual feedback loop
        requestAnimationFrame(updateCallAges);

        log('FactionOps initialised');
    }

    // =========================================================================
    // SECTION 25: HANDLE TORN NAVIGATION
    // =========================================================================

    /**
     * Torn uses hash-based navigation and AJAX page loads. We need to detect
     * when the user navigates to a different section and re-initialise.
     */
    let lastUrl = window.location.href;

    function watchNavigation() {
        // Check for URL changes periodically (hashchange + popstate don't
        // catch all of Torn's navigation patterns)
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                log('Navigation detected:', lastUrl, '->', window.location.href);
                lastUrl = window.location.href;
                onNavigate();
            }
        }, 1000);

        window.addEventListener('hashchange', () => {
            log('Hash change detected');
            onNavigate();
        });

        window.addEventListener('popstate', () => {
            log('Popstate detected');
            onNavigate();
        });
    }

    function onNavigate() {
        // Disconnect old observer
        if (observer) {
            observer.disconnect();
            observer = null;
        }

        // Remove old UI elements that are page-specific
        const chainBar = document.getElementById('wb-chain-bar');
        if (chainBar) chainBar.remove();
        state.ui.chainBar = null;
        document.body.classList.remove('wb-chain-active');

        const attackOverlay = document.getElementById('wb-attack-overlay');
        if (attackOverlay) {
            attackOverlay.remove();
            clearViewing(); // Tell server we left the attack page
        }
        const assistBtn = document.getElementById('wb-assist-btn');
        if (assistBtn) assistBtn.remove();

        // Restore Torn's chain bar to its original position before removing overlay
        restoreTornChainBar();

        // Remove FactionOps activate button and war overlay, restore hidden Torn elements
        const foBtn = document.getElementById('fo-activate-btn');
        if (foBtn) foBtn.remove();
        const foOverlay = document.getElementById('fo-overlay');
        if (foOverlay) foOverlay.remove();

        const hiddenEl = document.querySelector('[data-fo-hidden="true"]');
        if (hiddenEl) {
            hiddenEl.style.display = '';
            delete hiddenEl.dataset.foHidden;
        }

        // Cancel status timer RAF
        if (statusTimerRAF) {
            cancelAnimationFrame(statusTimerRAF);
            statusTimerRAF = null;
        }
        if (chainTimerRAF) {
            cancelAnimationFrame(chainTimerRAF);
            chainTimerRAF = null;
        }
        stopDirectChainPoll();
        stopChainDOMObserver();
        stopEnergyPoll();
        stopAttacksPoll();
        stopKeepAlive();
        if (lateChainWatcher) {
            lateChainWatcher.disconnect();
            lateChainWatcher = null;
        }
        usingChainDOM = false;

        // Re-detect page and init
        setTimeout(() => detectPageAndInit(), 500);
    }

    // =========================================================================
    // SECTION 26: STARTUP
    // =========================================================================

    // Wait for DOM to be ready (we're @run-at document-idle, but double-check)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            main();
            watchNavigation();
        });
    } else {
        main();
        watchNavigation();
    }

})();
