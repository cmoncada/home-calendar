CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  password_hash VARCHAR(100) NULL,
  role ENUM('admin', 'member', 'display') NOT NULL DEFAULT 'member',
  avatar_type ENUM('preset', 'upload') NOT NULL DEFAULT 'preset',
  avatar_value VARCHAR(255) NOT NULL DEFAULT 'avatar-01.svg',
  color CHAR(7) NOT NULL DEFAULT '#e50914',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE display_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  label VARCHAR(80) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_hint CHAR(4) NOT NULL,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  UNIQUE KEY uq_display_tokens_hash (token_hash),
  CONSTRAINT fk_display_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  notes TEXT NULL,
  color CHAR(7) NOT NULL DEFAULT '#e50914',
  start_date DATE NOT NULL,
  start_time TIME NULL,
  duration_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  duration_unit ENUM('hours', 'days') NOT NULL DEFAULT 'hours',
  recurrence_type ENUM('none', 'weekly', 'monthly') NOT NULL DEFAULT 'none',
  recurrence_days JSON NULL,
  recurrence_until DATE NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tasks_start (start_date),
  CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_assignees (
  task_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT fk_assignees_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignees_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_completions (
  task_id INT UNSIGNED NOT NULL,
  occurrence_date DATE NOT NULL,
  completed_by INT UNSIGNED NULL,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, occurrence_date),
  CONSTRAINT fk_completions_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_completions_user FOREIGN KEY (completed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_exceptions (
  task_id INT UNSIGNED NOT NULL,
  occurrence_date DATE NOT NULL,
  PRIMARY KEY (task_id, occurrence_date),
  CONSTRAINT fk_exceptions_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
