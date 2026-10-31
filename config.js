/* Supabase 접속 설정 — 공개해도 되는 값만(설계지시안 v1.2 §4-6).
   publishable 키는 브라우저용 공개 키다(RLS가 모든 표에 켜져 있어야 안전 — 001_schema.sql).
   ⚠ secret(service_role) 키는 이 저장소 · 문서 · 클라이언트 어디에도 두지 않는다. */
window.ELNINO_CONFIG = {
  url: 'https://bqnxjbzhbdhrbkqlbvvu.supabase.co',
  key: 'sb_publishable_HQ95njFY1-aFHeGPZVIXRA_5QqKHF5Q',
  channelPrefix: 'room:'
};
