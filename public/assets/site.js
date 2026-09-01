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

// ── 테마 선택과 키보드 검색 ─────────────────────────────────
// 별도 블록으로 둔다. 위쪽 record 폼 블록은 `if (!form) return` 으로
// 빠져나가므로, 그 안에 넣으면 다른 페이지에서 전부 죽는다.
document.addEventListener('DOMContentLoaded', () => {
  // 테마: 시스템 / 라이트 / 다크. 명시 선택이 시스템 설정을 이긴다.
  const themeButtons = [...document.querySelectorAll('[data-theme-set]')];
  if (themeButtons.length) {
    const stored = () => {
      try { return localStorage.getItem('sfx-theme') || 'system'; } catch (e) { return 'system'; }
    };
    const paint = (mode) => {
      themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === mode)));
    };
    paint(stored());
    themeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.themeSet;
        try {
          if (mode === 'system') localStorage.removeItem('sfx-theme');
          else localStorage.setItem('sfx-theme', mode);
        } catch (e) { /* 저장이 막혀도 이번 화면에는 적용한다 */ }
        if (mode === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', mode);
        paint(mode);
      });
    });
  }

  // 검색: ⌘K / Ctrl+K 로 열고, "/" 로도 열고, ↑↓ 로 고르고, Esc 로 닫는다.
  const searchInput = document.querySelector('#site-search');
  const searchResults = document.querySelector('#search-results');
  if (!searchInput) return;

  document.addEventListener('keydown', (event) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target && event.target.tagName);
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (event.key === '/' && !inField && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  const moveFocus = (dir) => {
    const links = [...(searchResults ? searchResults.querySelectorAll('a.search-result') : [])];
    if (!links.length) return false;
    const at = links.indexOf(document.activeElement);
    const next = at < 0 ? (dir > 0 ? 0 : links.length - 1) : (at + dir + links.length) % links.length;
    links[next].focus();
    return true;
  };

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.blur();
    } else if (event.key === 'ArrowDown' && moveFocus(1)) {
      event.preventDefault();
    }
  });

  if (searchResults) {
    searchResults.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && moveFocus(1)) event.preventDefault();
      else if (event.key === 'ArrowUp' && moveFocus(-1)) event.preventDefault();
      else if (event.key === 'Escape') searchInput.focus();
    });
  }
});

// 뇌 지도 필터. JS 가 하는 일은 svg 의 data-filter 속성 하나를 바꾸는 것뿐이다.
// 숨김·강조는 전부 CSS 가 한다 — 인라인 style 을 쓰면 CSP style-src 'self' 에 걸린다.
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.querySelector('.brain-panel');
  if (!panel) return;
  const svg = panel.querySelector('svg.brain');
  const buttons = [...panel.querySelectorAll('[data-brain-filter]')];
  if (!svg || !buttons.length) return;

  const apply = (value) => {
    svg.setAttribute('data-filter', value);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.brainFilter === value));
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      // 누른 걸 다시 누르면 전부로 돌아온다 — 해제하는 방법이 없으면 갇힌다.
      const now = svg.getAttribute('data-filter');
      apply(now === button.dataset.brainFilter ? 'all' : button.dataset.brainFilter);
    });
  }
});
