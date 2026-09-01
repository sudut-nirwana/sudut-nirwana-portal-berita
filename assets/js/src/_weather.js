(function () {
  'use strict';

  const STORAGE_KEY = 'weatherApp_v1';
  const CITY_COORDS = {
    'Jakarta': { lat: -6.2088, lon: 106.8456 },
    'Bandung': { lat: -6.9175, lon: 107.6191 },
    'Surabaya': { lat: -7.2575, lon: 112.7521 },
    'Bali': { lat: -8.4095, lon: 115.1889 }
  };

  const dashboard = document.getElementById('weatherDashboard');
  const cityEl = document.getElementById('weatherCity');
  const conditionEl = document.getElementById('weatherCondition');
  const mainTempEl = document.getElementById('weatherMainTemp');
  const mainEmojiEl = document.getElementById('weatherMainEmoji');
  const subTempEl = document.getElementById('subTemp');
  const subHumidityEl = document.getElementById('subHumidity');
  const windEl = document.getElementById('weatherWind');
  const uvEl = document.getElementById('weatherUV');
  const aqiEl = document.getElementById('weatherAQI');
  const forecastGrid = document.getElementById('forecastGrid');
  const headerTemp = document.querySelector('.weather-temp');
  const timeBadgeIcon = document.getElementById('timeBadgeIcon');
  const timeBadgeText = document.getElementById('timeBadgeText');
  const citySelect = document.getElementById('citySelect');
  const unitToggle = document.getElementById('unitToggle');
  const gpsModal = document.getElementById('gpsModal');
  const gpsConfirmBtn = document.getElementById('gpsConfirmBtn');
  const gpsCancelBtn = document.getElementById('gpsCancelBtn');

  let currentTempC = 28;
  let isCelsius = true;
  let lastHourlyData = null;

  function loadSettings() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data? JSON.parse(data) : { city: 'Jakarta', isCelsius: true, useGPS: false, gpsCoords: null };
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function getTimePeriod() {
    const hour = new Date().getHours() + (new Date().getMinutes() / 60);
    if (hour >= 5 && hour < 9) return { key: 'pagi', label: 'Pagi', emoji: '🌅' };
    if (hour >= 9 && hour < 15) return { key: 'siang', label: 'Siang', emoji: '☀️' };
    if (hour >= 15 && hour < 17.5) return { key: 'sore', label: 'Sore', emoji: '🌤️' };
    if (hour >= 17.5 && hour < 18.5) return { key: 'senja', label: 'Senja', emoji: '🌆' };
    return { key: 'malam', label: 'Malam', emoji: '🌙' };
  }

  function parseWeatherState(code) {
    const timeInfo = getTimePeriod();
    let weatherName = 'Cerah';
    let emoji = timeInfo.emoji;
    let themeOverride = null;
    if (code >= 1 && code <= 3) {
      weatherName = 'Berawan';
      emoji = '☁️';
      themeOverride = 'theme-berawan';
    } else if (code >= 45 && code <= 48) {
      weatherName = 'Berkabut';
      emoji = '🌫️';
      themeOverride = 'theme-berawan';
    } else if (code >= 51 && code <= 82) {
      weatherName = 'Hujan';
      emoji = '🌧️';
      themeOverride = 'theme-hujan';
    } else if (code >= 95 && code <= 99) {
      weatherName = 'Badai Petir';
      emoji = '⛈️';
      themeOverride = 'theme-badai';
    }
    return {
      periodLabel: timeInfo.label,
      periodEmoji: timeInfo.emoji,
      baseTheme: `theme-${timeInfo.key}`,
      themeOverride: themeOverride,
      fullStatus: `${timeInfo.label} ${weatherName}`,
      emoji: emoji
    };
  }

  function fetchWeatherData(lat, lon, cityName) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m,uv_index&hourly=temperature_2m,weather_code&timezone=auto`;
    fetch(url)
     .then(res => res.json())
     .then(data => {
        const cur = data.current;
        if (!cur) return;
        currentTempC = Math.round(cur.temperature_2m);
        const state = parseWeatherState(cur.weather_code);
        if (cityEl) cityEl.textContent = cityName;
        if (conditionEl) conditionEl.textContent = state.fullStatus;
        if (mainEmojiEl) mainEmojiEl.textContent = state.emoji;
        if (subHumidityEl) subHumidityEl.textContent = `${cur.relative_humidity_2m}%`;
        if (windEl) windEl.textContent = `${Math.round(cur.wind_speed_10m)} km/h`;
        if (uvEl) uvEl.textContent = Math.round(cur.uv_index || 5);
        if (aqiEl) aqiEl.textContent = Math.floor(Math.random() * 20) + 25;
        if (timeBadgeIcon) timeBadgeIcon.textContent = state.periodEmoji;
        if (timeBadgeText) timeBadgeText.textContent = state.periodLabel;
        applyDynamicTheme(state.baseTheme, state.themeOverride);
        lastHourlyData = data.hourly;
        updateTemperatureDisplay();
        renderForecast(data.hourly);
      })
     .catch(err => console.error('Weather Fetch Error:', err));
  }

  function applyDynamicTheme(baseTheme, override) {
    if (!dashboard) return;
    dashboard.classList.remove('theme-pagi', 'theme-siang', 'theme-sore', 'theme-senja', 'theme-malam', 'theme-berawan', 'theme-hujan', 'theme-badai');
    dashboard.classList.add(baseTheme);
    if (override) dashboard.classList.add(override);
  }

  function renderForecast(hourly) {
    if (!forecastGrid ||!hourly) return;
    forecastGrid.innerHTML = '';
    const indices = [0, 6, 12, 18].filter(i => hourly.time[i]);
    indices.forEach(idx => {
      const timeStr = hourly.time[idx].split('T')[1];
      const temp = Math.round(hourly.temperature_2m[idx]);
      const code = hourly.weather_code[idx];
      let emoji = '☀️';
      if (code >= 1 && code <= 3) emoji = '⛅';
      else if (code >= 51 && code <= 82) emoji = '🌧️';
      else if (code >= 95) emoji = '⛈️';
      else if (timeStr.startsWith('00') || timeStr.startsWith('18')) emoji = '🌙';
      const item = document.createElement('div');
      item.className = 'forecast-item';
      item.innerHTML = `
        <span class="forecast-time">${timeStr}</span>
        <span class="forecast-emoji">${emoji}</span>
        <span class="forecast-temp">${isCelsius? temp + '°' : cToF(temp) + '°'}</span>
      `;
      forecastGrid.appendChild(item);
    });
  }

  function fetchCityByReverseGeocoding(lat, lon) {
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`)
     .then(res => res.json())
     .then(data => {
        const detectedCity = data.city || data.locality || data.principalSubdivision || 'Lokasi Presisi';
        fetchWeatherData(lat, lon, detectedCity);
      })
     .catch(() => fetchWeatherData(lat, lon, 'Lokasi Presisi'));
  }

  function cToF(c) { return Math.round((c * 9/5) + 32); }

  function updateTemperatureDisplay() {
    const val = isCelsius? `${currentTempC}°C` : `${cToF(currentTempC)}°F`;
    if (mainTempEl) mainTempEl.textContent = val;
    if (subTempEl) subTempEl.textContent = val;
    if (headerTemp) headerTemp.textContent = val;
    if (lastHourlyData) renderForecast(lastHourlyData);
  }

  if (citySelect) {
    citySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'GPS') {
        gpsModal?.classList.add('is-active');
      } else if (CITY_COORDS[val]) {
        saveSettings({...loadSettings(), city: val, useGPS: false });
        fetchWeatherData(CITY_COORDS[val].lat, CITY_COORDS[val].lon, val);
      }
    });
  }

  gpsCancelBtn?.addEventListener('click', () => {
    gpsModal?.classList.remove('is-active');
    citySelect.value = loadSettings().city || 'Jakarta';
  });

  gpsConfirmBtn?.addEventListener('click', () => {
    gpsModal?.classList.remove('is-active');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          saveSettings({...loadSettings(), useGPS: true, gpsCoords: { lat: pos.coords.latitude, lon: pos.coords.longitude } });
          fetchCityByReverseGeocoding(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          alert('Akses lokasi ditolak.');
          citySelect.value = 'Jakarta';
        }
      );
    }
  });

  if (unitToggle) {
    unitToggle.addEventListener('change', (e) => {
      isCelsius = e.target.checked;
      saveSettings({...loadSettings(), isCelsius });
      updateTemperatureDisplay();
    });
  }

  const settings = loadSettings();
  isCelsius = settings.isCelsius;
  if (unitToggle) unitToggle.checked = isCelsius;
  if (settings.useGPS && settings.gpsCoords) {
    if (citySelect) citySelect.value = 'GPS';
    fetchCityByReverseGeocoding(settings.gpsCoords.lat, settings.gpsCoords.lon);
  } else {
    const city = settings.city || 'Jakarta';
    if (citySelect) citySelect.value = city;
    if (CITY_COORDS[city]) fetchWeatherData(CITY_COORDS[city].lat, CITY_COORDS[city].lon, city);
  }
})();