---
layout: page
title: "Tentang Kami"
permalink: /tentang-kami/
---

**SudutNirwana** adalah portal media digital independen yang menyajikan informasi kurasi tepercaya seputar berita, gaya hidup, wisata, kuliner, dan budaya populer.

Kami hadir dengan komitmen menghadirkan sudut pandang yang jernih, mendalam, dan relevan bagi para pembaca modern di tengah arus informasi yang serba cepat.

## Visi & Misi

* **Visi:** Menjadi media alternatif terdepan yang menginspirasi pembaca melalui jurnalisme berita dan gaya hidup yang akurat dan estetis.
* **Misi:** Menyajikan konten berkualitas tinggi yang berimbang, independen, serta nyaman diakses di berbagai perangkat penjelajah.

## Tim Redaksi

Portal ini dikelola oleh tim yang berdedikasi tinggi dalam bidang media digital dan jurnalistik:

<div class="team-grid">
  {% if site.data.authors %}
    {% for author_hash in site.data.authors %}
      {% assign author = author_hash[1] %}
      <div class="team-card">
        <img src="{{ author.avatar | default: '/assets/images/default-avatar.jpg' }}" alt="{{ author.name }}" class="team-avatar">
        <div class="team-info">
          <h3 class="team-name">{{ author.name }}</h3>
          <span class="team-role">{{ author.role }}</span>
          <p class="team-bio">{{ author.bio }}</p>
        </div>
      </div>
    {% endfor %}
  {% else %}
    <p>Data redaksi sedang diperbarui.</p>
  {% endif %}
</div>