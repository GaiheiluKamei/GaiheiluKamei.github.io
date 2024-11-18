---
title: 37signals Writebook 源码学习(1) - 准备工作
publishedAt: 2024-11-19
---

> 原本文章标题想用 “源码解析”、“源码探究”之类的词语，但仔细思考一下这两个词语的含义之后，发现我不是在高屋建瓴，而是在仰望星空。

## 1. 为什么想学习 Writebook 源码

几个月前，37signals 推出免费应用 Writebook ([https://once.com/writebook](https://once.com/writebook)) 时，坊间便有传说其操作之丝滑如行云流水、代码之精妙如巧夺天工，对 Rails 各种技法的使用更是如入仙境，是提升 Rails 技能无需多言的不二宝典。

但我稍加体验了一番 UI 之后感觉不过尔尔，甚至略微有点丑陋，对中文输入的支持更是一级事故的处分免不了背上，于是开始有点不屑： “DHH 还能写出多好的 Rails 代码？”

但实在架不住 Rails 生态圈在不同论坛的各种溢美之词，仿佛不学习 Writebook 源码，人生从此就有了褶皱，终于我还是想看看这代码到底是骡子是马。

在官网免费购买之后，邮箱里就收到了安装命令和 zip 源码。

## 2. 准备过程

### 2.1 本机尝试失败

一开始我打算用源码里的 Dockerfile 直接构建镜像运行，但是构建直接就失败了，由于网络问题，无法从 Docker 官网下载镜像。我查了一下有哪些可用的 Docker 源，创建并添加到 `/etc/docker/daemon.json` 文件，但在大概尝试了半小时之后仍然失败 (期间看到有文章说 Docker 源在国内被禁用了)。

我又看了一下 Dockerfile，把 `FROM` 命令里的 Docker 官网的 URL 删除，只保留 `ruby:` 之后的命令。镜像下载成功，但后面的 `TARGETPLATFORM` 变量被提示不存在，我开始觉得事情没那么简单，这似乎是和安装脚本有某种“绑定”关系的 Dockerfile。

于是我直接在本机 (Manjaro) 执行安装命令，报错是 `arch` 命令不存在。另存脚本后，发现里面用到了 `arch` 命令来判断 CPU 架构，于是把 `${arch}` 改成了 `${uname -m}`，`once` 命令安装成功。

但又在绑定 DNS 步骤失败，由于想在本地安装，随机输入了几个 IP (忘了尝试一下 `127.0.0.1` 或 `localhost` 了，罪过) 都不成功。

### 2.2 服务器尝试成功

想起来我还有一台吃灰的腾讯云香港服务器，但在用的这台电脑没绑定到服务器的 SSH，服务器密码也忘了，又开始找回密码。

折腾了半天设置 SSH 都没成功，所有的设置都很正确，甚至还在控制台尝试了绑定密钥、生成新密钥，却一直报错 `publicKey`。

最后发现是 `/etc/ssh/sshd_config` 配置文件选项没打开，打开文件编辑了 `PubkeyAuthentication` 和 `AuthorizedKeysFile` 选项之后，通过 `sudo systemctl restart sshd` 重启 SSH 服务，终于连上了。

之后，通过 `/bin/bash -c "xxx"` 安装命令一键安装成功。

### 2.3 本机尝试成功

但还是有点不甘心本机没启动成功。换个思路：不用 Docker 应该也不会有什么问题，直接启动服务不就行了？

项目用的 Ruby 版本是 3.3.5，于是通过下面的命令安装版本：

- `rbenv install 3.3.5`
- `rbenv local 3.3.5`
- `bundle`

看了一下项目目录有 `Procfile` 文件，于是 `gem install foreman` 之后 `foreman start`，终于在本地运行成功，打开浏览器服务也没有任何报错。

> 运行 Rails 服务时，一般还需要运行 Redis 和前端资产处理相关的 watch 命令等多个进程。*Foreman* 是管理多个进程的工具，它通过读取 `Profile` 文件来启动和管理 Rails 应用及其依赖的各种进程，在开发中极大地简化了多进程应用的启动和管理。
>
> *Foreman* 的创建：[http://blog.daviddollar.org/2011/05/06/introducing-foreman.html](http://blog.daviddollar.org/2011/05/06/introducing-foreman.html)
>
> *Foreman* 在开发和测试时非常方便，但它并非一个完整的进程管理器，缺乏生产环境所需要的健壮性和监控功能，因此不建议在生产环境使用。参考：[https://github.com/ddollar/foreman/wiki/Exporting-for-production](https://github.com/ddollar/foreman/wiki/Exporting-for-production)

### 2.4 本机二次成功

写这篇笔记的中途，刚才又**调整了一下网络**，再次运行安装脚本，终于成功了。

目前本机已成功运行“生产模式”和“开发模式”两种形式的 Writebook 服务，明天开始学习代码。