#!/usr/bin/env bash

set -Eeuo pipefail

DB_NAME="${ACCORD_DB_NAME:-accord}"
DB_USER="${ACCORD_DB_USER:-accord}"
DB_PASSWORD="${ACCORD_DB_PASSWORD:-accord}"
MYSQL_ROOT_USER="${MYSQL_ROOT_USER:-root}"

echo "Creating MySQL database '$DB_NAME' and application user '$DB_USER'."
echo "You may be prompted for the MySQL root password."

mysql --user="$MYSQL_ROOT_USER" -p <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "MySQL database is ready."
echo "Set DATABASE_URL in backend/.env to:"
echo "mysql+aiomysql://$DB_USER:$DB_PASSWORD@127.0.0.1:3306/$DB_NAME"
