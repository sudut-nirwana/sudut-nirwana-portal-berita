(function() {
  'use strict';

  const searchResultCards = document.getElementById('searchResultCards');
  const searchTitle = document.getElementById('searchTitle');
  const section = searchResultCards?.closest('.loading-section');
  
  if (!searchResultCards) return;

  const ITEMS_PER_PAGE = 12;
  let allPosts = [];
  let currentPage = 1;

  function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const rawQuery = urlParams.get('q') || '';
  const query = rawQuery.trim().toLowerCase();
  
  const pageFromUrl = parseInt(urlParams.get('page'), 10);
  if (!isNaN(pageFromUrl) && pageFromUrl > 0) {
    currentPage = pageFromUrl;
  }

  if (searchTitle) {
    if (query === 'terbaru') {
      searchTitle.textContent = 'Semua Berita Terbaru';
    } else {
      searchTitle.textContent = query 
        ? `Hasil pencarian: "${rawQuery.replace(/-/g, ' ')}"` 
        : 'Silakan masukkan kata kunci pencarian';
    }
  }

  if (!query) {
    searchResultCards.innerHTML = `
      <div class="search-empty">
        <img src="/assets/images/search-empty.png" alt="Search Empty" class="search-empty-img">
        <p>Ketik kata kunci di kolom pencarian untuk memulai.</p>
      </div>
    `;
    return;
  }

  if (typeof sectionLoader !== 'undefined' && section) {
    sectionLoader.show(section);
  }

  fetch(window.location.origin + '/assets/json/search.json')
    .then(res => {
      if (!res.ok) throw new Error(`Gagal memuat database: ${res.status}`);
      return res.json();
    })
    .then(posts => {
      if (query === 'terbaru') {
        allPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      } else {
        const querySlug = slugify(query);
        const keywords = query.replace(/-/g, ' ').split(/\s+/).filter(Boolean);

        allPosts = posts.filter(post => {
          const targetText = `${post.title || ''} ${post.snippet || ''}`.toLowerCase();
          const matchKeyword = keywords.some(kw => targetText.includes(kw));
          const matchCategory = slugify(post.category || '') === querySlug;
          return matchKeyword || matchCategory;
        });
      }

      searchResultCards.classList.add('fade-in');
      renderCurrentPage();
    })
    .catch(err => {
      console.error('Search Engine Error:', err);
      searchResultCards.innerHTML = '<p class="search-empty">Terjadi kesalahan saat memuat hasil pencarian.</p>';
    })
    .finally(() => {
      if (typeof sectionLoader !== 'undefined' && section) {
        sectionLoader.hide(section);
      }
    });

  function renderCurrentPage() {
    const totalPages = Math.ceil(allPosts.length / ITEMS_PER_PAGE) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const postsToShow = allPosts.slice(startIndex, endIndex);

    renderResults(postsToShow);
    renderPagination(totalPages);
  }

  function goToPage(page) {
    currentPage = page;
    
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('page', page);
    window.history.pushState({}, '', newUrl);

    searchResultCards.classList.remove('fade-in');
    void searchResultCards.offsetWidth;
    searchResultCards.classList.add('fade-in');

    renderCurrentPage();

    const resultsSection = document.querySelector('.search-results-section');
    if (resultsSection) {
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function renderPagination(totalPages) {
    let container = document.getElementById('paginationContainer');

    if (!container) {
      container = document.createElement('div');
      container.id = 'paginationContainer';
      container.className = 'pagination-container';
      searchResultCards.after(container);
    }

    container.innerHTML = '';

    if (totalPages <= 1) return;

    const nav = document.createElement('nav');
    nav.className = 'pagination-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.textContent = '« Sebelumnya';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nav.appendChild(prevBtn);

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => goToPage(i));
      nav.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `page-btn ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.textContent = 'Selanjutnya »';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    nav.appendChild(nextBtn);

    container.appendChild(nav);
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
  }

  function renderResults(results) {
    searchResultCards.innerHTML = '';

    if (!results.length) {
      searchResultCards.innerHTML = `
        <div class="search-empty">
          <img src="/assets/images/note-font.png" alt="Tidak Ditemukan" class="search-empty-img">
          <p>Tidak ada berita yang cocok dengan kata kunci tersebut.</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach(post => {
      const article = document.createElement('article');
      article.className = 'card-vertical';

      const a = document.createElement('a');
      a.href = post.url || '#';

      const thumb = document.createElement('div');
      thumb.className = 'card-thumb';
      
      const postTitle = post.title || 'Tanpa Judul';
      thumb.innerHTML = `
        <img src="${post.image || '/assets/images/default.jpg'}" alt="${postTitle}">
        <span class="badge">${post.category || 'Berita'}</span>
      `;

      const body = document.createElement('div');
      body.className = 'card-body';

      const h3 = document.createElement('h3');
      h3.textContent = postTitle;

      const meta = document.createElement('div');
      meta.className = 'card-meta';

      const date = document.createElement('span');
      date.className = 'meta-date';
      const iconDate = document.createElement('span');
      iconDate.setAttribute('data-icon', 'calendar');
      date.append(iconDate, ` ${post.date || ''}`);

      const views = document.createElement('span');
      views.className = 'meta-views';
      const iconViews = document.createElement('span');
      iconViews.setAttribute('data-icon', 'eye');
      views.append(iconViews, ` ${formatNumber(post.views || 0)}`);

      meta.append(date, views);
      body.append(h3, meta);
      a.append(thumb, body);
      article.appendChild(a);
      fragment.appendChild(article);
    });

    searchResultCards.appendChild(fragment);

    if (typeof window.renderIcons === 'function') {
      window.renderIcons(searchResultCards);
    }
  }
})();