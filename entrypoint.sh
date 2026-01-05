#!/bin/sh
# Entrypoint script to handle permissions and start the app

# Ensure data directory exists with correct permissions
mkdir -p /app/data
dchown -R nonroot:nonroot /app/data
chmod 755 /app/data

# Drop to nonroot user and run the app
exec su -s /bin/sh nonroot -c './transcriber'
