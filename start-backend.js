import { nodeProjects, startAll } from "./util.js"

startAll(nodeProjects.filter((p) => /^backend-/.test(p.dirname)))
