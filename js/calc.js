/* ============================================================
   calc.js — 分成与统计计算
   ============================================================ */
window.Calc = (function () {

  /* 计算单笔订单分成 */
  function split(order, members, projects) {
    var m = members.find(function (x) { return x.id === order.memberId; });
    var p = projects.find(function (x) { return x.id === order.projectId; });
    var rate = order.rate != null ? order.rate : (p ? p.defaultRate : 0.7);
    var price = Number(order.price) || 0;
    var memberIncome = Math.round(price * rate * 100) / 100;
    var teamFee = Math.round((price - memberIncome) * 100) / 100;
    return { member: m, project: p, rate: rate, price: price, memberIncome: memberIncome, teamFee: teamFee };
  }

  /* 总览统计 */
  function overview(d) {
    var orders = d.orders || [];
    var deposits = d.deposits || [];
    var totalIncome = orders.reduce(function (s, o) { return s + (Number(o.price) || 0); }, 0);
    var totalFee = orders.reduce(function (s, o) { return s + (o.teamFee || 0); }, 0);
    var totalPlayer = orders.reduce(function (s, o) { return s + (o.memberIncome || 0); }, 0);
    var totalDeposit = deposits.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
    var prepayUsed = orders.reduce(function (s, o) { return s + (Number(o.prepayUsed) || 0); }, 0);
    var now = new Date();
    var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var monthOrders = orders.filter(function (o) { return (o.date || '').indexOf(ym) === 0; });
    var monthIncome = monthOrders.reduce(function (s, o) { return s + (Number(o.price) || 0); }, 0);
    return {
      totalIncome: totalIncome, totalFee: totalFee, totalPlayer: totalPlayer,
      totalDeposit: totalDeposit, prepayUsed: prepayUsed,
      orderCount: orders.length, monthIncome: monthIncome, monthCount: monthOrders.length
    };
  }

  /* 陪玩排名 */
  function ranking(d, sortBy) {
    var orders = d.orders || [];
    var members = d.members || [];
    var map = {};
    members.filter(function (m) { return m.role === 'player'; }).forEach(function (m) {
      map[m.id] = { id: m.id, name: m.name, avatar: m.avatar, count: 0, income: 0, fee: 0, upline: m.upline };
    });
    orders.forEach(function (o) {
      if (!map[o.memberId]) return;
      map[o.memberId].count += 1;
      map[o.memberId].income += Number(o.memberIncome) || 0;
      map[o.memberId].fee += Number(o.teamFee) || 0;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    var key = sortBy || 'income';
    list.sort(function (a, b) { return (b[key] || 0) - (a[key] || 0); });
    list.forEach(function (r, i) { r.rank = i + 1; });
    return list;
  }

  /* 预存余额（按客户汇总） */
  function depositBalances(d) {
    var map = {};
    (d.deposits || []).forEach(function (x) {
      if (!map[x.customer]) map[x.customer] = { customer: x.customer, deposit: 0, bonus: 0, used: 0 };
      map[x.customer].deposit += Number(x.amount) || 0;
      map[x.customer].bonus += Number(x.bonus) || 0;
    });
    (d.orders || []).forEach(function (o) {
      if (!map[o.customer]) map[o.customer] = { customer: o.customer, deposit: 0, bonus: 0, used: 0 };
      map[o.customer].used += Number(o.prepayUsed) || 0;
    });
    return Object.keys(map).map(function (k) {
      var m = map[k];
      m.balance = m.deposit + m.bonus - m.used;
      return m;
    }).sort(function (a, b) { return b.balance - a.balance; });
  }

  /* 月度汇总 */
  function monthly(d) {
    var map = {};
    (d.orders || []).forEach(function (o) {
      var ym = (o.date || '').slice(0, 7) || '未知';
      if (!map[ym]) map[ym] = { month: ym, count: 0, income: 0, fee: 0, player: 0 };
      map[ym].count += 1;
      map[ym].income += Number(o.price) || 0;
      map[ym].fee += Number(o.teamFee) || 0;
      map[ym].player += Number(o.memberIncome) || 0;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.month < b.month ? 1 : -1; });
  }

  /* 直属下级统计 */
  function uplineStats(d) {
    var members = d.members || [];
    var rankingList = ranking(d, 'income');
    return members.filter(function (m) { return m.role === 'player'; }).map(function (m) {
      var downs = rankingList.filter(function (r) { return r.upline === m.id; });
      return {
        id: m.id, name: m.name, avatar: m.avatar,
        downCount: downs.length,
        downIncome: downs.reduce(function (s, r) { return s + r.income; }, 0)
      };
    });
  }

  function money(n) { return '¥' + (Number(n) || 0).toFixed(2); }

  return {
    split: split, overview: overview, ranking: ranking,
    depositBalances: depositBalances, monthly: monthly, uplineStats: uplineStats, money: money
  };
})();
