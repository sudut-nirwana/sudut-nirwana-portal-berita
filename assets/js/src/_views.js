(function() {
  'use strict';

  const viewElem = document.getElementById('view-count');
  if (!viewElem) return;

  const slug = viewElem.getAttribute('data-slug');
  if (!slug) return;

  function formatViews(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
  }

  fetch(`/api/views?slug=${encodeURIComponent(slug)}`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data && data.views !== undefined) {
        viewElem.textContent = formatViews(data.views);
      }
    })
    .catch(err => console.error('Error updating views:', err));
})();