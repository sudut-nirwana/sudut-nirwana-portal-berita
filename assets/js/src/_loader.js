(function() {
  'use strict';

  const loader = document.getElementById('global-loader');

  // 1. Fungsi Global dengan Null Safety
  window.showLoader = () => loader?.classList.remove('loader-hidden');
  window.hideLoader = () => loader?.classList.add('loader-hidden');

  window.sectionLoader = {
    show: (section) => section?.classList.add('is-loading'),
    hide: (section) => section?.classList.remove('is-loading')
  };

  // 2. Auto Loader Link (Hanya untuk navigasi tab utama)
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    
    // Abaikan jika bukan klik kiri biasa atau ditahan tombol modifier (Ctrl/Cmd/Shift/Alt)
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const href = link.getAttribute('href');
    const isInternal = link.hostname === window.location.hostname;
    const isAnchor = href?.startsWith('#') || href?.includes('#');
    const hasSpecialAttr = link.target || link.hasAttribute('download') || href?.startsWith('javascript:');

    if (isInternal && !isAnchor && !hasSpecialAttr) {
      showLoader();
    }
  });

  // 3. Sembunyikan Loader saat Load Selesai & Paksa Reset saat Back/Forward Browser (bfcache)
  window.addEventListener('load', hideLoader);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) hideLoader(); // Membuka kembali dari cache browser
  });

  // 4. Auto Handling untuk .loading-section bawaan HTML
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.loading-section').forEach(section => {
      sectionLoader.show(section);
      const images = section.querySelectorAll('img');
      
      if (images.length === 0) {
        setTimeout(() => sectionLoader.hide(section), 300); 
      } else {
        Promise.all([...images].map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => { img.onload = img.onerror = resolve; });
        })).then(() => sectionLoader.hide(section));
      }
    });
  });

})();