# Migrations

Changes for a database that was created from an older `schema.sql`. Fresh
installs from the current `schema.sql` + `seed.sql` already include them.

Always back up first:

```bash
mysqldump -h 127.0.0.1 -P 3307 -u root -p j_eats > j_eats_backup.sql
```

| File | What it does |
| --- | --- |
| `001_menu_tags_featured_rider_online.sql` | Adds `menu_items.tag`, `menu_items.featured` and `users.is_online`. Only adds columns. |
| `001_optional_demo_tags.sql` | Optional: fills `tag` / `featured` for the 9 seeded demo menu items. It only touches those rows, and only where `tag` is still empty. |

Restart Flask after running a migration.
