#!/bin/sh
set -e

BASE_PATH="${BASE_PATH:-/}"

# Safely ensure trailing slash (needed by <base href>)
case "$BASE_PATH" in
    */) ;;
    *) BASE_PATH="${BASE_PATH}/" ;;
esac

# Replace <base href="..."> in index.html
if [ -f /app/frontend/index.html ]; then
    sed -i "s|<base href=\"[^\"]*\">|<base href=\"${BASE_PATH}\">|" /app/frontend/index.html
fi

exec gunicorn --bind 0.0.0.0:5000 app:app
