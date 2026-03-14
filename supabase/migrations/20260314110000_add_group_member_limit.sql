create or replace function public.enforce_group_membership_limit()
returns trigger
language plpgsql
as $$
declare
  member_count integer;
begin
  select count(*)
  into member_count
  from public.group_memberships
  where group_id = new.group_id
    and course_id = new.course_id;

  if member_count >= 5 then
    raise exception 'Group is full (max 5 members).';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_group_membership_limit_trigger on public.group_memberships;
create trigger enforce_group_membership_limit_trigger
before insert on public.group_memberships
for each row
execute function public.enforce_group_membership_limit();
