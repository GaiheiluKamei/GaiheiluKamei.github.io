---
title: 课程笔记 - 揭秘 Ruby Block 及其常用模式
publishedAt: 2024-12-15
---

黑五期间买了 The Pragmatic Studio 的《Ruby Blocks》课程，原本打算买 Hotwire，因为我一直觉得 Hotwire 作为 Rails 默认的前端方案非常有吸引力。但是似乎 Ruby Blocks 的“设计技巧和模式”部分看起来也有点不错，而网上的 Hotwire 相关资源日益增多，所以最终还是选择了 Block。
## 1. 课程评价

课程总共 10 个模块，前 6 个模块的内容没什么深度，只有 7-10 还算可以。事实上我在学习的过程中一直陷于“跳过这一节吧，浪费时间”和“看看吧，买都买了”的左右脑互搏中。

## 2. 可以了解一下的细节

Ruby 的块是 `{}` 或 `do...end` 之间的代码块，它们不能独立存在，必须依附到方法上才能被执行，但**块不是方法的参数**。

有三个值得注意的细节，一是：**block parameter 不会被外界的同名变量影响，但块内定义的变量相当于是共享变量，会被影响**。

```ruby
name = 'Curly'
n = 100

3.times do |n|
  name = 'Moe'
  puts "#{n} Hi, #{name}!"
end

puts name # Moe
puts n    # 100
```

这里**块参数** (block parameter) 虽然也是 `n`，但和外面那个 `n` 变量毫无关系，可以想象成 block 为 `||` 管道提供了一个屏障，管道内的所有参数都属于块参数，不会被外界变量影响，**它们在块被调用时才被创建，生命周期仅限于块内**。

而 `name` 不是块参数，它有两种可能：

- 如果它是在块内新定义的，那么它的作用域当然仅限于块内
- 如果它在块外已经被定义，那么块内只是对它的引用，所以它可能像上面的例子一样在块内被修改

第二个细节是： 如果不想让外部的 `name` 变量影响块内的同名变量，可以使用**变量遮蔽 (variable shadowing)**，即在管道内使用 `;` 把参数分割成**块参数**和**块内预赋值的局部变量**。

```ruby
name = 'Curly'

3.times do |n; name, ok|
  name = 'Moe'
  ok = "fine"
  puts "#{n} Hi, #{name}, #{ok}!"
end

puts name # Curly
puts ok   # NameError
```

这里块外的 `name` 对管道里定义的 `name` 毫无影响，它们之间没有任何关系，好比黑龙江和广西都有一个叫张三的人，但除了都叫张三之外他们没有任何关系，他们是两个不同的张三；而管道里定义的 `ok` 属于块内预赋值的局部变量，当然仅限于块内使用。

实际上这种写法是非常糟糕的实践，除了炫技的小学生之外正经人谁会这么写代码，正常还是要像下面这样：

```ruby
global_name = 'Curly'

3.times do |n|
  local_name = 'Moe'
  ok = "fine"
  puts "#{n} Hi, #{local_name}, #{ok}!"
end
```

第三个细节是：`{}` 和 `do...end` 在绝大多数情况下都可以互换，但 `do` 和 `end` 的结合不像 `{}` 那样紧密。看一下这个例子：

```ruby
a = [1, 2, 3]

puts a.select { |n| n.even? } # 2

puts a.select do |n|
  n.even?
end  # #<Enumerator:0x00007ca886764ed0>
```

第二个结果合理的解释是 Ruby 认为 `a.select` 是传递给 `puts` 方法的参数，而 `do...end` 是附加到 `puts` 的块，`puts` 不接受块，所以块被忽略，而 `a.select` 的输出是一个 Enumerator。

## 3. 常见的 Enumerable 方法

像 `each` 这样重复调用代码块的方法被称为**迭代器 (Iterator)**，因为它们迭代集合中的对象。

Array 和 Hash 中使用的迭代器方法都来自 **Enumerable** 模块，课程里讲解了以下几个：

- `select` (== `find_all`)
- `reject`
- `any?`
- `detect` (返回第一个满足条件的选项)
- `partition` (即 `select` 和 `reject` 的结果组成的二维数组)
- `map` (== `collect`)
- `reduce` (== `inject`)
- `max_by`
- `min_by`

并强调了 Enumerable 模块非常值得花时间探索和研究：[https://docs.ruby-lang.org/en/master/Enumerable.html](https://docs.ruby-lang.org/en/master/Enumerable.html)．

## 4. Block 背后的秘密

Block 是很多年轻人包括我第一次接触 Ruby 时觉得很神奇的一件事，但理解它其实只需要理解一个关键字：`yeild`。 `yield` 的规则是“**Ruby 方法在执行过程中遇到 `yield` 会暂停执行，转而去执行方法的 block；如果给 `yield` 传递了参数，那么这些参数会被传递给块，块的返回值作为 `yield` 的返回值，块执行完毕之后，方法会继续从 `yield` 结束的地方执行**”。

除了上述规则之外，还有一些值得注意的是：

- 如果方法定义中使用了 `yield` 但是在调用时没有给方法传递块，那么会报错 `LocalJumpError`
- 如果方法定义没有使用 `yield` 而调用时给方法传递了块，则块会被忽略
- 是否给方法传递了块可以用 `block_given?` 方法来判断
- 块对于传递给自己的参数数量相当宽容：如果 `yield` 传递的参数数量少于块需要的，那么没有得到值的参数都被赋值为 *nil*；而多于块需要的参数会被丢弃

理解了这些，就不难重写 Ruby 的 `each` 方法：

```ruby
class Array
  def my_each
    i = 0
    while i < self.size
      yield self[i]
      i += 1
    end
    self # 返回 self 以供链式调用
  end
end

[1,2,3].my_each { |x| puts x }
```

`yield` 还可以被多次调用：

```ruby
def twice
  yield 1
  yield 2
end

twice { |x| puts x }
```

## 5. 编写自己的 Iterator

作为一般的经验法则：**只要你有一个充当其它对象集合的类，那么最好给这个类定义一个 `each` 方法**。试问有哪个 Ruby 程序员看到 **posts** 对象不想做个 `posts.each` 或 `posts.select` 之类的操作？

举一个更现实的例子，假设有一个 *Playlist* 类，它包括很多*歌曲 (song)*：

```ruby
class Song
  attr_reader :name, :artist, :duration

  def initialize(name, artist, duration)
    @name = name
    @artist = artist
    @duration = duration
  end

  def play
    puts "Playing '#{name}' by #{artist} (#{duration} mins)..."
  end
end

class Playlist
  def initialize(name)
    @name = name
    @songs = []
  end

  def add_song(song)
    @songs << song
  end

  def play_songs
    each { |song| song.play }
  end
end
```

如果想要迭代 Playlist 对象中的歌曲，当然可以使用 `playlist.songs.each`，但如果能够直接使用 `playlist.each` 岂不是“优雅他妈给优雅开门 - 优雅到家了”？🤣

这就需要我们给 Playlist 实现一个 `each` 方法：

```ruby
class Playlist
  # ...

  def each
    @songs.each { |song| yield song }
  end
end
```

如果一个对象能用 `each` 方法，又怎么可能让人相信它不支持 `map`、`select`、`reduce` 这些方法呢？难道我们要把所有 **Enumerable** 模块的方法都给 Playlist 类实现一遍吗？

并非如此，如果一个类**实现了 `each` 方法**，并且 **mixin (即 `include Enumerable`) 了 Enumerable 模块**，那么这个类的对象就可以自动使用 Enumerable 模块中的所有方法！

所以我们只需要添加 `include Enumerable` 到 Playlist 类即可：

```ruby
class Playlist
  include Enumerable

  # ...
end

song1 = Song.new("Okie From Muskogee", "Merle", 5)
song2 = Song.new("Ramblin' Man", "Hank", 7)
song3 = Song.new("Good Hearted Woman", "Waylon", 6)
playlist = Playlist.new("HipHop")
playlist.add_song(song1)
playlist.add_song(song2)
playlist.add_song(song3)

playlist.reject { |song| song.name =~ /Okie/ }
```

我们甚至还可以定义自己的 Enumerable 模块然后 *mixin* 到 Playlist 类。因为 Playlist 已经定义了 `each` 方法，我们只需要在自定义模块中使用它：

```ruby
# 定义自己的 Enumerable
module MyEnumerable
  def my_map
    new_array = []

    each do |v|
      new_array << yield(v)
    end

    new_array
  end

  def my_detect
    each do |v|
      return v if yield(v)
    end
    nil
  end

  def my_reduce(initial_value)
    sum = initial_value

    each do |value|
      sum = yield(sum, value)
    end

    sum
  end
end

# 用它
class Playlist
  include MyEnumerable

  # ...
end

playlist.my_reduce(0) { |sum, song| sum + song.duration }
playlist.my_detect { |song| song.artist == "Hank" }
```

## 6. Block 的常用模式

这是我觉得有价值的地方。

### 6.1 Execute Around

有时候我们通常需要在其它样板代码的“中间”执行一些自定义的代码块，这种技术被称为 **Execute Around**，因为块的前后都是样板代码。

假设要测量一个程序的执行时间，我们可能会写这种代码：

```ruby
start_time = Time.now

# run some code
sleep(1)

elapsed_time = Time.now - start_time
puts "It took #{elapsed_time} seconds"
```

这里我们可以用任何需要被测量的程序取代 `sleep(1)`，但我们总是会重复书写另外三行代码。使用 Execute Around 技术：

```ruby
def time_it(label)
  start_time = Time.now
  yield
  elapsed_time = Time.now - start_time
  puts "It took #{elapsed_time} seconds"
end

time_it("Sleepy code") { sleep(1) }
```

事实上，这里我们实现的 `time_it` 方法正是 Ruby 标准库中 `Benchmark#realtime` 方法的大致实现方式，参考： [https://docs.ruby-lang.org/en/master/Benchmark.html#method-i-realtime](https://docs.ruby-lang.org/en/master/Benchmark.html#method-i-realtime)

一个更现实的例子是 HTML 标签：

```ruby
def tag(element)
  print "<#{element}>"
  print yield
  print "</#{element}>"
end

# 使用
tag(:ul) do
  tag(:li) { "It sparkles!"}
  tag(:li) { "It shines!"}
  tag(:li) { "It mesmerizes!"}
end 
# <ul><li>It sparkles!</li><li>It shines!</li><li>It mesmerizes!</li></ul>
```

如果 `tag` 方法看起来有点眼熟，Rails 的 `content_tag` 方法正是在这种技术的基础上添加了一些更花哨的功能： [https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)

### 6.2 Toggle Around

有时候我们需要在*特定的上下文*中运行代码：先把程序切换到特定的模式，执行一段代码，再切换回默认模式。

在执行这些类似开关动作的代码时，一来我们总是需要执行“打开开关、执行代码、关闭开关”这些重复性动作，二来关闭操作很有可能会被忘记，这可以使用 **Toggle Around** 模式来解决。下面的例子假设我们总是需要保持开发环境为 `:development`，但也有切换开发环境的需求，届时就需要不停的进行“开关”：

```ruby
class Application
  attr_accessor :environment

  def initialize
    @environment = :development
  end

  def connect_to_database
    puts "Connecting to #{environment} database..."
  end

  def handle_request
    puts "Handling #{environment} request..."
  end

  def write_to_log
    puts "Writing to #{environment} log file..."
  end

  # 定义一个 Toggle Around 模式的方法
  def in_environment(new_env)
    old_env = @environment
    @environment = new_env
    yield
  rescue Exception => e
    puts e.message
  ensure
    @environment = old_env
    puts "Reset environment to #{@environment}"
  end
end

app = Application.new

# 不使用 Toggle Around
app.environment = :production
app.connect_to_database
app.handle_request
app.write_to_log
app.environment = :development # 这一步很容易被忘记

# 使用 Toggle Around
app.in_environment(:test) do
  app.connect_to_database
  app.handle_request
  app.write_to_log
end
```

另一个比较有用的例子是“捕获代码输出”：

```ruby
def capture_output
  begin
    old_output = $stdout
    $stdout = StringIO.new
    yield
    result = $stdout.string
  ensure
    $stdout = old_output
  end

  result
end

# 使用
output = capture_output do
  puts "Hello!"
  puts "Goodbye..."
end

puts output
```

一些更实际的例子是：

```ruby
# 1. Rake 使用这种方式忽略弃用警告
def ignore_deprecations
  Rake.application.options.ignore_deprecate = true
  yield
ensure
  Rake.application.options.ignore_deprecate = false
end

# 2. Ruby 的 verbose 模式
def silence_warnings
  $VERBOSE, v = false, $VERBOSE
  yield
ensure
  $VERBOSE = v
end

# 3. Capybara gem 里很多 `using_*` 方法使用了这种技术
# https://github.com/teamcapybara/capybara
def using_driver(driver)
  previous_driver = Capybara.current_driver
  Capybara.current_driver = driver
  yield
ensure
  @current_driver = previous_driver
end

# 4. 这种技术还通常用在测试工具中，以设置运行测试的特定上下文
# 如 Rails 的 with_locale()、travel_to() 方法

# 5. Money gem 用来设置货币的测试
# https://github.com/RubyMoney/money
```

这种模式其实是 **Execute Around** 的变体。

### 6.3 Block Initializer

**Block Initializer** 模式也被称为 **Self Yield**，顾名思义，它在初始化对象的时候提供合理的默认值，但也接受 Block 以供自定义值。

```ruby
class Canvas
  attr_accessor :width, :height, :color

  def initialize
    @width = 100
    @height = 100
    @color = :black
    yield self if block_given? # 这里
  end

  def to_s = "#{width}x#{height} #{color} canvas"
end

# 传统方式
canvas = Canvas.new
canvas.width = 250
canvas.height = 500
canvas.color = :blue
puts canvas

# Block Initializer
canvas = Canvas.new do |c|
  c.width = 800
  c.height = 600
end
puts canvas
```

一些更实际的例子是：

```ruby
# 1. Rails ActiveRecord 模型可以使用块进行初始化
user = User.new do |u|
  u.name = "Larry"
  u.email = "larry@example.com"
end

# 2. Rake 使用块来初始化不同类型的 task
Rake::TestTask.new do |t|
  t.libs << "test"
  t.test_files = FileList['test/test*.rb']
  t.verbose = true
end

Rake::PackageTask.new("rake", "1.2.3") do |p|
  p.need_tar = true
  p.package_files.include("lib/**/*.rb")
end

# 3. Ruby 标准库的 OptionParser 类使用块进行初始化
OptionParser.new do |opts|
  opts.banner = "Usage: example.rb [options]"
  opts.separator ""

  opts.on("-v", "--[no-]verbose", "Run verbosely") do |v|
    options[:verbose] = v
  end
end

# 4. Faraday HTTP 客户端中使用 URL 和块初始化 http 连接
# https://github.com/lostisland/faraday
conn = Faraday.new("https://example.com") do |faraday|
  faraday.params["q"] = "ruby"
  # ...
end

# 5. Ruby Gem 规范的初始化
Gem::Specification.new do |s|
  s.name    = 'my-gem'
  s.version = '1.0.0'
end
```

这种模式的使用更多的是一个设计美学的问题。

### 6.4 Manage Resources

在处理昂贵或有限的资源，如文件、网络连接、数据库连接等问题时，与其把负担交给程序员，使用块让这些资源管理自己的生命周期显然是更明智的做法。这是 **Manage Resources** 模式的用武之地。

课程里有两个例子值得注意，细节已注释：

```ruby
def self.open(user, password)
  dbdriver = self.new(user, password)
  dbdriver.connect

  return dbdriver unless block_given? # 1. 在不提供块的情况下也能使用方法

  # 2. 这里的 begin 关键字很重要，如果没有 begin，那么方法的 def self.open
  # 部分会被认为是 "begin"，这种情况下如果 self.new 出错，那么 ensure 会试图
  # 关闭一个没有打开的连接
  # 在此处显式使用 begin 使得 rescue 和 ensure 都只会在 begin 被调用之后
  # 才会作用；而 begin 调用之前的错误要视情况而定，本例中 begin 之前没有相关
  # 的错误处理，所以只会导致方法终止，程序退出
  begin
    yield(dbdriver)
  rescue Exception => e
    puts e.message
  ensure
    dbdriver.disconnect
  end
end
```

另一个是 `File.open` 可能的实现方式中需要注意的：

```ruby
class File
  def self.my_open(filename, mode)
    file = self.new(filename, mode)
    return file unless block_given?

    # 注意这里没有使用 rescue，如果 begin 内报错，那么错误会向
    # 上传播到调用这个方法的地方，那里是更好的处理这个错误的地方
    begin
      yield(file)
    ensure
      file.close
    end
  end
end
```

一些更实际的例子是：

```ruby
# 1. Ruby 的 Timeout.timeout，超时会引起 Timeout::Error 异常
Timeout.timeout(2.0) do
  sleep 1.0
  puts "That was refreshing..."
end

# 2. Rake 的 FTPUploader 类的 connect 方法：使用完毕之后关闭连接
def self.connect(path, host, account, password)
  up = self.new(path, host, account, password)
  begin
    yield(up)
  ensure
    up.close
  end
end

# 3. Ruby Net::HTTP 类的 start 方法
def start
  if block_given?
    begin
      do_start
      return yield(slef)
    ensure
      do_finish
    end
  end

  do_start
  self
end
```

## 7. 总结

Block 的这些常用模式在代码中非常常见，也不难理解。但之所以似乎有点神秘、令人望而生畏，我个人觉得自己有三点没做好的地方：

1. 日常开发中习惯了调用“别人封装好这些模式的方法”，而不是写“自己的使用这些模式的方法"
2. 没有过系统性的总结，不会下意识地去想“这个 Block 的用法和那个 Block 的用法貌似类似”
3. 即使发现了一些用法的相似性，也不会给它们起一个这么专业的名字
  
而一旦捅破了那层窗户纸，一切光环也就消失了。所以还是要站在巨人的肩膀上。

但首先要努力寻找“巨人”。