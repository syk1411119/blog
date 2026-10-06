import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.SUPABASE_CONFIG || {};
const isConfigured = !!(cfg.url && cfg.anonKey);

let sb = null;
if (isConfigured) {
  try { sb = createClient(cfg.url, cfg.anonKey); } catch (e) { console.error(e); }
}

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const formatDate = iso => iso ? new Date(iso).toLocaleDateString('zh-CN') : '';
const formatSize = b => {
  if (b == null || b === '') return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = Number(b);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
};

function toast(text, ok = true) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.className = 'toast ' + (ok ? 'ok' : 'err');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3000);
}

function setBusy(on) {
  $('#a-submit').disabled = on;
  $('#f-submit').disabled = on;
  $('#login-btn').disabled = on;
}

async function uploadToBucket(bucket, file) {
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${Date.now()}-${safe}`;
  const { data, error } = await sb.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return { url: sb.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

/* ---------- 登录态 ---------- */
async function refresh() {
  if (!isConfigured) {
    $('#not-configured').classList.remove('hidden');
    $('#login-box').classList.add('hidden');
    $('#admin-box').classList.add('hidden');
    return;
  }
  let user = null;
  try { user = (await sb.auth.getUser()).data.user; } catch {}
  $('#login-box').classList.toggle('hidden', !!user);
  $('#admin-box').classList.toggle('hidden', !user);
  if (user) {
    $('#whoami').textContent = user.email;
    await loadPosts();
    await loadFiles();
  }
}

/* ---------- 文章管理 ---------- */
async function loadPosts() {
  const box = $('#my-posts');
  const { data, error } = await sb.from('posts').select('id,title,category,created_at').order('created_at', { ascending: false });
  if (error) { box.innerHTML = `<p class="muted">读取失败：${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { box.innerHTML = '<p class="muted">还没有文章。</p>'; return; }
  box.innerHTML = data.map(p => `
    <div class="manage-row">
      <span class="manage-title">${esc(p.title)}</span>
      <span class="muted">${esc(p.category)} · ${formatDate(p.created_at)}</span>
      <button class="btn danger" data-del-post="${p.id}">删除</button>
    </div>`).join('');
  box.querySelectorAll('[data-del-post]').forEach(b => b.addEventListener('click', () => delPost(b.dataset.delPost)));
}

async function delPost(id) {
  if (!confirm('确定删除这篇文章？')) return;
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) { toast('删除失败：' + error.message, false); return; }
  toast('已删除');
  await loadPosts();
}

/* ---------- 文件管理 ---------- */
async function loadFiles() {
  const box = $('#my-files');
  const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });
  if (error) { box.innerHTML = `<p class="muted">读取失败：${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { box.innerHTML = '<p class="muted">还没有文件。</p>'; return; }
  box.innerHTML = data.map(f => `
    <div class="manage-row">
      <span class="manage-title">${esc(f.name)}</span>
      <span class="muted">${formatSize(f.size_bytes)} · ${formatDate(f.created_at)}</span>
      <button class="btn danger" data-del-file="${f.id}">删除</button>
    </div>`).join('');
  box.querySelectorAll('[data-del-file]').forEach(b => b.addEventListener('click', () => delFile(b.dataset.delFile)));
}

async function delFile(id) {
  if (!confirm('确定删除这个文件？')) return;
  const { data: row, error: e1 } = await sb.from('files').select('url').eq('id', id).single();
  if (!e1 && row && row.url) {
    // 尝试从 storage 删除（URL 形如 .../downloads/<path>）
    try {
      const m = row.url.match(/\/downloads\/([^?]+)/);
      if (m) await sb.storage.from('downloads').remove([decodeURIComponent(m[1])]);
    } catch {}
  }
  const { error } = await sb.from('files').delete().eq('id', id);
  if (error) { toast('删除失败：' + error.message, false); return; }
  toast('已删除');
  await loadFiles();
}

/* ---------- 事件绑定 ---------- */
function bind() {
  $('#login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await sb.auth.signInWithPassword({
        email: $('#login-email').value.trim(),
        password: $('#login-password').value,
      });
      if (error) throw error;
      toast('登录成功');
      await refresh();
    } catch (err) {
      toast('登录失败：' + (err.message || err), false);
    } finally {
      setBusy(false);
    }
  });

  $('#logout-btn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    toast('已退出');
    await refresh();
  });

  $('#article-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('#a-title').value.trim();
    const content = $('#a-content').value;
    if (!title || !content) { toast('标题和正文不能为空', false); return; }
    setBusy(true);
    try {
      let cover_url = null;
      const coverFile = $('#a-cover').files[0];
      if (coverFile) {
        toast('正在上传封面图…');
        cover_url = (await uploadToBucket('covers', coverFile)).url;
      }
      const { error } = await sb.from('posts').insert({
        title,
        category: $('#a-category').value,
        summary: $('#a-summary').value.trim(),
        content,
        cover_url,
      });
      if (error) throw error;
      toast('文章发布成功！');
      e.target.reset();
      await loadPosts();
    } catch (err) {
      toast('发布失败：' + (err.message || err), false);
    } finally {
      setBusy(false);
    }
  });

  $('#file-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#f-name').value.trim();
    const file = $('#f-file').files[0];
    if (!name || !file) { toast('请填写名称并选择文件', false); return; }
    setBusy(true);
    try {
      toast('正在上传文件…');
      const { url } = await uploadToBucket('downloads', file);
      const { error } = await sb.from('files').insert({
        name,
        version: $('#f-version').value.trim(),
        description: $('#f-description').value.trim(),
        url,
        size_bytes: file.size,
      });
      if (error) throw error;
      toast('上传成功！');
      e.target.reset();
      await loadFiles();
    } catch (err) {
      toast('上传失败：' + (err.message || err), false);
    } finally {
      setBusy(false);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bind();
  refresh();
});
