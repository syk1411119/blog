import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.SUPABASE_CONFIG || {};
const isConfigured = !!(cfg.url && cfg.anonKey);

let sb = null;
if (isConfigured) {
  try { sb = createClient(cfg.url, cfg.anonKey); } catch (e) { console.error(e); }
}

const CATEGORIES = {
  tech:  { label: '技术', color: '#2563eb' },
  life:  { label: '生活', color: '#16a34a' },
  study: { label: '学习', color: '#d97706' },
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function formatSize(bytes) {
  if (bytes == null || bytes === '') return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = Number(bytes);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
function catBadge(cat) {
  const c = CATEGORIES[cat] || { label: esc(cat || '未分类'), color: '#6b7280' };
  return `<span class="badge" style="--c:${c.color}">${c.label}</span>`;
}
function showNotConfigured(container) {
  container.innerHTML = `
    <div class="warning">
      <strong>后端尚未配置</strong>
      <p>把 <code>assets/config.js</code> 里的 Supabase 地址和密钥填好后，内容会显示在这里。</p>
      <p>配置方法见仓库里的 <code>README.md</code>。</p>
    </div>`;
}
async function renderMarkdown(text) {
  try {
    const { marked } = await import('https://cdn.jsdelivr.net/npm/marked@12/+esm');
    return marked.parse(text || '');
  } catch {
    return `<pre class="plain">${esc(text)}</pre>`;
  }
}

/* ---------- 首页 ---------- */
async function renderIndex() {
  const list = document.getElementById('post-list');
  if (!list) return;
  if (!isConfigured) { showNotConfigured(list); return; }

  const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false });
  if (error) {
    list.innerHTML = `<div class="warning"><strong>读取文章失败</strong><p>${esc(error.message)}</p></div>`;
    return;
  }
  const posts = data || [];
  const state = { cat: 'all' };

  function paint() {
    const rows = posts.filter(p => state.cat === 'all' || p.category === state.cat);
    if (!rows.length) {
      list.innerHTML = `<div class="empty">暂无文章，去 <a href="admin.html">后台</a> 发布第一篇吧。</div>`;
      return;
    }
    list.innerHTML = rows.map(p => `
      <a class="post-card" href="post.html?id=${encodeURIComponent(p.id)}">
        ${p.cover_url ? `<div class="cover"><img src="${esc(p.cover_url)}" alt="" loading="lazy"></div>` : ''}
        <div class="post-card-body">
          <div class="post-card-top">${catBadge(p.category)}<time>${formatDate(p.created_at)}</time></div>
          <h2>${esc(p.title)}</h2>
          ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
        </div>
      </a>`).join('');
  }

  const filters = document.getElementById('filters');
  if (filters) {
    filters.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cat = btn.dataset.cat;
      paint();
    });
  }
  paint();
}

/* ---------- 文章详情 ---------- */
async function renderPost() {
  const view = document.getElementById('post-view');
  if (!view) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { view.innerHTML = '<div class="empty">未指定文章。</div>'; return; }
  if (!isConfigured) { showNotConfigured(view); return; }

  const { data, error } = await sb.from('posts').select('*').eq('id', id).single();
  if (error || !data) {
    view.innerHTML = `<div class="warning"><strong>文章不存在或读取失败</strong><p>${esc(error && error.message)}</p><p><a href="index.html">← 返回首页</a></p></div>`;
    return;
  }
  document.title = `${data.title} · SYK 的博客`;
  const content = await renderMarkdown(data.content);
  view.innerHTML = `
    <article>
      ${data.cover_url ? `<img class="post-cover" src="${esc(data.cover_url)}" alt="">` : ''}
      <div class="post-meta">${catBadge(data.category)}<time>${formatDate(data.created_at)}</time></div>
      <h1 class="post-title">${esc(data.title)}</h1>
      ${data.summary ? `<p class="summary">${esc(data.summary)}</p>` : ''}
      <div class="markdown-body">${content}</div>
    </article>`;
}

/* ---------- 下载页 ---------- */
async function renderDownloads() {
  const el = document.getElementById('file-list');
  if (!el) return;
  if (!isConfigured) { showNotConfigured(el); return; }

  const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="warning"><strong>读取失败</strong><p>${esc(error.message)}</p></div>`; return; }
  if (!data || !data.length) {
    el.innerHTML = '<div class="empty">还没有上传任何文件，去 <a href="admin.html">后台</a> 上传吧。</div>';
    return;
  }
  el.innerHTML = data.map(f => `
    <div class="file-item">
      <div class="file-info">
        <div class="file-title-row">
          <h2>${esc(f.name)}</h2>
          ${f.version ? `<span class="badge" style="--c:#6b7280">v${esc(f.version)}</span>` : ''}
        </div>
        ${f.description ? `<p class="summary">${esc(f.description)}</p>` : ''}
        <div class="file-meta">${formatSize(f.size_bytes)} · ${formatDate(f.created_at)}</div>
      </div>
      <a class="btn primary" href="${esc(f.url)}" target="_blank" rel="noopener">下载</a>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderIndex();
  renderPost();
  renderDownloads();
});
