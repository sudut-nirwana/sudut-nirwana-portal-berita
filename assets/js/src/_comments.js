(function() {
  'use strict';
  const commentSection = document.querySelector('.post-comments');
  const commentForm = document.getElementById('commentForm');
  const commentList = document.getElementById('commentList');
  
  if (!commentList || !commentSection) return;

  const slug = commentSection.getAttribute('data-slug');
  if (!slug) return;

  // Load Komentar
  function loadComments() {
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        commentList.innerHTML = data.map(item => `
          <div class="comment-item">
            <div class="comment-content">
              <strong>${item.name}</strong>
              <small>${new Date(item.created_at).toLocaleDateString('id-ID')}</small>
              <p>${item.message}</p>
            </div>
          </div>
        `).join('');
      });
  }

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