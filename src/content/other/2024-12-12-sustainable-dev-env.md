---
title: 读书笔记 - 使用 Docker 和 Bash 搭建可持续的开发环境
publishedAt: 2024-12-12
---

上个月在网上冲浪，本想看看 David Bryant Copeland 的 《Sustainable Web Development with Ruby on Rails》一书有没有更新，发现他又写了一本新书：《Sustainable Dev Environments with Docker and Bash》(今年 3 月自出版的)。

在 [https://devbox.computer/](https://devbox.computer/) 上大概浏览了一下目录，感觉似乎没有什么新鲜和高深的内容，Docker 和 Bash 我不精通，但日常开发需要的命令也算驾轻就熟。不过自从看了那本 Rails 的书就对他比较关注，因为他的书行文细致、讲解透彻、且都是来自多年一线实战的经验，所以我还是抱着支持的态度买了一本。

上周花了两天时间边做边学看完了，这两天趁着还没忘完赶紧写一篇笔记。

## 1. 书评

但凡在至少两家公司工作过的人应该都非常认同作者的观点：**最熟悉一个公司开发环境的专家有两个，最初搭建环境的人和最近入职的人**。那些疏于维护支离破碎的文档在每次新人入职后被修修补补，之后又再次被束之高阁等待不知道多少年后的下一位新人。

而 Docker 和 Bash 这两个平凡工具的结合无疑是一剂对症的良药：

- **Docker 解决了一致性的问题**： 
  - Linux、macOS、Windows 不同系统的环境配置各不相同
  - 同一个系统不同版本的配置也未必一样，如 macOS 12/14、Win 7/11
  - Docker 隔离了这种不一致性
- **Bash 解决了可持续性的问题**：
  - 文档是死的，环境搭建起来了就没人管了
  - 脚本是活的，不改到正确为止就没法运行

在我看来，这本书的价值不在于有多少 Docker 和 Bash 的知识点，那些知识点在街头巷尾汗牛充栋。最重要的是字里行间作者：

1. **对技术细节的严谨态度**：比如 Docker 的 `latest` 标签，我一直都以为是表示最新的镜像，至少一直是以这个假设来使用的。但作者指出这是一个坑，把一个很老的镜像打上 `latest` 标签也没有任何关系，因为没有任何机制来验证或保证 “`latest` 表示最新的镜像” 这一点。
2. **对开发体验的极致追求**：这在稍后作者遵循的脚本设计原则里体现的淋漓尽致。
3. **对可持续性的深度思考**：为什么是 Docker 而不是 Podman/Nix/Devcontainers？为什么是 Bash 而不是 Ruby/Python/Lua/JavaScript？因为**一个运行良好且被广泛理解的工具才是一个好的工具**。

“真正的大师都有一颗学徒的心”，我们以为的大师也有自己的知识盲区，也都在各自的荒原里一点一滴的探索。本书作为作者多年开发实践的经验结晶，我又有什么理由不站他肩膀上。

本文旨在记录在看书过程中遇到的值得一记的知识点和作者提炼出来的最佳实践，从一本书里提炼出一篇文章不可能像书本身那样循序渐进、面面具到，不过作为复习笔记也已足矣。

## 2. Docker

> “无论你对 Docker 有什么先入为主的观念，我可以向你保证，让 Docker 安装软件比编写必须在许多不同操作系统和硬件配置文件上运行的脚本更简单”。

### 2.1 值得注意的细节

第一，Docker 镜像没有*版本* (version) 的概念，它们只是活动的**标签** (tag)。这意味着你今天使用的 `debian:12` 和昨天使用的 `debian:12` 可能是不同的东西，今天使用的 `debian:12` 实际是 `12.1`，而明天就可能指向的是 `12.2`。作者在写本书的时候遇到的情况是：他在没有更改镜像名的情况下，同样是 `debian:12`，第二次运行的镜像中 `curl` 命令却被删除了。所以在使用标签时，**至少要使用 `debian:12.1` 这样的标签** (指定了副版本号)。

第二，**永远永远永远不要使用 `latest` 标签**。原因如前所述，`latest` 非常非常不靠谱，没有任何机制可以保证镜像是所谓的 *latest*，它只是一个普通的标签，而已 。这也是 Docker 的设计缺陷之一： Docker 规定所有的镜像名都必须包含一个冒号，如果没有，Docker 会默认添加一个 `:latest`。也因此，一定要明确指定如 `debian:12.1` 这样的标签名。

第三，应该始终使用可以**被足够信任的镜像/软件链**。如官方网站指向的镜像，或是 Docker 官方维护的镜像。

### 2.2 关于 Dockerfile

```dockerfile
FROM debian:12.1

RUN apt-get update --quiet --yes

# curl is needed to install NodeJS
RUN apt-get install --quiet --yes curl

# From https://www.ruby-lang.org/en/documentation/installation/#apt
# NOTE: build-essential is needed to install Ruby C extensions
RUN apt-get install --quiet --yes ruby-full build-essential

# Based on
# https://github.com/nodesource/distributions?tab=readme-ov-file#using-debian-as-root-nodejs-22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    apt-get install --quiet --yes nodejs

# From https://rubygems.org/gems/bundler
RUN gem install bundler

# Copy developer-specific Bash configuration into the image
COPY .bashrc.dx.local /root/.bashrc.dx.local
# Modify the existing /root/.bashrc to source the customizations
RUN echo "# Dev-specific Bash customizations" >> ~/.bashrc && \
    echo ". ./.bashrc.dx.local" >> ~/.bashrc

# Source code will be available here
WORKDIR /root/catsay

# Stay busy when we start so we can run commands
CMD sleep infinity
```

上面是本书中的 Dockerfile 例子，有一些值得记录的地方：

1. 由于是在开发环境，所以文件被显式命名为 `Dockerfile.dev`。
2. Dockerfile 中的 `RUN` 指令默认是以 root 运行的，所以不需要再添加 `sudo`。
3. `--quiet` 和 `--yes` 虽然可以缩写为 `-qy`，但使用长格式选项对不熟悉这两个标志的团队成员更友好。
4. **确保总是在指令前面添加注释**，因为你的团队成员可能不清楚命令的作用，而你自己也可能会遗忘。
5. 每个 `RUN` 指令都会创建一个所谓的 *层* (layer)，这些层被缓存后可以显著加快后续镜像的构建速度。要尽可能的使层可以被缓存，就需要深思熟虑 `RUN` 指令的放置顺序，作者这里有一些观点：
   1. **考虑工具的实际更新频率**：比如 ChromeDriver 可能经常更改，而 Ruby 的改动没那么频繁。
   2. **考虑工具对应用稳定性的影响**：对于 Ruby 程序来说，显然 Ruby 的版本变动对程序的影响最大，Nodejs 的重要性就次点，而 Bundler 的更改可能比 Nodejs 更频繁，所以 Ruby -> Nodejs -> Bundler。

> 有点好奇书中没有讨论 Docker 镜像的多阶段构建问题。

上述 Dockerfile 被构建之后，以这种方式运行：

```bash
docker container create --name catsay-container --publish \
    4242:3000 --mount \
    type=bind,source=$(pwd),target=/root/catsay \
    catsay-dev:debian-12.1
```

这里的一些观点是：

1. 镜像的名字最好是冒号前使用 `<<app>>-dev` 形式，冒号后使用包含软件关键版本的字符串，如 `catsay-dev:debian-12.1`。
2. Docker 的三种 volume (volume，tmpfs，bind)，作者选择了 bind。
   1. volume 是创建 Docker 管理的独立文件系统；tmpfs 是在主机上创建临时目录，无持久化；bind 是把主机目录挂载到 Docker 内的指定路径。
   2. `-v` 和 `--mount` 都可以用来挂载，区别只是语法不同，以及 `--mount` 不会自动创建目标目录 (所以使用了 `WORKDIR`)。
   3. 强烈建议不要使用 `-v` 因为它令人困惑，而 `--mount` 使用逗号分割的键值对，更明确。
   4. `--mount` 的键：`type`，`source`，`destination`，`readonly`，`volumn-opts` (文档不详)。

> 但我挂载卷一直用的 `-v` 而没有用过 `--mount`。

### 2.3 Docker Compose

当应用和数据库或其他服务一起使用时，就需要使用 Docker Compose：

```yml
services:
  app:
    image: ${IMAGE}
    init: true
    volumes:
      - type: bind
        source: "."
        target: "/root/catsay"
    ports:
      - "4242:3000"
  redis:
    image: redis:7.2-alpine
```

`init: true` 的作用是让 Docker 在容器内运行一个初始化进程，这个初始化进程会接管容器中的 PID 1,负责信号处理和子进程。对于 app 服务来说，使用 `init: true` 可以提高容器的可靠性，如果没有初始化进程，容器内的主进程 (PID 1) 可能无法正确处理这些信号，导致容器无法正常关闭或子进程变成孤儿进程。

而 redis 服务本身就是一个稳定的服务，通常已经内置了合适的信号处理机制，所以无需使用 `init: true`。

这里 Docker Compose 的运行命令使用了 `--ansi=never` 以消除不支持彩色的终端可能带来的歧义性输出问题，这也太谨慎了。

```bash
docker compose --ansi=never --file docker-compose.dev.yml up \
    --detach --no-color
```

## 3. Bash

> “Bash 会比我们所有人都活得更久。在你的职业生涯中，唯一比学习 Bash 更好的投资就是学习 SQL”。
> 
> “Bash 无处不在，尽管语法令人困惑，但它确实是开发环境自动化的绝佳选择。它的普遍性超过了你最喜欢的编程语言”。

Bash 有缺陷，很多缺陷，但通过一些严格和谨慎的处理，我们仍然可以用它制作一个出色的 UI。书中提出了四个 Bash 脚本的编写原则：

1. 任何命令都不应该要求参数才能正确运行
2. 每个命令都应该响应 `-h` 以提供详细的帮助信息
3. 命令应该输出它们正在做什么的信息，以便理解它们的行为
4. 命令应该验证它们所做的任何假设，并在假设无效的情况下向用户提供有用的错误信息

这些原则非常重要，在学习书中的例子或者自己写脚本的时候，回头看这些原则才更能明白其字字珠玑。

由于开发过程所经历的大体阶段是：

1. `build` - 构建 Dokcer 镜像
2. `start` - 启动服务
3. `exec` - 在服务中执行命令
4. `stop` - 停止服务

所以一般来说只需要创建四个脚本就可以覆盖整个开发流程。而首先要考虑的是：脚本应该放哪里？

无论哪里，不应该是 `bin`，因为 `bin` 是用来存放应用程序自己的脚本，是针对应用的。而我们的脚本是针对整个开发环境的，这是一个重要的区别。

一般来说，在程序根目录下创建一个 `dx` 目录来存放脚本是合理的，它表示 *Developer Experience*。

### 3.1 build 脚本拆解

以下是 *build* 脚本：

```bash
#!/usr/bin/env bash

set -e
set -o pipefail

DIRNAME=$(dirname -- "${0}")
SCRIPT_DIR=$(cd -- "${DIRNAME}" > /dev/null 2>&1 && pwd)
. "${SCRIPT_DIR}"/shared.lib.sh
. "${SCRIPT_DIR}"/docker-compose.env

usage() {
    echo "usage: $0 [-h]"
    echo ""
    echo "Builds the development Docker image from Dockerfile.dev"
    echo ""
    echo "OPTIONS"
    echo ""
    echo "  -h - show this help"
}

while getopts ":h" opt "${@}"; do
  case ${opt} in
    h)
      usage
      exit 0
      ;;
    ?)
      log "Invalid option: ${OPTARG}"
      usage
      exit 1
      ;;
  esac
done
shift $((OPTIND -1))

check_for_docker
BASHRC_LOCAL="${ROOT_DIR}"/.bashrc.dx.local

if [ -e "${BASHRC_LOCAL}" ]; then
  log "${BASHRC_LOCAL} exists - not touching it"
else
  log "${BASHRC_LOCAL} missing - creating"
  echo "# Place custom Bash configuration to use" >> "${BASHRC_LOCAL}"
  echo "# inside the running container here" >> "${BASHRC_LOCAL}"
fi
if grep "${BASHRC_LOCAL}" .gitignore > /dev/null 2>&1; then
  log "${BASHRC_LOCAL} is already being ignored"
else
  log "${BASHRC_LOCAL} is not being ignored. Adding to .gitignore"
  echo "# This is for developer-specific customizations" >> .gitignore
  echo "${BASHRC_LOCAL}" >> .gitignore
fi

log "Building Docker image '${IMAGE}'"
docker buildx build \
  --quiet \
  --file "${ROOT_DIR}/Dockerfile.dev" \
  --tag "${IMAGE}" \
  "${ROOT_DIR}"

log "Docker image '${IMAGE}'" is built
```

以及它引用的 *shared.lib.sh* 脚本内容：

```bash
log() {
    echo "[ ${0} ]" "${@}"
}

if [ -z $SCRIPT_DIR ]; then
  log "SCRIPT_DIR was not defined"
  exit 1
fi

check_for_docker() {
    if ! command -v "docker" > /dev/null 2>&1; then
      log "Docker is not installed."
      log "Please visit https://docs.docker.com/get-docker/"
      exit 1
    fi
    log "Docker is installed!"
}

ROOT_DIR=$(cd -- "${SCRIPT_DIR}"/.. > /dev/null 2>&1 && pwd)
```

诚实地说，我之前写脚本一般“能跑就行”，没写过这么优美而健壮的脚本。上面的例子严格遵守作者设计的原则，考虑了很多失败的可能性：

1. **如果脚本不是从应用根目录运行的怎么办**？所以我们不能使用相对路径 (用 `dirname` 获取脚本本身的目录)。
2. **如果 Docker 没有安装怎么办**？ 提取出来 `check_for_docker` 这个公共函数检查 Docker 是否安装。
3. **如果我们需要调试脚本怎么办**？
   1. 调试脚本最重要的是要理解脚本在做什么，有常见的三种方式可以提供相关信息：
      1. 只打印错误信息，即“没有消息就是最好的消息”。
      2. 打印所有信息。
      3. 根据 `--verbose` 或 `--quiet` 控制是否打印消息。
   2. 一般来说第三种方式是最好的，但就我们的目的而言，**我们需要确保自己始终知道脚本正在做什么以及发生了什么，是否有错误产生**。所以第二种方案更合适，采用第二种方案需要：
      1. 在执行任何操作前，都以人类可理解的语言打印出要执行的操作，包括任何派生值。
      2. 确保该操作的任何一种可能的结果都会生成另一种打印消息。
      3. 确保每条消息都明确标记为来自我们的脚本，以区别于任何其他输出。
   3. 因此我们封装了 `log` 函数而不是直接使用 `echo` 命令。
4. **如果我们不知道这个脚本会干什么所以不敢运行它怎么办**？所以我们提供了 `-h` 命令。

除此之外，上述脚本中还有一些值得注意的技术点：

- Bash 命令通常位于 `/bin/bash`，但”通常“就意味着”可能存在意外“，所以更可靠的方式是让 `env` 变量去查找它，因此使用 `#/usr/bin/env bash`。
- `set -e`：如果有任何命令以**非零**的状态码退出，就立即结束脚本的运行。
- 关于 `set -o pipefail` 值得说明的是： Bash 的默认行为是**管道的退出码采用管道最后一个命令的退出码，而不管之前的命令是否有失败**，这基本上从来都不是我们想要的。使用 `set -o pipefail` 的作用是把管道的退出码改为**管道中第一个失败的命令的退出码**，这对于管道的健壮性当然是很有价值的。
- 使用 `$(dirname -- "${0}")` 来获取脚本目录，这里的问题是：如果目录名包含 `-` 符号，就会被 `dirname` 命令解析成标志，为了避免这种情况，使用 `--`，它的作用是充当**标志和参数之间的分割符**，这是一个非常良好的实践。
- `$(cd -- "${DIRNAME}" > /dev/null 2>&1 && pwd)` 中如果 `cd` 命令出现错误会扰乱终端输出，所以我们重定向到 `/dev/null` 以避免潜在的错误，这样如果 `cd` 命令出错在继续向下执行的过程中遇到的错误会结束脚本运行。
- `. "${SCRIPT_DIR}"/shared.lib.sh` 表示引用其他文件，`.` 可以理解成 Ruby 的 `require` 或者 JavaScript 的 `import`，但注意 **Bash 没有私有函数/方法的概念，一切都是公开的**。
- `log` 函数：
  - `${0}` 用于指脚本本身。
  - Bash 的函数不接受命名参数，而是使用 `${n}` 表示第 n 个参数 (n >= 1)，用 `${@}` 表示所有参数。
- Bash 是如何解析参数的？
  - 参数用空格分割。
  - 如果参数带空格，需要使用转义符号或引号 (单双引号均可)。
- 引用变量在变量名前添加 `$` 即可，但更好的方式是使用 `${变量名}`。
  - 单引号内的引用不会被展开 (求值)，而是保持原样输出。
  - 双引号内的变量会被替换成相应的值，且双引号被保留以防止变量的值中存在的空格被解析为参数分割符 (通常我们需要的是：`"${VAR}"`)。
- `getopts` 命令：
  - 再看一下我们如何使用的：`getopts ":h" opt "${@}"`。
  - `getopts` 是一个专门用于解析命令行参数的命令，它...弄清楚它要费一番周折。如果它成功解析了一个标志 (类似 `-h` 就是所谓的**标志/flag**)，会返回 0；如果没有更多的标志需要解析，返回非 0；所以我们只能在循环中调用它才能解析所有标志。
  - 被解析的标志必须以冒号开头，否则会出现无法控制的错误。
  - 冒号之后的每个字母都代表一个标志，`h` 表示 `-h`。
  - 字母后面可以跟可选的冒号，有冒号表示这个标志接受一个参数，如 `f:` 表示可能接受这种形式：`-f filename`，这个参数被放入 `OPTARG` 变量；没有冒号的标志一定不接受参数，否则也会出现错误。
  - 成功解析的参数会被放入 `${opt}`，这里 `opt` 是我们自定义的；解析失败会把返回的 `?` 放入 `${opt}`。
  - 被解析后的标志和参数最好从 `${@}` 删除，我们使用 `shift` 和 `OPTIND` 变量来达到目的 (`shift n` 从位置参数中删除前 n 个参数)，`OPTIND` 是专门与 `getopts` 命令一起使用的变量，它**总是保存要处理的下一个参数的索引** (所以最开始它就是 1)。这样清理参数之后，就只留下**非标志参数**，从而简化了脚本对后续参数的处理。
  - (学习像这样复杂的命令，最好的办法是在 Stack Overflow 找一个可行的例子，然后再根据例子详细查询命令的官方文档)
- case 语句中的 `h)`，这个 `)` 乍一看让我有点慌乱，以为是什么了不得的知识点，后来我想想，Golang 的 case 语句后面也有一个 `:`...

除了上面的知识之外，`usage` 函数使用 `echo` 命令而不是我们的 `log` 函数也是经过考量的：这种情况下用户知道自己在使用 `-h` 获取帮助命令，如果还添加前缀会使输出变得混乱，无疑画蛇添足。

*shared.lib.sh* 脚本中有这样一些代码：`[ -z $SCRIPT_DIR ]`，我也是才知道 `[` 居然是个命令，这个命令接受一些参数，但要求最后一个参数是 `]`，确实是有点狂野了。这里 `-z` 标志要求一个参数，如果参数为空那么就返回 0 作为退出码。

> `[` 是一个命令，所以一直令人 (wo) 困惑的 `[` 和 `-z` 之间是否应该有空格的问题，答案是显而易见的。

经过一番努力，我本机在应用根目录运行 `dx/build` 命令的输出结果如下：

```docker
[ dx/build ] Docker is installed!
[ dx/build ] /home/o/github/backend/b7-docker-bash/catsay/.bashrc.dx.local exists - not touching it
[ dx/build ] /home/o/github/backend/b7-docker-bash/catsay/.bashrc.dx.local is already being ignored
[ dx/build ] Building Docker image 'catsay-dev:debian-12.1'
sha256:2f3927f40ffeff7a1c016b1c6163c1150ed019a7a6d5ca79f6ef55ffa1959c5e
[ dx/build ] Docker image 'catsay-dev:debian-12.1' is built
```

是真的漂亮！

### 3.2 start/stop 脚本

上面的 build 脚本中有一行 `. docker-compose.env`，即导入 Docker Compose 所需要的环境变量文件，以这种方式管理环境变量避免了使用 `.env` 文件或者 `export` 方式声明环境变量所带来的复杂的、难以观察的隐式行为，且和 Docker Compose 的 `--env-file` 标志合作的天衣无缝：

```bash
# dx/start

# ...

docker compose \
  --ansi=never \
  --env-file "${SCRIPT_DIR}"/docker-compose.env \
  --file "${ROOT_DIR}"/docker-compose.dev.yml \
  up \
    --detach \
    --no-color

log "Dev environment started"
```

除此之外，start 和 stop 脚本就没有什么值得注意的了。

### 3.3 exec 脚本

Exec 脚本有点不一样，首先它需要接受命令才能运行，其次它应该有一个标志来指定要运行命令的容器。但我们仍然可以优化它！

目前的 Docker Compose 有 `app` 和 `redis` 两个服务，考虑到毫无疑问我们需要频繁执行命令的是 `app` 服务，所以我们可以**把 `app` 指定为默认运行的服务**：

```bash
# Default service commands are exec'ed in
SERVICE=app

usage() {
    echo "usage: $0 [-h] [-s service] command"
    echo ""
    echo "Executes a command inside a container"
    echo ""
    echo "OPTIONS"
    echo ""
    echo "  -s service - Set service name for the"
    echo "               command (default to '${SERVICE}')"
    echo "  -h         - show this help"
    # ...
}
```

经过这种构造，团队开发环境的文档可以简化为：

1. 安装 Docker
2. Clone 应用代码
3. `dx/build`
4. `dx/start`
5. `dx/exec <command>` (`dx/exec bin/setup`)

> 当然可以根据需要进一步定制，这里作者通过在项目根目录内添加 `.bashrc.dx.local` 使得团队成员可以根据需要在此文件内添加自己的 Bash 自定义，相关代码在 build 脚本有所体现。

而最终的项目结构大概就是：

```bash
├── bin
│   ├── ci
│   ├── run
│   ├── seed
│   ├── setup
│   └── test
├── docker-compose.dev.yml
├── Dockerfile.dev
├── dx
│   ├── build
│   ├── docker-compose.env
│   ├── exec
│   ├── shared.lib.sh
│   ├── start
│   └── stop
├── Gemfile
├── Gemfile.lock
│ ...
```

## 4. 结语

当然这只是一切的开始，别忘了我们的目标是“可持续的开发环境”，没有什么是一劳永逸的，要想可持续，就需要在日常开发中随着时间的推移而不断维护它。

### 4.1 如何解决日常开发中的 Dockerfile 问题

作者解决 Dockerfile 问题的方式是：

- 拆分长命令，分别执行
  - 尤其是用 `&&` 连接的命令
- 仔细在网络上搜索 (不是单纯的 Google)
  - Stack Overflow 上有很多过时的答案，但仍然相关，不要只看绿色的，还要看看最新的回答
  - GitHub Issues 上的相关讨论是解决问题的宝库
  - 不要太相信 AI，它们总是凭空却自信地创建根本不起作用的解决方案
  - 随机发布的博客也不太靠谱，它们基本上相当于 Stack Overflow 上绿色答案的复制
- 如果 base 镜像是我们自己构建的，在 base 镜像中逐步添加、运行命令，小步排查
- 验证解决方案：再细致地看一下官方文档以进一步理解

### 4.2 如何控制脚本质量

测试脚本是非常困难的，因为一些脚本命令会对计算机产生不可逆的影响 (想想 `rm -rf`)，有三种技术或许可以帮到我们：

- 经常运行脚本
  - 每天运行多次 `dx/exec`
  - 每天运行一次 `dx/start`
  - 每周运行一次 `dx/build`
- 把脚本作为 CI 的一部分
- [https://www.shellcheck.net/](https://www.shellcheck.net/) 是 Bash 脚本的静态分析器，可以识别错误、危险、以及应该避免的代码。

### 4.3 为什么搭建开发环境是核心能力

重点是**你应该自动化你的开发环境、控制它、了解它的工作原理，且有设计合理的灵活性**。你必须始终理解当前抽象的下一层： 比如编写汇编很烦人，所以发明了 C；但如果你只学习 C 而不是汇编，你最终会达到极限。你不知道 C 是为了解决什么而创建的，而你最终会遇到一个仅靠 C 知识无法解决的问题，那就是你需要汇编的时候。

开发环境也是如此，无论你使用什么机制来管理它，它最终都是为了管理你的环境而精心设计的其他技术之上的抽象，当出现问题时，你需要打开引擎盖看看里面有什么。因此你需要了解你的开发环境是基于什么而构建的。这也意味着你的开发环境应该使用你可以理解或者能够理解的技术，被普遍理解、经过实战经验的技术比功能似乎更丰富但更深奥且小众的技术更有价值。

想想看，如果你无法设置操作系统，或者无法安装、配置编写测试和运行应用程序所需的工具，那么一切开发都无从谈起。当遇到问题时，你不知道该怎么做，因为你对开发环境的各个部分都没有任何概念，更不用说如何找出哪些方面出了问题。

对于像开发环境这样的东西，你不会想要调试或者维护你无法控制的东西。比如 DevBox ([https://www.jetify.com/devbox](https://www.jetify.com/devbox)) 这样的产品声称你拥有你的开发环境，但如果它出了问题，你就只能先去学习 Nix (DevBox 底层使用 Nix)，再去研究那 200 多行指令了。