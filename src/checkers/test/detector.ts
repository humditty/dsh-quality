import { existsSync } from "node:fs";
import { join } from "node:path";

export type ProjectType = "maven" | "gradle" | "python" | "node";

export function detectProjectType(projectRoot: string): ProjectType | undefined {
  if (existsSync(join(projectRoot, "pom.xml"))) return "maven";
  if (existsSync(join(projectRoot, "build.gradle")) || existsSync(join(projectRoot, "build.gradle.kts"))) return "gradle";
  if (existsSync(join(projectRoot, "pytest.ini")) || existsSync(join(projectRoot, "pyproject.toml")) || existsSync(join(projectRoot, "requirements.txt"))) return "python";
  if (existsSync(join(projectRoot, "package.json"))) return "node";
  return undefined;
}
