import re

with open("src/components/views/SyllabusLibraryView.tsx", "r") as f:
    c = f.read()

# Add getRecommendedUploadMode import
if "getRecommendedUploadMode" not in c:
    c = c.replace("import { apiFetch } from '../../lib/api';", "import { apiFetch } from '../../lib/api';\nimport { getRecommendedUploadMode } from '../../lib/uploadMode';")

old_upload = r'''      fd\.append\("sourceScope", "owner_syllabus"\);
      fd\.append\("year", form\.year \|\| ""\);
      fd\.append\("medium", form\.medium \|\| "Sinhala"\);

      const res = await apiFetch\("/api/rag/upload", \{
        method: "POST",
        body: fd
      \}\);
      const data = await res\.json\(\)\.catch\(\(\)=>null\);
      let isFallback = false;
      let finalData = data;
      if \(!res\.ok \|\| data\?\.code === "GOOGLE_AUTH_TOKEN_FETCH_FAILED" \|\| data\?\.code === "UPLOAD_STORAGE_FAILED" \|\| \(data\?\.message && \(data\.message\.includes\("oauth2"\) \|\| data\.message\.includes\("Premature close"\)\)\)\) \{
        console\.warn\("Backend upload failed with auth or storage issue\. Falling back to client upload\.\.\.", data\);
        isFallback = true;
      \}

      if \(isFallback\) \{'''

new_upload = '''      fd.append("sourceScope", "owner_syllabus");
      fd.append("year", form.year || "");
      fd.append("medium", form.medium || "Sinhala");

      const uploadMode = await getRecommendedUploadMode();
      
      let data: any = null;
      let isFallback = uploadMode === "client_firebase_storage";
      let finalData = data;

      if (!isFallback) {
        const res = await apiFetch("/api/rag/upload", {
          method: "POST",
          body: fd
        });
        data = await res.json().catch(()=>null);
        finalData = data;
        
        if (!res.ok || data?.code === "GOOGLE_AUTH_TOKEN_FETCH_FAILED" || data?.code === "UPLOAD_STORAGE_FAILED" || (data?.message && (data.message.includes("oauth2") || data.message.includes("Premature close")))) {
          console.warn("Backend upload failed with auth or storage issue. Falling back to client upload...", data);
          isFallback = true;
        }
      }

      if (isFallback) {'''

c = re.sub(old_upload, new_upload, c)

with open("src/components/views/SyllabusLibraryView.tsx", "w") as f:
    f.write(c)
