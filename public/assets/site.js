const config = JSON.parse(document.querySelector('#site-config')?.textContent || '{}');
const searchInput = document.querySelector('#site-search');
const results = document.querySelector('#search-results');
const searchStatus = document.querySelector('#search-status');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

let indexPromise;
const loadIndex = () => {
  indexPromise ||= fetch(`${config.basePath || '/'}search.json`).then((response) => {
    if (!response.ok) throw new Error('search index unavailable');
    return response.json();
  });
  return indexPromise;
};

const renderResults = (items, query = '') => {
  if (!results) return;
  results.hidden = items.length === 0;
  searchInput?.setAttribute('aria-expanded', String(items.length > 0));
  results.innerHTML = items.length
    ? items.map((item) => `<li><a class="search-result" href="${config.basePath}${encodeURIComponent(item.slug)}/"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.track)} · ${escapeHtml(item.summary)}</small></a></li>`).join('')
    : '';
  if (searchStatus) searchStatus.textContent = query ? (items.length ? `검색 결과 ${items.length}개` : '검색 결과가 없습니다.') : '';
};

searchInput?.addEventListener('input', async (event) => {
  const query = event.target.value.trim().toLocaleLowerCase('ko-KR');
  if (!query) { renderResults([]); return; }
  try {
    const index = await loadIndex();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = index.filter((item) => terms.every((term) => `${item.title} ${item.summary} ${item.text}`.toLocaleLowerCase('ko-KR').includes(term))).slice(0, 8);
    renderResults(matches, query);
  } catch {
    renderResults([], query);
  }
});

searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    renderResults([]);
    searchInput.select();
  }
});

document.addEventListener('click', (event) => {
  if (results && searchInput && !results.contains(event.target) && event.target !== searchInput) {
    results.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
  }
});

const tocLinks = [...document.querySelectorAll('[data-toc-link]')];
const tocHeadings = tocLinks.map((link) => document.getElementById(link.dataset.tocLink)).filter(Boolean);
const setCurrentSection = (id) => {
  tocLinks.forEach((link) => {
    const current = link.dataset.tocLink === id;
    link.classList.toggle('is-current', current);
    if (current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};
if (tocHeadings.length) {
  let scheduled = false;
  const updateCurrentSection = () => {
    const readingLine = Math.max(96, window.innerHeight * 0.24);
    const current = [...tocHeadings].reverse().find((heading) => heading.getBoundingClientRect().top <= readingLine) || tocHeadings[0];
    setCurrentSection(current.id);
    scheduled = false;
  };
  const scheduleUpdate = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateCurrentSection);
    }
  };
  tocLinks.forEach((link) => link.addEventListener('click', () => setCurrentSection(link.dataset.tocLink)));
  updateCurrentSection();
  document.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
}

document.querySelectorAll('[data-feedback-title]').forEach((link) => {
  link.addEventListener('click', () => {
    const page = window.location.href.split('#')[0];
    const section = link.dataset.feedbackSection || '문서 전체';
    const anchor = link.dataset.feedbackAnchor ? `#${link.dataset.feedbackAnchor}` : '';
    const body = [
      `페이지: ${page}${anchor}`,
      `섹션: ${section}`,
      `배포 리비전: ${config.deploySha || 'unknown'}`,
      '',
      '좋았던 점:', '',
      '수정할 점:', '',
      '제안 문구:', '',
      '근거가 필요한 주장:',
    ].join('\n');
    const params = new URLSearchParams({
      title: `[Brand Feedback] ${link.dataset.feedbackTitle} — ${section}`,
      body,
    });
    link.href = `https://github.com/${config.repo}/issues/new?${params.toString()}`;
  });
});

// ── 기록하기 폼: 클라이언트에서 제목/본문을 조립해 GitHub Issue 작성 화면으로 넘긴다.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.capture-form');
  if (!form) return;
  const recordConfig = JSON.parse(document.querySelector('#record-config')?.textContent || '{}');
  const titlePrefix = recordConfig.titlePrefix || '[위키기록]';
  const bodyTemplateTail = recordConfig.bodyTemplate || '';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const type = document.querySelector('#capture-type')?.value || '기타';
    const date = document.querySelector('#capture-date')?.value || new Date().toISOString().slice(0, 10);
    const title = document.querySelector('#capture-title')?.value?.trim() || '제목 없는 기록';
    const bodyText = document.querySelector('#capture-body')?.value?.trim() || '';
    const composedBody = [
      `유형: ${type}`,
      `날짜: ${date}`,
      '',
      bodyText,
      bodyTemplateTail.replace('{유형}', type),
    ].join('\n');
    const params = new URLSearchParams({
      title: `${titlePrefix}[${type}] ${title}`,
      body: composedBody,
    });
    window.location.href = `${form.action}?${params.toString()}`;
  });
});
