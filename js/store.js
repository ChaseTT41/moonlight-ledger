/* ============================================================
   store.js — 本地缓存与默认数据
   ============================================================ */
window.Store = (function () {
  var KEY = 'moonlight_ledger_v1';
  var ROLE_KEY = 'moonlight_role';
  var TOKEN_KEY = 'moonlight_token';
  var GIST_KEY = 'moonlight_gist_id';

  function read(k, f) {
    try { var v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); }
    catch (e) { return f; }
  }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  return {
    getData: function () { return read(KEY, null); },
    setData: function (d) { write(KEY, d); },
    getRole: function () { return read(ROLE_KEY, null); },
    setRole: function (r) { write(ROLE_KEY, r); },
    getToken: function () { return read(TOKEN_KEY, ''); },
    setToken: function (t) { write(TOKEN_KEY, t); },
    getGistId: function () { return read(GIST_KEY, '98d61f490d6eb21af55262abf76a6099'); },
    setGistId: function (id) { write(GIST_KEY, id); },
    isOwner: function () { return this.getRole() === 'owner'; },
    clearSession: function () {
      [KEY, ROLE_KEY, TOKEN_KEY].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    }
  };
})();
