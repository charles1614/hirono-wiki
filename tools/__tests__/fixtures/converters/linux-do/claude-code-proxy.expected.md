# Claude code 平权计划 - 接入api+key+model 直接使用

> 原文链接: https://linux.do/t/topic/762693
> 主题元信息: 共 163 楼 · 4199 浏览 · 132 点赞 · 标签 人工智能
> *只归档了前 50/163 楼。*

---

## #1 @Ling_Anthony (Tingxifa) · 2025-07-03

现在、立刻、马上
大家一起用 - claude code

> 🔗 github.com — https://github.com/tingxifa/claude\_proxy

# Claude Code 代理配置工具

[![Shell Script](linuxdo-img-001.svg)](https://www.gnu.org/software/bash/)
![License](linuxdo-img-002.svg)

> :rocket: 一键配置 Claude Code 命令行工具，通过代理服务访问大语言模型

## :clipboard: 功能特性

-   :white\_check\_mark: **自动安装检查** - 检查并安装 Claude Code 工具
-   :gear: **智能配置** - 自动配置 `~/.claude/settings.json` 文件
-   :wrench: **多种更新方式** - 支持 `jq` 或 `python3` 更新 JSON 配置
-   :floppy\_disk: **安全备份** - 更新前自动备份原配置文件
-   :globe\_with\_meridians: **代理支持** - 设置代理 API 地址和密钥

## :hammer\_and\_wrench: 系统要求

-   **Node.js** 和 **npm** (用于安装 Claude Code)
-   **Bash** 环境
-   **jq** 或 **python3** (可选，用于 JSON 处理)

## :rocket: 快速开始

### 1\. 配置参数

打开脚本文件 `claude_proxy.sh`，找到 **“重点: 需要替换的内容”** 部分，修改以下变量(按实例的格式填入)：

```bash
# 🔑 API 密钥
API_KEY="your_api_key_here"

# 🌐 代理服务地址
OPEN_AI_URL=""

# 🤖 模型名称
OPEN_MODEL=""
```

### 2\. 运行脚本

```bash
# 添加执行权限
chmod +x claude_proxy.sh

# 运行脚本
./claude_proxy.sh
```

### 3\. 开始使用

配置完成后，即可在命令行中使用 Claude：

```bash
claude "Hello, world!"
```

## :file\_folder: 文件结构

```auto
~/.claude/
├── settings.json           # 主配置文件
└── settings.json.backup    # 自动备份文件
```

## :gear: 配置说明

| 参数  | 说明  | 示例  |
| --- | --- | --- |
| `API_KEY` | 你的 API 密钥 | `sk-xxx...` |
| `OPEN_AI_URL` | 代理服务地址 | `tbai.xin/v1` |
| `OPEN_MODEL` | 使用的模型名称 | `gemini-1.5-pro` |

## :wrench: 工作原理

1.  **检查环境** - 验证必要的依赖是否安装
2.  **安装工具** - 如果未安装，自动安装 Claude Code
3.  **备份配置** - 保存现有配置文件
4.  **更新设置** - 使用 JSON 处理工具更新配置
5.  **验证完成** - 确认配置更新成功

## :warning: 注意事项

-   :memo: 请确保 API 密钥的安全性，不要在公共仓库中暴露
-   :counterclockwise\_arrows\_button: 脚本会修改 `~/.claude/settings.json` 文件
-   :floppy\_disk: 每次运行都会创建配置文件的备份
-   :globe\_with\_meridians: 确保代理服务地址可以正常访问

## #2 @Ling_Anthony (Tingxifa) · 2025-07-03

上一个帖子：[平平无奇- TBAI\_claude code 实现自由](https://linux.do/t/topic/761806)

## #3 @dboo · 2025-07-03

谢谢，马上试试

## #4 @Ling_Anthony (Tingxifa) · 2025-07-03

gemini-balance 也可用，理论上都可用.. 不能用的话就提单子哈，我到时候看看

## #5 @waffie · 2025-07-03

这是用别的模型吧，效果可能没这么好

## #6 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #5)

用 gemini 还可以啊

## #7 @Cris_37 · 2025-07-03

收藏点赞

## #8 @aigem (ai来事) · 2025-07-03

> *@Tingxifa 引用：*
>
> 现在、立刻、马上
> 大家一起用 - claude code

有好用的公益 api 推荐？

## #9 @changgeng (leon) · 2025-07-03

mark一下

## #10 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #8)

@tbphp 的 公益api

## #11 @tbphp (唐洛) · 2025-07-03

这个跟 Claude Code Router差不多的功能吗？

## #12 @zhangkun (蜻蜓队长) · 2025-07-03

佬，太稳了

## #13 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #11)

> *引用：*
>
> Claude Code Router

那还是比不上他的， 这个功能比较简单， 操作更快捷， 适合我这种喜欢简单的人

## #14 @578382239 (南山) · 2025-07-03

感谢大佬

## #15 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #5)

> *@Tingxifa 引用：*
>
> 保 API 密钥的安全性，不要在公共仓库中暴

如果你有 claude 的也可以用呢

## #16 @handsome (大帅哥) · 2025-07-03

感谢大佬 ！

## #17 @sera · 2025-07-03

感觉还不错，就等一个TBAI了www

## #18 @dboo · 2025-07-03

![image](linuxdo-img-003.png)
请问一下这个错误是为什么啊

## #19 @bifang · 2025-07-03

![image](linuxdo-img-004.jpg)
用上了 :tieba\_003:

## #20 @bifang · 2025-07-03 (回复 #18)

不要用默认的地址和key，换成你自己的，包括worker。

## #21 @dboo · 2025-07-03 (回复 #20)

我在 https://tbai.xin/console/token 里面注册，生成了一个新的 Key，地址和 worker 怎么获取啊？

## #22 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #18)

url 和 key 两个应该有一个错的.

## #23 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #21)

\[quote=“Tingxifa, post:1, topic:762693, username:Ling\_Anthony”\]

```auto
worker 可以不用改的
地址就是 tbai.xin/v1
```

## #24 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #19)

好用吧？ 那给我点个星星不？

## #25 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #17)

其他站点也可以的，不一定 tbai

## #26 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #21)

> *@bifang 引用：*
>
> 不要用默认的地址和key，换成你自己的，包括worker。

你这个应该是你没法访问cf 的 worker? 带来开 tun 试试

## #27 @bifang · 2025-07-03 (回复 #24)

已点

![image](linuxdo-img-005.png)
这个统计为啥显示的都是0嘞，用的gemini-2.5，是需要改哪里的配置吗？

## #28 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #27)

因为.. response 没有给相关的 input 和 output.. 或者我没有解析

## #29 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #27)

> *@bifang 引用：*
>
> 这个统计为啥显示的都是0嘞，用的gemini-2.5，是需要改哪里的配置吗？

我没太关注这个.. 可以让 ai 给改改

## #30 @dboo · 2025-07-03

[New API](https://tbai.xin/console/token) 这个是不是要充值啊？

```auto
API Error: 403 {"error":{"message":"user quota is not enough (request id: 20250703134258691415704D64jiHpn)","type":"new_api_error","param":"","code":"insufficient_user_quota"}}
```

## #31 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #30)

> *@dboo 引用：*
>
> `insufficient_user_quota`

确实是提示你余额不足

## #32 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #30)

看一下私信

## #33 @dboo · 2025-07-03 (回复 #32)

谢谢大佬

## #34 @crolin (肉山大魔王) · 2025-07-03

403 错误～

![image](linuxdo-img-006.png)

## #35 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #34)

url按格式填，没有 http 之类的定义

## #36 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #34)

> *@Tingxifa 引用：*
>
> `tbai.xin/v1`

tbai.xin/v1

## #37 @crolin (肉山大魔王) · 2025-07-03 (回复 #36)

> *@Tingxifa 引用：*
>
> tbai.xin/v1

ok
我改下

## #38 @crolin (肉山大魔王) · 2025-07-03 (回复 #36)

好了，话说这么用gemini-2.5-pro 模型的效果，和直接用gemini cli 有什么区别没？

## #39 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #38)

gemini cli 感觉不咋地啊

## #40 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #38)

效果不好，总是断开

## #41 @crolin (肉山大魔王) · 2025-07-03 (回复 #39)

gemini cli 我也用了下，一会就会好笨了

## #42 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #41)

所以还得是用 api

## #43 @ImYourMyth · 2025-07-03 (回复 #6)

gemini和claude比调用工具有点弱，接到claude code里还是有明显差别，不过还是比gemini cli强

## #44 @shixq (Altman) · 2025-07-03 (回复 #6)

> *@Tingxifa 引用：*
>
> 用 gemini 还可以啊

不懂就问，这个意义是什么呢？如果用其他模型比如 Gemini ，跟直接在roo code 用有什么区别吗？

## #45 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #44)

roo code 是个插件， claude code 是个 cli， 你可以随时打开使用

## #46 @shixq (Altman) · 2025-07-03 (回复 #45)

额，是跟 Gemini cli 一样的吗？

## #47 @way_nicholas (xnic) · 2025-07-03

请问这个[https://claude-code-proxy.suixifa.workers.dev](https://claude-code-proxy.suixifa.workers.dev)， 代码有吗，打算部署到自己的worker

## #48 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #46)

建议你都使用一下看看..

## #49 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #47)

github 上有呢， 看看

## #50 @Ling_Anthony (Tingxifa) · 2025-07-03 (回复 #47)

index.ts
