/* ============================================================
   views.js — 各页面 HTML 渲染
   ============================================================ */
window.Views = (function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var D = null;
  function setData(d) { D = d; }
  function data() { return D; }

  /* ---------- 总览 ---------- */
  function dashboard() {
    var s = Calc.overview(D);
    var recent = (D.orders || []).slice(0, 6).map(function (o) {
      var m = (D.members || []).find(function (x) { return x.id === o.memberId; });
      var p = (D.projects || []).find(function (x) { return x.id === o.projectId; });
      return '<div class="recent-item"><div class="recent-ic">📝</div>' +
        '<div class="recent-main"><b>' + esc(p ? p.name : '项目') + ' · ' + esc(o.customer) + '</b>' +
        '<p>' + esc(m ? m.name : '') + ' · ' + esc(o.date) + ' · ' + esc(o.payment) + '</p></div>' +
        '<div class="recent-amt">' + Calc.money(o.price) + '</div></div>';
    }).join('');

    var ownerActions = Store.isOwner() ?
      '<div class="quick-actions">' +
        '<div class="quick-card" data-action="new-order"><div class="ic">📝</div><b>录一笔单</b><p>登记新订单</p></div>' +
        '<div class="quick-card" data-action="new-deposit"><div class="ic">💰</div><b>记预存</b><p>老板充值</p></div>' +
        '<div class="quick-card" data-page="members"><div class="ic">👥</div><b>人员管理</b><p>成员与分成</p></div>' +
        '<div class="quick-card" data-page="reports"><div class="ic">📄</div><b>导出报表</b><p>PDF 对账</p></div>' +
      '</div>' : '';

    return '<div class="page-head"><div><h2>总览</h2><div class="sub">月光女团经营数据一览 · ' + esc(D.space.slogan) + '</div></div></div>' +
      ownerActions +
      '<div class="stats-grid">' +
        statCard('moon', '累计流水', Calc.money(s.totalIncome), s.orderCount + ' 笔订单', '💎') +
        statCard('green', '团队抽成', Calc.money(s.totalFee), '团收入', '🏦') +
        statCard('pink', '陪玩分成', Calc.money(s.totalPlayer), '已结算', '🎀') +
        statCard('gold', '预存本金', Calc.money(s.totalDeposit), '已消耗 ' + Calc.money(s.prepayUsed), '💰') +
      '</div>' +
      '<div class="split-note"><span>💡</span><div>本月流水 <b>' + Calc.money(s.monthIncome) + '</b>（' + s.monthCount + ' 笔）。分成规则：订单金额 × 陪玩分成比例 = 陪玩收入，余额归团队。每单比例可在录单时自定义。</div></div>' +
      '<div class="card"><h3>📋 最近订单</h3><div class="recent-list">' +
        (recent || '<div class="empty"><div class="ic">📭</div><p>还没有订单，点击「录一笔单」开始吧</p></div>') +
      '</div></div>';
  }

  function statCard(cls, label, value, delta, ic) {
    return '<div class="stat-card ' + cls + '"><div class="bg-ic">' + ic + '</div>' +
      '<div class="label">' + label + '</div><div class="value">' + value + '</div>' +
      '<div class="delta">' + delta + '</div></div>';
  }

  /* ---------- 订单 ---------- */
  function orders(filter) {
    var list = (D.orders || []).slice().sort(function (a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });
    var search = (filter && filter.search || '').toLowerCase();
    if (search) list = list.filter(function (o) {
      return [o.orderNo, o.customer, (D.members.find(function(m){return m.id===o.memberId;})||{}).name]
        .join(' ').toLowerCase().indexOf(search) !== -1;
    });
    var canEdit = Store.isOwner();
    var rows = list.map(function (o) {
      var m = (D.members || []).find(function (x) { return x.id === o.memberId; });
      var p = (D.projects || []).find(function (x) { return x.id === o.projectId; });
      return '<tr><td><b>' + esc(o.orderNo) + '</b><br><span style="font-size:10px;color:var(--ink2)">' + esc(o.date) + '</span></td>' +
        '<td>' + esc(o.customer) + '</td>' +
        '<td>' + esc(p ? p.name : '-') + '</td>' +
        '<td>' + esc(m ? (m.avatar + ' ' + m.name) : '-') + '</td>' +
        '<td class="num">' + esc(o.price) + '</td>' +
        '<td class="num">' + Math.round((o.rate || 0) * 100) + '%</td>' +
        '<td class="num amount-in">' + Calc.money(o.memberIncome) + '</td>' +
        '<td class="num">' + Calc.money(o.teamFee) + '</td>' +
        '<td><span class="badge ' + (o.payment==='预存'?'active':'owner') + '">' + esc(o.payment) + '</span></td>' +
        (canEdit ? '<td><button class="btn-danger btn-sm" data-action="del-order" data-id="' + o.id + '">删</button></td>' : '') +
        '</tr>';
    }).join('');

    return '<div class="page-head"><div><h2>录单 / 订单</h2><div class="sub">每笔订单自动计算分成 · 共 ' + list.length + ' 笔</div></div>' +
      (canEdit ? '<button class="btn-primary" data-action="new-order">＋ 录一笔单</button>' : '') + '</div>' +
      '<div class="filter-bar">' +
        '<input id="orderSearch" placeholder="🔍 搜索单号 / 客户 / 陪玩" value="' + esc(filter && filter.search || '') + '" style="width:240px">' +
        '<button class="btn-ghost" data-action="search-orders">搜索</button>' +
        '<div class="spacer"></div>' +
        '<span style="font-size:12px;color:var(--ink2)">陪玩分成自动核算</span>' +
      '</div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr>' +
        '<th>单号 / 时间</th><th>客户</th><th>项目</th><th>陪玩</th><th>金额</th><th>分成比</th><th>陪玩收入</th><th>团队抽成</th><th>支付</th>' +
        (canEdit ? '<th>操作</th>' : '') +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="10"><div class="empty"><p>暂无订单</p></div></td></tr>') + '</tbody></table></div></div>';
  }

  /* ---------- 预存 ---------- */
  function deposits() {
    var list = (D.deposits || []).slice().sort(function (a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });
    var balances = Calc.depositBalances(D);
    var canEdit = Store.isOwner();
    var rows = list.map(function (x) {
      var pkg = (D.packages || []).find(function (p) { return p.id === x.packageId; });
      return '<tr><td>' + esc(x.date) + '</td><td><b>' + esc(x.customer) + '</b></td>' +
        '<td>' + esc(pkg ? pkg.name : '-') + '</td>' +
        '<td class="num amount-in">' + Calc.money(x.amount) + '</td>' +
        '<td class="num">' + Calc.money(x.bonus) + '</td>' +
        '<td class="num">' + Calc.money((Number(x.amount)||0)+(Number(x.bonus)||0)) + '</td>' +
        (canEdit ? '<td><button class="btn-danger btn-sm" data-action="del-deposit" data-id="' + x.id + '">删</button></td>' : '') +
        '</tr>';
    }).join('');
    var balRows = balances.map(function (b) {
      return '<tr><td><b>' + esc(b.customer) + '</b></td><td class="num">' + Calc.money(b.deposit) + '</td>' +
        '<td class="num">' + Calc.money(b.bonus) + '</td>' +
        '<td class="num amount-out">' + Calc.money(b.used) + '</td>' +
        '<td class="num amount-in">' + Calc.money(b.balance) + '</td></tr>';
    }).join('');

    return '<div class="page-head"><div><h2>预存管理</h2><div class="sub">预存套餐、赠送余额与消费明细</div></div>' +
      (canEdit ? '<button class="btn-primary" data-action="new-deposit">＋ 记预存</button>' : '') + '</div>' +
      '<div class="stats-grid">' +
        statCard('gold', '预存本金', Calc.money(Calc.overview(D).totalDeposit), '累计充值', '💰') +
        statCard('green', '赠送总额', Calc.money((D.deposits||[]).reduce(function(s,x){return s+(Number(x.bonus)||0);},0)), '优惠', '🎁') +
        statCard('pink', '已消耗', Calc.money(Calc.overview(D).prepayUsed), '预存抵扣', '📉') +
        statCard('moon', '预存客户', balances.length + ' 位', '活跃老板', '👤') +
      '</div>' +
      '<div class="card"><h3>💳 客户余额</h3><div class="table-wrap"><table><thead><tr>' +
        '<th>客户</th><th>充值本金</th><th>赠送</th><th>已消费</th><th>当前余额</th>' +
      '</tr></thead><tbody>' + (balRows || '<tr><td colspan="5"><div class="empty"><p>暂无预存客户</p></div></td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><h3>🧾 预存流水</h3><div class="table-wrap"><table><thead><tr>' +
        '<th>时间</th><th>客户</th><th>套餐</th><th>本金</th><th>赠送</th><th>到账</th>' +
        (canEdit ? '<th>操作</th>' : '') +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="7"><div class="empty"><p>暂无预存记录</p></div></td></tr>') + '</tbody></table></div></div>';
  }

  /* ---------- 人员 ---------- */
  function members() {
    var canEdit = Store.isOwner();
    var upline = Calc.uplineStats(D);
    var cards = (D.members || []).map(function (m) {
      var role = (D.roles || {})[m.role] || { label: m.role };
      var down = upline.find(function (u) { return u.id === m.id; });
      return '<div class="member-card"><div class="head"><div class="ava">' + esc(m.avatar) + '</div>' +
        '<div><b>' + esc(m.name) + '</b><br><span class="badge ' + m.role + '">' + role.label + '</span></div></div>' +
        '<div class="info-row"><span>分成比例</span><b>' + (m.role==='player' ? (m.rate*100)+'%' : '—') + '</b></div>' +
        '<div class="info-row"><span>直属上级</span><b>' + esc((D.members.find(function(x){return x.id===m.upline;})||{}).name || '—') + '</b></div>' +
        '<div class="info-row"><span>直属下级</span><b>' + (down ? down.downCount + ' 人' : '0 人') + '</b></div>' +
        '<div class="info-row"><span>入职日期</span><b>' + esc(m.joinDate) + '</b></div>' +
        (canEdit ? '<div class="actions"><button class="btn-ghost btn-sm" data-action="edit-member" data-id="' + m.id + '">编辑</button>' +
          '<button class="btn-danger btn-sm" data-action="del-member" data-id="' + m.id + '">删除</button></div>' : '') +
        '</div>';
    }).join('');
    return '<div class="page-head"><div><h2>人员管理</h2><div class="sub">团长 / 管理 / 陪玩三级权限 · 分成与直属关系</div></div>' +
      (canEdit ? '<button class="btn-primary" data-action="new-member">＋ 添加成员</button>' : '') + '</div>' +
      '<div class="split-note"><span>🔐</span><div><b>权限说明：</b>团长=全权（录单/人员/套餐/分成/报表）；管理=录单查看导出；陪玩=只读自己的订单与排名。设置连接身份决定权限。</div></div>' +
      '<div class="member-grid">' + cards + '</div>';
  }

  /* ---------- 项目 ---------- */
  function projects() {
    var canEdit = Store.isOwner();
    var cards = (D.projects || []).map(function (p) {
      return '<div class="proj-card"><span class="cat">' + esc(p.category) + '</span>' +
        '<h4>' + esc(p.name) + '</h4>' +
        '<div class="price">' + Calc.money(p.price) + '</div>' +
        '<div class="rate">默认分成 <b>' + Math.round(p.defaultRate*100) + '%</b> · 陪玩 ' + Calc.money(p.price*p.defaultRate) + '</div>' +
        (canEdit ? '<div class="actions"><button class="btn-ghost btn-sm" data-action="edit-project" data-id="' + p.id + '">编辑</button>' +
          '<button class="btn-danger btn-sm" data-action="del-project" data-id="' + p.id + '">删除</button></div>' : '') +
        '</div>';
    }).join('');
    return '<div class="page-head"><div><h2>项目与单价</h2><div class="sub">陪玩项目、单价与默认分成比例 · ' + (D.projects||[]).length + ' 项</div></div>' +
      (canEdit ? '<button class="btn-primary" data-action="new-project">＋ 新增项目</button>' : '') + '</div>' +
      '<div class="proj-grid">' + cards + '</div>';
  }

  /* ---------- 套餐 ---------- */
  function packages() {
    var canEdit = Store.isOwner();
    var cards = (D.packages || []).map(function (p) {
      return '<div class="pkg-card"><div class="name">' + esc(p.name) + '</div>' +
        '<div class="amt">' + Calc.money(p.amount) + '</div>' +
        '<div class="bonus">送 ' + Calc.money(p.bonus) + '</div>' +
        '<div class="val">有效期 ' + esc(p.validity) + '</div>' +
        '<div class="val">' + esc(p.desc) + '</div>' +
        (canEdit ? '<div class="actions"><button class="btn-ghost btn-sm" data-action="edit-package" data-id="' + p.id + '">编辑</button>' +
          '<button class="btn-danger btn-sm" data-action="del-package" data-id="' + p.id + '">删除</button></div>' : '') +
        '</div>';
    }).join('');
    return '<div class="page-head"><div><h2>预存套餐</h2><div class="sub">自定义充值金额、赠送与有效期</div></div>' +
      (canEdit ? '<button class="btn-primary" data-action="new-package">＋ 新增套餐</button>' : '') + '</div>' +
      '<div class="pkg-grid">' + cards + '</div>';
  }

  /* ---------- 排名 ---------- */
  function ranking(sortBy) {
    var list = Calc.ranking(D, sortBy);
    var max = Math.max.apply(null, list.map(function (r) { return r.income; }).concat([1]));
    var key = sortBy || 'income';
    var rows = list.map(function (r) {
      var medal = ['🥇','🥈','🥉'][r.rank-1] || r.rank;
      var barW = Math.round((r.income / max) * 100);
      return '<div class="rank-row"><div class="rank-medal">' + medal + '</div>' +
        '<div class="rank-avatar">' + esc(r.avatar) + '</div>' +
        '<div class="rank-info"><b>' + esc(r.name) + '</b><span class="role-tag">· ' + r.count + ' 单</span>' +
        '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + barW + '%"></div></div></div>' +
        '<div class="rank-val">' + Calc.money(r[key]) + '</div></div>';
    }).join('');

    var up = Calc.uplineStats(D).filter(function (u) { return u.downCount > 0; }).map(function (u) {
      return '<tr><td>' + esc(u.avatar) + ' ' + esc(u.name) + '</td><td class="num">' + u.downCount + '</td>' +
        '<td class="num amount-in">' + Calc.money(u.downIncome) + '</td></tr>';
    }).join('');

    return '<div class="page-head"><div><h2>统计排名</h2><div class="sub">陪玩业绩与直属团队统计</div></div></div>' +
      '<div class="tabs">' +
        '<button class="tab ' + (key==='income'?'on':'') + '" data-page="ranking" data-sort="income">按分成收入</button>' +
        '<button class="tab ' + (key==='count'?'on':'') + '" data-page="ranking" data-sort="count">按接单数</button>' +
        '<button class="tab ' + (key==='fee'?'on':'') + '" data-page="ranking" data-sort="fee">按团队贡献</button>' +
      '</div>' +
      '<div class="card"><h3>🏆 陪玩业绩榜</h3>' + (rows || '<div class="empty"><p>暂无数据</p></div>') + '</div>' +
      '<div class="card"><h3>🌿 直属团队</h3><div class="table-wrap"><table><thead><tr>' +
        '<th>上级陪玩</th><th>直属下级数</th><th>下级总业绩</th></tr></thead><tbody>' +
        (up || '<tr><td colspan="3"><div class="empty"><p>暂无直属关系</p></div></td></tr>') +
        '</tbody></table></div></div>';
  }

  /* ---------- 报表 ---------- */
  function reports() {
    var cards = [
      { type:'monthly', ic:'📅', title:'月度收支汇总', desc:'每月订单数、总收入、团队抽成、陪玩分成，按月对比。' },
      { type:'ranking', ic:'🏆', title:'陪玩排名明细', desc:'各陪玩接单数、分成收入、团队贡献及排名。' },
      { type:'deposits', ic:'💳', title:'预存明细', desc:'客户预存、赠送、消费与当前余额一览。' },
      { type:'orders', ic:'🧾', title:'全部订单流水', desc:'每笔订单的单号、客户、项目、陪玩、金额与分成明细。' }
    ].map(function (r) {
      return '<div class="report-card"><div class="ic">' + r.ic + '</div>' +
        '<h3>' + r.title + '</h3><p>' + r.desc + '</p>' +
        '<button class="btn-primary btn-sm" data-action="export" data-type="' + r.type + '">📄 导出 PDF</button></div>';
    }).join('');
    return '<div class="page-head"><div><h2>报表导出</h2><div class="sub">四类对账报表，一键导出 PDF（中文完好）</div></div></div>' +
      (Store.isOwner() ? '' : '<div class="split-note"><span>ℹ️</span><div>只读身份也可以导出报表用于核对。</div></div>') +
      '<div class="report-grid">' + cards + '</div>';
  }

  return {
    setData: setData, data: data, esc: esc,
    dashboard: dashboard, orders: orders, deposits: deposits, members: members,
    projects: projects, packages: packages, ranking: ranking, reports: reports
  };
})();
