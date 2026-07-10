import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

# Add getRecommendedUploadMode import
if "getRecommendedUploadMode" not in c:
    c = c.replace("import { apiFetch } from '../../lib/api';", "import { apiFetch } from '../../lib/api';\nimport { getRecommendedUploadMode } from '../../lib/uploadMode';")

old_upload = r'''      fd\.append\("sourceType", "uploaded_pdf"\);
      fd\.append\("sourceScope", "chat_upload"\);

      const res = await apiFetch\("/api/rag/upload", \{
        method: "POST",
        body: fd
      \}\);
      let data = await res\.json\(\)\.catch\(\(\) => null\);
      let isFallback = false;
      if \(!res\.ok \|\| data\?\.code === "GOOGLE_AUTH_TOKEN_FETCH_FAILED" \|\| data\?\.code === "UPLOAD_STORAGE_FAILED" \|\| \(data\?\.message && \(data\.message\.includes\("oauth2"\) \|\| data\.message\.includes\("Premature close"\)\)\)\) \{
        console\.warn\("Backend upload failed with auth or storage issue\. Falling back to client upload\.\.\.", data\);
        isFallback = true;
      \}

      if \(isFallback\) \{'''

new_upload = '''      fd.append("sourceType", "uploaded_pdf");
      fd.append("sourceScope", "chat_upload");

      const uploadMode = await getRecommendedUploadMode();
      
      let data: any = null;
      let isFallback = uploadMode === "client_firebase_storage";

      if (!isFallback) {
        const res = await apiFetch("/api/rag/upload", {
          method: "POST",
          body: fd
        });
        data = await res.json().catch(() => null);
        
        if (!res.ok || data?.code === "GOOGLE_AUTH_TOKEN_FETCH_FAILED" || data?.code === "UPLOAD_STORAGE_FAILED" || (data?.message && (data.message.includes("oauth2") || data.message.includes("Premature close")))) {
          console.warn("Backend upload failed with auth or storage issue. Falling back to client upload...", data);
          isFallback = true;
        }
      }

      if (isFallback) {'''

c = re.sub(old_upload, new_upload, c)

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
