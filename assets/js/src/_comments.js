(function() {
  'use strict';
  const commentSection = document.querySelector('.post-comments');
  const commentForm = document.getElementById('commentForm');
  const formWrapper = document.getElementById('formWrapper');
  const commentNotice = document.getElementById('commentNotice');
  const commentList = document.getElementById('commentList');
  
  if (!commentList || !commentSection) return;

  const slug = commentSection.getAttribute('data-slug');
  if (!slug) return;

  // Cek localStorage untuk pembatasan 1x sehari per artikel
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `comment_sent_${slug}_${today}`;
  
  if (localStorage.getItem(storageKey)) {
    if (formWrapper) formWrapper.style.display = 'none';
    if (commentNotice) commentNotice.style.display = 'block';
  }

  // Load Komentar
  function loadComments() {
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        commentList.innerHTML = data.map(item => `
          <div class="comment-item" data-id="${item.id}">
            <div class="comment-content">
              <strong>${item.name}</strong>
              <small>${new Date(item.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</small>
              <p>${item.message}</p>
              <div class="comment-actions">
                <button class="btn-like" type="button" onclick="window.likeComment(${item.id})">
                  ❤️ <span>${item.likes || 0}</span> Suka
                </button>
              </div>
            </div>
          </div>
        `).join('');
      });
  }

  // Fungsi Global untuk Like Komentar
  window.likeComment = function(id) {
    fetch('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        loadComments();
      }
    });
  };

  // Submit Komentar
  commentForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('commentName').value;
    const message = document.getElementById('commentMessage').value;
    if (!name || !message) return;

    fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug, name: name, message: message })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        localStorage.setItem(storageKey, 'true');
        if (formWrapper) formWrapper.style.display = 'none';
        if (commentNotice) commentNotice.style.display = 'block';
        commentForm.reset();
        loadComments();
      } else {
        alert('Gagal mengirim komentar: ' + (res.error || 'Terjadi kesalahan'));
      }
    })
    .catch(err => console.error('Error submitting comment:', err));
  });

  loadComments();
})();