# Google Cloud setup

Run these commands from an authenticated operator workstation. Replace every placeholder and review the region before applying.

```bash
gcloud services enable transcoder.googleapis.com storage.googleapis.com compute.googleapis.com --project PROJECT_ID
gcloud storage buckets create gs://INPUT_BUCKET --project PROJECT_ID --location REGION --uniform-bucket-level-access
gcloud storage buckets create gs://OUTPUT_BUCKET --project PROJECT_ID --location REGION --uniform-bucket-level-access
gcloud storage buckets create gs://ARCHIVE_BUCKET --project PROJECT_ID --location REGION --uniform-bucket-level-access
gcloud projects add-iam-policy-binding PROJECT_ID --member serviceAccount:APP_SERVICE_ACCOUNT --role roles/transcoder.admin
gcloud storage buckets add-iam-policy-binding gs://INPUT_BUCKET --member serviceAccount:APP_SERVICE_ACCOUNT --role roles/storage.objectAdmin
gcloud storage buckets add-iam-policy-binding gs://OUTPUT_BUCKET --member serviceAccount:service-PROJECT_NUMBER@gcp-sa-transcoder.iam.gserviceaccount.com --role roles/storage.objectAdmin
```

Configure the input-bucket CORS policy to allow `PUT` from the production and preview application origins and expose `Range`, `Content-Range`, and upload response headers. Do not grant `allUsers` or `allAuthenticatedUsers` object access.

Place the output bucket behind an external Application Load Balancer and Cloud CDN backend bucket. Enable signed-cookie enforcement, create a CDN signing key, and store its base64 key value only in the server environment. Use an app/CDN shared parent domain, for example `app.example.com` and `video.example.com`, with `VIDEO_COOKIE_DOMAIN=.example.com`; browsers cannot accept a cookie for an unrelated CDN domain.

After the Cloud resources are verified, set `ENABLE_VIDEO_TRANSCODING=true`, configure the CDN variables, deploy, upload a short test clip, wait for `ready`, publish it, and verify HLS requests return 403 without a playback cookie.
