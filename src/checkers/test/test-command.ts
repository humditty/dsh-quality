import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectType } from "./detector.js";

export function resolveTestCommand(projectRoot: string, projectType: ProjectType): string {
  switch (projectType) {
    case "maven": return "mvn test";
    case "gradle": return existsSync(join(projectRoot, "gradlew")) ? "./gradlew test" : "gradle test";
    case "python": return "pytest";
    case "node": return "npm test";
  }
}
