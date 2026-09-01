(function() {
  'use strict';

  let iconPromise = null;
  const iconJsonUrl = '/assets/json/icon.json';
  const FALLBACK_ICON = '<svg class="app-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';

  function loadAndRenderIcons(targetContainer = document) {
    if (!(targetContainer instanceof Element || targetContainer === document)) return;

    const iconElements = targetContainer.querySelectorAll('[data-icon]');
    if (!iconElements.length) return;

    if (!iconPromise) {
      iconPromise = fetch(iconJsonUrl)
      .then(res => {
          if (!res.ok) throw new Error(`Gagal memuat icon.json: ${res.status}`);
          return res.json();
        })
      .catch(err => {
          console.error('Icon Loader Error:', err);
          iconPromise = null;
          return null;
        });
    }

    iconPromise.then(iconData => {
      iconElements.forEach(el => {
        // Skip kalau udah ada svg biar gak dobel pas panggil ulang
        if (el.querySelector('svg.app-icon')) return;

        const iconName = el.getAttribute('data-icon');
        const val = iconData?.[iconName];

        let svg;
        if (val) {
          if (typeof val === 'string' && val.trim().startsWith('<svg')) {
            // Kalau di JSON udah full <svg>...</svg>
            const temp = document.createElement('div');
            temp.innerHTML = val;
            svg = temp.firstElementChild;
          } else {
            // Kalau di JSON cuma path
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '1em');
            svg.setAttribute('height', '1em');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '1.5');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.classList.add('app-icon');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', val);
            svg.appendChild(path);
          }

          // KUNCI: prepend, jangan timpa innerHTML
          el.prepend(svg);

        } else {
          // Fallback
          el.insertAdjacentHTML('afterbegin', FALLBACK_ICON);
        }
      });
    });
  }

  window.renderIcons = loadAndRenderIcons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadAndRenderIcons());
  } else {
    loadAndRenderIcons();
  }
})();