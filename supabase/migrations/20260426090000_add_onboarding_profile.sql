alter table public.profiles
add column if not exists onboarding_profile jsonb default '{}'::jsonb;

update public.profiles
set onboarding_profile = '{}'::jsonb
where onboarding_profile is null;
