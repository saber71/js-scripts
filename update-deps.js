import { exec, nodeProjects } from "./util.js"

for (let { dir, pip } of nodeProjects) {
  if (pip) await exec("pipenv run pipenv update", dir)
  await exec("pnpm update", dir)
}
