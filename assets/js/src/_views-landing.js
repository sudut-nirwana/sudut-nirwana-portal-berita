document.addEventListener("DOMContentLoaded", function() {
  'use strict';
  
  fetch('/api/views')
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      
      const viewMap = {};
      data.forEach(item => {
        viewMap[item.slug] = item.views;
      });

      document.querySelectorAll('.post-views').forEach(el => {
        const slug = el.getAttribute('data-slug');
        if (slug && viewMap[slug] !== undefined) {
          el.textContent = viewMap[slug];
        }
      });
    })
    .catch(err => console.error('Gagal memuat data views:', err));
});