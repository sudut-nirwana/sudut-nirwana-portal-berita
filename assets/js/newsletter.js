document.addEventListener('DOMContentLoaded', () => {
    const sbForm = document.getElementById('sidebarNewsletterForm');
    const unsubForm = document.getElementById('sidebarUnsubscribeForm');
    const toggleLink = document.getElementById('toggleUnsubscribe');
    const msgEl = document.getElementById('newsletterMsg');

    if (toggleLink) {
        toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (sbForm.style.display !== 'none') {
                sbForm.style.display = 'none';
                unsubForm.style.display = 'flex';
                toggleLink.innerText = 'Kembali ke Berlangganan';
            } else {
                sbForm.style.display = 'flex';
                unsubForm.style.display = 'none';
                toggleLink.innerText = 'Ingin berhenti berlangganan?';
            }
            msgEl.style.display = 'none';
        });
    }

    if (sbForm) {
        sbForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('sidebarEmail').value;
            try {
                const res = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                msgEl.style.display = 'block';
                if (data.success) {
                    msgEl.style.color = 'green';
                    msgEl.innerText = 'Berhasil berlangganan email!';
                    sbForm.reset();
                } else {
                    msgEl.style.color = 'red';
                    msgEl.innerText = data.error || 'Gagal mendaftar.';
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    if (unsubForm) {
        unsubForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('sidebarUnsubscribeEmail').value;
            try {
                const res = await fetch('/api/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                msgEl.style.display = 'block';
                if (data.success) {
                    msgEl.style.color = 'green';
                    msgEl.innerText = 'Berhasil berhenti berlangganan.';
                    unsubForm.reset();
                } else {
                    msgEl.style.color = 'red';
                    msgEl.innerText = data.error || 'Gagal memproses.';
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
});