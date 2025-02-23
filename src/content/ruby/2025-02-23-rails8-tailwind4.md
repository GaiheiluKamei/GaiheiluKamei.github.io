---
title: 如何在 Rails 8 中“正确”设置 Tailwind V4
publishedAt: 2025-02-23
---

下午我用 Rails 8 尝试一个 Demo 项目时，发现虽然默认使用了 Tailwind V4，但由于 Rails 生成器没有更新，生成的代码结构仍然基于 Tailwind V3，导致了一些问题。

借这篇不会太长的文章记录一下这些问题、也算给过去几个小时的瞎忙活画个分号。

> 画分号以及题目加引号都出于同一个原因：我不确定我的方案是否合适，不过从结果来看，没有任何报错，而且达到了效果。

## 1. 问题是怎样产生的

下面是我的开发环境以及新建项目时使用的命令：

```bash
ruby -v
# ruby 3.4.1 (2024-12-25 revision 48d4efcb85) +PRISM [x86_64-linux]

rails -v
# Rails 8.0.1

rails new xxx -c tailwind -j esbuild
```

在开发基于以上条件生成的项目时，我发现**页面上并没有应用样式，但查看 DevTools，HTML 元素中确实存在 Tailwind 类名**，这说明问题大概在 TailwindCSS。

联想到前段时间偶尔浏览过一篇关于 TailwindCSS V4 版本变化的文章，似乎有提到不需要再使用 `@tailwind base;` 之类的命令，而是直接使用 `@import tailwindcss;`。于是我把 `stylesheets/application.tailwind.css` 文件中的三行命令删除，用 `@import tailwindcss;` 取而代之。

这时候页面样式正常，但 DevTools 出现了 GET 请求 `/assets/tailwindcss` **404**，这是因为 CSS 的 `@import` 命令会导致浏览器发送对这个资源的请求，而根据 `package.json` 中构建 CSS 的命令，项目中并没有生成 `tailwindcss`：

```js
"build:css": "tailwindcss -i ./app/assets/stylesheets/application.tailwind.css -o ./app/assets/builds/application.css --minify"
```

理论上这时候除了这个**404**之外一切正常，我可以继续推进。但确实有一种如鲠在喉的感觉，让人很难沉下心来假装问题不存在。

我觉得无论如何，还是要先解决这个问题，哪怕要花点时间。

## 2. 我如何在错误的路上越走越远

我于是像上面一样描述了问题，粘贴了报错和相关代码，洋洋洒洒写了一段前因后果丢给 Grok，它很快给我一段巨长的回答。

但我一眼看到它还在用 `@tailwind` 命令，我提醒它 Tailwind V4 应该用 `@import`，甚至还贴心的给了它官方升级文档的链接。

它又很快给了我一段回答，如果你也用过 Grok，你应该能感受到它的回答**很快、也很长**。所以我花一些时间描述我的问题，再花一些时间等它输出完毕，再花一些时间根据它的回答修改代码进行验证，基本上一个多小时很快就过去了，**我手忙脚乱地把代码改的面目全非却什么也没得到**。

于是...

`git reset --hard` 之后，我把问题又给了 DeepSeek。之所以一开始不问它，因为它总是很忙，有网友甚至重试了 44 次，我自忖没那么多的耐心，所以总是等到别的“小伙伴”不给力时才去找它。

基本上，我在它们几个身上浪费了至少三个小时的时间，它们的自信确实令人印象深刻。

## 3. 学会回到原点

求人不如求己。我突然想起来之前看的一本书 (写过一篇文章，即使用 Docker 和 Bash 搭建可持续开发环境)，书的作者说**我们遇到的 99% 的问题，都可以通过 StackOverflow、GitHub 和官方文档来解决**，而盲目自信的 AI 很多时候回答的都是错的，尤其是在你不知道如何解决问题的情况下，再去花很大的时间和精力去验证它们的错误答案，结果必然是很惨。

> 这里申明一下我个人的观点：AI 在帮助做一些重复性或技术含量不太高的事情时，确实特别有帮助，比如水文章、看报告、做总结、写样板代码等等都是一流的。但它只能依靠已有的训练它时的数据，而不能创造性的解决新问题，所以当遇到“棘手的新问题”时 (比如 Tailwind V4 刚发布也才不久，Google 上都没几篇和 Rails 相关的文章)，可想而知效果不会太好。

所以我开始学着回到原点，认认真真地看了一部分官方关于升级的文档，以及 GitHub 的一些讨论，主要是下面两个链接：

- [https://github.com/rails/tailwindcss-rails/discussions/450#discussioncomment-12059381](https://github.com/rails/tailwindcss-rails/discussions/450#discussioncomment-12059381)
- [https://tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide)

之后我通过下面的三个操作解决了问题 (样式正确、无 404)：

- 删除 (或清空) `app/assets/stylesheets/application.tailwind.css` 文件
- 新建 `app/assets/tailwind/application.css` 文件，文件内容：`@import "tailwindcss";`
- 修改 `package.json` 文件中的 `"build:css"` 命令为： `"tailwindcss -i ./app/assets/tailwind/application.css ...` (`...` 表示后面的内容不变)

但通过了解官方文档，我知道当前项目中还存在一些不合时宜的配置，于是我逐步验证并做了以下操作：

- 删除 `tailwind.config.js` 文件
- 删除 `package.json` 文件中的 `autoprefixer`、`tailwindcss`、`postcss-import` 依赖 (根据链接的 `#using-postcss` 部分)

期间的每一步我都通过 `rm -rf app/assets/builds/` 和 `bin/dev` 进行了验证，确保终端、网页样式、DevTools 没有报错。

根据官方描述，甚至还可以进一步用 Tailwind CLI 来取代 PostCSS。

> Tailwind 会扫描哪些文件：[https://tailwindcss.com/docs/detecting-classes-in-source-files#which-files-are-scanned](https://tailwindcss.com/docs/detecting-classes-in-source-files#which-files-are-scanned)

## 4. 总结

总的来说，解决问题本身可能只需要两行代码，但我想通过记录这个过程，希望能够给别人一些启发，也能帮到以后的自己。

更重要的是，这一下午的时间不能就这样稀里糊涂的算了，总得有一堑一智。
