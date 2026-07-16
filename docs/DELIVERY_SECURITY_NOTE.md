# Delivery security note

The downloadable project package intentionally excludes `node_modules`, local
`data_users` exports, `.env` files, and version-control metadata. Install
packages with `npm ci` and configure production secrets only through the hosting
provider's encrypted environment settings.
