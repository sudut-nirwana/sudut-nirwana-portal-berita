(function() {
  'use strict';

  // DOM ELEMENTS
  const navToggleBtn = document.getElementById('navToggleBtn');
  const navDrawer = document.getElementById('navDrawer');
  const drawerClose = document.getElementById('drawerClose');
  const navBackdrop = document.getElementById('navBackdrop');

  const weatherTrigger = document.getElementById('weatherTrigger');
  const weatherCard = document.getElementById('weatherCard');
  const weatherClose = document.getElementById('weatherClose');
  const weatherBackdrop = document.getElementById('weatherBackdrop');

  const submenuToggle = document.getElementById('submenuToggle');
  const submenuParent = submenuToggle?.closest('.has-submenu');

  // NAVIGATION DRAWER LOGIC
  function openNav() {
    navDrawer?.classList.add('is-active');
    if (window.innerWidth <= 768) {
      navBackdrop?.classList.add('is-active');
    }
  }

  function closeNav() {
    navDrawer?.classList.remove('is-active');
    navBackdrop?.classList.remove('is-active');
  }

  if (navToggleBtn) {
    navToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      navDrawer?.classList.contains('is-active') ? closeNav() : openNav();
    });
  }

  drawerClose?.addEventListener('click', closeNav);
  navBackdrop?.addEventListener('click', closeNav);

  // SUBMENU ACCORDION LOGIC
  if (submenuToggle && submenuParent) {
    submenuToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      submenuParent.classList.toggle('is-open');
    });
  }

  // WEATHER DROPDOWN / MODAL LOGIC
  function openWeather() {
    weatherCard?.classList.add('is-active');
    weatherBackdrop?.classList.add('is-active');
  }

  function closeWeather() {
    weatherCard?.classList.remove('is-active');
    weatherBackdrop?.classList.remove('is-active');
  }

  if (weatherTrigger) {
    weatherTrigger.addEventListener('click', function(e) {
      e.stopPropagation();
      weatherCard?.classList.contains('is-active') ? closeWeather() : openWeather();
    });
  }

  weatherClose?.addEventListener('click', closeWeather);
  weatherBackdrop?.addEventListener('click', closeWeather);

  // GLOBAL OUTSIDE CLICK (DESKTOP)
  document.addEventListener('click', function(e) {
    if (window.innerWidth > 768) {
      if (navDrawer && !navDrawer.contains(e.target) && !navToggleBtn?.contains(e.target)) {
        closeNav();
      }
      if (weatherCard && !weatherCard.contains(e.target) && !weatherTrigger?.contains(e.target)) {
        closeWeather();
      }
    }
  });
})();