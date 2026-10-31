-- 003 — 한 방에서 연습 판 → 실전 판을 잇도록 «판 번호»(g) 칸 추가(2026-10-31 · 화면 만들기)
-- 까닭: moves · turns의 기본 키가 (room, i[, uid])라 연습 판 1~6턴과 실전 판 1~24턴이 겹친다. 학생은 방을 나가지 않고 그대로 다음 판.
alter table public.moves add column if not exists g smallint not null default 1 check (g between 1 and 9);
alter table public.turns add column if not exists g smallint not null default 1 check (g between 1 and 9);
alter table public.moves drop constraint if exists moves_pkey;
alter table public.moves add primary key (room, g, i, uid);
alter table public.turns drop constraint if exists turns_pkey;
alter table public.turns add primary key (room, g, i);
-- 판 사이에 교사가 방을 다시 'lobby'로 두면 늦게 온 학생도 입장할 수 있다(players_insert 정책 그대로).
