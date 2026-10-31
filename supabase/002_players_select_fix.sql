-- 002 — players 읽기 정책 고침(2026-10-31 · 통신 스모크 S5 실패)
-- 원인: join()의 insert … select(RETURNING)는 새 행이 읽기 정책도 통과해야 하는데, is_member()는 문장 시작 시점 스냅숏이라
--       방금 넣은 자기 행을 못 봐서 «new row violates row-level security policy». → 본인 행은 늘 읽을 수 있게.
drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated
  using (uid = auth.uid() or public.is_member(room) or public.is_host(room));
