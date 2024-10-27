import * as child_process from "node:child_process"
import chalk from "chalk"
import * as fs from "node:fs"
import * as path from "node:path"
import axios from "axios"
import process from "node:process"

export const nodeProjects = []

const __dirname = path.resolve(process.argv[2] || "../")
const dirs = fs.readdirSync(__dirname)

for (let dir of dirs) {
  const dirname = dir
  dir = path.join(__dirname, dir)
  if (fs.existsSync(path.join(dir, "package.json"))) {
    nodeProjects.push({
      dirname,
      dir,
      pip: fs.existsSync(path.join(dir, "Pipfile.lock")),
      packageJson: JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")),
      chalk: chalk.rgb((Math.random() * 255) | 0, (Math.random() * 255) | 0, (Math.random() * 255) | 0)
    })
  }
}

const aliveChildProcess = []

// 监听进程的退出事件
process.on("exit", () => {
  // 遍历所有存活的子进程并杀死它们
  aliveChildProcess.forEach((p) => p.kill())
})

// 监听SIGINT信号（如Ctrl+C）
process.on("SIGINT", () => {
  // 遍历所有存活的子进程并杀死它们
  aliveChildProcess.forEach((p) => p.kill())
})

/**
 * 使用child_process模块执行命令行命令。
 *
 * 此函数通过child_process.exec方法执行指定的命令行命令，并在指定的工作目录中运行。
 * 它返回一个Promise，允许异步处理命令的执行结果。如果命令执行出错，Promise将被拒绝，
 * 否则，它将解析为包含命令输出的数组。
 *
 * @param {string} cmd 要执行的命令行命令。
 * @param {string} cwd 命令执行时的工作目录。
 * @returns {Promise<Array<string>>} 返回一个Promise，解析为包含命令输出的数组。
 */
export function exec(cmd, cwd) {
  const chalkInstance = nodeProjects.find((p) => p.dir === cwd)?.chalk || chalk
  return new Promise((resolve, reject) => {
    const dirname = chalkInstance(path.basename(cwd))
    // 打印正在执行的命令及其工作目录
    console.log(`[${dirname}]`, chalk.red(cmd))

    const data = [] // 用于收集命令的输出数据

    // 创建一个子进程来执行命令
    const childProcess = child_process.exec(cmd, { cwd }, (error, stdout) => {
      // 如果有错误发生，拒绝Promise并返回错误信息
      if (error) reject(error)
      if (stdout) data.push(stdout)
    })
    aliveChildProcess.push(childProcess)

    /**
     * 监听子进程的标准输出流的数据事件。
     * 当有数据输出时，进行处理并打印到控制台。
     */
    childProcess.stdout.on("data", (data) => {
      // 去除数据两端的空格，以确保处理的数据不包含额外的空格。
      data = data.trim()

      // 检查处理后的数据是否为空，非空数据才进行进一步处理。
      if (data) {
        // 将数据按行分割，并过滤掉空行，准备进行打印。
        const arr = data.split("\n").filter((str) => !!str)
        // 遍历处理后的数据行，每行前添加标识，然后打印到控制台。
        arr.forEach((str) => console.log(`[${dirname}]`, str))
      }
    })

    // 当子进程关闭时，打印命令执行的结果并解析Promise
    childProcess.on("close", (code) => {
      // 打印命令执行完成的消息，包括命令、工作目录和退出码
      console.log(`[${dirname}]`, chalk.blue("finished with code"), code)
      const index = aliveChildProcess.indexOf(childProcess)
      if (index >= 0) aliveChildProcess.splice(index, 1)
      resolve(data) // 解析Promise，传递收集到的命令输出数据
    })
  })
}

/**
 * 异步函数：发布npm包
 *
 * @param {string} dir - 包的目录路径
 * @param {Object} packageJson - 包的package.json对象
 * @param chalk - 用于设置消息颜色的chalk实例
 * @param {boolean} pip - 是否是python项目
 *
 * 此函数检查包是否标记为私有，如果是，则不执行任何操作。
 * 它随后尝试从npm镜像获取最新的包版本，并与package.json中的版本进行比较。
 * 如果版本不匹配，则执行构建和发布流程。
 */
export async function publish(dir, packageJson, chalk, pip) {
  // 检查package.json中的private属性，如果是私有包则不发布
  if (packageJson.private === true || packageJson.private === "true") return

  try {
    // 从npm获取当前包的最新版本信息
    const res = await axios.get(`https://registry.npmjs.org/${packageJson.name}/latest`)
    const latestVersion = res.data.version

    let localVersion = packageJson.version
    if (localVersion !== latestVersion) localVersion = chalk.red(localVersion)
    console.log(`[${chalk(packageJson.name)}]`, "本地版本：" + localVersion, "远程版本：" + latestVersion)

    // 比较本地版本和最新版本，如果版本不同则进行构建和发布
    if (latestVersion !== packageJson.version) {
      await exec("pnpm run build", dir) // 执行构建命令
      // 执行发布命令
      if (packageJson.scripts.upload) await exec("pnpm run upload", dir)
      else if (packageJson.scripts["upload-python"]) await exec("pnpm run upload-python", dir)
      else await exec("pnpm publish", dir)
    }
  } catch (e) {
    // 捕获并忽略任何错误，确保函数不会因为错误而中断执行
  }
}

/**
 * 异步启动所有项目。
 * @param {Array} projects - 项目数组，每个项目对象应包含packageJson和dir属性。
 */
export function startAll(projects) {
  // 初始化一个对象，用于通过项目名快速查找项目对象
  const map = {}
  // 初始化一个对象，用于记录已经启动的项目，避免重复启动
  const started = {}

  // 填充map对象，方便后续通过项目名查找项目对象
  projects.forEach((p) => (map[p.packageJson.name] = p))

  // 遍历项目列表，启动每个项目
  for (let project of projects) {
    start(project)
  }

  /**
   * 异步启动一个项目及其依赖项目。
   * @param {Object} project - 项目对象，应包含packageJson和dir属性。
   */
  function start(project) {
    // 如果项目已经启动，则直接返回
    if (started[project.packageJson.name]) return
    // 标记项目为已经开始启动
    started[project.packageJson.name] = true

    // 组合并去重项目的所有依赖类型（dependencies、devDependencies、peerDependencies）
    const deps = [
      ...new Set(
        Object.keys(project.packageJson.dependencies || {}).concat(
          Object.keys(project.packageJson.devDependencies || {}),
          Object.keys(project.packageJson.peerDependencies || {})
        )
      )
    ]
      // 过滤出map中存在的依赖项目，并转换为项目对象数组
      .filter((name) => map[name])
      .map((name) => map[name])

    // 递归启动项目的所有依赖项目
    for (let project of deps) {
      start(project)
    }
    // 启动当前项目
    exec("pnpm run start", project.dir)
  }
}
