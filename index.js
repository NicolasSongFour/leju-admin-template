#!/usr/bin/env node
const fs         = require("fs");
const path       = require("path");
const program    = require("commander");          // 命令行解决方案      https://www.npmjs.com/package/commander
const download   = require("download-git-repo");  // 下载模版文件       https://www.npmjs.com/package/download-git-repo/
const chalk      = require("chalk");              // 美化终端           https://www.npmjs.com/package/chalk
const symbols    = require("log-symbols");        // 美化终端           https://www.npmjs.com/package/log-symbols
const ora        = require("ora");                // 提示下载           https://www.npmjs.com/package/ora
const inquirer   = require("inquirer");           // 提示文本           https://www.npmjs.com/package/inquirer
const package    = require("./package.json");     // 获取版本信息
const shell      = require('shelljs');            // shell
// const handlebars = require("handlebars");         // 修改模版文件内容

// 模版对应分支 当前拼接规则：[github]:[账户名]/[仓库名]#[分支]
const templateList = {
  '星火子项目': "github:NicolasSongFour/MarkdownTest/#master",
};

let projectPath  = process.cwd();  // 项目绝对路径
let templatePath = '';  // 模版绝对路径

/**
 * 命令行输出
 *
 * @param {string} type 输出类型 info|success|error|warning
 * @param {string} color 输出颜色 red|green
 * @param {string} str 输出文案
 */
function log(type, color, str) {
  console.log(symbols[type], chalk[color](str));
}

/**
 * 默认错误处理
 *
 * @param {error} error 错误
 */
function errorCallback(error) {
  log("error", "red", error.message);
}

/**
 * create 操作处理方法
 *
 * @param {string} pathName 创建项目路径，命令行传入 lj create <pathName>
 */
function handleCommand(pathName) {
  templatePath = path.resolve(projectPath, pathName);

  // 判断项目目录是否存在，防止覆盖已有项目
  if (fs.existsSync(pathName)) {
    log("error", "red", `${pathName}项目目录已经存在`);
  } else {
    // 显示模版列表
    showTemplateList()
      .then(selectTemplateList)
      .catch(errorCallback);
  }
}

/**
 * 命令行模版选单显示
 *
 * @returns {promise} 命令行选单
 */
function showTemplateList() {
  const choicesList = Object.keys(templateList);
  const options = [
    {
      type   : "list",
      name   : "type",
      message: "请选择模版类型?",
      choices: choicesList,
    },
  ];

  return inquirer.prompt(options);
}

/**
 * 命令行继续执行确认显示
 *
 * @returns {promise} 命令行选单
 */
function showAutoInstallConfirm() {
  const options = [
    {
      type   : "confirm",
      name   : "type",
      message: "是否继续执行 npm install 安装依赖?",
    },
  ];

  return inquirer.prompt(options);
}

/**
 * 模版选择
 *
 * @param {object} answers 用户选择
 * @param {string} answers.type 用户选择，字段名对应创建选单时 options[].name
 */
function selectTemplateList(answers) {
  const spinner = ora("正在下载模板");
  log("success", "green", "开始创建..........请稍候");
  spinner.start();  // loading

  const templateURL = templateList[answers.type];

  download(templateURL, templatePath, err => {
    if (err) {
      spinner.fail();
      log("error", "red", `${answers.type}模版创建失败`);
      log("error", "red", err.message);
    } else {
      spinner.succeed();

      downloadTemplateSuccess();
    }
  })
}

/**
 * 模版下载完成
 */
function downloadTemplateSuccess() {
  log("success", "green", '模版创建成功');

  mergePackageJSON(); // 合并 package.json
}

/**
 * 合并模版package.json与项目package.json
 */
function mergePackageJSON() {
  // log + loading
  const spinner = ora("正在合并package.json");
  log("success", "green", "开始合并package.json..........请稍候");
  spinner.start();

  const projectPackageJSON  = getPackageJSON(projectPath);
  const templatePackageJSON = getPackageJSON(templatePath);

  let needAutoInstall = true;

  if(templatePackageJSON === null) {
    needAutoInstall = false;
  } else if(projectPackageJSON === null) {
    needAutoInstall = false;

    // TODO: 不存在package.json时 警告+中断+清理已下载模版
    log('error', 'red', '项目下无法找到package.json，无法继续执行');
  } else {
    needAutoInstall = true;

    const { dependencies, devDependencies } = templatePackageJSON;

    if(typeof dependencies !== 'undefined') {
      let target = projectPackageJSON.dependencies;

      if(!target) {
        projectPackageJSON.dependencies = dependencies;
      } else {
        // TODO: 增加依赖版本判断，log提示
        for(let key in dependencies) {
          if(!target[key]) {
            target[key] = dependencies[key];
          }
        }
      }
    }

    if(typeof devDependencies !== 'undefined') {
      let target = projectPackageJSON.devDependencies;

      if(!target) {
        projectPackageJSON.devDependencies = devDependencies;
      } else {
        // TODO: 增加依赖版本判断，log提示
        for(let key in devDependencies) {
          if(!target[key]) {
            target[key] = devDependencies[key];
          }
        }
      }
    }

    fs.writeFileSync(path.resolve(projectPath, './package.json'), JSON.stringify(projectPackageJSON));
  }

  spinner.succeed();
  log("success", "green", "合并package.json成功");

  if(needAutoInstall) {
    showAutoInstallConfirm()
      .then(selectAutoInstallConfirm)
      .catch(errorCallback);
  }
}

/**
 * 获取路径下package.json文件
 *
 * @param {string} dirPath 需要获取json文件的路径
 * @return {null|object} 获取成功返回json object，无法获取返回null
 */
function getPackageJSON(dirPath) {
  const packagePath  = path.resolve(dirPath, './package.json');
  let result = null;

  // 判断文件是否存在
  if(fs.existsSync(packagePath)) {
    result = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  }

  return result;
}

/**
 * shell 执行 npm install
 *
 * @param {object} answers 用户选择
 * @param {string} answers.type 用户选择，字段名对应创建选单时 options[].name
 */
function selectAutoInstallConfirm(answers) {
  if(!answers.type) {
    return log('success', 'green', '请稍后自行执行`npm install`命令');
  }

  // log + loading
  const spinner = ora("正在安装依赖");
  log("success", "green", "开始安装依赖..........请稍候");
  spinner.start();

  //判定npm命令是否可用
  if (!shell.which('npm')) {
    spinner.fail();
    log('error', 'red', 'npm 命令不可用，请自行执行`npm install`命令');
    shell.exit(1);  //退出当前进程
  }

  // 切换至项目地址
  shell.cd(projectPath);

  //异步执行npm命令安装依赖，屏蔽打印
  shell.exec('npm install', {silent:true}, function(code, stdout, stderr) {
    if(code === 0) {
      spinner.succeed();
      log('info', 'white', stdout);
      log('success', 'green', '安装依赖完成');
    } else {
      spinner.fail();
      log('error', 'red', '，请自行执行`npm install`命令');
      shell.exit(1);  //退出当前进程
    }
  })
}

program
  .version(package.version, "-v,--version")
  .command("create <pathName>")
  .action(handleCommand);

program.parse(process.argv);

// 参考：https://segmentfault.com/a/1190000015957648
