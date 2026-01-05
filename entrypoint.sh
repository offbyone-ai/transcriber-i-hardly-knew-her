#!/bin/sh
# Entrypoint script to handle permissions and start the app

# Ensure data directory exists with correct permissions
mkdir -p /app/data
chown -R 65532:65532 /app/data
chmod 755 /app/data

# Drop to nonroot user and run the app
exec su -s /bin/sh 65532 -c './transcriber'
