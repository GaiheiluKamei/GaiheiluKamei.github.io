---
title: Rails 8 Authentication 实现分析(2) - 自己实现注册功能
publishedAt: 2024-12-23
---

Rails 8 Authentication 生成器的设计目标是提供一个**基础的、可扩展的认证系统**，而不是一个完整的、开箱即用的用户管理解决方案。而注册流程通常和业务相关，需要处理各种用户特定的细节：

- 不同的应用需要收集的用户数据不同，如用户名、地址、电话、个人资料等等
- 不同的应用对用户数据的验证规则不同，如密码强度、邮箱格式、用户名唯一性等等
- 不同的应用可能需要额外的注册步骤，如邮箱验证、管理员审核等等

所以生成器只包含登录、退出、重置密码，而不包含注册功能也在情理之中。

本系列文章旨在以 Rails 8 Authentication 生成器生成的文件为蓝本但重新实现它，到系列结尾会完成一个和生成器基本相同的认证系统，以达到完全理解 Rails 8 Authentication 的目的，也为后续添加扩展功能奠定基础。

## 1. 准备

我本机的开发环境如下：

```bash
ruby -v
# => ruby 3.3.6 (2024-11-05 revision 75015d4c1f) [x86_64-linux]

rails -v
# => Rails 8.0.1
```

使用 Rails 的默认设置创建一个新项目：

```bash
rails new myauth

cd myauth
```

然后我们创建两个页面，一个用来模拟无需登录的公开页面，另一个模拟需要登录的私有页面。这部分代码和身份验证无关，所以我就不加分析的直接把代码贴在此处：

```bash
rails g controller PublicPage index --skip-helper

rails g controller PrivatePage index --skip-helper
```

然后修改一下 `config/routes.rb` 文件，让 `root` 指向公开页面，这会使得后续的访问很迅捷：

```ruby
# config/routes.rb
Rails.application.routes.draw do
  root "public_page#index"
  # ...
end
```

再修改一下 `application.html.erb` 文件的 `<body>` 部分，添加快速导航的链接和 Flash 消息：

```html
<!-- app/views/layouts/application.html.erb -->

<body>
  <header>
    <nav>
      <ul>
        <li><%= link_to "Public Page", public_page_index_path %></li>
        <li><%= link_to "Private Page", private_page_index_path %></li>
      </ul>
    </nav>
  </header>
  
  <main>
    <%= notice %>

    <%= yield %>
  </main>
</body>
```

到此为止，准备工作就这样简单而迅速的完成了，在项目目录使用 `bin/setup` 启动服务，用浏览器打开 `http://localhost:3000` 就可以看到我们丑陋的页面了。

## 2. 实现 User Model

### 2.1 User Migration

用户验证系统的第一步毫无疑问要有一个用户模型先。使用生成器创建用户模型时以下两种方式可以任选其一：

```bash
bin/rails g model User email:string:uniq password:digest!

# or
bin/rails g model User email:string:uniq password_digest
```

这个命令的解释可以参考我之前的文章 [Rails Migration (1/2) - 了解一点数据库迁移的知识](https://mp.weixin.qq.com/s/-1UIRpAV9UdUB9FB3is0tg)。但有一个小技巧是你大概率不知道的，我忘了在哪学的这个旁门左道直到写到这里才想起来： __`password:digest!` 的 `!` 放在类型之后表示这一列的值不为 `null`，也就是自动为我们在迁移文件中添加 `null: false`__，不过我刚才又尝试了几次发现如果有第二个冒号存在，这个符号放哪里都不会生效。


所以还是要手动给 `email` 字段加上数据库约束：

```ruby
# db/migrate/20241223061032_create_users.rb

class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false

      t.timestamps
    end
    add_index :users, :email, unique: true
  end
end
```

> 添加唯一索引还有一种 `t.string :email, null: false, index: {unique: true}` 的方式。

然后就可以运行 `bin/rails db:migrate` 执行数据库迁移了。

### 2.2 安装 Bcrypt Gem

Bcrypt 是 Rails 的默认 Gem，所以只需要在 `Gemfile` 中去掉它前面的注释，然后运行 `bundle install` 安装即可。

```ruby
# Gemfile

gem "bcrypt", "~> 3.1.7"
```

### 2.3 完成 User Model

在开始实现注册功能之前，我们还需要完善 User Model：添加密码最少为 8 位、邮箱存在且唯一的验证，以及在保存邮箱之前对其进行规范化，即删除邮箱前后的空格并把它小写。当然根据上一篇文章的讨论，还需要 `has_secure_password` 宏。

```ruby
# app/models/user.rb

class User < ApplicationRecord
  MINIMUM_PASSWORD_LENGTH = 8

  has_secure_password

  validates :password, length: { minimum: MINIMUM_PASSWORD_LENGTH }
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: ->(e) { e.strip.downcase }
end
```

`normalizes` 是 Rails 7.1 添加的方法，它的作用是**声明对模型属性值的规范化规则**，在属性被赋值或更新时调用。在这个方法被添加之前，一般用 `before_save` 之类的 hook 实现属性的规范化。

## 3. 实现注册功能

我们要实现的注册功能很简单：

1. 用户访问注册页面
2. 输入邮箱、密码，提交注册
3. 如果注册成功，把用户重定向到 Private 页面，发给他一个成功的 Flash 消息
4. 如果注册失败 (邮箱已存在)，让用户停在注册页面，发给他一个失败的 Flash 消息

所以实现也分为以下几步：

1. 创建 router (使用 `resource` 而不是 `resources`，因为用户只需要注册一次)
2. 创建 controller (只需要 `new` 和 `create` 方法)
3. 创建 view

```ruby
# 1. config/routes.rb
Rails.application.routes.draw do
  # ...
  resource :registration, only: %i[new create]
end

# 2. app/controllers/registrations_controller.rb
class RegistrationsController < ApplicationController
  def new
    @user = User.new
  end

  def create
    @user = User.new(user_params)
    if @user.save
      redirect_to private_page_index_path, notice: "Successfully registered!"
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

    def user_params = params.expect(user: [ :email, :password ])
end

```

需要注意的是：即使 route 是单数，controller 也是复数。**根据 Rails 约定，controller 名称始终是复数**。

此外，`def user_params =` 这种单行方法的写法是 Ruby 3.0 起添加的便捷写法，**当方法定义只有一个表达式组成时，可以使用这种写法**。参考 [https://docs.ruby-lang.org/en/master/syntax/methods_rdoc.html](https://docs.ruby-lang.org/en/master/syntax/methods_rdoc.html) 的第五行：*Since Ruby 3.0, there is also a shorthand syntax for methods consisting of exactly one expression*。

`params.expect()` 方法是 Rails 8 开始添加的，**几乎**可以用来完全取代 `params.require().permit()`，它们的区别是 **`params.require().permit()` 方法虽然能防止恶意参数的注入，但不能有效地处理格式错误的参数，导致服务器返回 500 错误，暴露了内部信息，并可能引发安全风险。 而 `params.expect()` 则能更有效地验证参数的结构和类型，在参数格式错误时返回 400 错误，从而提高了应用程序的安全性**。可以参考下面两个链接进一步了解：

> - [https://martinemde.com/2024/10/22/how-to-rails-params-expect.html](https://martinemde.com/2024/10/22/how-to-rails-params-expect.html)
>
> - [https://github.com/rails/rails/pull/51674](https://github.com/rails/rails/pull/51674)

之后就是创建 view 了：

```ruby
# app/views/registrations/new.html.erb

<h1>Sign up</h1>

<%= form_with model: @user, url: registration_path do |f| %>
  <%= tag.div(@user.errors.full_messages.to_sentence) if @user.errors.any? %>

  <div>
    <%= f.label :email %>
    <%= f.email_field :email %>
  </div>

  <div>
    <%= f.label :password %>
    <%= f.password_field :password %>
  </div>

  <%= f.submit "Sign up" %>
<% end %>
```

在 `application.html.erb` 中再添加一个注册的快速导航：

```html
<!-- app/views/layouts/application.html.erb -->

<!-- ... -->
<li><%= link_to "Private Page", private_page_index_path %></li>
<li><%= link_to "Sign up", new_registration_path %></li>
<!-- ... -->
```

此时启动服务，在浏览器输入 `http://localhost:3000/registration/new` 注册一个新用户，如果第二次注册时输入字母大写的相同邮箱，页面上会出现 `Email has already been taken` 的报错。

## 4. 下一步

注册后的下一步，很自然的需求就是实现登录功能。下一篇文章会在本篇代码的基础上首先实现不安全的 Session，探讨存在的漏洞，然后在其基础上逐步实现更加安全的 Session，之后视篇幅确定是否实现退出功能。