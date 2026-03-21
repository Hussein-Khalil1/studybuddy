-- Add points visibility preference to profiles
alter table public.profiles
  add column if not exists show_points boolean not null default true;

-- Re-create co-member policies to respect show_points preference

drop policy if exists "Group co-members can read course points" on public.user_course_points;
create policy "Group co-members can read course points"
  on public.user_course_points for select to authenticated
  using (
    auth.uid() = user_id
    or (
      (select show_points from public.profiles where id = user_course_points.user_id) = true
      and exists (
        select 1
        from public.group_memberships gm1
        join public.group_memberships gm2 on gm1.group_id = gm2.group_id
        where gm1.user_id = auth.uid()
          and gm2.user_id = user_course_points.user_id
      )
    )
  );

drop policy if exists "Group co-members can read badges" on public.user_badges;
create policy "Group co-members can read badges"
  on public.user_badges for select to authenticated
  using (
    auth.uid() = user_id
    or (
      (select show_points from public.profiles where id = user_badges.user_id) = true
      and exists (
        select 1
        from public.group_memberships gm1
        join public.group_memberships gm2 on gm1.group_id = gm2.group_id
        where gm1.user_id = auth.uid()
          and gm2.user_id = user_badges.user_id
      )
    )
  );
