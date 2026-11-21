/* ============================================================
   app.js — 主逻辑：路由、弹窗、表单、PDF 导出、云端同步
   ============================================================ */
window.App = (function () {
  var currentPage = 'dashboard';
  var filterState = { search: '' };
  var rankSort = 'income';
  var toastTimer = null;

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function D() { return Views.data(); }
  function canEdit() { return Store.isOwner(); }

  /* ---------- 渲染 ---------- */
  function render() {
    Views.setData(Store.getData() || requireSeed());
    var d = D();
    document.getElementById('teamName').textContent = d.space.teamName;
    document.getElementById('teamSlogan').textContent = d.space.slogan;
    var role = Store.getRole() || 'viewer';
    var roleLabels = { owner:'👑 团长', manager:'🛡️ 管理', viewer:'👀 只读' };
    document.getElementById('roleBadge').textContent = roleLabels[role] || roleLabels.viewer;
    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.dataset.page === currentPage);
    });
    var content = document.getElementById('content');
    var html;
    switch (currentPage) {
      case 'orders': html = Views.orders(filterState); break;
      case 'deposits': html = Views.deposits(); break;
      case 'members': html = Views.members(); break;
      case 'projects': html = Views.projects(); break;
      case 'packages': html = Views.packages(); break;
      case 'ranking': html = Views.ranking(rankSort); break;
      case 'reports': html = Views.reports(); break;
      default: html = Views.dashboard();
    }
    content.innerHTML = html;
  }

  function requireSeed() {
    // 云端加载失败时的兜底空骨架
    return {
      space: { teamName: '月光女团', slogan: '月色温柔，陪伴长久' },
      roles: {}, members: [], projects: [], packages: [], orders: [], deposits: [],
      meta: {}
    };
  }

  function navigate(page) {
    currentPage = page;
    window.scrollTo(0, 0);
    render();
  }

  /* ---------- 弹窗 ---------- */
  function openModal(html) {
    var root = document.getElementById('modalRoot');
    root.innerHTML = '<div class="modal-mask" data-action="close-modal"></div>' +
      '<div class="modal">' + html + '</div>';
    root.classList.add('open');
  }
  function closeModal() {
    var root = document.getElementById('modalRoot');
    root.classList.remove('open');
    setTimeout(function () { if (!root.classList.contains('open')) root.innerHTML = ''; }, 200);
  }

  function options(list, valueKey, labelFn, selected) {
    return list.map(function (x) {
      var v = typeof valueKey === 'function' ? valueKey(x) : x[valueKey];
      return '<option value="' + escAttr(v) + '"' + (String(v)===String(selected)?' selected':'') + '>' + escHtml(labelFn(x)) + '</option>';
    }).join('');
  }
  function escHtml(s){ return Views.esc(s); }
  function escAttr(s){ return Views.esc(s); }

  /* ---------- 表单：录单 ---------- */
  function modalOrder() {
    var d = D();
    var players = (d.members||[]).filter(function (m) { return m.role === 'player' && m.status !== 'disabled'; });
    var projects = (d.projects||[]).filter(function (p) { return p.enabled !== false; });
    var customers = Object.keys(Calc.depositBalances(d));
    openModal('<h3>📝 录一笔单</h3><div class="modal-sub">选择陪玩与项目，自动计算分成</div>' +
      '<div class="form-grid">' +
        fld('单号', '<input id="fNo" value="' + genOrderNo() + '">') +
        fld('时间', '<input id="fDate" value="' + nowStr() + '">') +
      '</div>' +
      '<div class="form-grid">' +
        fld('客户', '<input id="fCustomer" list="customerList" placeholder="客户名"><datalist id="customerList">' +
          customers.map(function(c){return '<option value="'+escAttr(c)+'">';}).join('')+'</datalist>') +
        fld('陪玩', '<select id="fMember">' + options(players, 'id', function(m){return m.avatar+' '+m.name;}) + '</select>') +
      '</div>' +
      '<div class="form-grid">' +
        fld('项目', '<select id="fProject">' + options(projects, 'id', function(p){return p.name+' · ¥'+p.price;}) + '</select>') +
        fld('金额 (¥)', '<input id="fPrice" type="number" step="0.01" value="' + (projects[0]?projects[0].price:0) + '" oninput="App.updateSplit()">') +
      '</div>' +
      '<div class="form-grid">' +
        fld('陪玩分成 (%)', '<input id="fRate" type="number" step="1" value="' + Math.round((players[0]?players[0].rate:(projects[0]?projects[0].defaultRate:0.7))*100) + '" oninput="App.updateSplit()">') +
        fld('支付方式', '<select id="fPayment"><option>微信</option><option>支付宝</option><option>预存</option><option>现金</option></select>') +
      '</div>' +
      '<div id="fPrepayRow" style="display:none">' + fld('预存抵扣 (¥)', '<input id="fPrepay" type="number" step="0.01" value="0" oninput="App.updateSplit()">') + '</div>' +
      fld('备注', '<textarea id="fNote" placeholder="可选"></textarea>') +
      '<div class="calc-preview" id="calcPreview"></div>' +
      '<div class="modal-actions"><button class="btn-ghost" data-action="close-modal">取消</button>' +
        '<button class="btn-primary" data-action="save-order">确认录入</button></div>');
    document.getElementById('fPayment').addEventListener('change', function () {
      document.getElementById('fPrepayRow').style.display = this.value === '预存' ? 'block' : 'none';
      App.updateSplit();
    });
    App.updateSplit();
  }

  function genOrderNo() { return 'ML' + new Date().toISOString().slice(0,10).replace(/-/g,'') + String(Math.floor(Math.random()*900)+100); }
  function nowStr() {
    var d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+
      ' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
  function fld(label, control) { return '<div class="form-row"><label>' + label + '</label>' + control + '</div>'; }

  function updateSplit() {
    var el = function(id){ return document.getElementById(id); };
    if (!el('fPrice') || !el('fRate')) return;
    var price = parseFloat(el('fPrice').value) || 0;
    var rate = (parseFloat(el('fRate').value) || 0) / 100;
    var member = Math.round(price*rate*100)/100;
    var fee = Math.round((price-member)*100)/100;
    var prepay = el('fPayment').value === '预存' ? (parseFloat(el('fPrepay').value)||0) : 0;
    var html = '<div class="line"><span>订单金额</span><b>' + Calc.money(price) + '</b></div>' +
      '<div class="line"><span>陪玩分成 (' + Math.round(rate*100) + '%)</span><b style="color:var(--green)">' + Calc.money(member) + '</b></div>' +
      '<div class="line"><span>团队抽成</span><b style="color:var(--pink)">' + Calc.money(fee) + '</b></div>';
    if (prepay) html += '<div class="line"><span>预存抵扣</span><b>' + Calc.money(prepay) + '</b></div>';
    html += '<div class="line total"><span>实收 / 需结算</span><span>' + Calc.money(prepay ? price-prepay : price) + ' / ' + Calc.money(member) + '</span></div>';
    document.getElementById('calcPreview').innerHTML = html;
  }

  function saveOrder() {
    var d = D();
    var price = parseFloat(document.getElementById('fPrice').value)||0;
    var rate = (parseFloat(document.getElementById('fRate').value)||0)/100;
    var order = {
      id: uid('o'),
      orderNo: document.getElementById('fNo').value.trim() || genOrderNo(),
      date: document.getElementById('fDate').value.trim() || nowStr(),
      customer: document.getElementById('fCustomer').value.trim() || '散客',
      projectId: document.getElementById('fProject').value,
      price: price,
      memberId: document.getElementById('fMember').value,
      rate: rate,
      memberIncome: Math.round(price*rate*100)/100,
      teamFee: Math.round((price-price*rate)*100)/100,
      payment: document.getElementById('fPayment').value,
      prepayUsed: document.getElementById('fPayment').value==='预存' ? (parseFloat(document.getElementById('fPrepay').value)||0) : 0,
      note: document.getElementById('fNote').value.trim(),
      status: 'done'
    };
    d.orders.push(order);
    commit(d, '订单已录入');
  }

  /* ---------- 表单：预存 ---------- */
  function modalDeposit() {
    var d = D();
    var pkgs = d.packages||[];
    openModal('<h3>💰 记预存</h3><div class="modal-sub">老板充值，选择套餐自动算赠送</div>' +
      '<div class="form-grid">' +
        fld('客户', '<input id="dCustomer" placeholder="客户名">') +
        fld('时间', '<input id="dDate" value="' + nowStr() + '">') +
      '</div>' +
      fld('套餐', '<select id="dPackage" onchange="App.updateDeposit()">' + options(pkgs,'id',function(p){return p.name+' · ¥'+p.amount+' 送'+p.bonus;}) + '</select>') +
      '<div class="form-grid">' +
        fld('充值本金 (¥)', '<input id="dAmount" type="number" step="0.01" value="' + (pkgs[0]?pkgs[0].amount:0) + '" oninput="App.updateDeposit()">') +
        fld('赠送 (¥)', '<input id="dBonus" type="number" step="0.01" value="' + (pkgs[0]?pkgs[0].bonus:0) + '" oninput="App.updateDeposit()">') +
      '</div>' +
      fld('备注', '<textarea id="dNote" placeholder="可选"></textarea>') +
      '<div class="calc-preview"><div class="line"><span>到账总额</span><b class="total" id="dTotal">' + Calc.money((pkgs[0]?pkgs[0].amount:0)+(pkgs[0]?pkgs[0].bonus:0)) + '</b></div></div>' +
      '<div class="modal-actions"><button class="btn-ghost" data-action="close-modal">取消</button>' +
        '<button class="btn-primary" data-action="save-deposit">确认入账</button></div>');
  }
  function updateDeposit() {
    var a = parseFloat(document.getElementById('dAmount').value)||0;
    var b = parseFloat(document.getElementById('dBonus').value)||0;
    document.getElementById('dTotal').textContent = Calc.money(a+b);
  }
  function saveDeposit() {
    var d = D();
    var pkgId = document.getElementById('dPackage').value;
    d.deposits.push({
      id: uid('d'),
      date: document.getElementById('dDate').value.trim() || nowStr(),
      customer: document.getElementById('dCustomer').value.trim() || '散客',
      packageId: pkgId,
      amount: parseFloat(document.getElementById('dAmount').value)||0,
      bonus: parseFloat(document.getElementById('dBonus').value)||0,
      note: document.getElementById('dNote').value.trim()
    });
    commit(d, '预存已入账');
  }

  /* ---------- 通用实体表单 ---------- */
  function modalEntity(type, id) {
    var d = D();
    var cfg = {
      member: { title:'成员', list:d.members, fields:[
        {k:'name',l:'姓名'},{k:'avatar',l:'头像 emoji'},
        {k:'role',l:'角色',type:'select',opts:[['owner','团长'],['manager','管理'],['player','陪玩']]},
        {k:'rate',l:'分成比例 (%)',type:'rate'},
        {k:'upline',l:'直属上级',type:'upline'},
        {k:'phone',l:'电话'}
      ]},
      project: { title:'项目', list:d.projects, fields:[
        {k:'name',l:'项目名称'},{k:'category',l:'分类'},{k:'price',l:'单价 (¥)',type:'num'},
        {k:'defaultRate',l:'默认分成 (%)',type:'rate'}
      ]},
      package: { title:'套餐', list:d.packages, fields:[
        {k:'name',l:'套餐名'},{k:'amount',l:'充值金额 (¥)',type:'num'},{k:'bonus',l:'赠送 (¥)',type:'num'},
        {k:'validity',l:'有效期'},{k:'desc',l:'描述'}
      ]}
    }[type];
    var item = id ? cfg.list.find(function(x){return x.id===id;}) : null;
    var body = '';
    cfg.fields.forEach(function (f) {
      var val = item ? item[f.k] : '';
      var ctrl;
      if (f.type === 'select') {
        ctrl = '<select id="e_'+f.k+'">' + f.opts.map(function(o){
          return '<option value="'+o[0]+'"'+(String(val)===o[0]?' selected':'')+'>'+o[1]+'</option>';
        }).join('') + '</select>';
      } else if (f.type === 'upline') {
        var others = (d.members||[]).filter(function(m){return m.id!==id;});
        ctrl = '<select id="e_'+f.k+'"><option value="">无</option>' + others.map(function(m){
          return '<option value="'+m.id+'"'+(val===m.id?' selected':'')+'>'+escHtml(m.name)+'</option>';
        }).join('') + '</select>';
      } else if (f.type === 'rate') {
        ctrl = '<input id="e_'+f.k+'" type="number" step="1" value="' + Math.round((val||0)*100) + '">';
      } else if (f.type === 'num') {
        ctrl = '<input id="e_'+f.k+'" type="number" step="0.01" value="' + (val||0) + '">';
      } else {
        ctrl = '<input id="e_'+f.k+'" value="' + escAttr(val||'') + '">';
      }
      body += fld(f.l, ctrl);
    });
    openModal('<h3>' + (item?'编辑':'新增') + cfg.title + '</h3><div class="modal-sub">带 * 为分成/金额字段</div>' + body +
      '<div class="modal-actions"><button class="btn-ghost" data-action="close-modal">取消</button>' +
        '<button class="btn-primary" data-action="save-entity" data-type="'+type+'" data-id="'+(id||'')+'">保存</button></div>');
  }

  function saveEntity(type, id) {
    var d = D();
    var list = d.members;
    if (type==='project') list = d.projects;
    if (type==='package') list = d.packages;
    var item = id ? list.find(function(x){return x.id===id;}) : null;
    if (!item) { item = { id: uid(type[0]) }; list.push(item); }
    var val = function(k){ var e=document.getElementById('e_'+k); return e?e.value:''; };
    if (type==='member') {
      item.name=val('name'); item.avatar=val('avatar')||'🌟'; item.role=val('role');
      item.rate=(parseFloat(val('rate'))||0)/100; item.upline=val('upline');
      item.phone=val('phone'); item.status=item.status||'active'; item.joinDate=item.joinDate||new Date().toISOString().slice(0,10);
    } else if (type==='project') {
      item.name=val('name'); item.category=val('category')||'其他';
      item.price=parseFloat(val('price'))||0; item.defaultRate=(parseFloat(val('defaultRate'))||0)/100; item.enabled=item.enabled!==false;
    } else if (type==='package') {
      item.name=val('name'); item.amount=parseFloat(val('amount'))||0;
      item.bonus=parseFloat(val('bonus'))||0; item.validity=val('validity')||'长期'; item.desc=val('desc')||'';
    }
    commit(d, (id?'已更新':'已添加') + ({member:'成员',project:'项目',package:'套餐'}[type]));
  }

  /* ---------- 提交到云端 ---------- */
  async function commit(d, msg) {
    d.meta = d.meta || {};
    d.meta.revision = (d.meta.revision||0)+1;
    d.meta.updatedAt = nowStr();
    d.meta.updatedBy = Store.getRole()==='owner' ? '团长' : '管理';
    Store.setData(d);
    render();
    closeModal();
    if (Store.isOwner()) {
      try { await Cloud.save(d); toast(msg+' · 已同步云端'); }
      catch (e) { toast(msg+' · 云端保存失败：'+e.message); }
    } else {
      toast(msg+'（只读模式，改动未保存）');
    }
  }

  /* ---------- 分享 ---------- */
  function openShare() {
    var url = Cloud.getShareUrl();
    openModal('<h3>📋 邀请朋友一起用</h3><div class="modal-sub">把链接发给朋友，他们打开即可查看账本</div>' +
      '<div class="form-row"><label>共享链接（朋友打开只读）</label>' +
        '<input id="shareUrl" value="' + escAttr(url) + '" readonly onclick="this.select()"></div>' +
      '<button class="btn-primary full" data-action="copy-share">📋 复制链接</button>' +
      '<div class="calc-preview" style="margin-top:16px"><div class="line"><span>权限说明</span></div>' +
        '<div class="line"><span>👀 朋友/陪玩</span><b>只读</b></div>' +
        '<div class="line"><span>👑 团长</span><b>全权写入</b></div>' +
        '<div class="line"><span>云端账本</span><b>GitHub Gist</b></div></div>' +
      '<div class="modal-actions"><button class="btn-ghost" data-action="close-modal">关闭</button></div>');
  }
  function copyShare() {
    var input = document.getElementById('shareUrl');
    input.select();
    try { document.execCommand('copy'); toast('链接已复制，发给朋友吧～'); }
    catch (e) { toast('请手动复制链接'); }
  }

  /* ---------- 设置 ---------- */
  function openSettings() {
    openModal('<h3>⚙️ 设置</h3><div class="modal-sub">连接身份与云端账本</div>' +
      '<div class="calc-preview"><div class="line"><span>当前身份</span><b>' + (Store.getRole()||'未设置') + '</b></div>' +
        '<div class="line"><span>账本 Gist</span><b>' + Cloud.getGistId().slice(0,12) + '…</b></div></div>' +
      '<div class="form-row" style="margin-top:16px"><label>切换身份（需重新加载）</label>' +
        '<select id="setRole"><option value="viewer"'+(Store.getRole()==='viewer'?' selected':'')+'>👀 只读（陪玩/朋友）</option>' +
        '<option value="owner"'+(Store.getRole()==='owner'?' selected':'')+'>👑 团长（全权）</option></select></div>' +
      (Store.isOwner() ? '<div class="form-row"><label>GitHub Token（团长写入用）</label>' +
        '<input type="password" id="setToken" value="' + escAttr(Store.getToken()) + '" placeholder="ghp_..."></div>' : '') +
      '<div class="modal-actions"><button class="btn-ghost" data-action="close-modal">取消</button>' +
        '<button class="btn-primary" data-action="save-settings">保存并刷新</button></div>');
  }
  function saveSettings() {
    var role = document.getElementById('setRole').value;
    Store.setRole(role);
    if (role==='owner') {
      var t = document.getElementById('setToken');
      if (t && t.value.trim()) Store.setToken(t.value.trim());
    }
    closeModal();
    toast('设置已保存，正在刷新…');
    setTimeout(function(){ location.reload(); }, 600);
  }

  /* ---------- 首次引导 ---------- */
  function showOnboard() {
    document.getElementById('onboard').style.display = 'flex';
  }
  function enterAsViewer() {
    Store.setRole('viewer');
    document.getElementById('onboard').style.display = 'none';
    bootstrap();
  }
  async function enterAsOwner() {
    var token = document.getElementById('tokenInput').value.trim();
    if (!token) { toast('请先填入 GitHub token'); return; }
    toast('正在验证令牌…');
    var ok = await Cloud.verifyToken(token);
    if (!ok) { toast('令牌无效，请检查后重试'); return; }
    Store.setToken(token); Store.setRole('owner');
    document.getElementById('onboard').style.display = 'none';
    bootstrap();
  }

  /* ---------- PDF 导出 ---------- */
  async function exportPDF(type) {
    toast('正在生成 PDF…');
    var d = D();
    var title = { monthly:'月度收支汇总', ranking:'陪玩排名明细', deposits:'预存明细', orders:'全部订单流水' }[type];
    var inner = '';
    if (type==='monthly') {
      var rows = Calc.monthly(d).map(function(m){
        return '<tr><td>'+m.month+'</td><td>'+m.count+'</td><td>'+Calc.money(m.income)+'</td><td>'+Calc.money(m.fee)+'</td><td>'+Calc.money(m.player)+'</td></tr>';
      }).join('');
      inner = '<table><thead><tr><th>月份</th><th>订单数</th><th>总收入</th><th>团队抽成</th><th>陪玩分成</th></tr></thead><tbody>'+rows+'</tbody></table>';
    } else if (type==='ranking') {
      var rows = Calc.ranking(d).map(function(r){
        return '<tr><td>'+r.rank+'</td><td>'+Views.esc(r.name)+'</td><td>'+r.count+'</td><td>'+Calc.money(r.income)+'</td><td>'+Calc.money(r.fee)+'</td></tr>';
      }).join('');
      inner = '<table><thead><tr><th>排名</th><th>陪玩</th><th>接单数</th><th>分成收入</th><th>团队贡献</th></tr></thead><tbody>'+rows+'</tbody></table>';
    } else if (type==='deposits') {
      var rows = Calc.depositBalances(d).map(function(b){
        return '<tr><td>'+Views.esc(b.customer)+'</td><td>'+Calc.money(b.deposit)+'</td><td>'+Calc.money(b.bonus)+'</td><td>'+Calc.money(b.used)+'</td><td>'+Calc.money(b.balance)+'</td></tr>';
      }).join('');
      inner = '<table><thead><tr><th>客户</th><th>充值本金</th><th>赠送</th><th>已消费</th><th>余额</th></tr></thead><tbody>'+rows+'</tbody></table>';
    } else {
      var rows = (d.orders||[]).slice().reverse().map(function(o){
        var m=(d.members||[]).find(function(x){return x.id===o.memberId;});
        var p=(d.projects||[]).find(function(x){return x.id===o.projectId;});
        return '<tr><td>'+Views.esc(o.orderNo)+'</td><td>'+Views.esc(o.date)+'</td><td>'+Views.esc(o.customer)+'</td><td>'+Views.esc(p?p.name:'-')+'</td><td>'+Views.esc(m?m.name:'-')+'</td><td>'+Calc.money(o.price)+'</td><td>'+Calc.money(o.memberIncome)+'</td><td>'+Calc.money(o.teamFee)+'</td></tr>';
      }).join('');
      inner = '<table style="font-size:11px"><thead><tr><th>单号</th><th>时间</th><th>客户</th><th>项目</th><th>陪玩</th><th>金额</th><th>分成</th><th>抽成</th></tr></thead><tbody>'+rows+'</tbody></table>';
    }
    var stage = document.createElement('div');
    stage.className = 'pdf-stage';
    stage.innerHTML = '<div class="report-sheet"><h2>🌙 ' + Views.esc(d.space.teamName) + ' · ' + title + '</h2>' +
      '<div class="report-meta">生成时间：' + nowStr() + ' · 共 ' + (d.orders||[]).length + ' 笔订单</div>' + inner + '</div>';
    document.body.appendChild(stage);
    try {
      var canvas = await html2canvas(stage.querySelector('.report-sheet'), { scale: 2, backgroundColor:'#ffffff' });
      var img = canvas.toDataURL('image/png');
      var pdf = new jspdf.jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      var pw = 190, ph = canvas.height * pw / canvas.width;
      var pageH = 277;
      var pos = 0;
      pdf.addImage(img, 'PNG', 10, 10, pw, ph);
      var fullH = ph;
      while (pos + pageH < fullH) {
        pos += pageH;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 10, 10 - pos, pw, ph);
      }
      pdf.save('月光女团_' + title + '_' + new Date().toISOString().slice(0,10) + '.pdf');
      toast('PDF 已导出 🎉');
    } catch (e) {
      toast('导出失败：' + e.message);
    } finally {
      document.body.removeChild(stage);
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    document.getElementById('sidebar').addEventListener('click', function (e) {
      var nav = e.target.closest('[data-page]');
      if (nav) { navigate(nav.dataset.page); return; }
    });
    document.getElementById('content').addEventListener('click', function (e) {
      var t = e.target.closest('[data-page]');
      if (t) { if (t.dataset.sort) rankSort=t.dataset.sort; navigate(t.dataset.page); }
    });
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var a = el.dataset.action, id = el.dataset.id;
      if (a==='close-modal') return closeModal();
      if (a==='new-order') return modalOrder();
      if (a==='new-deposit') return modalDeposit();
      if (a==='search-orders') { filterState.search = document.getElementById('orderSearch').value.trim(); return render(); }
      if (a==='save-order') return saveOrder();
      if (a==='save-deposit') return saveDeposit();
      if (a==='update-split') return updateSplit();
      if (a==='new-member') return modalEntity('member');
      if (a==='edit-member') return modalEntity('member', id);
      if (a==='new-project') return modalEntity('project');
      if (a==='edit-project') return modalEntity('project', id);
      if (a==='new-package') return modalEntity('package');
      if (a==='edit-package') return modalEntity('package', id);
      if (a==='save-entity') return saveEntity(el.dataset.type, id);
      if (a==='del-order') { if(confirm('确定删除这笔订单？')){var d=D();d.orders=d.orders.filter(function(x){return x.id!==id;});commit(d,'订单已删除');} return; }
      if (a==='del-deposit') { if(confirm('确定删除这条预存记录？')){var d=D();d.deposits=d.deposits.filter(function(x){return x.id!==id;});commit(d,'预存记录已删除');} return; }
      if (a==='del-member') { if(confirm('确定删除该成员？其订单将保留但不再计入排名。')){var d=D();d.members=d.members.filter(function(x){return x.id!==id;});commit(d,'成员已删除');} return; }
      if (a==='del-project') { if(confirm('确定删除该项目？')){var d=D();d.projects=d.projects.filter(function(x){return x.id!==id;});commit(d,'项目已删除');} return; }
      if (a==='del-package') { if(confirm('确定删除该套餐？')){var d=D();d.packages=d.packages.filter(function(x){return x.id!==id;});commit(d,'套餐已删除');} return; }
      if (a==='export') return exportPDF(el.dataset.type);
      if (a==='copy-share') return copyShare();
      if (a==='save-settings') return saveSettings();
    });
    document.getElementById('orderSearch') && null;
    document.getElementById('btnSettings').addEventListener('click', openSettings);
    var ob = document.querySelectorAll('.onboard-tab');
    ob.forEach(function(b){ b.addEventListener('click', function(){
      ob.forEach(function(x){x.classList.remove('on');}); b.classList.add('on');
      var r = b.dataset.role;
      document.getElementById('onboardViewer').style.display = r==='viewer'?'block':'none';
      document.getElementById('onboardOwner').style.display = r==='owner'?'block':'none';
    });});
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });
  }

  /* ---------- 初始化 ---------- */
  async function bootstrap() {
    try {
      await Cloud.load();
    } catch (e) {
      // 加载失败，用本地缓存继续
    }
    render();
  }

  function init() {
    bind();
    var role = Store.getRole();
    if (!role) { showOnboard(); return; }
    bootstrap();
  }

  return {
    init: init, toast: toast, updateSplit: updateSplit, updateDeposit: updateDeposit,
    openSettings: openSettings, openShare: openShare,
    enterAsViewer: enterAsViewer, enterAsOwner: enterAsOwner
  };
})();
document.addEventListener('DOMContentLoaded', App.init);
