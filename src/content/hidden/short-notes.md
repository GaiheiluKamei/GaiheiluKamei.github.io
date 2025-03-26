# Short Notes

## 2025-03-26

### 1. Ubuntu 24.04.2 LTS 安装 docker compose 报错：

```bash
sudo apt-get install docker-compose-plugin
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
E: Unable to locate package docker-compose-plugin


cat /etc/lsb-release
DISTRIB_ID=Ubuntu
DISTRIB_RELEASE=22.04
DISTRIB_CODENAME=jammy
DISTRIB_DESCRIPTION="Ubuntu 22.04.2 LTS"
```

解决方案：

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources:
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

参考链接：

- [StackOverflow - sudo apt-get install docker-compose-plugin fails on jammy](https://stackoverflow.com/questions/76031884/sudo-apt-get-install-docker-compose-plugin-fails-on-jammy)
  - [引用官方文档](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository)
- [How to Fix Unable to Locate Docker Compose Plugin Error]

### 2. 从 importmap 迁移到 jsbundling-rails (esbuild)

> [Migrate from importmap to esbuild for rails projects](https://alec-c4.com/posts/2024-12-15-migrate-from-importmap/)

1. 修改 Gemfile，删除 `gem "importmap-rails"`
2. 执行: `bundle add jsbundling-rails`, `bin/rails javascript:install:esbuild`
3. views/layouts/application.html.erb 删除 `<%= javascript_importmap_tags %>`
4. 修改 `package.json`：

```json
  "scripts": {
    "build": "esbuild app/javascript/*.* --bundle --sourcemap --format=esm --outdir=app/assets/builds --public-path=/assets",
    "build:watch": "esbuild app/javascript/*.* --bundle --sourcemap --format=esm --outdir=app/assets/builds --public-path=/assets --watch"
  }
```

5. 修改 Procfile.dev:

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
npm install --save-exact --save-dev esbuild

# 根据需要
npm install chart.js @hotwired/stimulus @hotwired/turbo-rails stimulus-datepicker @rive-app/canvas
```

7. 修改 _app/javascript/application.js_: `import "controllers"` -> `import "./controllers"`
8. 根据需要，修改 _app/javascript/controllers/xxx_controller.js_：

```js
// before
import { Chart, registerables } from "chart.js"
Chart.register(...registerables)

// after
import Chart from "chart.js/auto"

// before
import rive from "@rive-app/canvas"
// after
import * as rive from "@rive-app/canvas"
```

9. 执行 `bin/rails stimulus:manifest:update` 更新 _app/javascript/controllers/index.js_ 文件
10. `bin/dev` 是自动修改的
11. 删除 `config/importmap.rb` 文件
12. 删除 `vendor/javascript` 内的文件
13. 修改 Dockerfile:

```dockerfile
# syntax=docker/dockerfile:1
# check=error=true

# This Dockerfile is designed for production, not development. Use with Kamal or build'n'run by hand:
# docker build -t tiansuan .
# docker run -d -p 80:80 -e RAILS_MASTER_KEY=<value from config/master.key> --name tiansuan tiansuan

# For a containerized dev environment, see Dev Containers: https://guides.rubyonrails.org/getting_started_with_devcontainer.html

# Make sure RUBY_VERSION matches the Ruby version in .ruby-version
ARG RUBY_VERSION=3.4.1
FROM docker.io/library/ruby:${RUBY_VERSION}-slim-bookworm AS base

# Rails app lives here
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
