CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  icon VARCHAR(8) NOT NULL,
  color CHAR(7) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('Limpieza', '🧹', '#00b8a9', 1),
  ('Mantenimiento', '🔧', '#ff7a00', 2),
  ('Pagos', '💳', '#2ecc71', 3),
  ('Recordatorios', '🔔', '#f5c518', 4);

ALTER TABLE tasks
  ADD COLUMN category_id INT UNSIGNED NULL AFTER notes,
  ADD CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;
