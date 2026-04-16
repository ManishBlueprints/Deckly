-- Create Founder User
INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    aud,
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    role, 
    email_change,
    phone,
    phone_change,
    confirmation_token, 
    is_super_admin
)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '00000000-0000-0000-0000-000000000000',
    'founder@example.com',
    'authenticated',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Founder One"}',
    NOW(),
    NOW(),
    'authenticated',
    '',
    NULL,
    NULL,
    '',
    false
) ON CONFLICT (id) DO NOTHING;

-- Profile for Founder
INSERT INTO public.profiles (id, full_name, handle, tier)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
    'Founder One', 
    'founder', 
    'PRO'
) ON CONFLICT (id) DO UPDATE SET handle = EXCLUDED.handle, tier = EXCLUDED.tier;

-- Create Investor User
INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    aud,
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    role, 
    email_change,
    phone,
    phone_change,
    confirmation_token, 
    is_super_admin
)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    '00000000-0000-0000-0000-000000000000',
    'investor@example.com',
    'authenticated',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Investor One"}',
    NOW(),
    NOW(),
    'authenticated',
    '',
    NULL,
    NULL,
    '',
    false
) ON CONFLICT (id) DO NOTHING;

-- Profile for Investor
INSERT INTO public.profiles (id, full_name, handle, tier)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 
    'Investor One', 
    'investor', 
    'FREE'
) ON CONFLICT (id) DO UPDATE SET handle = EXCLUDED.handle, tier = EXCLUDED.tier;

-- 1. Set Founder as Admin
INSERT INTO public.admin_emails (email)
VALUES ('founder@example.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Sample Deck for Founder
INSERT INTO public.decks (id, user_id, title, slug, description, status, file_type, pages, unique_visitors)
VALUES (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Tech Startup Deck 2024',
    'tech-startup-2024',
    'Our vision for the next generation of AI-driven tools.',
    'PROCESSED',
    'pdf',
    '[{"page": 1, "url": "https://placehold.jp/150x150.png"}, {"page": 2, "url": "https://placehold.jp/150x150.png"}]'::jsonb,
    5
) ON CONFLICT (id) DO NOTHING;

-- 3. Sample Branding
INSERT INTO public.branding (user_id, room_name, logo_url)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Deckly Ventures',
    'https://placehold.jp/150x150.png'
) ON CONFLICT (user_id) DO NOTHING;

-- 4. Sample Data Room
INSERT INTO public.data_rooms (id, user_id, name, slug, description)
VALUES (
    'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Series A Fundraising',
    'series-a',
    'Due diligence and pitch materials for Series A.'
) ON CONFLICT (id) DO NOTHING;

-- 5. Add Deck to Data Room
INSERT INTO public.data_room_documents (data_room_id, deck_id, display_order)
VALUES (
    'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e11',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
    1
) ON CONFLICT (data_room_id, deck_id) DO NOTHING;
