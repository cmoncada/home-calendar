ALTER TABLE tasks
  MODIFY recurrence_type ENUM('none', 'weekly', 'monthly', 'interval') NOT NULL DEFAULT 'none',
  ADD COLUMN recurrence_interval SMALLINT UNSIGNED NULL AFTER recurrence_days;
