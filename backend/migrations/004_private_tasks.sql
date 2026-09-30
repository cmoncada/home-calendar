ALTER TABLE tasks
  ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0 AFTER category_id,
  ADD KEY idx_tasks_private_creator (is_private, created_by);
