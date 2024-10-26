import { exec, nodeProjects } from "./util.js"

for (let { dir, pip } of nodeProjects) {
  if (pip) await exec("pipenv run pipenv sync", dir)
  await exec("pnpm install", dir)
}
