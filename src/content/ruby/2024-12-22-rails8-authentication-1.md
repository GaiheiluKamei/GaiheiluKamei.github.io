---
title: Rails 8 Authentication 实现分析(1) - 理论准备
publishedAt: 2024-12-22
---

十天前，37signals 发布了一篇文章：**A vanilla Rails stack is plenty**，这篇文章加强了我一直以来的想法：**如果 Rails 提供了解决方案，那么最好坚持 Rails 的方案**。保持最小的依赖性、减少版本升级的障碍固然重要；更重要的是学习顶级开发人员思考、实践之后的“最优解”。

所以当 Rails 8 推出 Authentication 方案时，我想在第一时间学习他的实现细节，也借此机会了解身份验证这个我一向觉得神秘的黑盒。

> **A vanilla Rails stack is plenty**: [https://dev.37signals.com/a-vanilla-rails-stack-is-plenty/](https://dev.37signals.com/a-vanilla-rails-stack-is-plenty/)

## 1. 密码应该如何保存

要了解身份验证，首先要确定在开发中应该如何保存密码。有四种可能的方式：**明文**、**哈希 (Hashing)**、**加密 (Encrypting)**、**签名 (Signing)**，下面分别介绍一下这四种你可能已经都了解的方案。

### 1.1 明文

所谓明文保存用户密码，就是用户的密码是什么我们就在数据库中保存什么。这个方案的缺点是相当一目了然的，而优点可以说是没有：

- 如果数据库被黑客攻击，那么用户名、密码一起泄露...想一想黑客拿到你的支付宝账号、密码的场景
- 即使没有被黑客攻击，内部开发人员也能直接通过数据库看到用户的密码，这和被攻击的区别不大

### 1.2 加密 (Encrypting)

加密就是把给定的字符串转换为乱码字符串的过程。它的问题在于**只要你有加密密钥，加密就是可逆的**，所以谁来保存这个密钥呢？DBA、CTO、CEO、UFO？

保存密钥本身就是一个很大的挑战，显然这个方案也不可取。

### 1.3 签名 (Signing)

签名是利用非对称加密技术生成一个私钥和一个公钥组成的密钥对，用私钥为数据创建签名，而使得拥有相应公钥的任何人都可以验证签名，它主要用来验证数据的真实性和完整性。这里需要注意的是**数据本身并没有被加密，只是带有你的私钥签名**。所以仔细想一想，用来验证数据的真实性和完整性确实是不错的，但用来加密就不合理了，因为**数据本身还是相当于明文存储**的。我们可以在 Rails 中用 `ActiveSupport::MessageVerifier` 类来验证：

```ruby
# 1. 这是你的私钥
verifier = ActiveSupport::MessageVerifier.new("secret key")

# 2. 你用私钥签名用户的密码
signed_string = verifier.generate("user's password")
# => "InVzZXIncyBwYXNzd29yZCI=--8c5d09fcec50a63bad5ffe303a307be10d412615"

# 3. 这个签名的结果似乎非常不错，看起来像被加密了，而且还可以被验证
verifier.verify("InVzZXIncyBwYXNzd29yZCI=--8c5d09fcec50a63bad5ffe303a307be10d412615")
# => "user's password"

# 4. 但不要被这个字符串的表面所迷惑，这个字符串以 `--` 分为两部分：前半部分是 payload，是公开的，
# 只是用 Base64 进行了编码； 后半部分才是签名
payload, signature = signed_string.split("--")

# 5. 数据部分是公开的，也就是你采用这种方案，相当于用户密码是公开的
JSON.parse(Base64.decode64(payload))
# => "user's password"

# 6. 但签名是私密的，如果更改了数据部分，会导致验证失败，所以签名能保证数据的完整性
bad_payload = Base64.encode64("fake data").strip
# => "ZmFrZSBkYXRh"
bad_signed_string = [bad_payload, signature].join("--")
# => "ZmFrZSBkYXRh--8c5d09fcec50a63bad5ffe303a307be10d412615"
verifier.verify(bad_signed_string)
# raises ActiveSupport::MessageVerifier::InvalidSignature
```

`ActiveSupport::MessageVerifier` 使用的密钥来自 `secret_key_base`，这个配置在 Rails 6+ 版本中位于 `config/credentials.yml.enc`，Rails 的 `cookies.signed` 就是利用这种方式来验证“浏览器传过来的 cookie 确实是你发出去的 cookie”。

### 1.4 哈希 (Hashing)

哈希是把给定的字符串转换为固定大小的乱码字符串，它有两个很棒的特性：

- **确定性**：给定的输入总是会被转换为相同的哈希值
- **不可逆**：哈希函数是单向的，在计算上从哈希值反推出原始输入是不可行的

这简直是为保存密码量身定制的，我们通过哈希算法把用户的密码转为哈希值，即使数据库被攻击、即使内部人员拿到哈希值也无法得到用户的原始密码。在 `rails console` 中尝试一下：

```ruby
Digest::SHA256.hexdigest("hello")
# => "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
```

有很多哈希算法，如众所周知的 SHA1、SHA256，但不是所有的哈希算法都适合处理用户密码。事实上，SHA256 这些永远都不应该被用来哈希用户密码，因为它们“太快了”，很容易被**暴力攻击 (brute force attack)**，暴力攻击是指攻击者对很多随机字符串逐个进行哈希处理，以尝试其中一个字符串是否和密码的哈希值匹配。很显然，这种情况下算法越快，黑客就越容易破解到密码。

要保存用户密码，必须使用专门为生成用户密码设计的哈希算法，这种算法被专门设计成“速度慢、消耗大量内存”，比如 Rails 默认使用的 Bcrypt 算法。Bcrypt 还可以通过**成本因子 (cost factor)** 来控制速度和内存消耗，成本因子越高，哈希计算越慢。有一些新型的这类算法安全性更高，比如 Argon2id，但 Bcrypt 的成本因子设置为 10 及以上都是安全的，Rails 的默认值是 12。

不过这还不够，如果攻击者已经有了一个巨大的字符串数据库保存着字符串到哈希值的映射，那么他们只需要查询这个数据库就能得到原始密码，这种数据库被称为 **彩虹表 (rainbow tables)**，这种攻击被称为 **彩虹表攻击 (rainbow table attack)**。要防止彩虹表攻击，需要对密码**加盐 (salting)**：所谓加盐就是在保存用户密码时，随机生成一个字符串，把这个字符串和用户密码“连接”到一起进行哈希处理，这样就算两个用户的密码相同，但因为每个人的“盐值”不同，他们被保存的的哈希值也不相同。这就使得虽然黑客的数据库里保存的密码 `123` 的哈希值为 `xxx` (假设)，但通过加盐操作使得 `123` 的哈希值变成了 `xxy`，这就使得几乎不可能使用彩虹表攻击来破解用户密码。

Rails 的加盐操作是通过 `has_secure_password` 自动完成的：

1. 当创建一个新用户时，Rails 自动**为这个用户生成一个随机的盐 (salt)**
2. Rails 使用 Bcrypt 把用户的密码和盐结合起来生成哈希值
3. 生成的哈希值被保存在用户的 `xxx_digest` 字段中，这里的 `xxx` 一般我们使用 `password`

当用户登录需要验证密码时，Rails 使用 `authenticate` 方法完成以下操作：

1. 通过邮箱等用户名查找对应的 `password_digest` 哈希值
2. Bcrypt 从 `password_digest` 中提取盐以及哈希值本身
3. Bcrypt 用用户输入的密码和提取出来的盐重新生成一个哈希值
4. Bcrypt 比较新生成的哈希值和保存在 `password_digest` 中的哈希值是否一样，如果一样，则验证通过

OWASP 的 **Password Storage Cheat Sheet** 部分对保存密码相关的哈希算法有相当完整的解释，不过除了加盐之外，还有**加胡椒 (peppering)** 这种操作是我完全没有料到的。🥲

> Password Storage Cheat Sheet: [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## 2. 在 Rails Console 中小试牛刀

### 2.1 学一点 Yaml

在 Rails 8 项目根目录运行 `rails g authentication` 之后，虽然可以直接打开 `bin/rails console` 进行创建用户操作，但这里我想顺便记录两个在 *fixtures* 中提取变量的技巧。

第一个是利用 ERB 提取变量：

```yml
# test/fixtures/users.yml

<% password_digest = BCrypt::Password.create("password") %>

one:
  email_address: one@example.com
  password_digest: <%= password_digest %>

two:
  email_address: two@example.com
  password_digest: <%= password_digest %>
```

第二个是利用 Yaml 的**锚点 (anchors)** 和**别名 (aliases)**：

```yml
# test/fixtures/users.yml

DEFAULTS: &defaults
  password_digest: <%= BCrypt::Password.create("password") %>

one:
  email_address: one@example.com
  <<: *defaults

two:
  email_address: two@example.com
  <<: *defaults
```

这个写法在 `config` 目录的 Yaml 配置文件中很常见，我之前一直似懂非懂。其实很简单：

1. 用 `&` 定义一个锚点，这个锚点包含了 `password_digest` 这个键值对
2. 用 `*` 引用这个锚点，相当于把锚点下的所有值都插入到引用的位置
3. `<<` 被称为**合并键 (Merge Key)**，经常和 `*` 一起使用，把一个锚点的内容合并到当前节点，而且允许使用新的值覆盖锚点中的值
4. 如果不使用合并键，Yaml 解析器会用整个锚点的内容直接替换当前节点，替换过程中如果存在键冲突，大多数解析器都会报错

> **YAML anchors**: [https://support.atlassian.com/bitbucket-cloud/docs/yaml-anchors/](https://support.atlassian.com/bitbucket-cloud/docs/yaml-anchors/)

### 2.2 一点 Rails 小技巧

现在 `test/fixtures/users.yml` 文件中已经有了练手需要的数据，那么该怎么把它写入到数据库以在 Rails Console 中使用呢？有两种方式：

1. 把数据写入测试数据库，再以测试环境运行 Rails Console：
   1. `bin/rails test`
   2. `RAILS_ENV=test bin/rails console`
2. 把数据写入开发数据库，再以开发环境运行 Rails Console：
   1. `bin/rails db:fixtures:load`
   2. `bin/rails console`

无论哪种方式，现在我们可以使用 Rails Console 来尝试 Bcrypt 算法了。

### 2.3 在 Rails Console 中尝试

```ruby
user = User.first
# =>  #<User:0x000070c0cf51c880...

# 1. password_digest 列确实是以哈希存储的
user.password_digest
# => "$2a$12$cFn5jqnTfWVbQzxyfplWuexuKbhOw9fq9aKsNun5PU.GoORlaYqlG"

# 2. 使用 BCrypt::Password.new 创建一个 BCrypt::Password 对象，这个对象包含了原始
# 哈希字符串的所有信息，包括盐值、成本因子和哈希值本身
hash = BCrypt::Password.new(user.password_digest)
# => "$2a$12$cFn5jqnTfWVbQzxyfplWuexuKbhOw9fq9aKsNun5PU.GoORlaYqlG"

# 3. 由于 hash 是确定性的，所以可以和用户提供的密码进行比较，注意 `==` 是一个方法
hash == "password"
# => true

# 4. 当然也可以使用 is_password? 方法
hash.is_password? "password"
# => true

# 5. 了解哈希对象的一些信息，包括算法版本、成本因子和盐值
hash.version
# => "2a"
hash.cost
# => 12
hash.salt
# => "$2a$12$cFn5jqnTfWVbQzxyfplWue"
```

这里值得注意的是 `BCrypt::Password.create` 和 `BCrypt::Password.new` 的区别：

1. `create` 用于**创建**新的哈希值，它接受一个明文密码作为参数，并返回一个 Bcrypt 哈希字符串
2. `new` 用于**验证**现有的哈希值，它接受一个 Bcrypt 哈希字符串作为参数，返回一个 `BCrypt::Password` 对象，用于与用户提供的密码进行比较

注意，**我们总是应该用 `BCrypt::Password` 对象比较哈希字符串，而不是直接比较字符串**。这里的 `==` 方法就很有迷惑性，让人以为在比较两个字符串是否相等；而实际上我们是在调用 `BCrypt::Password` 对象上的 `==` 方法。

还可以自己配置成本因子，虽然大概率不需要这样做：

```ruby
# config/initializers/bcrypt.rb

BCrypt::Engine.cost = 15
```

### 2.4 了解 `has_secure_password`

Authentication 方案有很大一部分是建立在 `has_secure_password` 方法上的，所以我们很难不去了解这个方法。粗略来说，`has_secure_password`：

1. 需要你指定一个要被哈希存储的属性名，如果不指定，默认就是 `:password`
2. 根据属性名，它帮我们创建了 `xxx_confirmation` 属性，这个属性一般用来在创建密码时“再次输入密码” (用于客户端验证，和密码哈希无关)
3. 它还创建了 `xxx_challenge` 属性，一般用来验证在修改密码时“输入的当前密码” (**修改密码时要求输入当前密码是极其必要的**)
4. 它用 `generates_token_for` 方法生成了一个`xxx_reset_token` 方法，后者生成一个默认 15 分钟过期的重置密码的 token，可以用 `find_xxx_reset_token` 方法进行验证

其中 `xxx_reset_token` 中是这样使用 `generates_token_for` 的：

```ruby
# https://github.com/rails/rails/blob/cf6ff17e9a3c6c1139040b519a341f55f0be16cf/activemodel/lib/active_model/secure_password.rb#L163
generates_token_for :"#{attribute}_reset", expires_in: 15.minutes do
  public_send(:"#{attribute}_salt")&.last(10)
end
```

这里用盐的最后 10 个字符作为重置密码的 token 的一部分，虽然这 10 个字符相当于明文存储的，但由于密码重置之后盐也会变化，所以作为一次性的使用是安全的 (虽然安全性相对较弱，但一般的小破站漏洞百出，实现功能已属不易，担心这个更是多余 🤪)。而 `generates_token_for` 方法本身是基于上述的 `ActiveSupport::MessageVerifier` 实现的。

到目前为止，正如 DHH 在 PR **rails#50446** 所说的： Rails now include all the key building blocks needed to do basic authentication.

> `has_secure_password` API: [https://api.rubyonrails.org/classes/ActiveModel/SecurePassword/ClassMethods.html#method-i-has_secure_password](https://api.rubyonrails.org/classes/ActiveModel/SecurePassword/ClassMethods.html#method-i-has_secure_password)
>
> `generates_token_for` API: [https://api.rubyonrails.org/classes/ActiveRecord/TokenFor/ClassMethods.html#method-i-generates_token_for](https://api.rubyonrails.org/classes/ActiveRecord/TokenFor/ClassMethods.html#method-i-generates_token_for)
>
> Add basic authentication generator PR `rails#50446`: [https://github.com/rails/rails/issues/50446](https://github.com/rails/rails/issues/50446)
>
> Add a default password reset token to has_secure_password PR `rails#52483`：[https://github.com/rails/rails/pull/52483](https://github.com/rails/rails/pull/52483)
>
> Generate magic tokens in Rails with generates_token_for: [https://blog.siami.fr/generate-magic-tokens-in-rails](https://blog.siami.fr/generate-magic-tokens-in-rails)