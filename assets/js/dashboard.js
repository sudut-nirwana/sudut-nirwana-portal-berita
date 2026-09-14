let currentUser = null;
let allArticles = [];
let filteredArticles = [];
let currentPage = 1;
const itemsPerPage = 7;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
});

function checkSession() {
    const savedUser = localStorage.getItem('sn_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showDashboard();
        } catch (e) {
            logout();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('welcome-user').textContent = `Halo, ${currentUser.name} (${currentUser.role.toUpperCase()})`;
    
    // Admin Panel khusus untuk role admin
    if (currentUser.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    } else {
        document.getElementById('admin-panel').classList.add('hidden');
    }

    loadAdminData();
}

// Login Form Handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('sn_user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            alert('Login Gagal: ' + (data.error || 'Email atau password salah'));
        }
    } catch (err) {
        alert('Kesalahan jaringan: ' + err.message);
    }
});

function logout() {
    localStorage.removeItem('sn_user');
    currentUser = null;
    window.location.reload();
}

// Konversi File Gambar Apapun ke WebP (Client-Side Canvas)
function convertToWebP(file, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const webpDataUrl = canvas.toDataURL('image/webp', quality);
                const base64Data = webpDataUrl.split(',')[1];
                
                let cleanFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                cleanFileName = cleanFileName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.webp';
                
                resolve({ base64: base64Data, filename: cleanFileName });
            };
            img.onerror = () => reject('Gagal memuat file gambar.');
            img.src = event.target.result;
        };
        reader.onerror = () => reject('Gagal membaca file.');
        reader.readAsDataURL(file);
    });
}

// Upload Gambar Sampul Artikel ke GitHub (Otomatis Hapus Sampul Lama)
async function uploadImageToGithub(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const oldPath = document.getElementById('image').value.trim();

    try {
        document.getElementById('image').value = 'Mengonversi ke WebP & Mengunggah...';
        const converted = await convertToWebP(file);
        
        const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_email: currentUser.email,
                filename: converted.filename,
                imageBase64: converted.base64,
                targetFolder: 'assets/images/posts',
                oldImagePath: oldPath
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('image').value = data.path;
            alert('Gambar sampul berhasil diunggah dan dikonversi ke .webp');
        } else {
            alert('Gagal unggah gambar: ' + data.error);
            document.getElementById('image').value = oldPath;
        }
    } catch (err) {
        alert('Error konversi/unggah gambar: ' + err);
        document.getElementById('image').value = oldPath;
    }
}

// Upload Foto Profil Avatar ke GitHub (Otomatis Hapus Avatar Lama)
async function uploadAvatarToGithub(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const oldAvatarPath = document.getElementById('settings-avatar').value.trim();

    try {
        const converted = await convertToWebP(file);
        const avatarFilename = `avatar-${currentUser.slug || Date.now()}.webp`;

        const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_email: currentUser.email,
                filename: avatarFilename,
                imageBase64: converted.base64,
                targetFolder: 'assets/images/authors',
                oldImagePath: oldAvatarPath
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('settings-avatar').value = data.path;
            document.getElementById('settings-avatar-preview').src = data.path;
            alert('Foto profil baru berhasil diunggah ke GitHub!');
        } else {
            alert('Gagal unggah foto profil: ' + data.error);
        }
    } catch (err) {
        alert('Error unggah profil: ' + err);
    }
}

// Auto Slug Generator dari Judul Artikel
document.getElementById('title').addEventListener('input', function() {
    if (!document.getElementById('edit-article-id').value) {
        const titleVal = this.value;
        const slugVal = titleVal.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .split('-').slice(0, 6).join('-');
        document.getElementById('slug').value = slugVal;
    }
});

// Tab Switcher Editor Markdown vs Preview
function switchEditorTab(tab) {
    const editBtn = document.getElementById('btn-tab-edit');
    const previewBtn = document.getElementById('btn-tab-preview');
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');

    if (tab === 'edit') {
        editBtn.classList.add('active');
        previewBtn.classList.remove('active');
        editorPane.classList.remove('hidden');
        previewPane.classList.add('hidden');
    } else {
        previewBtn.classList.add('active');
        editBtn.classList.remove('active');
        editorPane.classList.add('hidden');
        previewPane.classList.remove('hidden');

        const markdownText = document.getElementById('content').value;
        if (window.marked) {
            previewPane.innerHTML = marked.parse(markdownText || '*Tidak ada konten untuk dipratinjau.*');
        } else {
            previewPane.textContent = markdownText;
        }
    }
}

// Fitur Asisten AI Draft Mentah (Sinkron dengan /api/ai-format)
async function processWithAI() {
    const rawText = document.getElementById('ai-raw-input').value.trim();
    if (!rawText) {
        alert('Silakan isi draf mentah terlebih dahulu.');
        return;
    }

    const btn = document.querySelector("button[onclick='processWithAI()']");
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ AI Sedang Memproses...';
    }

    try {
        const res = await fetch('/api/ai-format', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawText: rawText })
        });

        const textRes = await res.text();
        if (!textRes) {
            throw new Error(`Server mengembalikan respon kosong (Status: ${res.status}).`);
        }

        let data;
        try {
            data = JSON.parse(textRes);
        } catch (e) {
            throw new Error(`Respon server bukan JSON valid: ${textRes.substring(0, 100)}...`);
        }

        if (data.success && data.data) {
            const resObj = data.data;
            if (resObj.title) document.getElementById('title').value = resObj.title;
            if (resObj.slug) document.getElementById('slug').value = resObj.slug;
            if (resObj.category) document.getElementById('category').value = resObj.category;
            if (resObj.popular) document.getElementById('popular').value = resObj.popular;
            if (resObj.description) document.getElementById('description').value = resObj.description;
            if (resObj.tags) document.getElementById('tags').value = resObj.tags;
            if (resObj.content) document.getElementById('content').value = resObj.content;
            alert('✨ Format berhasil dirapikan otomatis oleh AI!');
        } else {
            alert('AI Gagal memproses draf: ' + (data.error || 'Respon tidak valid'));
        }
    } catch (err) {
        alert('Gagal menghubungi layanan AI: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✨ Sempurnakan dengan AI';
        }
    }
}

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_email: currentUser.email })
        });
        const data = await res.json();

        if (!data.success) {
            alert('Gagal memuat data dashboard: ' + data.error);
            return;
        }

        // Populasi form Pengaturan Akun
        if (data.user_profile) {
            document.getElementById('settings-name').value = data.user_profile.name || '';
            document.getElementById('settings-email').value = data.user_profile.email || '';
            const avatarPath = data.user_profile.avatar || '/assets/images/authors/default.webp';
            document.getElementById('settings-avatar').value = avatarPath;
            document.getElementById('settings-avatar-preview').src = avatarPath;
        }

        // Render Artikel
        allArticles = data.articles || [];
        filteredArticles = [...allArticles];
        currentPage = 1;
        renderArticlesTable();

        // Render Khusus Admin
        if (currentUser.role === 'admin') {
            renderUsersTable(data.users || []);
            renderCommentsTable(data.comments || []);
            loadSubscribers();
        }
    } catch (err) {
        console.error('Error loadAdminData:', err);
    }
}

// Render Tabel Artikel (Tombol Index Google, Broadcast, & Hapus Hanya Muncul Bagi Admin)
function renderArticlesTable() {
    const tbody = document.getElementById('articles-table-body');
    tbody.innerHTML = '';

    if (filteredArticles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Tidak ada artikel ditemukan.</td></tr>';
        document.getElementById('page-info').textContent = 'Halaman 0 dari 0';
        document.getElementById('prev-page-btn').disabled = true;
        document.getElementById('next-page-btn').disabled = true;
        return;
    }

    const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredArticles.slice(startIdx, startIdx + itemsPerPage);

    pageItems.forEach(art => {
        const tr = document.createElement('tr');
        
        // Tombol aksi bertingkat berdasarkan Role (Dengan jarak rapi gap: 6px)
        let actionButtonsHtml = `
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                <button type="button" onclick="editArticle(${art.id})" style="width:auto; padding:6px 10px; font-size:12px; background:#3182ce; margin:0;">Edit</button>
        `;

        if (currentUser.role === 'admin') {
            actionButtonsHtml += `
                <button type="button" onclick="requestGoogleIndex('${art.slug}', '${art.category}')" style="width:auto; padding:6px 10px; font-size:12px; background:#38a169; margin:0;">Index</button>
                <button type="button" onclick="broadcastArticle(${art.id})" style="width:auto; padding:6px 10px; font-size:12px; background:#805ad5; margin:0;">Broadcast</button>
                <button type="button" onclick="deleteArticle(${art.id}, '${art.slug}')" class="btn-danger" style="margin:0; padding:6px 10px; font-size:12px;">Hapus</button>
            `;
        }

        actionButtonsHtml += `</div>`;

        tr.innerHTML = `
            <td><strong>${escapeHtml(art.title)}</strong><br><small style="color:#666;">/posts/${art.slug}</small></td>
            <td><span style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-size:12px;">${art.category || '-'}</span></td>
            <td>${actionButtonsHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('page-info').textContent = `Halaman ${currentPage} dari ${totalPages}`;
    document.getElementById('prev-page-btn').disabled = (currentPage === 1);
    document.getElementById('next-page-btn').disabled = (currentPage === totalPages);
}

function changePage(delta) {
    currentPage += delta;
    renderArticlesTable();
}

// Pencarian Artikel
document.getElementById('article-search').addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    filteredArticles = allArticles.filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) || 
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.slug && a.slug.toLowerCase().includes(q))
    );
    currentPage = 1;
    renderArticlesTable();
});

// Form Publish & Edit Artikel
document.getElementById('publish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const articleId = document.getElementById('edit-article-id').value;
    const title = document.getElementById('title').value.trim();
    const slug = document.getElementById('slug').value.trim();
    const category = document.getElementById('category').value;
    const popular = document.getElementById('popular').value;
    const description = document.getElementById('description').value.trim();
    const image = document.getElementById('image').value.trim();
    const tags = document.getElementById('tags').value.trim();
    const content = document.getElementById('content').value;

    const endpoint = articleId ? '/api/update-article' : '/api/publish';
    const payload = {
        user_email: currentUser.email,
        article_id: articleId ? parseInt(articleId) : undefined,
        title, slug, category, popular, description, image, tags, content
    };

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses ke GitHub...';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message || 'Berhasil disimpan!');
            cancelEdit();
            loadAdminData();
        } else {
            alert('Gagal menyimpan: ' + data.error);
        }
    } catch (err) {
        alert('Kesalahan koneksi: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = articleId ? 'Simpan Perubahan Artikel' : 'Publikasikan Artikel';
    }
});

function editArticle(id) {
    const art = allArticles.find(a => a.id === id);
    if (!art) return;

    document.getElementById('edit-article-id').value = art.id;
    document.getElementById('form-title').textContent = 'Edit Artikel: ' + art.title;
    document.getElementById('title').value = art.title || '';
    document.getElementById('slug').value = art.slug || '';
    if (art.category) document.getElementById('category').value = art.category;
    document.getElementById('popular').value = art.popular || 'true';
    document.getElementById('description').value = art.description || '';
    document.getElementById('image').value = art.image || '';
    document.getElementById('tags').value = art.tags || '';
    document.getElementById('content').value = art.content || '';

    document.getElementById('submit-btn').textContent = 'Simpan Perubahan Artikel';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('edit-article-id').value = '';
    document.getElementById('form-title').textContent = 'Tulis Artikel Baru';
    document.getElementById('publish-form').reset();
    document.getElementById('submit-btn').textContent = 'Publikasikan Artikel';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

// Aksi Khusus Admin: Hapus Artikel
async function deleteArticle(id, slug) {
    if (!confirm(`Apakah Anda yakin ingin menghapus artikel "${slug}"?`)) return;

    try {
        const res = await fetch('/api/delete-article', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email, article_id: id, slug })
        });
        const data = await res.json();
        if (data.success) {
            alert('Artikel berhasil dihapus!');
            loadAdminData();
        } else {
            alert('Gagal menghapus: ' + data.error);
        }
    } catch (err) {
        alert('Error hapus artikel: ' + err.message);
    }
}

// Aksi Khusus Admin: Minta Pengindeksan Google Indexing API
async function requestGoogleIndex(slug, category) {
    if (!confirm(`Kirim sinyal pengindeksan Google untuk artikel: /${category}/${slug}?`)) return;

    try {
        const res = await fetch('/api/google-index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email, slug, category })
        });
        const data = await res.json();
        if (data.success) {
            alert('Google Indexing: ' + data.message);
        } else {
            alert('Gagal Google Indexing: ' + data.error);
        }
    } catch (err) {
        alert('Error Google Indexing: ' + err.message);
    }
}

// Aksi Khusus Admin: Kirim Buletin Broadcast ke Subscriber Newsletter
async function broadcastArticle(id) {
    const art = allArticles.find(a => a.id === id);
    if (!art) return;

    if (!confirm(`Kirim email broadcast artikel "${art.title}" ke SEMUA subscriber newsletter?`)) return;

    try {
        const res = await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_email: currentUser.email,
                slug: art.slug,
                title: art.title,
                description: art.description,
                image: art.image,
                category: art.category
            })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Broadcast Berhasil! Email terkirim ke ${data.sent} dari total ${data.total} subscriber.`);
        } else {
            alert('Gagal Broadcast: ' + data.error);
        }
    } catch (err) {
        alert('Error Broadcast: ' + err.message);
    }
}

// Form Update Pengaturan Akun
document.getElementById('account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const new_name = document.getElementById('settings-name').value.trim();
    const new_email = document.getElementById('settings-email').value.trim();
    const old_password = document.getElementById('settings-old-password').value;
    const new_password = document.getElementById('settings-new-password').value;
    const new_avatar = document.getElementById('settings-avatar').value.trim();

    try {
        const res = await fetch('/api/update-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_email: currentUser.email,
                new_name, new_email, old_password, new_password, new_avatar
            })
        });
        const data = await res.json();
        if (data.success) {
            alert('Akun berhasil diperbarui!');
            if (new_name) currentUser.name = new_name;
            if (new_email) currentUser.email = new_email;
            if (new_avatar) currentUser.avatar = new_avatar;
            localStorage.setItem('sn_user', JSON.stringify(currentUser));
            document.getElementById('settings-old-password').value = '';
            document.getElementById('settings-new-password').value = '';
            showDashboard();
        } else {
            alert('Gagal memperbarui akun: ' + data.error);
        }
    } catch (err) {
        alert('Error update akun: ' + err.message);
    }
});

// Aksi Tambah Penulis Baru (Khusus Admin)
const authorForm = document.getElementById('author-form');
if (authorForm) {
    authorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-name').value.trim();
        const slug = document.getElementById('new-slug').value.trim();
        const email = document.getElementById('new-email').value.trim();
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;
        const avatar = document.getElementById('new-avatar').value.trim();
        const bio = document.getElementById('new-bio').value.trim();

        try {
            const res = await fetch('/api/register-author', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_email: currentUser.email, name, slug, email, password, role, avatar, bio })
            });
            const data = await res.json();
            if (data.success) {
                alert('Penulis baru berhasil didaftarkan!');
                authorForm.reset();
                loadAdminData();
            } else {
                alert('Gagal mendaftarkan penulis: ' + data.error);
            }
        } catch (err) {
            alert('Error tambah penulis: ' + err.message);
        }
    });
}

// Render Tabel User & Komentar (Khusus Admin)
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(u.name)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.role}</td>
            <td><button type="button" onclick="deleteUser(${u.id})" class="btn-danger">Hapus</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCommentsTable(comments) {
    const tbody = document.getElementById('comments-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (comments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada komentar.</td></tr>';
        return;
    }
    comments.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><small>${escapeHtml(c.article_slug)}</small></td>
            <td>${escapeHtml(c.author_name)}</td>
            <td>${escapeHtml(c.content)}</td>
            <td><button type="button" onclick="deleteComment(${c.id})" class="btn-danger">Hapus</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Memuat Subscriber Newsletter (GET /api/subscribers)
async function loadSubscribers() {
    const tbody = document.getElementById('subscribers-table-body');
    if (!tbody) return;
    try {
        const res = await fetch('/api/subscribers');
        const subscribers = await res.json();
        tbody.innerHTML = '';

        if (Array.isArray(subscribers) && subscribers.length > 0) {
            subscribers.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(s.email)}</td>
                    <td>${s.created_at || '-'}</td>
                    <td><button type="button" onclick="deleteSubscriber(${s.id})" class="btn-danger">Hapus</button></td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Belum ada subscriber newsletter.</td></tr>';
        }
    } catch (e) {
        console.error('Error loadSubscribers:', e);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Gagal memuat daftar subscriber.</td></tr>';
    }
}

// Menghapus Subscriber Newsletter (DELETE /api/subscribers?id=X)
async function deleteSubscriber(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus subscriber ini?')) return;

    try {
        const res = await fetch(`/api/subscribers?id=${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            alert('Subscriber berhasil dihapus.');
            loadSubscribers();
        } else {
            alert('Gagal menghapus subscriber: ' + data.error);
        }
    } catch (err) {
        alert('Error hapus subscriber: ' + err.message);
    }
}

function exportSubscribersCSV() {
    window.open(`/api/export-subscribers?admin_email=${encodeURIComponent(currentUser.email)}`, '_blank');
}

async function syncGithubArticles() {
    const btn = document.getElementById('sync-github-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Menyinkronkan...';
    try {
        const res = await fetch('/api/sync-github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_email: currentUser.email })
        });
        const data = await res.json();
        if (data.success) {
            alert('Sinkronisasi selesai!');
            loadAdminData();
        } else {
            alert('Gagal sinkronisasi: ' + data.error);
        }
    } catch (err) {
        alert('Error sinkronisasi: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Sinkron';
    }
}

function setupEventListeners() {}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}