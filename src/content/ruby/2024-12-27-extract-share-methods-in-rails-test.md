---
title: Rails 测试中提取公共方法的最佳实践
publishedAt: 2024-12-27
---

在写 Rails 测试时，经常需要提取公共方法来提高代码可重用性和可维护性。本文探讨了在 Rails 测试中组织和管理公共方法的几种方式，并推荐最佳实践。

## 1. 单元测试内的方法提取

对于仅在单个测试或少量测试中使用的公共方法，例如特定断言逻辑，可以直接在测试类内部定义，就像定义普通类方法一样。这种方法简单直接，适用于范围有限的公共逻辑。

## 2. 使用 `test_helper.rb`

假设我们要测试一个要求登录的 Controller：

```ruby
class DashboardControllerTest < ActionDispatch::IntegrationTest
  def sign_in(user)
    # ...
  end

  # ...
end
```

在实际业务逻辑中，`sign_in` 这样的辅助方法可能被很多测试需要。Rails 提供了 `test_helper.rb` 文件，允许在所有测试中添加辅助方法。这对于跨多个测试的通用方法，例如登录功能 (`sign_in`)，非常方便：

```ruby
# test/test_helper.rb

ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end
```

上面代码的最后一条注释，是官方认定的公共方法位置。

不过如果写到这就结束...走到街上肯定会被人在背后指指点点。毕竟直接在 `test_helper.rb` 中添加大量公共方法的后果是显而易见的：**降低代码的可读性和可维护性，导致模块内聚性降低**。

## 3. 模块化方法：创建辅助模块

为了提高代码组织性，建议将跨多个测试的公共方法提取到单独的模块中。例如，创建一个 `SessionTestHelper` 模块来包含所有与会话相关的辅助方法，然后在 `test_helper.rb` 中 `include` 此模块：

```ruby
# test/test_helpers/session_test_helper.rb

module SessionTestHelper
  def sign_in(user)
    # ...
  end
end

# test/test_helper.rb

require_relative "test_helpers/session_test_helper"

module ActiveSupport
  class TestCase
    # ...

    include SessionTestHelper
  end
end
```

这种方法毫无疑问更清晰，也更易于维护。但...如果写到这里就结束了...走到街上小概率也会被人在背后指指点点。那些不喜欢在 Rails 中写 `require` 语句的人。🤣

## 4. 利用 Rails 自动加载机制

Rails 的自动加载机制可以进一步简化代码，只要遵循命名约定，Rails 就能自动加载所需的辅助模块。命名约定很简单：**模块名与文件名一致**。这里的*一致*不是严格意义上的相等，而是那种 `AdminController` 模块的文件名是 `admin_controller` 的一致。

通过在 `config/environments/test.rb` 中配置自动加载路径，Rails 就能自动加载 `test/test_helpers` 目录下的所有文件：

```ruby
# config/environments/test.rb

Rails.application.configure do
  # ...
  config.autoload_paths += %w[test/test_helpers]
end
```

这样，`test_helper.rb` 文件就不再需要 `require` 语句，代码不能更简洁。

事实上，我们可以利用 Rails 的自动加载机制解决一整类相关问题。
