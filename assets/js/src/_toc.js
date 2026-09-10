(function() {
  'use strict';

  function initTOC() {
    const article = document.querySelector('.post-body');
    if (!article) return;

    const headings = article.querySelectorAll('h2, h3');
    const tocContainers = document.querySelectorAll('.toc-container');
    const widgetTocs = document.querySelectorAll('.widget-toc');

    if (headings.length === 0) {
      widgetTocs.forEach(widget => widget.style.display = 'none');
      return;
    }

    tocContainers.forEach(tocContainer => {
      tocContainer.innerHTML = '';
      
      const list = document.createElement('ul');
      list.className = 'toc-list';

      headings.forEach((heading, index) => {
        const id = heading.id || 'heading-' + index;
        heading.id = id;

        const li = document.createElement('li');
        li.className = 'toc-item toc-' + heading.tagName.toLowerCase();

        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = heading.textContent;

        li.appendChild(a);
        list.appendChild(li);
      });

      tocContainer.appendChild(list);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTOC);
  } else {
    initTOC();
  }
})();