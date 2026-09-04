'use strict';
let currentUser = null;
let allArticles = [];
let currentPage = 1;
const rowsPerPage = 10;
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('article-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1; // Reset ke halaman pertama saat mencari
            renderArticlesTable();
        });
    }
});

document.getElementById('title').addEventListener('input', (e) => {
    const editId = document.getElementById('edit-article-id').value;
    if (editId) return;
    let slug = e.target.value.toLowerCase()
        .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
        .replace(/^-+/, '').replace(/-+$/, '');
    const words = slug.split('-');
    if (words.length > 6) slug = words.slice(0, 6).join('-');
    if (slug.length > 80) slug = slug.substring(0, 80);
    document.getElementById('slug').value = slug;
});

function switchEditorTab(mode) {
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');
    const btnEdit = document.getElementById('btn-tab-edit');
    const btnPreview = document.getElementById('btn-tab-preview');
    const contentVal = document.getElementById('content').value;

    if (mode === 'edit') {
        editorPane.classList.remove('hidden'); previewPane.classList.add('hidden');
        btnEdit.classList.add('active'); btnPreview.classList.remove('active');
    } else {
        editorPane.classList.add('hidden'); previewPane.classList.remove('hidden');
        btnPreview.classList.add('active'); btnEdit.classList.remove('active');
        renderPreviewContent(contentVal, previewPane);
    }
}

function renderPreviewContent(text, pane) {
    if (!text.trim()) {
        pane.innerHTML = '<p style="color: #888; font-style: italic;">Belum ada konten untuk dipratinjau.</p>';
    } else {
        pane.innerHTML = marked.parse(text);
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value
            })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            document.getElementById('welcome-user').innerText = `Halo, ${currentUser.name} (${currentUser.role})`;
            document.getElementById('settings-name').value = currentUser.name;
            document.getElementById('settings-email').value = currentUser.email;
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');

            if (currentUser.role === 'admin') {
                document.getElementById('admin-panel').classList.remove('hidden');
                loadAdminData();
            } else {
                document.getElementById('settings-email').disabled = true;
            }
        } else {
            alert('Login Gagal: ' + (data.error || 'Periksa kembali email dan password.'));
        }
    } catch (err) {
        alert('Terjadi kesalahan jaringan saat login.');
    }
});

document.getElementById('publish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert('Sesi login tidak valid. Silakan login ulang.');
        return;
    }

    const editId = document.getElementById('edit-article-id').value;
    const endpoint = editId ? '/api/update-article' : '/api/publish';

    const payload = {
        title: document.getElementById('title').value,
        slug: document.getElementById('slug').value,
        category: document.getElementById('category').value,
        popular: document.getElementById('popular').value, // Ditambahkan untuk menangkap status popular
        description: document.getElementById('description').value,
        image: document.getElementById('image').value,
        tags: document.getElementById('tags').value,
        content: document.getElementById('content').value,
        admin_email: currentUser.email,
        author_email: currentUser.email
    };

    if (editId) {
        payload.article_id = editId;
    }
    
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; 
    btn.innerText = editId ? 'Menyimpan Perubahan...' : 'Mempublikasikan...';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert(editId ? 'Artikel berhasil diperbarui!' : 'Artikel berhasil dipublikasikan!');
            cancelEdit();
            if (currentUser.role === 'admin') loadAdminData();
        } else {
            alert('Gagal: ' + (data.error || 'Terjadi kesalahan.'));
        }
    } catch (err) {
        alert('Terjadi kesalahan jaringan saat mengirim data.');
    }
    btn.disabled = false; 
    btn.innerText = editId ? 'Simpan Perubahan Artikel' : 'Publikasikan Artikel';
});

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email })
        });
        const data = await res.json();
        
        if (!data.success) return;

        allArticles = data.articles || [];
        renderArticlesTable();

        const userTableBody = document.getElementById('users-table-body');
        if (data.users && data.users.length > 0) {
            userTableBody.innerHTML = data.users.map(u => `
                <tr>
                    <td>${escapeHtml(u.name)}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${escapeHtml(u.role)}</td>
                    <td>
                        ${u.email !== currentUser.email ? `
                            <button type="button" class="btn-danger" onclick="deleteUser(${u.id})" style="margin-right: 5px; margin-bottom: 5px;">Hapus</button>
                            <button type="button" onclick="resetUserPassword(${u.id}, '${escapeHtml(u.name)}')" style="background: #d69e2e; width: auto; padding: 5px 10px; font-size: 13px;">Reset Sandi</button>
                        ` : '<strong>(Akun Anda)</strong>'}
                    </td>
                </tr>
            `).join('');
        } else {
            userTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada anggota terdaftar.</td></tr>';
        }

        const commentTableBody = document.getElementById('comments-table-body');
        if (data.comments && data.comments.length > 0) {
            commentTableBody.innerHTML = data.comments.map(c => `
                <tr>
                    <td>${escapeHtml(c.article_slug)}</td>
                    <td>${escapeHtml(c.author_name || 'Anonim')}</td>
                    <td>${escapeHtml(c.content)}</td>
                    <td><button type="button" class="btn-danger" onclick="deleteComment(${c.id})">Hapus</button></td>
                </tr>
            `).join('');
        } else {
            commentTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada komentar.</td></tr>';
        }
    } catch (err) {
        console.error('Error loading admin data:', err);
    }
}

function renderArticlesTable() {
    const articlesTableBody = document.getElementById('articles-table-body');
    if (!articlesTableBody) return;

    const filtered = allArticles.filter(art => 
        (art.title && art.title.toLowerCase().includes(searchQuery)) ||
        (art.category && art.category.toLowerCase().includes(searchQuery))
    );

    const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);

    if (paginated.length > 0) {
        articlesTableBody.innerHTML = paginated.map(art => `
            <tr>
                <td>${escapeHtml(art.title)}</td>
                <td>${escapeHtml(art.category || '-')}</td>
                <td>
                    <button type="button" onclick="editArticle('${art.id}')" style="background: #319795; width: auto; padding: 5px 10px; font-size: 13px; margin-right: 5px; margin-bottom: 5px;">Edit</button>
                    <button type="button" class="btn-danger" onclick="deleteArticle('${art.id}')">Hapus</button>
                </td>
            </tr>
        `).join('');
    } else {
        articlesTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Tidak ada artikel ditemukan.</td></tr>';
    }

    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    if (pageInfo) pageInfo.innerText = `Hal ${currentPage} dari ${totalPages} (Total: ${filtered.length})`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
    currentPage += direction;
    renderArticlesTable();
}

function editArticle(articleId) {
    const article = allArticles.find(a => a.id == articleId);
    if (!article) {
        alert('Artikel tidak ditemukan.');
        return;
    }

    document.getElementById('edit-article-id').value = article.id;
    document.getElementById('title').value = article.title || '';
    document.getElementById('slug').value = article.slug || '';
    document.getElementById('category').value = article.category || '';
    document.getElementById('popular').value = article.popular || 'true'; // Mengisi pilihan popular saat edit
    document.getElementById('description').value = article.description || '';
    document.getElementById('image').value = article.image || '';
    document.getElementById('tags').value = article.tags || '';
    document.getElementById('content').value = article.content || '';

    document.getElementById('form-title').innerText = 'Edit Artikel';
    document.getElementById('submit-btn').innerText = 'Simpan Perubahan Artikel';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('edit-article-id').value = '';
    document.getElementById('publish-form').reset();
    document.getElementById('form-title').innerText = 'Tulis Artikel Baru';
    document.getElementById('submit-btn').innerText = 'Publikasikan Artikel';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    switchEditorTab('edit');
}

async function deleteArticle(articleId) {
    if (!confirm('Yakin ingin menghapus artikel ini?')) return;
    try {
        const res = await fetch('/api/delete-article', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email, article_id: articleId })
        });
        const data = await res.json();
        if (data.success) { alert('Artikel berhasil dihapus.'); loadAdminData(); }
        else { alert('Gagal menghapus: ' + (data.error || 'Terjadi kesalahan')); }
    } catch (err) {
        alert('Terjadi kesalahan jaringan.');
    }
}

async function syncGithubArticles() {
    if (!confirm('Tarik dan sinkronkan semua artikel dari folder _posts GitHub ke database?')) return;
    try {
        const res = await fetch('/api/sync-github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email })
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
            loadAdminData();
        } else {
            alert('Gagal sinkronisasi: ' + (data.error || 'Terjadi kesalahan'));
        }
    } catch (err) {
        alert('Terjadi kesalahan jaringan saat sinkronisasi.');
    }
}

async function deleteUser(userId) {
    if (!confirm('Yakin ingin menghapus keanggotaan penulis ini?')) return;
    try {
        const res = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email, user_id: userId })
        });
        const data = await res.json();
        if (data.success) { alert('Penulis berhasil dihapus.'); loadAdminData(); }
        else { alert('Gagal menghapus: ' + data.error); }
    } catch (err) { alert('Terjadi kesalahan jaringan.'); }
}

async function resetUserPassword(userId, userName) {
    const newPassword = prompt(`Masukkan kata sandi baru untuk ${userName}:`);
    if (!newPassword) return;
    try {
        const res = await fetch('/api/update-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email, target_user_id: userId, new_password: newPassword })
        });
        const data = await res.json();
        if (data.success) { alert(`Kata sandi untuk ${userName} berhasil diubah.`); }
        else { alert('Gagal mereset sandi: ' + data.error); }
    } catch (err) { alert('Terjadi kesalahan jaringan.'); }
}

async function deleteComment(commentId) {
    if (!confirm('Hapus komentar ini?')) return;
    try {
        const res = await fetch('/api/delete-comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email, comment_id: commentId })
        });
        const data = await res.json();
        if (data.success) { loadAdminData(); }
        else { alert('Gagal menghapus komentar: ' + data.error); }
    } catch (err) { alert('Terjadi kesalahan jaringan.'); }
}

document.getElementById('author-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/register-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            admin_email: currentUser.email,
            name: document.getElementById('new-name').value,
            email: document.getElementById('new-email').value,
            password: document.getElementById('new-password').value,
            role: document.getElementById('new-role').value
        })
    });
    const data = await res.json();
    if (data.success) { alert('Penulis berhasil ditambahkan.'); e.target.reset(); loadAdminData(); }
    else { alert('Gagal: ' + data.error); }
});

document.getElementById('account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('/api/update-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_email: currentUser.email,
                new_name: document.getElementById('settings-name').value,
                new_email: document.getElementById('settings-email').value,
                old_password: document.getElementById('settings-old-password').value,
                new_password: document.getElementById('settings-new-password').value
            })
        });
        const data = await res.json();
        if (data.success) { alert('Perubahan berhasil disimpan.'); location.reload(); }
        else { alert('Gagal menyimpan: ' + data.error); }
    } catch (err) { alert('Terjadi kesalahan jaringan saat menyimpan akun.'); }
});

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function logout() { location.reload(); }