---
layout: page
title: "Tentang Kami"
permalink: /tentang-kami/
---

**SudutNirwana** adalah ruang dokumentasi digital independen tempat kami merangkum berbagai keseruan harian, gaya hidup, hobi otomotif, petualangan wisata, ulasan kuliner, hingga seni dan budaya populer.

Situs ini dibangun sebagai wadah kreatif dan portofolio konten kreator untuk menghadirkan sudut pandang yang santai, jernih, dan menarik bagi para pembaca modern yang ingin rehat sejenak dari penatnya arus informasi.

## Visi & Misi

* **Visi:** Menjadi ruang baca alternatif yang seru, estetik, dan menginspirasi bagi pembaca dalam mengeksplorasi gaya hidup serta budaya lokal.
* **Misi:** Menyajikan konten harian yang jujur berdasarkan pengalaman nyata, disajikan dengan visual menarik, serta nyaman diakses di berbagai perangkat penjelajah.

## Tim Redaksi (Author)

Portal dokumentasi ini dikelola secara mandiri oleh kreator dan didukung oleh rekanan penulis (*author biasa*) yang berdedikasi menghasilkan tulisan kreatif yang segar:

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
    <p>Data penulis sedang diperbarui.</p>
  {% endif %}
</div>