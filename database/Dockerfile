# Use the official MySQL 8 image as base
FROM mysql:8

# Set default environment variables (for local dev only!)
# You can override these at runtime with `-e` or docker-compose.
ENV MYSQL_ROOT_PASSWORD=supersecret
ENV MYSQL_DATABASE=gigsdb

# Copy initialization scripts into Docker image
COPY init-scripts/*.sql /docker-entrypoint-initdb.d/

# The official MySQL image automatically runs any .sql scripts in
# /docker-entrypoint-initdb.d/ on first container startup, creating DBs/tables.
