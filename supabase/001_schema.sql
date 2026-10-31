-- 엘니뇨 어부 버티기 게임 — Supabase 스키마 v1 (설계지시안 v1.2 §4 · 2026-10-31)
-- 원칙: 클라이언트는 anon 키 + 익명 로그인(auth.uid())만. service_role 키는 어디에도 두지 않는다.
--       모든 표 RLS · 새 표 자동 공개 꺼짐(프로젝트 생성 때) → 필요한 권한만 아래에서 직접 GRANT.
--       학생 실명 · 학번 · 기기 정보 칸 없음(별명 1~8자만). 판 기록은 24시간 뒤 삭제.

create extension if not exists pgcrypto with schema extensions;

-- ── 표 ─────────────────────────────────────────────
create table if not exists public.rooms (
  code        text primary key check (code ~ '^[0-9]{4}$'),
  host_uid    uuid not null default auth.uid(),
  practice    boolean not null default false,
  status      text not null default 'lobby' check (status in ('lobby', 'play', 'end')),
  created_at  timestamptz not null default now()
);
-- 시드(= 엘니뇨 시점 · 카드 순서)와 교사 복구 PIN은 학생이 읽으면 안 된다 → 따로 · 교사만
create table if not exists public.room_secrets (
  code      text primary key references public.rooms(code) on delete cascade,
  seed      integer not null,
  pin_hash  text not null
);
create table if not exists public.players (
  room        text not null references public.rooms(code) on delete cascade,
  uid         uuid not null default auth.uid(),
  nick        text not null check (char_length(nick) between 1 and 8),
  side        text check (side in ('west', 'east')),
  join_order  integer,
  created_at  timestamptz not null default now(),
  primary key (room, uid),
  unique (room, nick)
);
-- 학생의 선택 · 맡기기 — 본인 uid로만 넣는다(P-검토 B6: Broadcast로 남의 선택을 흉내 내지 못하게)
create table if not exists public.moves (
  room        text not null references public.rooms(code) on delete cascade,
  i           integer not null check (i between 1 and 24),
  uid         uuid not null default auth.uid(),
  ch          text not null check (ch in ('near', 'far', 'rest')),
  dep         integer not null default 0 check (dep between 0 and 10),
  created_at  timestamptz not null default now(),
  primary key (room, i, uid)
);
-- 턴 기록(호스트만 씀) — 재접속 · 호스트 복구(replay) 입력: 선택 · 맡기기 · 앞당김 + 결과 요약
create table if not exists public.turns (
  room        text not null references public.rooms(code) on delete cascade,
  i           integer not null check (i between 1 and 24),
  choices     jsonb not null default '{}'::jsonb,
  deposits    jsonb not null default '{}'::jsonb,
  trigger_at  integer,
  rec         jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (room, i)
);

alter table public.rooms        enable row level security;
alter table public.room_secrets enable row level security;
alter table public.players      enable row level security;
alter table public.moves        enable row level security;
alter table public.turns        enable row level security;

-- ── 도우미(보안 정의 · 검색 경로 고정) ──────────────────
create or replace function public.is_host(p_room text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rooms r where r.code = p_room and r.host_uid = auth.uid());
$$;
create or replace function public.is_member(p_room text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players p where p.room = p_room and p.uid = auth.uid());
$$;

-- ── RLS 정책 ───────────────────────────────────────
-- rooms: 방 코드로 들어오려면 존재 · 상태는 읽을 수 있어야 함(시드는 room_secrets라 안 보임)
create policy rooms_select on public.rooms for select to authenticated using (true);
create policy rooms_update on public.rooms for update to authenticated using (host_uid = auth.uid()) with check (host_uid = auth.uid());
-- 방 만들기는 create_room() 함수로만(코드 · 시드 · PIN을 서버에서 만든다) → insert 정책 없음

-- room_secrets: 교사만 읽음 · 쓰기는 함수로만
create policy secrets_select on public.room_secrets for select to authenticated using (public.is_host(code));

-- players: 본인 행만 넣음(대기실일 때) · 같은 방 사람과 교사가 읽음 · 교사가 마을 배정 · 별명 다시 잇기(uid 바꾸기)
create policy players_insert on public.players for insert to authenticated
  with check (uid = auth.uid() and exists (select 1 from rooms r where r.code = room and r.status = 'lobby'));
create policy players_select on public.players for select to authenticated using (public.is_member(room) or public.is_host(room));
create policy players_update on public.players for update to authenticated using (public.is_host(room)) with check (public.is_host(room));

-- moves: 본인 uid · 그 방 참가자 · 진행 중일 때만 넣고 고침 · 교사와 본인만 읽음
create policy moves_insert on public.moves for insert to authenticated
  with check (uid = auth.uid() and public.is_member(room) and exists (select 1 from rooms r where r.code = room and r.status = 'play'));
create policy moves_update on public.moves for update to authenticated
  using (uid = auth.uid()) with check (uid = auth.uid() and exists (select 1 from rooms r where r.code = room and r.status = 'play'));
create policy moves_select on public.moves for select to authenticated using (uid = auth.uid() or public.is_host(room));

-- turns: 교사만 씀 · 같은 방 사람이 읽음(재접속)
create policy turns_insert on public.turns for insert to authenticated with check (public.is_host(room));
create policy turns_update on public.turns for update to authenticated using (public.is_host(room)) with check (public.is_host(room));
create policy turns_select on public.turns for select to authenticated using (public.is_member(room) or public.is_host(room));

-- ── 권한(새 표 자동 공개를 껐으므로 직접) — anon(로그인 전)에는 아무것도 주지 않음 ──
grant usage on schema public to authenticated;
grant select, update on public.rooms to authenticated;
grant select on public.room_secrets to authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert, update on public.moves to authenticated;
grant select, insert, update on public.turns to authenticated;

-- ── 함수: 방 만들기(교사) · 교사 복구 · 정리 ─────────────
-- 24시간 지난 판 삭제 + 2일 지난 익명 사용자 정리(공식 문서: 익명 사용자 자동 정리는 없음 — 직접 삭제)
create or replace function public.cleanup_old() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from public.rooms where created_at < now() - interval '24 hours';
  delete from auth.users where is_anonymous is true and created_at < now() - interval '2 days';
end $$;

create or replace function public.create_room(p_practice boolean, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text; v_try int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'pin must be 4-8 digits'; end if;
  perform public.cleanup_old();
  loop
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from rooms where code = v_code);
    v_try := v_try + 1; if v_try > 50 then raise exception 'no free room code'; end if;
  end loop;
  insert into rooms(code, host_uid, practice) values (v_code, auth.uid(), coalesce(p_practice, false));
  insert into room_secrets(code, seed, pin_hash) values (v_code, (floor(random() * 2147483647))::int, crypt(p_pin, gen_salt('bf')));
  return v_code;
end $$;

-- 교사 탭을 잃었을 때(다른 PC · 저장소 지워짐): 방 코드 + PIN으로 호스트 권한을 지금 uid로 옮김(P-검토 B9 ⒟)
create or replace function public.claim_host(p_code text, p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from room_secrets s where s.code = p_code and s.pin_hash = crypt(p_pin, s.pin_hash)) then
    update rooms set host_uid = auth.uid() where code = p_code; return true;
  end if;
  return false;
end $$;

revoke all on function public.cleanup_old() from public, anon, authenticated;
grant execute on function public.create_room(boolean, text) to authenticated;
grant execute on function public.claim_host(text, text) to authenticated;
grant execute on function public.is_host(text) to authenticated;
grant execute on function public.is_member(text) to authenticated;

-- ── Realtime 비공개 채널 정책(공식 문서: Realtime Authorization · «Allow public access» 꺼야 적용) ──
-- 채널 이름 = 'room:' || 방 코드. 받기 = 참가자 · 교사 / 보내기: broadcast = 교사만(턴 방송) · presence = 참가자 · 교사
create policy rt_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence')
         and (public.is_member(substr((select realtime.topic()), 6)) or public.is_host(substr((select realtime.topic()), 6))));
create policy rt_send_broadcast on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public.is_host(substr((select realtime.topic()), 6)));
create policy rt_send_presence on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'presence'
              and (public.is_member(substr((select realtime.topic()), 6)) or public.is_host(substr((select realtime.topic()), 6))));

-- 교사 화면이 학생 선택을 바로 받도록(postgres_changes · RLS 적용 — 교사는 moves_select로 그 방 선택만 받음)
alter publication supabase_realtime add table public.moves;
