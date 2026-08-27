// 저장된 테마를 CSS 가 그려지기 전에 적용한다 — 안 그러면 첫 프레임이 깜빡인다.
// CSP script-src 'self' 라 인라인 스크립트를 못 쓰므로 별도 파일을 head 에서 동기 로드한다.
try {
  var t = localStorage.getItem('sfx-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  // 사생활 보호 모드 등에서 localStorage 가 막힐 수 있다. 시스템 설정으로 둔다.
}
