import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

old_upload = r'''      const fd = new FormData\(\);
      fd\.append\("file", file\);
      fd\.append\("title", file\.name\);
      fd\.append\("subject", currentSubject\);
      fd\.append\("lesson", topic\);
      fd\.append\("resourceType", "attachment"\);
      fd\.append\("sourceType", "attachment"\);
      fd\.append\("sourceScope", "owner_syllabus"\);'''

new_upload = '''      const { sourceId, storagePath } = await uploadPdfWithClientStorage({
        file,
        subject: currentSubject,
        lesson: topic,
        resourceType: "paper_structure",
        sourceScope: "owner_syllabus"
      });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", file.name);
      fd.append("subject", currentSubject);
      fd.append("lesson", topic);
      fd.append("resourceType", "paper_structure");
      fd.append("sourceType", "attachment");
      fd.append("sourceScope", "owner_syllabus");
      fd.append("sourceId", sourceId);
      fd.append("storagePath", storagePath);'''

c = re.sub(old_upload, new_upload, c)

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
