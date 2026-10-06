-- ============================================================
-- Supabase 初始化脚本：在 Supabase 后台 → SQL Editor 里粘贴执行
-- ============================================================

-- 1. 文章表
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'tech',   -- tech | life | study
  summary     text,
  content     text not null,                  -- Markdown
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. 软件 / 文件表
create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  version     text,
  category    text default 'software',
  size_bytes  bigint,
  url         text not null,                  -- 指向 Storage 公开链接
  created_at  timestamptz not null default now()
);

-- 3. 开启行级安全（RLS）
alter table public.posts enable row level security;
alter table public.files  enable row level security;

-- 4. 公开可读
create policy "posts_public_read" on public.posts for select using (true);
create policy "files_public_read" on public.files  for select using (true);

-- 5. 仅登录用户可写
create policy "posts_auth_insert" on public.posts for insert with check (auth.role() = 'authenticated');
create policy "posts_auth_update" on public.posts for update using (auth.role() = 'authenticated');
create policy "posts_auth_delete" on public.posts for delete using (auth.role() = 'authenticated');

create policy "files_auth_insert" on public.files for insert with check (auth.role() = 'authenticated');
create policy "files_auth_update" on public.files for update using (auth.role() = 'authenticated');
create policy "files_auth_delete" on public.files for delete using (auth.role() = 'authenticated');

-- 6. 创建存储桶（封面图 / 软件文件，均公开读）
insert into storage.buckets (id, name, public) values ('covers',    'covers',    true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('downloads', 'downloads', true) on conflict (id) do nothing;

-- 7. Storage 权限：公开读、登录写
create policy "storage_covers_read"      on storage.objects for select using (bucket_id = 'covers');
create policy "storage_downloads_read"   on storage.objects for select using (bucket_id = 'downloads');
create policy "storage_covers_insert"    on storage.objects for insert with check (bucket_id = 'covers'    and auth.role() = 'authenticated');
create policy "storage_downloads_insert" on storage.objects for insert with check (bucket_id = 'downloads' and auth.role() = 'authenticated');
create policy "storage_auth_delete"      on storage.objects for delete using (bucket_id in ('covers','downloads') and auth.role() = 'authenticated');
