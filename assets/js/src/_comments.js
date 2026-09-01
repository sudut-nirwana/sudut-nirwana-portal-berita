(function() {
  'use strict';

  const authContainer = document.getElementById('authContainer');
  const commentForm = document.getElementById('commentForm');
  const commentList = document.getElementById('commentList');
  const viewElem = document.getElementById('view-count');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!commentList || !viewElem) return;

  const slug = viewElem.getAttribute('data-slug');
  let currentUser = JSON.parse(localStorage.getItem('sn_user_session')) || null;

  // Function untuk Decode Token JWT dari Google
  function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  }

  // Callback Otomatis Setelah User Login Google
  window.handleGoogleLogin = function(response) {
    const payload = parseJwt(response.credential);
    currentUser = {
      name: payload.name,
      email: payload.email,
      avatar: payload.picture,
      token: response.credential
    };
    localStorage.setItem('sn_user_session', JSON.stringify(currentUser));
    renderUI();
  };

  function renderUI() {
    if (currentUser) {
      authContainer.style.display = 'none';
      commentForm.style.display = 'block';
      document.getElementById('userName').textContent = currentUser.name;
      document.getElementById('userAvatar').src = currentUser.avatar;
    } else {
      authContainer.style.display = 'block';
      commentForm.style.display = 'none';
    }
  }

  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('sn_user_session');
    currentUser = null;
    renderUI();
  });

  function loadComments() {
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        commentList.innerHTML = data.map(item => `
          <div class="comment-item">
            <img src="${item.avatar}" alt="${item.name}" class="comment-avatar">
            <div class="comment-content">
              <strong>${item.name}</strong>
              <p>${item.message}</p>
            </div>
          </div>
        `).join('');
      })
      .catch(err => console.error('Error loading comments:', err));
  }

  commentForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    const messageInput = document.getElementById('commentMessage');
    if (!currentUser || !messageInput?.value) return;

    fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: slug,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
        message: messageInput.value
      })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        messageInput.value = '';
        loadComments();
      }
    });
  });

  renderUI();
  loadComments();
})();