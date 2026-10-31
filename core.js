/* 엘니뇨 어부 버티기 게임 — 계산부(단일 원천 · 호스트 권위). 설계지시안 v1 초안(2026-10-31).
   P0(승인 10-31): 전조 = 무역풍 약화 → 본격 = 동쪽 표층 수온 상승이 «구간 내내» 지속(물고기 떼 감소 = 바다 상태) → 회복.
   현상 카드는 그 위에 마을별 본격 턴마다 1장(교 76 · 77 · 지 172 문장 6종). 서쪽 수온은 식되(지 172 표) 서쪽 물고기는 불변.
   라니냐 없음. 모든 효과량은 게임 균형값(실제 단위 없음). 시안 결정: E both · C store · 두 마을 · 빠른 흐름.
   전역 ELNINO_CORE 하나. ES5 · 모듈 · fetch · 저장 없음. 난수는 고정 시드(호스트가 시드를 정한다). */
/* v1.1(10-31 · P-검토 A1 · B3 · B4 · B5 반영): 본격 첫 턴 충격 3 · 서쪽 첫 장 가뭄 · 앞당김 기준 · D12 나간 배당 · 창고 규칙 · eNorm 1.2 → 1.05(1위 마을 공정 — C4b) */
/* 균형값 v1(10-31 · elnino_balance.js 스윕 — 설계지시안 §5): storeMax 10 · priceUp 3 · eNorm 1.2 · eDrop 0.9 · depKeep 5 · 가뭄 = 물 부족 체력 −1(쉬기 +2는 그대로) · 생활비 부족 체력 −1 */
var ELNINO_CORE = (function () {
  'use strict';
  var B = {
    turns: 24, practiceTurns: 6,
    maxSt: 10, st0: 8, store0: 6, storeMax: 10,
    cost: 3, priceUp: 3,
    near: 4, far: 7, nearSt: 1, farSt: 2, rest: 2,
    shortSt: 1,                       /* 생활비가 모자라면 체력 −1(시안의 −2는 «빈 창고 함정»: 쉬어도 영원히 제자리) */
    vLo: 0.8, vHi: 1.2,               /* 어획 변동 폭 */
    fishW: 0.85, eDrop: 0.9, eNorm: 1.05,   /* 서쪽 물고기 떼 밀도(판 내내) · 동쪽 = eNorm × (1 − eDrop × warmE) — 평상시 동쪽 = 용승 어장(교 76 «좋은 어장») */
    restDrought: 2, restFlood: 1, droughtWater: 1,   /* 가뭄 · 홍수 턴의 쉬기 · 가뭄(물 부족) 턴에 서쪽 전원 체력 − */
    onsetMin: 7, onsetMax: 11,        /* 자동 발생: 전조 첫 턴(학급 공통 · 판마다 시드로) */
    preLen: 2, fullLen: 6, recLen: 2,
    shock: 3, shockW: null,   /* shockW: 서쪽 충격(없으면 shock) */
                            /* v1.1(P-검토 A1): 본격 첫 턴 충격 — 동쪽 'warm'(그물이 빔 · 생계 충격) · 서쪽 첫 장 'drought'(가뭄 시작) 카드를 받은 살아 있는 어부 전원 체력 −shock. 미리 체력을 채운 어부만 버팀 = 전조를 읽을 이유 */
    depKeep: 5                        /* 봇 규칙: 창고가 이만큼 넘으면 남는 것을 마을 창고에 맡김(10-31: 8이면 상한 10 − 생활비 3 = 7을 못 넘어 맡기기 0회) */
  };
  var CARDS = { east: ['eco', 'flood', 'price'], west: ['drought', 'fire', 'price'] };   /* 동쪽 첫 본격 턴은 늘 'warm' */

  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* 엘니뇨 구간 — 단일 원천. onset = 전조 첫 턴(null = 이 판에 엘니뇨 없음 · 연습 판) */
  function phaseOf(i, onset) {
    if (onset == null) return 'normal';
    var k = i - onset;
    if (k < 0) return 'normal';
    if (k < B.preLen) return 'pre';
    if (k < B.preLen + B.fullLen) return 'full';
    if (k < B.preLen + B.fullLen + B.recLen) return 'rec';
    return 'normal';
  }
  function envOf(i, onset) {
    var ph = phaseOf(i, onset), k = onset == null ? 0 : i - onset, f = k - B.preLen, r = f - B.fullLen;
    var wind = 1, warmE = 0;
    if (ph === 'pre') { wind = [0.65, 0.45][k]; warmE = [0.12, 0.3][k]; }
    if (ph === 'full') { wind = 0.2; warmE = [0.8, 1, 1, 1, 1, 0.9][f]; }
    if (ph === 'rec') { wind = [0.5, 0.8][r]; warmE = [0.5, 0.2][r]; }
    return {
      phase: ph, wind: wind, warmE: warmE, coolW: 0.6 * warmE, upwell: 1 - 0.9 * warmE,
      fishE: B.eNorm * (1 - B.eDrop * warmE), fishW: B.fishW,
      rainE: ph === 'full' ? 1 : ph === 'normal' ? 0 : 0.3, rainW: ph === 'full' ? 0.1 : ph === 'normal' ? 1 : 0.6,
      drought: ph === 'full' ? Math.min(1, 0.4 + 0.12 * f) : ph === 'rec' ? 0.3 : 0
    };
  }

  /* 본격 턴마다 마을별 카드 한 장 — 동쪽 첫 장은 'warm', 같은 카드가 세 번 이어지지 않게 */
  function dealCards(r, two) {
    var out = { east: ['warm'], west: ['drought'] }, side, i, c;   /* v1.1: 서쪽 첫 장 = 가뭄 시작(충격 카드) */
    ['east', 'west'].forEach(function (s) {
      side = CARDS[s];
      for (i = out[s].length; i < B.fullLen; i++) {
        do { c = side[Math.floor(r() * side.length)]; } while (i >= 2 && out[s][i - 1] === c && out[s][i - 2] === c);
        out[s].push(c);
      }
    });
    if (!two) out.west = [];
    return out;
  }

  /* 새 판. opt = { seed, two:bool, coop:'none'|'store', practice:bool, onset:수|null(자동) } */
  function newGame(opt) {
    var r = rng(opt.seed >>> 0), practice = !!opt.practice;
    var onset = practice ? null : (opt.onset != null ? opt.onset : B.onsetMin + Math.floor(r() * (B.onsetMax - B.onsetMin + 1)));
    return {
      r: r, two: opt.two !== false, coop: opt.coop || 'store', practice: practice,
      turns: practice ? B.practiceTurns : B.turns, turn: 0, onset: onset, autoOnset: onset,
      deck: dealCards(r, opt.two !== false), players: [], box: { west: 0, east: 0 }, flow: { dep: 0, wd: 0 },
      log: [], over: false
    };
  }
  /* 입장 — 두 마을이면 인원이 적은 쪽으로(같으면 서쪽) */
  function addPlayer(g, nick) {
    var n = { west: 0, east: 0 }; g.players.forEach(function (p) { n[p.side]++; });
    var side = !g.two ? 'east' : n.west <= n.east ? 'west' : 'east';
    var p = { id: g.players.length, nick: nick, side: side, st: B.st0, store: B.store0, score: 0, out: 0 };
    g.players.push(p); return p;
  }
  /* 교사 [엘니뇨 일으키기] — 아직 시작 전이면 «다음 턴»을 전조 첫 턴으로 앞당긴다(E both · 늦출 수는 없다) */
  /* v1.1(P-검토 B3): newsShown = 지금 턴(g.turn + 1)의 바다 소식이 이미 화면에 나갔는가(고르는 중이면 true).
     전조는 «아직 소식이 안 나간 첫 턴»부터 — 이미 보인 평상시 바다를 소급해 전조로 바꾸지 않는다 */
  function trigger(g, newsShown) {
    if (g.practice || g.onset == null) return false;
    var next = g.turn + (newsShown ? 2 : 1);
    if (next >= g.onset) return false;
    if (next + B.preLen + B.fullLen + B.recLen - 1 > g.turns) return false;
    g.onset = next; return true;
  }
  function cardOf(g, i, side) {
    if (phaseOf(i, g.onset) !== 'full') return null;
    return g.deck[side][i - g.onset - B.preLen] || null;
  }

  /* 한 턴 판정(호스트 권위). choices = { <id>: 'near'|'far'|'rest' } — 없는 학생 = 시간 초과 = 쉬기.
     deposits = { <id>: n } — [맡기기](C store) — 판정 «뒤» 자기 창고에서 n만큼 마을 창고로. */
  function resolveTurn(g, choices, deposits) {
    if (g.over) return null;
    var i = ++g.turn, env = envOf(i, g.onset), r = g.r, rec = { i: i, env: env, cards: { west: cardOf(g, i, 'west'), east: cardOf(g, i, 'east') }, rows: [] };
    var sum = { west: { c: 0, n: 0, out: 0 }, east: { c: 0, n: 0, out: 0 } };
    g.players.forEach(function (p) {
      var row = { id: p.id, before: { st: p.st, store: p.store, score: p.score } };
      if (p.out) { row.ch = null; row.after = row.before; rec.rows.push(row); return; }
      var card = rec.cards[p.side], ch = choices && choices[p.id] || 'rest';
      if (ch !== 'near' && ch !== 'far' && ch !== 'rest') ch = 'rest';
      if (card === 'flood') ch = 'rest';                 /* 출항 금지 */
      var shock = card === 'warm' ? B.shock : (card === 'drought' && i === g.onset + B.preLen) ? Math.max(0, (B.shockW != null ? B.shockW : B.shock) - B.droughtWater) : 0;   /* v1.1: 본격 첫 턴 충격(서쪽은 가뭄 물 부족과 합쳐 shock) */
      p.st -= shock; row.shock = shock;
      var dens = p.side === 'east' ? env.fishE : env.fishW, v = B.vLo + (B.vHi - B.vLo) * r(), c = 0;
      if (ch === 'near') { c = Math.round(B.near * dens * v); p.st -= B.nearSt; }
      if (ch === 'far') { c = Math.round(B.far * dens * v * (card === 'fire' ? 2 * r() : 1)); p.st -= B.farSt; }
      if (ch === 'rest') p.st = Math.min(B.maxSt, p.st + (card === 'drought' ? B.restDrought : card === 'flood' ? B.restFlood : B.rest));
      if (card === 'drought') p.st -= B.droughtWater;
      var small = card === 'eco' ? Math.floor(c / 2) : 0;
      p.score += (c - small) + small * 0.5;
      p.store = Math.min(B.storeMax, p.store + c) - B.cost - (card === 'price' ? B.priceUp : 0);
      var wd = 0, active = !!(choices && choices[p.id]);
      /* v1.1(P-검토 B5): 마을 창고는 «이번 턴에 고른» 어부만 · 모자람을 «다 메울 수 있을 때»만 꺼냄(일부만 꺼내고 −1까지 받는 낭비 방지 · 시간 초과 학생의 무임승차 방지) */
      if (p.store < 0 && g.coop === 'store' && active && g.box[p.side] >= -p.store) { wd = -p.store; g.box[p.side] -= wd; p.store += wd; }
      if (p.store < 0) { p.store = 0; p.st -= B.shortSt; }
      var dep = 0;
      if (g.coop === 'store' && deposits && deposits[p.id] > 0 && p.st > 0) { dep = Math.min(Math.floor(deposits[p.id]), p.store); p.store -= dep; g.box[p.side] += dep; }
      g.flow.dep += dep; g.flow.wd += wd;
      if (p.st <= 0) { p.st = 0; p.out = i; }
      sum[p.side].c += c; sum[p.side].n++; if (ch !== 'rest') sum[p.side].out++;
      row.ch = ch; row.catch = c; row.small = small; row.dep = dep; row.wd = wd;
      row.after = { st: p.st, store: p.store, score: p.score };
      rec.rows.push(row);
    });
    /* D12 — 물고기 수 변화 기록(바다의 물고기 떼 밀도 · 나간 배당 평균 어획) */
    rec.fishE = env.fishE; rec.fishW = env.fishW;
    /* v1.1(P-검토 B4): 나간 배 수 · 잡은 합 · 나간 배당 · 살아 있는 어부당을 따로 기록(그래프는 «나간 배당»을 그린다) */
    ['east', 'west'].forEach(function (sd) { var k = sd === 'east' ? 'E' : 'W', q = sum[sd];
      rec['boats' + k] = q.out; rec['catchSum' + k] = q.c; rec['catchPerBoat' + k] = q.out ? q.c / q.out : 0; rec['catchPerAlive' + k] = q.n ? q.c / q.n : 0; });
    rec.catchE = rec.catchPerBoatE; rec.catchW = rec.catchPerBoatW;
    rec.box = { west: g.box.west, east: g.box.east }; rec.flow = { dep: g.flow.dep, wd: g.flow.wd };
    g.log.push(rec);
    if (i >= g.turns) g.over = true;
    return rec;
  }
  /* 순위 — 살아남은 어부만 · 점수(작은 물고기 ½)가 같으면 같은 순위(D18 공동 1위 · 10-31) · 보이는 순서만 남은 체력 → 입장 순.
     반환은 사본(rank 붙임) — 플레이어 객체를 바꾸지 않는다 */
  function standings(g) {
    var list = g.players.filter(function (p) { return !p.out; }).slice().sort(function (a, b) { return b.score - a.score || b.st - a.st || a.id - b.id; });
    return list.map(function (p, i) {
      var q = {}, k; for (k in p) q[k] = p[k];
      q.rank = i > 0 && list[i - 1].score === p.score ? null : i + 1;
      return q;
    }).map(function (q, i, arr) { if (q.rank === null) { var j = i; while (arr[j].rank === null) j--; q.rank = arr[j].rank; } return q; });
  }
  return { B: B, CARDS: CARDS, rng: rng, phaseOf: phaseOf, envOf: envOf, newGame: newGame, addPlayer: addPlayer, trigger: trigger, cardOf: cardOf, resolveTurn: resolveTurn, standings: standings, clamp: clamp };
})();
if (typeof module !== 'undefined') module.exports = ELNINO_CORE;
