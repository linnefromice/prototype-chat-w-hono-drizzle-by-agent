-- Chat users data (users table)
-- Links chat functionality users to auth users
--
-- Dependencies:
--   - Requires auth users to be created first (001_auth_users.ts)
--   - auth_user_id should match the ID from auth_user table
--
-- Alice and Bob characters from cryptography and security protocols
-- Reference: https://en.wikipedia.org/wiki/Alice_and_Bob
-- Avatar images from PokeAPI sprites
--
-- Note: auth_user_id is set to NULL for now.
-- Use 001_auth_users.ts to create auth users and link them to these chat users.

INSERT INTO users (id, id_alias, name, avatar_url, auth_user_id, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'alice', 'Alice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob', 'Bob', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440003', 'carol', 'Carol', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440004', 'dave', 'Dave', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440005', 'eve', 'Eve', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440006', 'frank', 'Frank', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440007', 'grace', 'Grace', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440008', 'heidi', 'Heidi', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440009', 'ivan', 'Ivan', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440010', 'judy', 'Judy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/151.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440011', 'kevin', 'Kevin', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440012', 'laura', 'Laura', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440013', 'michael', 'Michael', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440014', 'nancy', 'Nancy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/35.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440015', 'oscar', 'Oscar', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440016', 'peggy', 'Peggy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/113.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440017', 'quinn', 'Quinn', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/131.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440018', 'rachel', 'Rachel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/148.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440019', 'steve', 'Steve', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z'),
  ('550e8400-e29b-41d4-a716-446655440020', 'tina', 'Tina', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/196.png', NULL, strftime('%Y-%m-%dT%H:%M:%S', 'now') || 'Z');
