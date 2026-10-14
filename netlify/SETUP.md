# 私有同步部署

站点配置：`netlify.toml`。构建会生成静态资料和浏览器登录脚本；函数和数据库迁移不进入静态发布目录。

1. 在 Netlify 项目 `wengu-personal-sync` 的控制台连接本 GitHub 仓库。先选择改版分支进行预览，确认后再使用 main。无需填写 GitHub token 到代码中。
2. 在项目 Identity 页开启 Identity，注册设置为 **Invite only**，只邀请站主本人。通过邀请链接设置密码。没有注册按钮；第三方登录按钮按实际启用的提供商显示。
3. 在项目环境变量中添加 `WENGU_OWNER_ID`，值为 Identity 用户列表中的站主用户 ID，作用域 Functions。重新部署使环境变量生效。未配置时同步接口始终拒绝读写。
4. Netlify Database 按依赖自动配置，迁移由部署流程执行。若账户不支持 Database 或需要升级，先停止部署并检查账户方案，不自动升级。
5. 两个设备打开同一 Netlify 入口，登录同一账户。首次登录导入此来源下的本机草稿。GitHub Pages 与 Netlify 是不同来源；旧入口的草稿先从首页导出，再在新入口从备份恢复。

## 验收

- 两台设备登录后测试作答保存、另一台接续、离线重新连接、同时编辑冲突选择。
- 顶部区分仅本机、等待同步、已同步、冲突和权限未配置。
- 同步读写均校验服务器身份和固定站主 ID；写入检查 Origin；私有响应禁止缓存，service worker 排除整个 `/.netlify/` 路径。
- 密码只提交给 Identity SDK。学习数据仅同步三个允许的学习存储前缀，不同步任何登录存储。
- 冲突选择不删除云端提交版本；本机冲突备份可导出。当前版本和最近 30 次提交可由已登录站主通过接口历史参数读取。
- 退出保留本机内容，符合个人设备使用场景。不要在公用浏览器保存个人草稿。

验证命令：`npm ci && npm run build:cloud`、`node --test tests/*.test.cjs tests/*.test.mjs`、`python3 -m unittest discover -s tests`。

本地数据库测试覆盖迁移、并发条件更新、重试幂等和用户隔离。本地不能完成真实 Identity 登录；上线验收必须在配置后的 Netlify 部署进行。
