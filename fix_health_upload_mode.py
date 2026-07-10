import re

with open("server/ai/routes.ts", "r") as f:
    c = f.read()

c = c.replace("""    requiredIamRoles: [""", """    recommendedUploadMode: storageOk ? "backend_multer" : "client_firebase_storage",
    requiredIamRoles: [""")

with open("server/ai/routes.ts", "w") as f:
    f.write(c)
