/* 엘니뇨 어부 버티기 게임 — 화면(설계지시안 v1.2 §6 · 시안 2 구조 승계).
   ?host = 교사 TV(호스트 권위: core로 판정 → 표에 쓰고 → 방송) · 그 밖 = 학생 휴대폰.
   한 시계: 방송마다 «이 단계가 시작된 뒤 지난 초(el)»가 오고, 기기는 받은 시각 − el 을 기준으로 sample(t)를 그린다.
   D11: 화면 글자는 text.js · 숫자 · 별명 자리(data-slot="nick")뿐 — 오류도 글자가 아니라 흔들림 · 빨간 테두리. */
(function () {
  'use strict';
  var CORE = window.ELNINO_CORE, NET = window.ELNINO_NET, TX = window.ELNINO_TEXT, A = window.ELNINO_ART || null, B = CORE.B;
  var Q = location.search;
  var HOST = /[?&]host\b/.test(Q), FAST = /[?&]fast=1/.test(Q);
  var X3 = !/[?&]2d=1/.test(Q) && window.ELNINO_3D && window.ELNINO_3D.supported && window.ELNINO_3D.supported() ? window.ELNINO_3D : null;
  var T = FAST ? { news: 0.6, choose: 4, result: 1.5, all: 0.3, warm: 4 } : { news: 2, choose: 15, result: 3, all: 0.8, warm: 3 };   /* warm: «시작» 방송 뒤 첫 턴까지 — 휴대폰이 3D 장면을 미리 만들고 셰이더를 컴파일할 시간(10-31 E2E: 첫 턴에 만들면 선택 시간이 멈춤) */
  var WARM = /[?&]warm=(\d+)/.exec(Q); if (WARM) T.warm = +WARM[1];
  function now() { return performance.now() / 1000; }
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function icon(n, sz) { return A && A.svg && A.svg[n] ? A.svg[n](sz || 28) : ''; }
  function el(tag, cls, html, st) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (st) e.setAttribute('style', st); return e; }
  function num(n) { return String(Math.round(n)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nickSlot(n) { return '<span data-slot="nick">' + esc(n) + '</span>'; }
  function shake(e) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake', 'bad'); setTimeout(function () { e.classList.remove('bad'); }, 1200); }
  function lerpEnv(a, b, k) { if (!a) return b; var o = {}, key; for (key in b) o[key] = typeof b[key] === 'number' && typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * k : b[key]; return o; }

  /* ── 보기 상태(교사 · 학생 공통) ── */
  /* 교사 비밀번호(사용자 11-01) — 평문 대신 SHA-256('elnino:' + 비밀번호)만 둔다. 화면 단 잠금이다(저장소가 공개라 진짜 보안은 아님). 통과한 기기는 기억 */
  var TEACH_HASH = '12431f0e63812ff19a3237fbc023381b3a2b5d1c3a1271cd91902fe2fb5e556c';
  function teacherOk() { try { return localStorage.getItem('elnino-teacher') === TEACH_HASH; } catch (e) { return false; } }
  function sha256hex(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  var V = { mode: HOST ? (teacherOk() ? 'make' : 'gate') : 'join', code: null, g: 0, practice: false, meta: [], meId: null, i: 0, env: CORE.envOf(1, null), prevEnv: null,
    cards: {}, before: {}, prevRows: {}, rows: null, phase: 'news', phaseT0: now(), resultT0: 0, box: { west: 0, east: 0 }, chosen: {}, joined: [],
    log: null, rank: null, paused: false, myCh: null, myDep: 0 };

  function metaById(id) { for (var k = 0; k < V.meta.length; k++) if (V.meta[k].id === id) return V.meta[k]; return null; }

  /* ── 한 시계: 시간 → 화면의 모든 값 ── */
  function snapNow() {
    var t = now(), s = { mode: V.mode, phase: V.phase, t: t, turnI: V.i, cards: V.cards || {}, box: V.box, players: [], alive: { west: 0, east: 0 } };
    var loc = V.paused ? (V.pauseAt - V.phaseT0) : t - V.phaseT0;
    s.loc = loc; s.locR = V.phase === 'result' ? (V.paused ? V.pauseAt - V.resultT0 : t - V.resultT0) : -1;
    var ph = V.phase === 'result' ? 'result' : loc < T.news ? 'news' : 'choose';
    s.phase = ph;
    s.env = ph === 'news' ? lerpEnv(V.prevEnv, V.env, sm(loc / T.news)) : V.env;
    s.timer = ph === 'choose' ? Math.max(0, Math.ceil(T.choose - (loc - T.news))) : ph === 'news' ? T.choose : 0;
    s.pulse = ph === 'news' ? sm(loc / Math.min(1, T.news)) : 0;
    s.cardFlip = ph === 'news' ? 1 - sm(loc / Math.min(0.8, T.news)) : 0;
    s.cardBig = ph === 'news' || (ph === 'choose' && loc - T.news < 1.0);
    var R = T.result, tr = 0.33 * R, hl = 0.4 * R, rv = 0.67 * R;
    V.meta.forEach(function (m) {
      var b = V.before[m.id] || { st: B.st0, store: B.store0, score: 0, out: 0 };
      var o = { id: m.id, nick: m.nick, side: m.side, k: m.k, me: m.id === V.meId, from: 'port', to: 'port', p: 1, haul: 0, catch: 0, out: b.out ? 1 : 0, chosen: !!V.chosen[m.id], ch: null, pop: null, st: b.st, store: b.store, score: b.score };
      if (V.mode === 'end') { var e = V.rank && V.rank.byId[m.id]; if (e) { o.st = e.st; o.score = e.score; o.out = e.out ? 1 : 0; } }
      else if (!b.out) {
        if (ph === 'news') { var pr = V.prevRows[m.id]; if (pr && (pr.ch === 'near' || pr.ch === 'far')) { o.from = pr.ch; o.to = 'port'; o.p = sm(loc / Math.min(1.6, T.news)); } }
        else if (ph === 'result' && V.rows && V.rows[m.id]) {
          var r = V.rows[m.id]; o.ch = r.ch; o.chosen = true;
          if (r.ch && r.ch !== 'rest') { o.to = r.ch; o.p = sm(s.locR / tr); o.haul = sm((s.locR - tr) / hl); o.catch = Math.min(9, r.catch || 0); if (s.locR >= rv && r.catch > 0) o.pop = r.catch; }
          if (s.locR >= rv) { o.st = r.after.st; o.store = r.after.store; o.score = r.after.score; }
          if (r.after.st <= 0) o.out = sm((s.locR - rv) / (R - rv + 0.01));
        }
      }
      o.isOut = o.out >= 1 || (o.st <= 0);
      if (!o.isOut) s.alive[m.side]++;
      s.players.push(o);
    });
    s.me = null; s.players.forEach(function (p) { if (p.me) s.me = p; });
    return s;
  }

  /* ════════ 교사(호스트) ════════ */
  var H = { pin: null, game: null, seed: 0, uidToId: {}, idToUid: {}, moves: {}, present: {}, trigCode: null, lastMoveT: 0, busy: false };
  function saveHost() { try { localStorage.setItem('elnino-host', V.code); } catch (e) {} }
  function bcast(msg) { msg.el = msg.el || 0; return NET.broadcastTurn(msg); }
  function before(game) { var o = {}; game.players.forEach(function (p) { o[p.id] = { st: p.st, store: p.store, score: p.score, out: p.out }; }); return o; }
  function hostMake(pin) {
    H.pin = pin;
    return NET.signIn().then(function () { return NET.createRoom(false, pin); }).then(function (code) {
      V.code = code; return NET.getSeed(code);
    }).then(function (seed) {
      H.seed = seed;
      return NET.subscribe(V.code, { move: hostOnMove, presence: function (st) { H.present = {}; Object.keys(st).forEach(function (k) { H.present[k] = 1; }); } }, true);
    }).then(function () { V.mode = 'lobby'; saveHost(); pollLobby(); });
  }
  function pollLobby() {
    if (V.mode !== 'lobby' && V.mode !== 'end') return;
    NET.listPlayers(V.code).then(function (rows) { V.joined = rows; }).catch(function () {});
    setTimeout(pollLobby, 2000);
  }
  function hostStart(practice) {
    if (H.busy) return; H.busy = true;
    V.g += 1; V.practice = practice;
    NET.setRoom(V.code, { status: 'play', practice: !!practice }).then(function () { return NET.listPlayers(V.code); }).then(function (rows) {
      var game = CORE.newGame({ seed: (H.seed + V.g * 7919) >>> 0, two: true, coop: 'store', practice: practice });
      H.uidToId = {}; H.idToUid = {}; V.meta = [];
      rows.forEach(function (r) { var p = CORE.addPlayer(game, r.nick); H.uidToId[r.uid] = p.id; H.idToUid[p.id] = r.uid; V.meta.push({ id: p.id, uid: r.uid, nick: r.nick, side: p.side, k: p.id % 15 }); });
      H.game = game; V.rows = null; V.prevRows = {}; V.env = CORE.envOf(1, game.onset); V.prevEnv = null; V.box = { west: 0, east: 0 }; V.log = null; V.rank = null;
      return NET.assign(V.code, V.meta.map(function (m) { return { uid: m.uid, side: m.side, join_order: m.id }; }));
    }).then(function () {
      bcast({ type: 'start', g: V.g, practice: practice, meta: V.meta, T: T });
      V.mode = 'play'; V.phase = 'result'; V.resultT0 = now() + 1e6;   /* 준비 시간 동안 hostTick이 판정하지 않게 */
      setTimeout(function () { H.busy = false; hostNews(); }, T.warm * 1000);
    }).catch(function (e) { H.busy = false; console.error(e); });
  }
  function hostNews() {
    if (V.mode !== 'play' || !H.game) return;   /* 나가기 뒤 남은 예약 */
    var game = H.game; if (game.over) { hostEnd(); return; }
    var i = game.turn + 1;
    V.prevEnv = V.env; V.env = CORE.envOf(i, game.onset); V.i = i;
    V.cards = { west: CORE.cardOf(game, i, 'west'), east: CORE.cardOf(game, i, 'east') };
    V.prevRows = {}; if (V.rows) Object.keys(V.rows).forEach(function (id) { V.prevRows[id] = { ch: V.rows[id].ch }; });
    V.before = before(game); V.rows = null; V.chosen = {}; H.moves = {}; H.lastMoveT = 0;
    V.phase = 'news'; V.phaseT0 = now();
    bcast({ type: 'news', g: V.g, practice: V.practice, i: i, env: V.env, prevEnv: V.prevEnv, cards: V.cards, before: V.before, prevRows: V.prevRows, box: V.box, meta: V.meta, T: T });
  }
  function hostOnMove(row) {
    if (/[?&]debug=1/.test(Q)) console.log('MOVE', row && row.g, row && row.i, 'V', V.g, V.i, V.phase, row && row.ch);
    if (!row || row.g !== V.g || row.i !== V.i || V.phase === 'result') return;
    var id = H.uidToId[row.uid]; if (id == null) return;
    H.moves[row.uid] = { ch: row.ch, dep: row.dep || 0 }; V.chosen[id] = 1; H.lastMoveT = now();
  }
  function hostTick() {
    if (!HOST || V.mode !== 'play' || V.paused || H.busy) return;
    var t = now() - V.phaseT0;
    if (V.phase !== 'result') {
      if (t < T.news) return;
      var need = V.meta.filter(function (m) { var b = V.before[m.id]; return b && !b.out && H.present[m.uid]; });
      var all = need.length > 0 && need.every(function (m) { return H.moves[m.uid]; });
      if (t >= T.news + T.choose || (all && now() - H.lastMoveT >= T.all)) hostResolve();
    } else if (now() - V.resultT0 >= T.result) hostNews();
  }
  function hostResolve() {
    if (/[?&]debug=1/.test(Q)) console.log('RESOLVE', V.i, Object.keys(H.moves).length, (now() - V.phaseT0).toFixed(2));
    H.busy = true;
    var game = H.game, choices = {}, deps = {};
    Object.keys(H.moves).forEach(function (uid) { var id = H.uidToId[uid]; if (id == null) return; choices[id] = H.moves[uid].ch; if (H.moves[uid].dep) deps[id] = H.moves[uid].dep; });
    var rec = CORE.resolveTurn(game, choices, deps), rows = {};
    rec.rows.forEach(function (r) { rows[r.id] = { ch: r.ch, catch: r.catch || 0, dep: r.dep || 0, wd: r.wd || 0, shock: r.shock || 0, after: r.after }; });
    V.rows = rows; V.box = rec.box; V.phase = 'result'; V.resultT0 = now();
    var tc = H.trigCode; H.trigCode = null;
    NET.writeTurn(V.code, V.g, rec.i, { choices: choices, deposits: deps, trigger_at: tc, rec: { i: rec.i, box: rec.box, fishE: rec.fishE, fishW: rec.fishW, catchE: rec.catchE, catchW: rec.catchW, cards: rec.cards } })
      .catch(function (e) { console.error('writeTurn', e); })
      .then(function () { bcast({ type: 'result', g: V.g, i: rec.i, rows: rows, box: rec.box, el: now() - V.resultT0 }); H.busy = false; });
  }
  function hostEnd() {
    var game = H.game, st = CORE.standings(game), byId = {};
    game.players.forEach(function (p) { byId[p.id] = { st: p.st, score: p.score, out: p.out, rank: null }; });
    st.forEach(function (p) { byId[p.id].rank = p.rank; });
    var log = { fishE: [], fishW: [], catchE: [], catchW: [], cards: [] };
    game.log.forEach(function (r) { log.fishE.push(r.fishE); log.fishW.push(r.fishW); log.catchE.push(r.catchE); log.catchW.push(r.catchW); log.cards.push(r.cards); });
    var surv = { west: 0, east: 0 }, sc = { west: [], east: [] };
    game.players.forEach(function (p) { if (!p.out) surv[p.side]++; sc[p.side].push(p.score); });
    function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
    V.rank = { byId: byId, order: st.map(function (p) { return { id: p.id, rank: p.rank, score: p.score }; }), surv: surv, mean: { west: mean(sc.west), east: mean(sc.east) }, n: { west: sc.west.length, east: sc.east.length }, onset: game.onset };
    V.log = log; V.mode = 'end';
    NET.setStatus(V.code, 'lobby').catch(function () {});
    bcast({ type: 'end', g: V.g, rank: V.rank, log: log });
    pollLobby();
  }
  /* 교사 복구(설계지시안 §4-2 · §4-4) — 턴 기록을 0턴부터 다시 돌려 같은 상태를 만든다(core 결정성 · K1-15) */
  function hostRecover(code) {
    var room;
    return NET.getRoom(code).then(function (r) { if (!r) throw new Error('no room'); room = r; return NET.getSeed(code); }).then(function (seed) {
      H.seed = seed; V.code = code; saveHost();
      return NET.subscribe(code, { move: hostOnMove, presence: function (st) { H.present = {}; Object.keys(st).forEach(function (k) { H.present[k] = 1; }); } }, true);
    }).then(function () { return NET.lastGame(code); }).then(function (g) {
      V.g = g;
      if (room.status !== 'play' || !g) { V.mode = 'lobby'; pollLobby(); return null; }
      return Promise.all([NET.listPlayers(code), NET.readTurns(code, g)]).then(function (res) {
        var rows = res[0].slice().sort(function (a, b) { return (a.join_order == null ? 1e9 : a.join_order) - (b.join_order == null ? 1e9 : b.join_order); });
        var game = CORE.newGame({ seed: (H.seed + g * 7919) >>> 0, two: true, coop: 'store', practice: !!room.practice });
        H.uidToId = {}; H.idToUid = {}; V.meta = []; V.practice = !!room.practice;
        rows.forEach(function (r) { if (r.join_order == null) return; var p = CORE.addPlayer(game, r.nick); H.uidToId[r.uid] = p.id; H.idToUid[p.id] = r.uid; V.meta.push({ id: p.id, uid: r.uid, nick: r.nick, side: p.side, k: p.id % 15 }); });
        var last = null;
        res[1].forEach(function (t) {
          if (t.trigger_at != null && Math.floor(t.trigger_at / 10) === game.turn) CORE.trigger(game, t.trigger_at % 10 === 1);
          last = CORE.resolveTurn(game, t.choices || {}, t.deposits || {});
        });
        H.game = game; V.box = last ? last.box : { west: 0, east: 0 }; V.env = CORE.envOf(game.turn || 1, game.onset); V.i = game.turn;
        V.rows = {}; if (last) last.rows.forEach(function (r) { V.rows[r.id] = { ch: r.ch, catch: r.catch || 0, after: r.after }; });
        window.__recovered = { g: g, turns: res[1].length, players: V.meta.length };
        if (game.over) { hostEnd(); return; }
        V.mode = 'play'; V.phase = 'result'; V.resultT0 = now() - T.result + 1.0;   /* 1초 뒤 다음 턴 소식 */
      });
    });
  }
  /* 나가기(사용자 11-01) — 학생에게 «닫힘» 방송 → 방 상태 'end'(입장 · 이동 RLS가 막음) → 구독 해제 → 방 만들기 화면 */
  function hostLeave() {
    if (H.busy || (V.mode === 'play' && !V.paused)) return;
    var code = V.code; H.busy = true;
    Promise.resolve().then(function () { return bcast({ type: 'closed' }); }).catch(function () {}).then(function () { return NET.setStatus(code, 'end'); }).catch(function (e) { console.error(e); }).then(function () {
      NET.leave(); try { localStorage.removeItem('elnino-host'); } catch (e) {}
      H.game = null; H.pin = null; H.uidToId = {}; H.idToUid = {}; H.moves = {}; H.present = {}; H.trigCode = null; H.busy = false;
      V.code = null; V.g = 0; V.i = 0; V.meta = []; V.joined = []; V.rows = null; V.prevRows = {}; V.rank = null; V.log = null; V.paused = false; V.chosen = {};
      V.env = CORE.envOf(1, null); V.prevEnv = null; V.box = { west: 0, east: 0 }; V.cards = {}; V.phase = 'news';
      V.mode = 'make';
    });
  }
  function hostPause() {
    if (V.mode !== 'play') return;
    if (!V.paused) { V.paused = true; V.pauseAt = now(); bcast({ type: 'pause' }); }
    else { var d = now() - V.pauseAt; V.phaseT0 += d; V.resultT0 += d; V.paused = false; bcast({ type: 'resume', phase: V.phase, el: now() - (V.phase === 'result' ? V.resultT0 : V.phaseT0) }); }
  }
  function hostTrigger() {   /* D16: 구석 아이콘 길게 누르기 — 화면에는 아무것도 바뀌지 않는다(전조는 바다로만) */
    if (!H.game || V.mode !== 'play') return false;
    var shown = V.phase !== 'result', at = H.game.turn, ok = CORE.trigger(H.game, shown);
    if (ok) H.trigCode = at * 10 + (shown ? 1 : 0);   /* replay: game.turn === at 일 때 trigger(game, shown) */
    return ok;
  }

  /* ════════ 학생 ════════ */
  function stuJoin(code, nick, codeEl, nickEl) {
    if (!/^\d{4}$/.test(code)) { shake(codeEl); return; }
    if (!nick || nick.length > 8) { shake(nickEl); return; }
    NET.signIn().then(function () { return NET.getRoom(code); }).then(function (room) {
      if (!room) { shake(codeEl); throw 0; }
      return NET.join(code, nick).catch(function (e) { if (e && e.code === '23505' && /room_pkey|players_pkey/.test(e.message || '')) return null; if (e && e.code === '23505') { shake(nickEl); throw 0; } if (e && e.code === '42501') { shake(codeEl); throw 0; } throw e; });
    }).then(function () {
      V.code = code; try { localStorage.setItem('elnino-room', code); } catch (e) {}
      return NET.subscribe(code, { turn: stuOnMsg }, false);
    }).then(function () { V.mode = 'wait'; prewarm(); }).catch(function (e) { if (e) console.error(e); });
  }
  function stuOnMsg(m) {
    if (!m || !m.type) return;
    var t = now();
    if (m.type === 'start') {   /* 마을 배정 — 3D 장면을 지금 만들어 한 번 그려 둔다(첫 턴 멈춤 방지) */
      if (m.T) T = m.T; V.g = m.g; V.meta = m.meta; var u0 = NET.uid(); V.meId = null; V.meta.forEach(function (x) { if (x.uid === u0) V.meId = x.id; });
      var mm = metaById(V.meId), tw = performance.now(); if (mm) { var w0 = phoneWorld(mm.side); if (w0) { try { w0.update(now(), state3(snapNow(), mm.side)); w0.render(); } catch (e) {} } }
      window.__warmMs = Math.round(performance.now() - tw);
      return;
    }
    if (m.type === 'news') {
      if (m.T) T = m.T;
      V.mode = 'play'; V.g = m.g; V.practice = m.practice; V.i = m.i; V.env = m.env; V.prevEnv = m.prevEnv; V.cards = m.cards || {}; V.before = m.before; V.prevRows = m.prevRows || {};
      V.box = m.box; V.meta = m.meta; V.rows = null; V.phase = 'news'; V.phaseT0 = t - (m.el || 0); V.myCh = null; V.myDep = 0; V.paused = false;
      var uid = NET.uid(); V.meId = null; V.meta.forEach(function (x) { if (x.uid === uid) V.meId = x.id; });
    } else if (m.type === 'result' && m.g === V.g && m.i === V.i) { V.rows = m.rows; V.box = m.box; V.phase = 'result'; V.resultT0 = t - (m.el || 0); }
    else if (m.type === 'end') { V.mode = 'end'; V.rank = m.rank; V.log = m.log; }
    else if (m.type === 'closed') { NET.leave(); try { localStorage.removeItem('elnino-room'); } catch (e) {} V.code = null; V.meId = null; V.meta = []; V.rank = null; V.log = null; V.paused = false; V.mode = 'join'; }
    else if (m.type === 'pause') { V.paused = true; V.pauseAt = t; }
    else if (m.type === 'resume') { V.paused = false; if (m.phase === 'result') V.resultT0 = t - m.el; else V.phaseT0 = t - m.el; }
  }
  /* 대기 중 3D 미리 준비(10-31 실측: 소프트웨어 렌더에서 첫 장면 준비 10.9 s — 판 시작 «뒤»에 하면 첫 턴 선택 시간이 멈춤) */
  function prewarm() {
    setTimeout(function () { var w0 = phoneWorld('east'); if (w0) { try { var t0 = performance.now(); w0.update(now(), state3(snapNow(), 'east')); w0.render(); window.__prewarmMs = Math.round(performance.now() - t0); } catch (e) {} } }, 300);
  }
  function stuChoose(k) {
    var s = snapNow(), me = s.me; if (!me || me.isOut || s.phase === 'result' || V.mode !== 'play') return;
    if (s.cards[me.side] === 'flood' && k !== 'rest') return;
    V.myCh = k; V.chosen[me.id] = 1;
    if (/[?&]debug=1/.test(Q)) console.log('SUBMIT', V.g, V.i, k, s.phase);
    NET.submitMove(V.code, V.g, V.i, k, V.myDep).catch(function (e) { console.error(e); V.myCh = null; });
  }
  function stuDeposit() {
    var s = snapNow(), me = s.me; if (!me || me.isOut || s.phase === 'result') return;
    V.myDep = (V.myDep + 1) % (Math.max(0, me.store) + 1);
    if (V.myCh) NET.submitMove(V.code, V.g, V.i, V.myCh, V.myDep).catch(function () {});
  }

  /* ════════ 그리기 ════════ */
  var tvwrap = document.getElementById('tvwrap'), tv = document.getElementById('tv'), phone = document.getElementById('phone');
  var bd3 = document.getElementById('bd3'), bd2 = document.getElementById('bd2'), bdov = document.getElementById('bdov'), tvc2 = document.getElementById('tvc2'), tvov = document.getElementById('tvov'), phov = document.getElementById('phov');
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  /* 3D 캔버스 표시 크기 — Astra resize는 setSize(…, false)라 CSS 크기를 안 정한다. 안 정하면 화소 밀도 2 이상 휴대폰 · 배율 125 % PC에서
     내부 크기(w × dpr)대로 커져 왼쪽 위만 보인다(11-01 실기기 제보 — 시험 환경은 dpr 1이라 안 드러남) */
  function css3(c, w, h) { c.style.width = w + 'px'; c.style.height = h + 'px'; }
  function sizeCanvas(c, w, h, d) { c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.width = w + 'px'; c.style.height = h + 'px'; }
  var W3 = null, P3 = null, phCanvas = document.createElement('canvas'), phSide = null;
  if (HOST) {
    tvwrap.hidden = false; sizeCanvas(tvc2, 1366, 768, DPR); sizeCanvas(bd2, 900, 560, DPR);
    if (X3) { try { W3 = X3.create(bd3, { view: 'tv', side: 'east', dpr: DPR, quality: 'high' }); W3.resize(900, 560); css3(bd3, 900, 560); bd2.style.display = 'none'; } catch (e) { W3 = null; } }
    var fit = function () { var k = Math.min(window.innerWidth / 1366, window.innerHeight / 768); tv.style.transform = 'scale(' + k + ')'; };
    window.addEventListener('resize', fit); fit();
  } else { phone.hidden = false; }
  var ICON3 = {};   /* 마을별 3D 아이콘 그림 주소(data URL) */
  function icon3(kind, side) {
    var key = kind + '|' + side;
    if (ICON3[key] === undefined) {
      ICON3[key] = null;
      if (X3 && X3.icon) { try { var c = X3.icon(kind, 40, { dpr: Math.min(3, window.devicePixelRatio || 1), village: side }); if (c) ICON3[key] = c.toDataURL(); } catch (e) {} }
      if (X3 && X3.iconDispose) { try { X3.iconDispose(); } catch (e) {} }
    }
    return ICON3[key] ? '<img class="ic3" alt="" src="' + ICON3[key] + '">' : null;
  }
  function phoneWorld(side) {
    if (!X3) return null; if (P3 && phSide === side) return P3; if (P3) P3.dispose();
    try { P3 = X3.create(phCanvas, { view: 'phone', side: side, dpr: Math.min(2, window.devicePixelRatio || 1), quality: 'low' });   /* 휴대폰 = 가벼운 화질 · v2.5 배 뒤 추적 시점 */ P3.resize(phW(), SEAH); css3(phCanvas, phW(), SEAH); phSide = side; } catch (e) { P3 = null; }
    return P3;
  }
  function phW() { return Math.min(420, window.innerWidth); }
  var SEAH = Math.round(Math.min(420, Math.max(300, (window.innerHeight || 700) * 0.42)));   /* 휴대폰 바다 칸 높이 */
  function state3(s, spot) {
    var e = s.env, c = s.cards;
    return { env: { wind: e.wind, warmE: e.warmE, coolW: e.coolW, upwell: e.upwell, fishE: e.fishE, fishW: e.fishW, rainE: e.rainE, rainW: e.rainW, flood: c.east === 'flood' ? 0.8 : 0, drought: e.drought, fire: c.west === 'fire' ? 0.8 : 0 },
      boats: s.players.map(function (q) { return { id: q.id, village: q.side, k: q.k, me: q.me, from: q.from, to: q.to, p: q.p, haul: q.haul, catch: q.catch, out: q.out }; }), spotlight: spot || null, pulse: s.pulse || 0 };
  }
  function board2D(ctx, W, H2, s, dim) {
    if (!A) return; var e = s.env, c = s.cards;
    A.board(ctx, W, H2, { view: '2d', t: s.t, wind: e.wind, warmE: e.warmE, coolW: e.coolW, upwell: e.upwell, fishE: e.fishE, fishW: e.fishW, rainE: e.rainE, rainW: e.rainW, flood: c.east === 'flood' ? 0.8 : 0, drought: e.drought, fire: c.west === 'fire' ? 0.8 : 0, dimW: dim === 'west' ? 0.6 : 0, dimE: dim === 'east' ? 0.6 : 0 });
    var an = A.anchors(W, H2, '2d');
    s.players.forEach(function (q, ix) {
      var z = an[q.side], at = function (w) { return w === 'port' ? [z.port[0] + ((ix % 15) - 7) * 4, z.port[1]] : [z[w][0] + Math.cos(q.id * 2.4) * z[w][2] * 0.7, z[w][1] + Math.sin(q.id * 2.4) * z[w][3] * 0.7]; };
      var a = at(q.from), b = at(q.to);
      A.boat(ctx, a[0] + (b[0] - a[0]) * q.p, a[1] + (b[1] - a[1]) * q.p, W > 500 ? 20 : 10, { village: q.side, k: q.k, state: q.out >= 1 ? 'out' : q.to === 'port' && q.p >= 1 ? 'port' : q.to === 'port' ? q.from : q.to, me: q.me, t: s.t });
    });
  }
  function cardEl(kind, w, h, flip, s) {
    var box = el('div', 'cardbox'), c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1);
    sizeCanvas(c, w, h, d); var ctx = c.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
    if (A && kind) A.card(ctx, 0, 0, w, h, { kind: kind, t: s.t });
    c.style.transform = 'rotateY(' + Math.round(flip * 180) + 'deg)'; box.appendChild(c); return box;
  }

  /* DOM은 «바뀐 것이 있을 때만» 다시 만든다(시안 2: 매 프레임 DOM 재생성 = 41 ms) — 캔버스 · 3D는 매 프레임 */
  var lastKey = '';
  function domKey(s) {
    return [V.mode, V.code, V.g, V.i, s.phase, s.timer, V.rows ? 1 : 0, Object.keys(V.chosen).length, s.cardBig ? 1 : 0, Math.round(s.cardFlip * 10), s.locR >= 0.67 * T.result ? 1 : 0, V.myCh, V.myDep, V.paused ? 1 : 0, V.joined.length, s.me ? s.me.isOut : '', s.alive.west + s.alive.east].join('|');
  }
  function frame() {
    hostTick();
    var s = snapNow(), key = domKey(s), dom = key !== lastKey; lastKey = key;
    if (HOST) drawTV(s, dom); else drawPhone(s);
    requestAnimationFrame(frame);
  }

  var ctl = el('div', null, null, 'position:absolute;inset:0;pointer-events:none'), ctlKey = '';
  if (HOST) tv.appendChild(ctl);
  function buildCtl() {   /* 교사 조작 단추 · 입력칸 — 단계가 바뀔 때만 새로 만든다(10-31 E2E: 누르는 사이에 바뀌면 터치가 사라짐) */
    ctl.innerHTML = '';
    if (V.mode === 'gate') {
      var gf = el('div', 'tvform'); gf.innerHTML = '<input id="tpw" type="password" inputmode="numeric" maxlength="12" placeholder="' + TX.ph.teacher + '"><button id="tok">' + TX.btn.ok + '</button>';
      ctl.appendChild(gf);
      var go = function () { var p = gf.querySelector('#tpw'); sha256hex('elnino:' + p.value).then(function (h) { if (h !== TEACH_HASH) { p.value = ''; shake(p); return; } try { localStorage.setItem('elnino-teacher', h); } catch (e) {} V.mode = 'make'; }); };
      gf.querySelector('#tok').onclick = go; gf.querySelector('#tpw').onkeydown = function (e) { if (e.key === 'Enter') go(); };
    } else if (V.mode === 'make') {
      var f = el('div', 'tvform'); f.innerHTML = '<input id="pin" inputmode="numeric" maxlength="8" placeholder="' + TX.ph.pin + '"><button id="mk">' + TX.btn.make + '</button>';
      ctl.appendChild(f);
      f.querySelector('#mk').onclick = function () { var p = f.querySelector('#pin'), bt = this; if (!/^\d{4,8}$/.test(p.value)) { shake(p); return; } bt.disabled = true; hostMake(p.value).catch(function (e) { console.error(e); bt.disabled = false; shake(p); }); };
      var g2 = el('div', 'tvform', null, 'top:420px'); g2.innerHTML = '<input id="rcode" inputmode="numeric" maxlength="4" placeholder="' + TX.ph.room + '"><input id="rpin" inputmode="numeric" maxlength="8" placeholder="' + TX.ph.pin + '"><button id="rj">' + TX.btn.join + '</button>';
      ctl.appendChild(g2);
      g2.querySelector('#rj').onclick = function () { var c = g2.querySelector('#rcode'), p = g2.querySelector('#rpin'), bt = this; if (!/^\d{4}$/.test(c.value)) { shake(c); return; } if (!/^\d{4,8}$/.test(p.value)) { shake(p); return; } bt.disabled = true;
        NET.signIn().then(function () { return NET.claimHost(c.value, p.value); }).then(function (okc) { if (!okc) { bt.disabled = false; shake(p); return; } return hostRecover(c.value); }).catch(function (e) { console.error(e); bt.disabled = false; shake(c); }); };
    } else if (V.mode === 'lobby' || V.mode === 'end') {
      var a = el('button', 'tvbtn main', TX.btn.practice, 'left:300px;top:470px'), b = el('button', 'tvbtn main', TX.btn.real, 'left:520px;top:470px');
      a.id = 'bPractice'; b.id = 'bReal';
      a.onclick = function () { hostStart(true); }; b.onclick = function () { hostStart(false); };
      ctl.appendChild(a); ctl.appendChild(b);
      var lv = el('button', 'tvbtn', TX.btn.leave, 'left:12px;top:10px'); lv.id = 'bLeave'; lv.onclick = hostLeave; ctl.appendChild(lv);
    } else if (V.mode === 'play') {
      var pb = el('button', 'tvbtn', TX.btn.pause, 'left:12px;top:10px'); pb.onclick = hostPause; ctl.appendChild(pb);
      var lv2 = el('button', 'tvbtn', TX.btn.leave, 'left:12px;top:62px'); lv2.id = 'bLeave'; lv2.onclick = hostLeave; ctl.appendChild(lv2);   /* 멈춘 동안만 눌림(실수로 판을 깨지 않게) */
      elninoIcon(ctl);
    }
  }
  function drawTV(s, dom) {
    if (V.mode !== ctlKey) { ctlKey = V.mode; buildCtl(); }
    var bp = document.getElementById('bPractice'), br = document.getElementById('bReal');
    if (bp) bp.disabled = br.disabled = V.joined.length === 0 || H.busy;
    var bl = document.getElementById('bLeave'); if (bl) bl.disabled = H.busy || (V.mode === 'play' && !V.paused);

    var ctx = tvc2.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var bctx = bd2.getContext('2d'); bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (V.mode === 'play' || V.mode === 'lobby' || V.mode === 'make' || V.mode === 'gate') {
      if (W3) { W3.update(s.t, state3(s)); W3.render(); } else { bctx.clearRect(0, 0, 900, 560); board2D(bctx, 900, 560, s); }
    }
    if (!dom) return;
    ctx.clearRect(0, 0, 1366, 768); tvov.innerHTML = ''; bdov.innerHTML = '';
    document.getElementById('board').style.visibility = V.mode === 'end' ? 'hidden' : 'visible';
    if (V.mode === 'make' || V.mode === 'gate') { drawRank(ctx, s); return; }
    if (V.mode === 'lobby') {
      bdov.appendChild(el('div', 'ov bigcode', V.code));
      bdov.appendChild(el('div', 'ov lobbyppl', '<span class="chip">' + icon('people') + '<span>' + V.joined.length + '</span></span>'));
      tvov.appendChild(el('div', 'usr', TX.user.lobbyTV, 'left:24px;top:500px'));
      drawRank(ctx, s); return;
    }
    if (V.mode === 'end') { drawEnd(ctx, s); return; }
    /* play */
    var hud = el('div', 'ov hud');
    hud.innerHTML = '<span class="chip">' + icon('turn') + '<span>' + V.i + '</span></span><span class="chip">' + icon('timer') + '<span>' + s.timer + '</span></span>';
    bdov.appendChild(hud);
    ['west', 'east'].forEach(function (side, si) {
      var kind = s.cards[side]; if (!kind) return;
      if (s.cardBig) { var cb = cardEl(kind, 130, 173, s.cardFlip, s); cb.style.left = (si ? 900 - 160 - 130 : 160) + 'px'; cb.style.top = '60px'; bdov.appendChild(cb); }
      else { var cs = cardEl(kind, 72, 96, 0, s); cs.style.left = (20 + si * 450 + 330) + 'px'; cs.style.top = '596px'; tvov.appendChild(cs); }
    });
    if (s.cardBig && (s.cards.west || s.cards.east)) bdov.appendChild(el('div', 'usr', TX.user.cardTV, 'left:50%;top:250px;transform:translateX(-50%)'));
    villageBoxes(ctx, s);
    drawRank(ctx, s);
  }
  function villageBoxes(ctx, s) {
    ['west', 'east'].forEach(function (side, si) {
      var x = 20 + si * 450; ctx.fillStyle = side === 'west' ? '#fde7cf' : '#d6ebf7'; ctx.fillRect(x - 10, 576, 430, 176);
      tvov.appendChild(el('div', 'ov vhead', icon(side === 'west' ? 'westVillage' : 'eastVillage') + '<span class="chip" style="font-size:18px">' + icon('people') + '<span>' + s.alive[side] + '</span></span><span class="chip" style="font-size:18px">' + icon('store') + '<span>' + num(s.box[side] || 0) + '</span></span>', 'left:' + x + 'px;top:590px;color:var(--' + side + ')'));
    });
  }
  function drawRank(ctx, s) {
    var x0 = 900; ctx.fillStyle = '#f5f7fa'; ctx.fillRect(x0, 0, 466, 768);
    var list = s.players.length ? s.players.slice() : V.joined.map(function (r, i) { return { id: i, nick: r.nick, side: r.side || (i % 2 ? 'east' : 'west'), k: i % 15, st: B.st0, score: 0, isOut: false }; });
    list.sort(function (a, b) { return ((a.isOut ? 1 : 0) - (b.isOut ? 1 : 0)) || (b.score - a.score) || (b.st - a.st) || (a.id - b.id); });
    var prevScore = null, rk = 0;
    list.forEach(function (q, ix) {
      var y = 6 + ix * 25; if (y > 740) return;
      if (!q.isOut && q.score !== prevScore) { rk = ix + 1; prevScore = q.score; }
      if (A) A.boat(ctx, x0 + 52, y + 12, 18, { village: q.side, k: q.k, state: q.isOut ? 'out' : 'port', me: false, t: s.t });
      ctx.fillStyle = '#e3e6ea'; ctx.fillRect(x0 + 330, y + 9, 110, 7);
      ctx.fillStyle = q.st <= 3 ? '#b91c1c' : '#15803d'; ctx.fillRect(x0 + 330, y + 9, 110 * Math.max(0, q.st) / B.maxSt, 7);
      if (q.chosen && s.phase === 'choose') { ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(x0 + 452, y + 12, 4, 0, 7); ctx.fill(); }
      tvov.appendChild(el('div', 'ov rank', '<span class="r">' + (q.isOut ? '' : rk) + '</span><span style="width:40px"></span><span class="n" style="color:var(--' + q.side + ')">' + nickSlot(q.nick) + '</span><span class="cellnum">' + icon('fish') + '<span>' + num(q.score) + '</span></span>' + (q.pop ? '<span class="rankpop">+' + q.pop + '</span>' : ''), 'left:' + (x0 + 4) + 'px;top:' + y + 'px'));
    });
  }
  function elninoIcon(host) {   /* D16 — 교사만 아는 자리 · 1.5초 길게 누르기 · 화면에는 고리만 차오름(TV 판은 바뀌지 않음) */
    var e = el('div', 'elnino-ic', icon('elnino', 24) + '<div class="ring"></div>'), t0 = 0, tm = null;
    var ring = e.querySelector('.ring');
    function down(ev) { ev.preventDefault(); t0 = now(); ring.style.borderColor = 'rgba(37,99,235,.6)'; tm = setTimeout(function () { hostTrigger(); ring.style.borderColor = 'transparent'; }, 1500); }
    function up() { clearTimeout(tm); ring.style.borderColor = 'transparent'; }
    e.addEventListener('pointerdown', down); e.addEventListener('pointerup', up); e.addEventListener('pointerleave', up);
    host.appendChild(e);
  }
  function drawEnd(ctx, s) {
    var gx = 70, gy = 70, gw = 760, gh = 380, lg = V.log, n = lg ? lg.fishE.length : 0, rk = V.rank;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 900, 768);
    if (!lg || !n) return;
    var X = function (i) { return gx + gw * (i - 0.5) / n; }, Y = function (v) { return gy + gh - gh * Math.min(1, v / 1.2); };
    if (rk.onset != null) { var on = rk.onset, band = function (a, b, col) { if (b < 1 || a > n) return; ctx.fillStyle = col; ctx.fillRect(X(Math.max(1, a)) - gw / n / 2, gy, gw / n * (Math.min(n, b) - Math.max(1, a) + 1), gh); };
      band(on, on + B.preLen - 1, 'rgba(251,146,60,.14)'); band(on + B.preLen, on + B.preLen + B.fullLen - 1, 'rgba(185,28,28,.14)'); band(on + B.preLen + B.fullLen, on + B.preLen + B.fullLen + B.recLen - 1, 'rgba(251,146,60,.14)'); }
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    function line(arr, col, w, dash, k) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); arr.forEach(function (v, j) { var x = X(j + 1), y = Y(v * (k || 1)); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]); }
    line(lg.fishW, '#b45309', 4); line(lg.fishE, '#0f5c8c', 4);
    line(lg.catchW, 'rgba(180,83,9,.55)', 2, [6, 5], 1 / 7); line(lg.catchE, 'rgba(15,92,140,.55)', 2, [6, 5], 1 / 7);
    [1, Math.ceil(n / 4), Math.ceil(n / 2), Math.ceil(3 * n / 4), n].forEach(function (i) { tvov.appendChild(el('div', 'ov', '<span>' + i + '</span>', 'left:' + (X(i) - 8) + 'px;top:' + (gy + gh + 6) + 'px;font-size:15px;color:#5b636b')); });
    tvov.appendChild(el('div', 'ov', icon('turn'), 'left:' + (gx + gw + 8) + 'px;top:' + (gy + gh - 14) + 'px'));
    tvov.appendChild(el('div', 'ov', icon('fish'), 'left:' + (gx - 40) + 'px;top:' + (gy - 6) + 'px'));
    ['west', 'east'].forEach(function (side, si) {
      tvov.appendChild(el('div', 'ov', icon(side === 'west' ? 'westVillage' : 'eastVillage'), 'left:' + (gx - 40) + 'px;top:' + (gy + gh + 34 + si * 34) + 'px'));
      lg.cards.forEach(function (c, j) { if (c && c[side]) tvov.appendChild(el('div', 'ov', icon(c[side]), 'left:' + (X(j + 1) - 14) + 'px;top:' + (gy + gh + 34 + si * 34) + 'px')); });
      var x = 20 + si * 450; ctx.fillStyle = side === 'west' ? '#fde7cf' : '#d6ebf7'; ctx.fillRect(x - 10, 576, 430, 176);
      tvov.appendChild(el('div', 'ov vhead', icon(side === 'west' ? 'westVillage' : 'eastVillage') + '<span class="chip">' + icon('people') + '<span>' + rk.surv[side] + '</span></span><span class="chip">' + icon('out') + '<span>' + (rk.n[side] - rk.surv[side]) + '</span></span><span class="chip">' + icon('fish') + '<span>' + num(rk.mean[side]) + '</span></span>', 'left:' + x + 'px;top:600px;color:var(--' + side + ')'));
    });
    tvov.appendChild(el('div', 'usr', TX.user.endTV, 'left:70px;top:16px'));
    var x0 = 900; ctx.fillStyle = '#f5f7fa'; ctx.fillRect(x0, 0, 466, 768);
    rk.order.forEach(function (o, ix) {
      var m = metaById(o.id); if (!m) return; var y = 6 + ix * 25; if (y > 740) return;
      if (A) A.boat(ctx, x0 + 52, y + 12, 18, { village: m.side, k: m.k, state: 'port', me: false, t: s.t });
      tvov.appendChild(el('div', 'ov rank', '<span class="r">' + (o.rank === 1 ? icon('crown', 20) : o.rank) + '</span><span style="width:40px"></span><span class="n" style="color:var(--' + m.side + ')">' + nickSlot(m.nick) + '</span><span class="cellnum">' + icon('fish') + '<span>' + num(o.score) + '</span></span>', 'left:' + (x0 + 4) + 'px;top:' + y + 'px'));
    });
  }

  /* 휴대폰 — 단추는 «구조»가 바뀔 때만 만들고(10-31 E2E: 남은 시간 · 카드 뒤집기마다 단추를 새로 만들어 터치가 사라짐) 값은 제자리 갱신 */
  var phStruct = '', PH = {}, phVal = '', SLOW = { n: 0, ema: 0 };
  function phoneStructKey(s) { var me = s.me; return [V.mode, V.code, V.meId, me ? (me.isOut ? 'out' : 'in') : 'none', V.mode === 'end' ? JSON.stringify(V.rank && V.meId != null ? V.rank.byId[V.meId] : '') : ''].join('|'); }
  function buildPhone(s) {
    phov.innerHTML = ''; PH = {};
    var w = phW(), me = s.me;
    if (V.mode === 'join') {
      phov.appendChild(el('div', 'usr', TX.user.lobbyPhone));
      var f = el('div', 'pform', '<input id="rc" inputmode="numeric" maxlength="4" placeholder="' + TX.ph.room + '"><input id="nk" maxlength="8" placeholder="' + TX.ph.nick + '"><button id="jn">' + TX.btn.join + '</button>');
      phov.appendChild(f);
      f.querySelector('#jn').onclick = function () { stuJoin(f.querySelector('#rc').value.trim(), f.querySelector('#nk').value.trim(), f.querySelector('#rc'), f.querySelector('#nk')); };
      return;
    }
    if (V.mode === 'wait' || (V.mode === 'play' && !me)) { phov.appendChild(el('div', 'pwait', icon('people', 64) + '<div>' + V.code + '</div>')); return; }
    if (V.mode === 'end') {
      var e = V.rank && V.meId != null ? V.rank.byId[V.meId] : null;
      phov.appendChild(el('div', 'pend', (e && e.rank === 1 ? icon('crown', 60) : e && e.out ? icon('out', 60) : '') + '<div>' + (e && e.rank ? e.rank : '') + '</div><div class="row">' + icon('fish', 36) + '<span>' + (e ? num(e.score) : '') + '</span></div>'));
      return;
    }
    PH.top = document.createElement('canvas'); sizeCanvas(PH.top, w, 56, Math.min(3, window.devicePixelRatio || 1)); phov.appendChild(PH.top);
    PH.hud = el('div', 'phud'); phov.appendChild(PH.hud);
    PH.sea = el('div', 'sea', null, 'height:' + SEAH + 'px'); phov.appendChild(PH.sea);
    if (X3 && phoneWorld(me.side)) PH.sea.appendChild(phCanvas); else { PH.sea2 = document.createElement('canvas'); sizeCanvas(PH.sea2, w, SEAH, Math.min(3, window.devicePixelRatio || 1)); PH.sea.appendChild(PH.sea2); }
    PH.over = el('div', null, null, 'position:absolute;inset:0;pointer-events:none'); PH.sea.appendChild(PH.over);
    PH.usr = el('div', 'usr', ''); phov.appendChild(PH.usr);
    if (me.isOut) { PH.sea.appendChild(el('div', 'pout', icon('out', 72))); return; }
    var btns = el('div', 'pbtns'); PH.btn = {};
    ['near', 'far', 'rest'].forEach(function (k) {
      var b = el('button', '', (icon3(k, me.side) || icon(k, 30)) + '<span class="lb">' + TX.btn[k] + '</span><span class="cost">' + icon('stamina', 16) + '<span class="cv">' + ({ near: '−' + CORE.B.nearSt, far: '−' + CORE.B.farSt, rest: '+' + CORE.B.rest })[k] + '</span></span>'); b.type = 'button'; b.dataset.k = k;
      b.addEventListener('click', function () { stuChoose(k); }); btns.appendChild(b); PH.btn[k] = b;
    });
    phov.appendChild(btns);
    var dp = el('div', 'pcoop', '<button type="button" data-k="store">' + (icon3('store', me.side) || icon('store', 22)) + '<span>' + TX.btn.store + '</span><span class="cost">' + icon('fish', 16) + '<span>−1</span></span><span class="dn"></span></button>');
    PH.dep = dp.querySelector('button'); PH.depN = dp.querySelector('.dn'); PH.dep.addEventListener('click', stuDeposit); phov.appendChild(dp);
  }
  function drawPhone(s) {
    var key = phoneStructKey(s); if (key !== phStruct) { phStruct = key; phVal = ''; buildPhone(s); }
    var w = phW(), me = s.me; if (V.mode !== 'play' || !me || !PH.hud) return;
    var side = me.side, ex = s.env, c = s.cards[side];
    if (P3 && PH.sea.contains(phCanvas)) {
      var tf = performance.now(); P3.update(s.t, state3(s, side)); P3.render(); var df = performance.now() - tf;
      SLOW.n++; SLOW.ema = SLOW.n < 5 ? df : SLOW.ema * 0.9 + df * 0.1;
      if (SLOW.n > 30 && SLOW.ema > 70) { try { P3.dispose(); } catch (e) {} P3 = null; X3 = null; phStruct = ''; window.__fellBack2D = Math.round(SLOW.ema); }   /* 느린 휴대폰 = 2D 그림(대체 화면) */
    }
    else if (A && PH.sea2) {
      var cx = PH.sea2.getContext('2d'), d2 = PH.sea2.width / w; cx.setTransform(d2, 0, 0, d2, 0, 0);
      A.sea(cx, w, SEAH, { side: side, t: s.t, fish: side === 'east' ? ex.fishE : ex.fishW, warm: side === 'east' ? ex.warmE : 0, upwell: side === 'east' ? ex.upwell : 0.2, rain: side === 'east' ? ex.rainE : ex.rainW, flood: c === 'flood' ? 0.8 : 0, drought: side === 'west' ? ex.drought : 0, fire: c === 'fire' ? 0.8 : 0, sel: me.chosen ? (V.myCh || me.ch) : null });
      var an = A.seaAnchors(w, SEAH, side), za = an[me.from], zb = an[me.to], ax = za[0] + za[2] / 2, ay = za[1] + za[3] / 2;
      A.boat(cx, ax + (zb[0] + zb[2] / 2 - ax) * me.p, ay + (zb[1] + zb[3] / 2 - ay) * me.p, 30, { village: side, k: me.k, state: me.out >= 1 ? 'out' : me.to, me: true, t: s.t });
    }
    if (A) { var tc = PH.top.getContext('2d'), d = PH.top.width / w; tc.setTransform(d, 0, 0, d, 0, 0); A.strip(tc, w, 56, { t: s.t, wind: ex.wind, warmE: ex.warmE, coolW: ex.coolW, side: side }); }
    /* 값(글자 · 카드 · «+n» · 선택 표시) — 바뀐 때만 · 단추 요소는 그대로 두고 속성만 바꾼다 */
    var myCh = V.myCh || (s.phase === 'result' ? me.ch : null);
    var vk = [num(me.st), num(me.store), s.timer, V.i, me.pop || '', c || '', s.cardBig ? Math.round(s.cardFlip * 10) : 'x', myCh, V.myDep, s.phase].join('|');
    if (vk === phVal) return; phVal = vk;
    PH.hud.innerHTML = '<span>' + icon('stamina') + '<span>' + num(me.st) + '</span></span><span>' + icon('fish') + '<span>' + num(me.store) + '</span></span><span>' + icon('timer') + '<span>' + s.timer + '</span></span><span>' + icon('turn') + '<span>' + V.i + '</span></span>';
    PH.over.innerHTML = '';
    if (me.pop) PH.over.appendChild(el('div', 'pop', '+' + me.pop, 'left:50%;top:45%'));
    if (c && s.cardBig) { var cb = cardEl(c, 96, 128, s.cardFlip, s); cb.style.right = '8px'; cb.style.top = '8px'; PH.over.appendChild(cb); }
    PH.usr.textContent = c && s.cardBig ? TX.user.cardPhone : '';
    if (PH.btn) ['near', 'far', 'rest'].forEach(function (k) {
      var b = PH.btn[k]; b.classList.toggle('sel', myCh === k);
      if (k === 'rest') b.querySelector('.cv').textContent = '+' + (c === 'flood' ? CORE.B.restFlood : c === 'drought' ? CORE.B.restDrought : CORE.B.rest);   /* core 쉬기 규칙과 같은 원천 */ b.disabled = s.phase === 'result' || (c === 'flood' && k !== 'rest');
    });
    if (PH.dep) { PH.dep.disabled = s.phase === 'result'; PH.depN.textContent = V.myDep ? String(V.myDep) : ''; }
  }

  /* 재접속(학생): 같은 기기 세션 + 저장된 방 코드 → 다시 구독하고 다음 방송을 기다림 */
  if (!HOST) {
    var saved = null; try { saved = localStorage.getItem('elnino-room'); } catch (e) {}
    if (saved) NET.signIn().then(function () { return NET.getRoom(saved); }).then(function (room) {
      if (!room || room.status === 'end') { try { localStorage.removeItem('elnino-room'); } catch (e) {} return; } V.code = saved; return NET.subscribe(saved, { turn: stuOnMsg }, false).then(function () { V.mode = 'wait'; });
    }).catch(function () {});
  }
  if (HOST) { var hs = null; try { hs = localStorage.getItem('elnino-host'); } catch (e) {}
    if (hs && teacherOk()) NET.signIn().then(function () { return hostRecover(hs); }).catch(function () { try { localStorage.removeItem('elnino-host'); } catch (e) {} }); }
  window.__elnino = { V: V, H: H, snap: snapNow, T: function () { return T; }, three: function () { return !!(W3 || P3); } };
  requestAnimationFrame(frame);
})();
