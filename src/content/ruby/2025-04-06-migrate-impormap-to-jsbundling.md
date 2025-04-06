---
title: Rails 8 —— 如何从 Importmap 迁移到 Jsbundling
publishedAt: 2025-04-06
---

由于之前我对现代前端生态的陌生，也出于对 Rails 团队毫无保留的信任和一些最佳实践教条式的盲从，我在当前所做项目的一开始就最大化程度地保留了 Rails 的默认设置，这当然也包括 Importmap。但是通过三个月的开发实践，我感觉自己开始“认清了一点真相”，也决定在一切都还来得及之前从 Importmap 迁移到 Jsbundling，使用 Esbuild 作为打包工具。

## 1. Importmap VS. Jsbundling

抛开“无需构建、按需加载”这些花哨的术语，在我看来，Importmap 和 Jsbundling 的一个重要区别还在于 **Importmap 使浏览器更高效地利用缓存**。由于 Importmap 不打包 JS 文件 (在浏览器开发者工具的 _Network_ 选项，发起一次请求可以看到相当多的 JS 文件返回)，所以在浏览器端只有内容变化的文件才需要重新被缓存：

```js
{
  "imports": {
    "application": "/assets/application-123.js",
    "@hotwired/turbo-rails": "/assets/turbo.min-456.js",
    "lodash": "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
  }
}
```

以上述代码为例，如果 `application` 文件变化，浏览器只需要重新请求这个文件，而无需更新其他两个文件。但 Jsbundling 把所有的 JS 文件都打包成一个 (或多个) 文件 (在浏览器开发者工具的 _Network_ 选项，发起一次请求大概率只会看到一个 `application-xxx.js` 文件返回)，那么当项目中任何一个所引用的 JS 库或自有 JS 代码发生变化，都会导致前端缓存失效。

## 2. 为什么迁移

既然 Importmap 似乎不错，为什么还要迁移到 Jsbundling？

因为**从概念到生产还有一段很长的路**。Importmap 虽然已经问世多年，但**大多数前端库对它的支持不能说没有，但和没有差不太多**。我做的项目目前也只用了 `chart.js` 和 `@rive-app/canvas` 两个库，但这两个库使用 `bin/importmap pin xxx` 时都出了各种适配问题，浪费了很多时间解决这些原本不应该存在的问题。最近因为要用 Fullcalendar，我用 Importmap 时换了多个源，比如 cdnjs、jsDelivr、unpkg，以及 Fullcalendar 官方推荐的 skypack，都不行。

所以我觉得不能再逃避了。

## 3. 迁移步骤

下面是我经过探索和实践梳理出来的在 Rails 8 中从 Importmap 迁移到 Jsbundling 的步骤：

1. 修改 `Gemfile`，删除 `gem "importmap-rails"`。
2. 添加 jsbundling-rails Gem 并使用 Esbuild：`bundle add jsbundling-rails`, `bin/rails javascript:install:esbuild`。
3. 修改 `app/views/layouts/application.html.erb`：删除 `<%= javascript_importmap_tags %>`
4. 修改 `package.json`，添加下面两个构建命令，其中带有 `--watch` flag 的用于开发：

```json
"scripts": {
    "build": "esbuild app/javascript/*.* --bundle --sourcemap --format=esm --outdir=app/assets/builds --public-path=/assets",
    "build:watch": "esbuild app/javascript/*.* --bundle --sourcemap --format=esm --outdir=app/assets/builds --public-path=/assets --watch"
}
```

5. 修改 `Procfile.dev`:

```bash
# before
web: bin/rails server
css: bin/rails tailwindcss:watch

# after
web: bin/rails server
css: bin/rails tailwindcss:watch
js: npm run build:watch
```

6.  安装 npm 包：

```bash
# 安装 esbuild
npm install --save-exact --save-dev esbuild

# 根据需要
npm install chart.js @hotwired/stimulus @hotwired/turbo-rails stimulus-datepicker @rive-app/canvas
```

7. 修改 `app/javascript/application.js`: `import "controllers"` 改为 `import "./controllers"`。
8. 根据需要，修改调用第三方 JS 库的方式，以我的项目为例：

```js
// ----------------- Chart.js -------------------
// before
import { Chart, registerables } from "chart.js"
Chart.register(...registerables)
// after
import Chart from "chart.js/auto"

// ----------------- @rive-app/canvas -----------
// before
import rive from "@rive-app/canvas"
// after
import * as rive from "@rive-app/canvas"
```

9. 执行 `bin/rails stimulus:manifest:update` 命令，以更新 `app/javascript/controller/index.js` 文件。
10. `bin/dev` 文件是 Rails 自动修改的，我没注意看，推测应该是在第二步时发生的。
11. 删除 `config/importmap.rb` 文件。
12. 删除 `vendor/javascript` 内的文件。
13. 删除 `bin/importmap` 文件。

除了这些主要流程之外，可能还需要更新以下文件：

- `.github/workflows/ci.yml`
- `.gitignore`
- `Dockerfile`
- `.dockerignore`

## 4. 总结

在迁移 Importmap 之前，我花了一下午的时间没有解决 Fullcalendar 的使用问题，迁移到 Jsbuilding 后，`npm install` 之后不到二十分钟即跑通了流程，可见**工欲善其事、必先利其器**。

但重要的也许是不要盲从。**37signals 选择 Importmap，是因为出了问题他们能解决，而我只能给自己兜底**。

> - [Odin - Using jsbundling-rails](https://www.theodinproject.com/lessons/ruby-on-rails-js-bundling#using-jsbundling-rails)
> - [Migrate from importmap to esbuild for rails projects](https://alec-c4.com/posts/2024-12-15-migrate-from-importmap/)

## 5. 备注

其中我增加了 Node 安装的完整 Dockerfile 内容如下 (写在此处供以后查阅)：

```dockerfile
ARG RUBY_VERSION=3.4.1
FROM docker.io/library/ruby:${RUBY_VERSION}-slim-bookworm AS base

WORKDIR /rails

# Install base packages
RUN echo "deb http://mirrors.tencentyun.com/debian/ bookworm main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.tencentyun.com/debian-security/ bookworm-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.tencentyun.com/debian/ bookworm-updates main contrib non-free" >> /etc/apt/sources.list && \
    rm -f /etc/apt/sources.list.d/* && \
    apt-get update -qq && \
    apt-get install --no-install-recommends -y curl default-mysql-client libjemalloc2 libvips && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

RUN gem sources --add https://mirrors.cloud.tencent.com/rubygems/ --remove https://rubygems.org/ && \
    bundle config mirror.https://rubygems.org https://mirrors.cloud.tencent.com/rubygems/

# Set production environment
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build gems
RUN echo "deb http://mirrors.tencentyun.com/debian/ bookworm main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.tencentyun.com/debian-security/ bookworm-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.tencentyun.com/debian/ bookworm-updates main contrib non-free" >> /etc/apt/sources.list && \
    rm -f /etc/apt/sources.list.d/* && \
    apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential default-libmysqlclient-dev git pkg-config curl && \
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    apt-get install --quiet --yes nodejs && \
    npm config set registry https://mirrors.tencent.com/npm/ && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install application gems
COPY Gemfile Gemfile.lock ./
RUN bundle config set --global path "${BUNDLE_PATH}" && \
    bundle config set --global without "${BUNDLE_WITHOUT}" && \
    bundle install --jobs=4 --retry=3 && \
    rm -rf "${BUNDLE_PATH}"/ruby/*/cache && \
    bundle exec bootsnap precompile --gemfile

# Install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .
RUN chmod 755 bin/docker-entrypoint && \
    find bin/ -type f -exec chmod 755 {} + && \
    bundle exec bootsnap precompile app/ lib/ && \
    SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Final stage for app image
FROM base

# Copy built artifacts: gems, application
COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

# Run and own only the runtime files as a non-root user for security
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chmod 755 /rails/bin/docker-entrypoint && \
    find /rails/bin -type f -exec chmod 755 {} + && \
    chown -R rails:rails /rails db log storage tmp
USER 1000:1000

# Entrypoint prepares the database.
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

# Start server via Thruster by default, this can be overwritten at runtime
EXPOSE 80
CMD ["./bin/thrust", "./bin/rails", "server"]
```
