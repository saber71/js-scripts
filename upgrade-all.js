import { exec, nodeProjects, publish } from "./util.js"
import * as fs from "node:fs"
import path from "node:path"

/*
 * 更新npm包的版本号并发布
 */

// 定义正则表达式，用于匹配fix和feat类型的commit消息，以及版本号信息
const fixReg = /^fix(\(.+\))?:/
const featReg = /^feat(\(.+\))?:/
const versionReg = /"version":(.+),/

// 遍历nodeProjects数组，对每个项目进行版本号更新
for (let { dir, chalk, packageJson } of nodeProjects) {
  // 执行git log命令，获取最近20条commit消息
  let logs = await exec('git log --oneline --pretty=format:"%s" -20', dir)
  // 处理commit消息，去除换行和空格
  logs = logs
    .map((str) => str.split("\n"))
    .flat()
    .map((str) => str.trim())
  // 初始化feat和fix计数器
  let feat = 0,
    fix = 0
  // 遍历commit消息，统计feat和fix的数量
  for (let log of logs) {
    // 如果遇到升级包版本的commit，则停止统计
    if (log === "chore: upgrade package version") break
    // 如果commit消息匹配feat正则表达式，则feat计数器加一
    if (featReg.test(log)) feat++
    // 如果commit消息匹配fix正则表达式，则fix计数器加一
    else if (fixReg.test(log)) fix++
  }
  // 读取package.json文件内容
  let packageJsonText = fs.readFileSync(path.join(dir, "package.json"), "utf-8")
  // 匹配版本号信息
  const matchResult = packageJsonText.match(versionReg)
  // 如果没有匹配到版本号信息，则抛出错误
  if (!matchResult) throw new Error("not match version:" + dir)
  // 提取版本号字段和版本号值
  const field = matchResult[0]
  let version = matchResult[1].trim()
  version = version.slice(1, version.length - 1)
  // 将版本号字符串转换为数字数组
  const versionNumbers = version.split(".").map(Number)
  // 根据feat和fix的数量，更新版本号
  if (feat) {
    versionNumbers[1] += feat
    versionNumbers[2] = fix
  } else if (fix) {
    versionNumbers[2] += fix
  } else continue
  // 将版本号数字数组转换回字符串
  version = versionNumbers.join(".")
  // 更新package.json文件中的版本号
  packageJsonText = packageJsonText.replace(field, `"version": "${version}",`)
  // 写回修改后的package.json文件
  fs.writeFileSync(path.join(dir, "package.json"), packageJsonText)
  // 添加所有文件到git仓库，准备提交
  await exec("git add .", dir)
  // 提交git仓库中的修改，提交信息为"chore: upgrade package version"
  await exec(`git commit -m "chore: upgrade package version"`, dir)
  // 发布包
  await publish(dir, packageJson, chalk)
}
