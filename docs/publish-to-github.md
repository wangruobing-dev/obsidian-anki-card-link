# Anki Card Link 首次发布到 GitHub

本文适用于当前项目的 `1.0.0` 首次发布。完成后，GitHub 中应同时存在：

- 项目源码仓库；
- `1.0.0` Git 标签；
- `1.0.0` GitHub Release；
- Release 附件 `main.js`、`manifest.json`、`styles.css` 和 `versions.json`。

## 一、发布前检查

在 PowerShell 中进入项目目录：

```powershell
Set-Location "C:\UserFiles\AnkiCardLink"
```

执行与 GitHub 自动检查相同的命令：

```powershell
npm run lint
npm test
npm run build
```

三条命令都成功后再继续。

## 二、创建 GitHub 仓库

1. 登录 GitHub。
2. 打开 <https://github.com/new>。
3. `Repository name` 填写：

   ```text
   obsidian-anki-card-link
   ```

4. 可见性选择 `Public`。Obsidian 官方插件收录需要能够公开访问项目。
5. 不要勾选自动创建 README、`.gitignore` 或 License，因为本地项目已经包含这些文件。
6. 点击 `Create repository`。

创建完成后先不要关闭页面，后面需要复制仓库地址。

## 三、替换项目中的 GitHub 用户名

当前项目还有两处 `your-github-username`。将下面命令里的 `<你的GitHub用户名>` 替换成真实用户名后执行：

```powershell
$githubUser = "<你的GitHub用户名>"

(Get-Content -LiteralPath "manifest.json" -Raw -Encoding utf8).Replace(
    "your-github-username",
    $githubUser
) | Set-Content -LiteralPath "manifest.json" -Encoding utf8

(Get-Content -LiteralPath "package.json" -Raw -Encoding utf8).Replace(
    "your-github-username",
    $githubUser
) | Set-Content -LiteralPath "package.json" -Encoding utf8
```

检查是否已经全部替换：

```powershell
rg -n "your-github-username" manifest.json package.json
```

没有输出表示替换完成。

注意：PowerShell 写回 JSON 后可能产生 UTF-8 BOM。通常不影响使用；如果后续校验工具对此有要求，可使用编辑器以 UTF-8 无 BOM 重新保存。

## 四、初始化本地 Git 仓库

当前项目目录还不是 Git 仓库。执行：

```powershell
git init -b main
git add .
git status
```

检查 `git status`：

- 应该包含源码、测试、文档、工作流和配置文件；
- 不应该包含 `node_modules`；
- `main.js` 不出现是正常的，因为它是构建产物，并已被 `.gitignore` 忽略；GitHub Release 工作流会重新构建并上传它。

确认后创建第一次提交：

```powershell
git commit -m "Initial release of Anki Card Link 1.0.0"
```

本机已经配置 Git 提交身份时会直接成功。如果提示缺少 `user.name` 或 `user.email`，按照错误提示配置后重新提交。

## 五、连接并推送 GitHub 仓库

将 `<你的GitHub用户名>` 替换为真实用户名：

```powershell
git remote add origin "https://github.com/<你的GitHub用户名>/obsidian-anki-card-link.git"
git remote -v
git push -u origin main
```

GitHub 目前不接受账户密码进行 Git 推送。弹出登录窗口时，通过浏览器登录 GitHub；如果要求令牌，需要使用 Personal Access Token，而不是 GitHub 登录密码。

推送成功后，刷新 GitHub 仓库页面，确认源码已经出现。

## 六、检查 GitHub Actions

打开仓库的 `Actions` 页面，应该看到 `Build check` 工作流。

它会自动执行：

```text
npm ci
npm run lint
npm test
npm run build
```

必须等 `Build check` 变成绿色成功状态后，再发布 `1.0.0`。

如果 Actions 被 GitHub 默认禁用，按照页面提示启用工作流，然后重新运行。

## 七、创建 1.0.0 Release

当前项目已经配置 `.github/workflows/release.yml`。只要推送版本标签，就会自动创建 GitHub Release。

版本号必须与 `manifest.json` 和 `package.json` 中的版本一致。首次发布使用 `1.0.0`，不要写成 `v1.0.0`。

执行：

```powershell
git tag -a 1.0.0 -m "Release 1.0.0"
git push origin 1.0.0
```

推送标签后：

1. 打开 GitHub 仓库的 `Actions` 页面；
2. 等待 `GitHub release` 工作流完成；
3. 打开仓库右侧的 `Releases`；
4. 打开 `1.0.0` Release。

## 八、验收 Release

`1.0.0` Release 中必须能够下载以下四个文件：

```text
main.js
manifest.json
styles.css
versions.json
```

另外确认：

- Release 不是 Draft；
- Release 不是 Prerelease；
- 标签名称是 `1.0.0`；
- `manifest.json` 中的版本也是 `1.0.0`；
- 仓库首页 README 能正常显示；
- README 中的 AnkiConnect 安装链接能够打开；
- License 显示为 MIT。

建议下载 Release 中的三个插件文件，放入一个临时 Obsidian 插件目录重新测试一次。这样验证的是用户真正会下载到的文件，而不是项目目录中的本地构建文件。

## 九、常见问题

### 推送时提示 `remote origin already exists`

先查看现有地址：

```powershell
git remote -v
```

如果地址错误，修改为正确地址：

```powershell
git remote set-url origin "https://github.com/<你的GitHub用户名>/obsidian-anki-card-link.git"
```

### 标签打错了，但还没有成功发布

不要直接反复覆盖已经公开使用的正式版本。首次发布且确认没有用户使用时，可删除错误标签后重新创建：

```powershell
git tag -d 1.0.0
git push origin --delete 1.0.0
```

修正代码并提交后，再重新创建和推送标签。

### Release 没有附件

打开 `Actions → GitHub release` 查看失败步骤。常见原因包括：

- `npm run lint` 失败；
- 自动测试失败；
- TypeScript 构建失败；
- 仓库的 Actions 写权限被限制。

正常情况下，现有工作流会在云端生成 `main.js` 并上传全部 Release 文件，不需要手工上传。

## 十、发布完成标准

满足以下条件，就算 GitHub 首次发布完成：

- `main` 分支源码已公开；
- `Build check` 执行成功；
- `1.0.0` 标签存在；
- `GitHub release` 工作流执行成功；
- `1.0.0` Release 可公开访问；
- Release 的四个附件齐全；
- 下载 Release 文件后能够在 Obsidian 中安装和运行。

完成 GitHub 发布后，下一步才是向 Obsidian 官方社区插件仓库提交收录申请。
