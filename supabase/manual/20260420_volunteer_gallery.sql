/*
  Volunteer Gallery setup

  Run this in Supabase SQL Editor.
  It creates:
  - a public bucket for gallery images
  - a volunteer_gallery_photos table
  - policies so anyone signed in can upload and publish photos
*/

insert into storage.buckets (id, name, public)
values ('volunteer-gallery', 'volunteer-gallery', true)
on conflict (id) do update set public = true;

create table if not exists public.volunteer_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  caption text not null default '',
  image_url text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.volunteer_gallery_photos enable row level security;

drop policy if exists "Authenticated users can view volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Authenticated users can view volunteer gallery photos"
  on public.volunteer_gallery_photos
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Authenticated users can insert volunteer gallery photos"
  on public.volunteer_gallery_photos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Users can update their own volunteer gallery photos"
  on public.volunteer_gallery_photos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Users can delete their own volunteer gallery photos"
  on public.volunteer_gallery_photos
  for delete
  to authenticated
  using (auth.uid() = user_id or get_my_role() = 'admin');

drop policy if exists "Authenticated users can view volunteer gallery storage" on storage.objects;
create policy "Authenticated users can view volunteer gallery storage"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'volunteer-gallery');

drop policy if exists "Authenticated users can upload volunteer gallery storage" on storage.objects;
create policy "Authenticated users can upload volunteer gallery storage"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'volunteer-gallery'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own volunteer gallery storage" on storage.objects;
create policy "Users can update their own volunteer gallery storage"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'volunteer-gallery'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'volunteer-gallery'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own volunteer gallery storage" on storage.objects;
create policy "Users can delete their own volunteer gallery storage"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'volunteer-gallery'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or get_my_role() = 'admin'
    )
  );
