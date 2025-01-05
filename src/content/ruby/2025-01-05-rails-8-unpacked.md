---
title: 官方的 Rails 8 Unpacked 系列课程讲了什么
publishedAt: 2025-01-05
---

Rails 官方发布[《Rails 8: Unpacked with typecraft》](https://www.youtube.com/playlist?list=PLHFP2OPUpCebdA4-xR07SPpoBWVERkHR6)系列课程已经将近一个月了，看完这个课程也半月有余，如果再不写篇笔记，这些知识很快就随着看视频的时间一起浪费掉了。

Playlist 上共有 9 个视频，我一开始以为是 “Learn by doing” 的，看着看着才发现这不是 “导师一行我一行” 的写代码，而是每个视频都在之前已经完成的 Demo 项目基础上逐步添加并介绍一个新特性。但即便如此，这在相当大一部分书籍、视频还未面市的此刻仍然意义重大，在这套课程的基础上再看相关文档也能有的放矢。

首先要指出官方 Playlist 上的课程顺序没有正确排列，正确的观看顺序是 1、2、3、4、8、9、5、6、7。

## 1. 视频 X 讲了什么

**视频 1** 是简介，没有知识点。

**视频 2** 介绍了 Rails 8 的身份验证生成器，即 Authentication。大概讲解了生成的代码实现及用法，个人觉得看这个视频了解一下大概，再看我关于这个主题的四篇文章[Rails 8 Authentication 实现分析](https://rubyist.run/ruby/2024-12-22-rails8-authentication-1/)深入细节是比较好的。事实上我只所以一直没写这篇笔记就是打算完成身份验证的文章先，毕竟对于一个任何一个应用来说，没有身份验证一切都无从谈起。

**视频 3** 介绍了Rails 8 将默认的资产管道从 Sprockets 切换到了 Propshaft。Sprockets 功能强大，可以处理 Sass、CoffeeScript、JavaScript 的转译、压缩以及其他资产处理任务。然而，随着现代 CSS、JavaScript 功能的不断丰富以及前端开发工具链（如 Vite, esbuild）的成熟，这些功能可能不再需要，或者可以更好地由已有的工具来完成；HTTP/2 的普及也大大提升了网络效率。所以 Rails 8 选择了更轻量级的 Propshaft，它专注于对静态文件进行哈希并复制到 `public` 目录，用 `public/assets/.minifest.json` 文件做文件映射。基本上和我之前的[Rails 如何处理静态资源](https://rubyist.run/ruby/2024-11-05-rails-assets/)内容一致。

**视频 4** 没有知识点，主要说 Rails 8 带来了 “Solid 三剑客”。

**视频 8** 讲述了为什么 Solid Cache 应运而生：现代固态硬盘的速度越来越快，价格越来越便宜，使得缓存大量数据成为可能；而 RAM 虽然速度极快，但价格高昂，只能进行有限的数据缓存，缓存缺失率较高；此消彼长，使得利用硬盘进行缓存不仅可行，甚至略有优势：后者可以长期、大量的缓存数据，大大提高缓存命中率。之后视频以 [Collection Caching](https://guides.rubyonrails.org/caching_with_rails.html#collection-caching) 为例介绍了如何使用 Solid Cache:

1. 进行页面数据缓存：`<%= render partial: "tasks/task", collection: @tasks, cached: true %>`
2. 在 `config/database.yml` 配置缓存数据库
3. 创建、迁移缓存数据库：`bin/rails db:create db:migrate`
4. 配置缓存，以使用缓存数据库：`config/cache.yml`
5. 在开发环境 `config/environment/development.rb` 使用 Adapter：`config.cache_store = :solid_cache_store`
6. 在开发环境开启缓存：`bin/rails dev:cache`

此外，作者还用 K6 对 RAM 缓存和磁盘缓存进行了性能测试的比较，在某些设置下，基于磁盘的缓存甚至不止小胜。看完这个视频再去看官方文档的 [Solid Cache](https://guides.rubyonrails.org/caching_with_rails.html#solid-cache) 部分，比直接盲目查找官方文档要好的多。

**视频 9** 介绍了 Solid Cable：它使用**轮询 (polling)** 机制，而不是真正的推 (push) 模式。这种权衡牺牲了一定的实时性和服务器性能来换取部署的简便性和对 Redis 的依赖性消除。使用 WebSocket 需要在 *Solid Cable* 和 *Action Cable* 两个方面进行设置。

我之前的工作只见到过用 Go 的 gorilla/websocket 或者 Node 的 SocketIO 做 WebSocket，对 Action Cable 没什么了解。但对于小型的服务， Action Cable 应该是足够了，社区还有宣称更高性能的 AnyCable。

如果真的要使用在 Rails 中使用 WebSocket，应该需要再三阅读 [Action Cable Overview](https://guides.rubyonrails.org/action_cable_overview.html)。

**视频 5** 介绍了 Solid Queue。在此之前，Rails 作业队列事实上的王者是 Sidekiq，也许以后要换天了。视频主要讲述了 Solid Queue 的用法：

1. 在 `config/database.yml` 配置数据库
2. 在 `config/environment/development.rb` 配置 Adapter 及第一步的数据库
3. 创建数据库、运行数据库迁移
4. 在 `Procfile.dev` 文件中添加 `bin/jobs` 使服务可以自动启动
5. `config/recurring.yml` 文件还可以进行循环调度的配置
6. 还可以使用 [Mission Control — Jobs](https://github.com/rails/mission_control-jobs) 设置作业队列的 Web 界面，此界面默认使用 `ApplicationController` 的身份验证，可以根据需要改为使用 `AdminController`

详细的用法还是要在看完视频之后参考文档：[Active Job Basics](https://guides.rubyonrails.org/active_job_basics.html)。

**视频 6** 介绍了 Rails 自带的 Dockerfile，稍带介绍了一些 Docker 的原理。这个 Dockerfile 是为了生产使用高度优化的，以开发为目的可以考虑 *devcontainer*。我对 *devcontainer* 不了解，之前看过的[使用 Docker 和 Bash 搭建可持续的开发环境](https://rubyist.run/other/2024-12-12-sustainable-dev-env/)一书的作者似乎对 *devcontainer* 不太看好，于是我也就不去学它，至少是先不去学它。

**视频 7** 介绍了 Rails 自带的部署工具 Kamal，它可以部署所有的 Web 服务而不限于 Rails，作者的演示非常有吸引力。如果你考虑使用 Kamal 进行部署，手头有可用的 VPS 大可一试。

但据了解这只是一个部署工具，我目前还不清楚使用 Kamal 部署的应用之后如何解决伸缩性的问题。

## 2. 总结

总的来说，本课程对于快速了解 Rails 8 的新特性非常有帮助，而且介绍全面，并非蜻蜓点水，每个视频一个主题的形式也方便了后续复习。当用到相关知识的时候，先看一遍视频，再去看文档能节约不少时间，更好地抓住文档的重点。

但没有人能通过只看视频学到知识，这些特性也只有在用到、踩到坑、解决问题之后才会真正内化成自己的知识。话虽如此，本着 “Vanilla Rails” 的理念，“先了解它们的存在”仍然是一切故事的开始。