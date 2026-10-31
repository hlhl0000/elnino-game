/* 엘니뇨 어부 게임 — 통신 블록(설계지시안 v1.2 §2 · §4). 통신 코드는 «전부» 이 파일에만 있다(popgame CLASSROOM 블록 원칙 승계).
   의존: vendor/supabase.js(전역 supabase) · config.js(ELNINO_CONFIG). Promise 기반 · ES5 문법.
   ⚠ 이 게임은 사이트(화학탐구실) 밖 별도 배포(D7 · D19)라 fetch · https · localStorage(세션 유지 = 같은 기기 재접속 복구)를 쓴다. 사이트 본체에는 이 파일이 없다.
   보안 모양(001_schema.sql): 학생 선택 = moves 표(본인 uid 고정) · 턴 방송 = 비공개 채널에서 호스트만 보낼 수 있음 · 시드 = room_secrets(교사만). */
window.ELNINO_NET = (function () {
  'use strict';
  var C = window.ELNINO_CONFIG, sb = null, chan = null, me = null;

  function client() {
    if (!sb) sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'elnino-auth' } });
    return sb;
  }
  function ok(r) { if (r.error) throw r.error; return r.data; }

  /* 익명 로그인 — 저장된 세션이 있으면 그 uid를 다시 쓴다(같은 기기 = 같은 배) */
  function signIn() {
    var c = client();
    return c.auth.getSession().then(function (r) {
      if (r.data && r.data.session) return r.data.session;
      return c.auth.signInAnonymously().then(function (x) { return ok(x).session; });
    }).then(function (s) { me = s.user.id; return me; });
  }
  function uid() { return me; }

  /* 교사 */
  function createRoom(practice, pin) { return client().rpc('create_room', { p_practice: !!practice, p_pin: String(pin) }).then(ok); }
  function claimHost(code, pin) { return client().rpc('claim_host', { p_code: code, p_pin: String(pin) }).then(ok); }
  function getSeed(code) { return client().from('room_secrets').select('seed').eq('code', code).single().then(ok).then(function (d) { return d.seed; }); }
  function setRoom(code, fields) { return client().from('rooms').update(fields).eq('code', code).select().then(ok); }
  function lastGame(code) { return client().from('turns').select('g').eq('room', code).order('g', { ascending: false }).limit(1).then(ok).then(function (r) { return r.length ? r[0].g : 0; }); }
  function setStatus(code, status) { return client().from('rooms').update({ status: status }).eq('code', code).select().then(ok); }
  function listPlayers(code) { return client().from('players').select('uid,nick,side,join_order,created_at').eq('room', code).order('created_at').order('uid').then(ok); }
  function assign(code, rows) {   /* 마을 · 입장 순 배정(호스트 권위) */
    var c = client();
    return Promise.all(rows.map(function (r) { return c.from('players').update({ side: r.side, join_order: r.join_order }).eq('room', code).eq('uid', r.uid).then(ok); }));
  }
  function listMoves(code, g, i) { return client().from('moves').select('uid,ch,dep').eq('room', code).eq('g', g).eq('i', i).then(ok); }
  function writeTurn(code, g, i, row) {   /* 표에 먼저 쓰고 → 그다음 방송(§4-2) · g = 판 번호(003) */
    return client().from('turns').upsert({ room: code, g: g, i: i, choices: row.choices || {}, deposits: row.deposits || {}, trigger_at: row.trigger_at == null ? null : row.trigger_at, rec: row.rec || {} }).then(ok);
  }

  /* 학생 */
  function getRoom(code) { return client().from('rooms').select('code,status,practice').eq('code', code).maybeSingle().then(ok); }
  function join(code, nick) { return client().from('players').insert({ room: code, nick: nick }).select().then(ok); }
  function submitMove(code, g, i, ch, dep) { return client().from('moves').upsert({ room: code, g: g, i: i, uid: me, ch: ch, dep: dep || 0 }).then(ok); }
  function readTurns(code, g) { return client().from('turns').select('g,i,choices,deposits,rec,trigger_at').eq('room', code).eq('g', g).order('i').then(ok); }

  /* 실시간 — 비공개 채널 'room:<코드>'. handlers = { turn(payload), move(row), presence(state) } */
  function subscribe(code, handlers, isHost) {
    var c = client();
    return c.realtime.setAuth().then(function () {
      chan = c.channel(C.channelPrefix + code, { config: { private: true, broadcast: { self: false }, presence: { key: me } } });
      chan.on('broadcast', { event: 'turn' }, function (m) { if (handlers.turn) handlers.turn(m.payload); });
      chan.on('presence', { event: 'sync' }, function () { if (handlers.presence) handlers.presence(chan.presenceState()); });
      if (isHost) chan.on('postgres_changes', { event: '*', schema: 'public', table: 'moves', filter: 'room=eq.' + code }, function (p) { if (handlers.move) handlers.move(p.new); });
      return new Promise(function (res, rej) {
        chan.subscribe(function (st, err) {
          if (st === 'SUBSCRIBED') { chan.track({ at: Date.now() }); res(st); }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') rej(err || new Error(st));
        });
      });
    });
  }
  function broadcastTurn(payload) { return chan.send({ type: 'broadcast', event: 'turn', payload: payload }); }
  function leave() { if (chan) { client().removeChannel(chan); chan = null; } }

  return { setRoom: setRoom, lastGame: lastGame, signIn: signIn, uid: uid, createRoom: createRoom, claimHost: claimHost, getSeed: getSeed, setStatus: setStatus, listPlayers: listPlayers, assign: assign,
    listMoves: listMoves, writeTurn: writeTurn, getRoom: getRoom, join: join, submitMove: submitMove, readTurns: readTurns,
    subscribe: subscribe, broadcastTurn: broadcastTurn, leave: leave, _client: client };
})();
