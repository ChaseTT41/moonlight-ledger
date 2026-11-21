/* ============================================================
   cloud.js — GitHub Gist 云端读写（只读用 API GET，写入用 token PATCH）
   ============================================================ */
window.Cloud = (function () {
  var GIST_ID = Store.getGistId();
  var API = 'https://api.github.com/gists/' + GIST_ID;
  var FILENAME = 'ledger-seed.json';

  function setStatus(state, text) {
    var el = document.getElementById('syncStatus');
    if (!el) return;
    el.className = 'sync-status ' + state;
    el.querySelector('.txt').textContent = text;
  }

  /* 读取账本（任何人可读，无需 token） */
  async function load() {
    setStatus('', '同步中');
    try {
      var res = await fetch(API, { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var gist = await res.json();
      var file = gist.files && gist.files[FILENAME];
      if (!file) throw new Error('账本文件不存在');
      var raw = file.content || '';
      var payload = JSON.parse(raw);
      var data = payload.data || payload;
      Store.setData(data);
      setStatus('online', '已同步');
      return data;
    } catch (e) {
      setStatus('error', '读取失败');
      var cached = Store.getData();
      if (cached) { setStatus('offline', '离线缓存'); return cached; }
      throw e;
    }
  }

  /* 写入账本（需要团长 token） */
  async function save(data) {
    var token = Store.getToken();
    if (!token) throw new Error('需要团长令牌才能保存');
    setStatus('', '保存中');
    var payload = { name: '月光女团账本', data: data };
    var body = {
      description: '月光女团账本 - 云端共享',
      files: {}
    };
    body.files[FILENAME] = { content: JSON.stringify(payload, null, 2) };
    try {
      var res = await fetch(API, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.message || ('HTTP ' + res.status));
      }
      Store.setData(data);
      setStatus('online', '已保存');
      return true;
    } catch (e) {
      setStatus('error', '保存失败');
      throw e;
    }
  }

  /* 验证 token 是否有效 */
  async function verifyToken(token) {
    try {
      var res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
      });
      return res.ok;
    } catch (e) { return false; }
  }

  return {
    load: load, save: save, verifyToken: verifyToken,
    getGistId: function(){ return GIST_ID; },
    setGistId: function(id){ GIST_ID = id; Store.setGistId(id); },
    getShareUrl: function () {
      return location.origin + location.pathname;
    },
    getGistUrl: function () { return 'https://gist.github.com/' + GIST_ID; }
  };
})();
