import { nodeProjects, publish } from "./util.js"

for (let { dir, packageJson, chalk } of nodeProjects) {
  await publish(dir, packageJson, chalk)
}
