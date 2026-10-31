/* 문구 표 — 게임 화면에 나오는 «모든 글자»의 단일 원천(지시서 §4 · D11). 원장: 시안/elnino/문구원장.md 와 1:1.
   화면 코드는 글자를 이 표에서만 읽는다. 숫자(«+n» 포함) · 별명(data-slot="nick" 자리)은 표 밖이지만 검사가 따로 허용한다.
   user: 사용자 추가 대기 자리 — 기본 비어 있음(비어 있으면 보이지 않는다).
   D16: «엘니뇨 일으키기»는 글자 없이 아이콘 길게 누르기. */
window.ELNINO_TEXT = {
  btn: { near: '가까운 바다', far: '먼바다', rest: '쉬기', join: '입장', pause: '멈춤', store: '맡기기',
         practice: '연습', real: '실전', make: '방 만들기' },
  ph: { room: '방 코드', nick: '별명', pin: 'PIN' },
  user: { lobbyTV: '', lobbyPhone: '', cardTV: '', cardPhone: '', endTV: '' }
};
