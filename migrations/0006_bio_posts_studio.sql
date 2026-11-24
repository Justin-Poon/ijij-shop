-- Posts marked as posted in IJIJ Studio sync here automatically; studio_id links the row to the studio post.
ALTER TABLE bio_posts ADD COLUMN studio_id INTEGER;
CREATE UNIQUE INDEX bio_posts_studio ON bio_posts (studio_id);
