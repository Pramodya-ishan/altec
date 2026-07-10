with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

c = c.replace('import { apiFetch } from "../../lib/api";import { SSEParser } from "../../lib/sseParser";import { GraduationCap', 'import { apiFetch } from "../../lib/api";\nimport { SSEParser } from "../../lib/sseParser";\nimport { GraduationCap')
c = c.replace("Flame } from 'lucide-react';import React", "Flame } from 'lucide-react';\nimport React")
c = c.replace('import React, { useState, useEffect, useMemo } from "react";import { motion', 'import React, { useState, useEffect, useMemo } from "react";\nimport { motion')
c = c.replace('from "motion/react";import { ResponsiveChartShell', 'from "motion/react";\nimport { ResponsiveChartShell')
c = c.replace('from "../ui/ResponsiveChartShell";import { AreaChart', 'from "../ui/ResponsiveChartShell";\nimport { AreaChart')

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
