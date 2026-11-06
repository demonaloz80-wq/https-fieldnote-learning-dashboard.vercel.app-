do $$
declare
  target_ids uuid[];
begin
  if exists (
    select 1
    from public.profiles
    where role = 'instructor'
      and (
        lower(btrim(full_name)) = 'zelalem lamesgen'
        or lower(btrim(full_name)) like 'zelalem lamesgen %'
        or lower(btrim(full_name)) = 'dnku ayeleg'
        or lower(btrim(full_name)) like 'dnku ayeleg %'
        or lower(btrim(full_name)) = 'dnku ayelgn'
        or lower(btrim(full_name)) like 'dnku ayelgn %'
      )
    group by case
      when lower(btrim(full_name)) like 'zelalem lamesgen%' then 'zelalem lamesgen'
      else 'dnku ayeleg'
    end
    having count(*) > 1
  ) then
    raise exception 'Instructor deletion stopped: a requested name matches multiple accounts. Inspect matching profiles and remove the duplicate deliberately.';
  end if;

  select array_agg(id)
  into target_ids
  from public.profiles
  where role = 'instructor'
    and (
      lower(btrim(full_name)) = 'zelalem lamesgen'
      or lower(btrim(full_name)) like 'zelalem lamesgen %'
      or lower(btrim(full_name)) = 'dnku ayeleg'
      or lower(btrim(full_name)) like 'dnku ayeleg %'
      or lower(btrim(full_name)) = 'dnku ayelgn'
      or lower(btrim(full_name)) like 'dnku ayelgn %'
    );

  delete from public.courses
  where instructor_id = any(coalesce(target_ids, array[]::uuid[]));

  delete from auth.users
  where id = any(coalesce(target_ids, array[]::uuid[]));
end;
$$;
