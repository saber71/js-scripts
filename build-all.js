import { exec, nodeProjects } from "./util.js"

for (let { dir, packageJson } of nodeProjects) {
  if (packageJson.scripts.build) await exec("pnpm run build", dir)
}
