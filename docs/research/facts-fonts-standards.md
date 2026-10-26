# 事实核验：中文字体授权与排版标准

- 核验日期：2026-10-25
- 核验方式：只读官方来源，包括官网授权页、官方仓库的 LICENSE、官方 FAQ 和标准化机构官网。不采信第三方博客和字体下载站。
- 档位定义沿用 PRD：🟢 可嵌入（可以作为 webfont 自托管，可以用在商用图片上）／🟡 只能调用系统字体／🔴 商用授权。
- 状态说明：「已核验」表示结论直接来自官方原文。「待确认」表示官方原文没有覆盖这一点，或者原文本次没有取到。「原文未明确」只照实记录，不做推断。

---

## 第 1 部分：中文字体授权

### 1.1 总表

| 字体 | license | 可自托管 webfont | 可用于商用图片 | 可修改／子集化 | 需署名 | 建议档位 | 来源 URL | 核验状态 | 核验日期 |
|---|---|---|---|---|---|---|---|---|---|
| 思源黑体 Source Han Sans | SIL OFL 1.1，保留字体名（RFN）为「Source」 | 可以（OFL 允许捆绑、嵌入、再分发） | 可以（OFL FAQ 1.1、1.13：用该字体制作的作品不受 OFL 约束） | 可以；但子集化属于修改（OFL FAQ 2.6），子集化后的字体不能再用「Source」作为字体名，需要改名 | 再分发字体文件时要附版权声明和 OFL 全文，可以写在 metadata 字段里；用在图片上不需要署名 | 🟢 | https://github.com/adobe-fonts/source-han-sans/blob/master/LICENSE.txt ；https://openfontlicense.org/ofl-faq/ | 已核验 | 2026-10-25 |
| 思源宋体 Source Han Serif | 同上（OFL 1.1，RFN「Source」） | 可以 | 可以 | 同上，子集化后需改名 | 同上 | 🟢 | https://github.com/adobe-fonts/source-han-serif/blob/master/LICENSE.txt | 已核验 | 2026-10-25 |
| Noto Sans CJK／Noto Serif CJK | SIL OFL 1.1，LICENSE 文件里没有保留字体名 | 可以 | 可以 | 可以；没有 RFN，子集化后不用改名 | 再分发字体文件时附 OFL 全文 | 🟢（在 OFL 系里改名负担最小） | https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE ；https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE | 已核验 | 2026-10-25 |
| 霞鹜文楷 LXGW WenKai | SIL OFL 1.1；RFN 为「霞鹜／霞鶩／落霞孤鹜／落霞孤鶩／LXGW」，另附额外许可 | 可以。额外许可规定：只为网页渲染做子集化或转 WOFF/WOFF2，并且不作为可安装的桌面字体提供下载时，可以保留原名。原文举的平台是 Google Fonts、作者认可的公益平台，并写明「其他平台请联系作者确认」。在自己网站上自托管算不算在内：原文未明确 | 可以 | 可以；改造后的衍生字体不能使用上述保留名，网页子集化例外 | 再分发字体文件时附 OFL.txt；README 写明不需要告知作者 | 🟢（自托管子集建议改名，或向作者确认） | https://github.com/lxgw/LxgwWenKai/blob/main/OFL.txt ；https://github.com/lxgw/LxgwWenKai/blob/main/README.md | 已核验（RFN 例外是否覆盖自托管：待确认） | 2026-10-25 |
| 得意黑 Smiley Sans | SIL OFL 1.1，RFN 为「Smiley」「得意黑」 | 可以；官方仓库直接提供 `.woff2`，README 说明「供网站开发人员使用」 | 可以 | 可以；子集化后不能叫「Smiley／得意黑」，需要改名 | 再分发字体文件时附 OFL 全文 | 🟢（子集需改名） | https://github.com/atelier-anchor/smiley-sans/blob/main/LICENSE ；https://github.com/atelier-anchor/smiley-sans/blob/main/README.md | 已核验 | 2026-10-25 |
| 站酷快乐体／站酷小薇 LOGO 体／站酷庆科黄油体（Google Fonts 收录版：ZCOOL KuaiLe／ZCOOL XiaoWei／ZCOOL QingKe HuangYou） | SIL OFL 1.1，三款都没有 RFN | 可以（仅限 Google Fonts 收录的 OFL 版本） | 可以 | 可以 | 再分发字体文件时附 OFL 全文 | 🟢（只认 google/fonts 里的 OFL 版本） | https://github.com/google/fonts/tree/main/ofl/zcoolkuaile ；…/ofl/zcoolxiaowei ；…/ofl/zcoolqingkehuangyou ；站酷官方字库页 https://www.zcool.com.cn/special/zcoolfonts/ | 已核验（OFL 版）。站酷官网下载的版本是否同样适用 OFL：原文未明确，待确认 | 2026-10-25 |
| 站酷高端黑（以及站酷酷黑体、站酷文艺体、站酷仓耳渔阳体等只在站酷官网发布的免费字体） | 站酷官网只有一句话：「免费授权全社会使用（包括商用）」。完整条款在下载包里的《站酷高端黑（修订版）使用声明.txt》，本次没有读到 | 原文未明确 | 字库页写的是「包括商用」。但素材页的授权选项里列有「电商平台（不得用于商品包装，外观及标识等）」，这条是否适用于免费字体：原文未明确 | 原文未明确 | 原文未明确 | unknown | https://www.zcool.com.cn/special/zcoolfonts/ ；https://www.zcool.com.cn/assets/ZNTY0OA==.html | 待确认（需要读下载包里的使用声明 .txt） | 2026-10-25 |
| 阿里巴巴普惠体 3.0 | 《阿里巴巴普惠体 3.0 版法律声明》，自定义许可：免费、普通许可，可用于商业或非商业用途 | 自托管不可以。声明规定，未经书面授权不得对字体进行「仿制、转换、翻译……拆分」，转 WOFF2、子集化都在范围内；也不得「转授权」。官网提供自家 CDN（fonts.alibabadesign.com）的 `<link>` 引用代码，但法律声明本身没有写到 CDN 引用（原文未明确） | 可以（「可基于合法目的用于商业用途」） | 不可以（转换、拆分需要书面授权） | 不需要署名；但不得删除或修改法律声明 | unknown（图片可以商用，自托管 webfont 不满足 🟢，见开放决策 D1） | https://www.yuque.com/yiguang-wkqc2/hgpff0/nus9wiinq4aeiegy（官网 fonts.alibabagroup.com「法律声明」按钮链接到这里，内容更新于 2023-05-31）；https://fonts.alibabagroup.com/ | 已核验 | 2026-10-25 |
| HarmonyOS Sans | 《HarmonyOS Sans Fonts License Agreement》，自定义、可撤销 | 原文未明确。许可允许把**未修改**的字体随「任何软件（字体软件除外）」嵌入、捆绑、再分发，但没有说网站算不算 software；子集化属于修改，被禁止 | 可以（原文：可以自由分发或出售用它制作的 materials、logos、application software） | 不可以（「may not make any modifications」） | 需要。「shall make a prominent notice in the software」，即在软件中显著声明使用了该字体 | unknown（图片可以；子集 webfont 被禁止，见 D1） | https://github.com/openharmony/global_system_resources/blob/master/LICENSE_Fonts （OpenHarmony 官方仓库，文件最后提交于 2022-03-25）；下载页 https://developer.huawei.com/consumer/cn/design/resource/ | 已核验（OpenHarmony 仓库版本）。华为开发者官网 2026/06 版 ZIP 内附的协议是否有更新：待确认 | 2026-10-25 |
| MiSans | 《MiSans 字体知识产权许可协议》，自定义、可撤销 | 原文未明确，且有冲突：FAQ 说「可以用作嵌入式字体，但应在软件中特别注明」；协议又写「不得……进一步分发字体软件或其任何副本」，自托管 webfont 等于向访客分发副本 | 可以（协议原文：用它创作的「宣传素材、logo、应用 App 等，您有权分发或出售」） | 不可以（「不得……进行改编或二次开发」）。FAQ 说可以在软件中调节粗细、间距，但不得改外观 | 需要（「您应在软件中特别注明使用了 MiSans 字体」） | unknown（见 D1） | https://hyperos.mi.com/font/zh/download/（页面内附协议全文）；https://hyperos.mi.com/font/zh/faq | 已核验 | 2026-10-25 |
| OPPO Sans 4.0 | OPPO 官方使用条款，免费，包括商用，版权归 OPPO 广东移动通信有限公司 | 原文未明确，风险高：条款写着「不向他方提供其他下载渠道」，自托管字体文件可能被认定为提供了下载渠道 | 可以（「允许个人或企业免费使用，含商业用途」） | 不可以（「不对字体进行改编或二次开发」）；子集化是否算改编：原文未明确 | 原文未要求 | unknown（见 D1） | https://www.coloros.com/article/A00000074/（2024-11-26）；https://open.oppomobile.com/new/developmentDoc/info?id=13223（页面靠 JS 渲染，本次没有取到正文） | 已核验（以 coloros.com 为准） | 2026-10-25 |
| 苹方 PingFang | macOS 软件许可协议（Apple SLA，macOS Tahoe 26 版）§2E Fonts | 不可以。SLA 只允许「在运行 Apple 软件时」显示和打印；嵌入受字体内置的 embedding 限制约束；§2J 禁止在非 Apple 品牌计算机上安装、使用 Apple 软件 | 原文未明确。§2E 只说可以在运行 Apple 软件时显示、打印内容，没有写非商用限制；同一份协议对 System Voices 写明了「personal, non-commercial」，字体条款里没有这句话 | 不可以（SLA 不授予修改或转换权） | 不需要 | 🟡（只能在 Apple 设备上作为 CSS 字体栈的系统字体调用） | https://www.apple.com/legal/sla/docs/macOSTahoe.pdf（§2E、§2J） | 已核验 | 2026-10-25 |
| 微软雅黑 Microsoft YaHei | 随 Windows 提供的系统字体，按 Windows 许可使用。版权：© Microsoft Corporation，部分 © 北京北大方正电子有限公司；字体厂商（vendor）登记为 Microsoft Corp.，字形由微软从方正授权 | 不可以。微软 FAQ 原文：无权把字体从 Windows 拷到服务器自托管，也无权转成 WOFF/WOFF2。写进 CSS 字体栈可以，因为「使用」发生在访客的 Windows 设备上 | 可以（FAQ：海报、广告、logo、截图等图形文件视同打印输出，不限制商用；只有家庭版、学生版、非商用授权的应用除外） | 不可以（FAQ：不得转换格式或修改） | 不需要 | 🟡 | https://learn.microsoft.com/en-us/typography/font-list/microsoft-yahei ；https://learn.microsoft.com/en-us/typography/fonts/font-faq | 已核验。在 Windows 之外使用：FAQ 规定不得拷到其他计算机；随 Office（含 Mac 版 Office 云字体）提供的副本受 Office 许可约束，原文未明确，待确认 | 2026-10-25 |
| 方正字库（不含下面这一行的「免费字体」） | 方正自定义许可：个人非商业用《方正字库家庭版用户许可协议》，商用另行购买 | 不可以，需要单独的「内置使用」（嵌入式）授权。官网把「直接或格式转换后以嵌入的方式应用到网站」定义为内置使用，标准报价不含这一项 | 需要购买授权。按单一设计稿计，每款字体每年：基础字体 0.15 万元，精选字体 0.45 万元；全媒体 0.7 万元 | 不可以，需要书面授权 | — | 🔴 | https://www.foundertype.com/index.php/About/powerbus.html ；https://www.foundertype.com/index.php/About/powerPer.html ；https://www.foundertype.com/index.php/About/aboutUsBus.html | 已核验 | 2026-10-25 |
| 方正「免费字体」：方正黑体、方正书宋、方正仿宋、方正楷体、方正甲骨文 | 官网原文：针对「发布使用」这种使用方式免费 | 不可以。免费范围只覆盖「发布使用」，「内置使用」（嵌入网站）仍要授权 | 可以（发布使用免费）。需不需要申请授权书：原文未明确 | 原文未明确；家庭版协议禁止未经授权修改 | 原文未明确 | unknown（图片可以，webfont 🔴，见 D1） | https://www.foundertype.com/index.php/About/powerbus.html | 已核验（是否需要申请授权书：待确认） | 2026-10-25 |
| 汉仪字库 | 汉仪自定义许可：个人非商用免费，但必须**注册账号**，按《汉仪字库个人非商用许可协议》使用；任何商业使用都要事先取得书面许可 | 不可以。H5 页面、小程序、App 都归入「嵌入式授权」，需要另外购买 | 需要购买授权。单一设计稿每款字体每年：基础字库 0.15 万元，精选字库 0.4 万元（官网 FAQ） | 不可以（FAQ：修改、改编需要版权人同意） | — | 🔴（例外：贤二体，官网 FAQ 写「商用是全免费的」，版权归龙泉寺动漫中心，webfont 条款原文未明确） | https://www.hanyi.com.cn/license ；https://www.hanyi.com.cn/faq ；https://www.hanyi.com.cn/faq-doc-1 | 已核验 | 2026-10-25 |

### 1.2 原文要点摘录（用于复核）

**OFL 1.1 的共性规则**（适用于思源、Noto CJK、霞鹜文楷、得意黑、ZCOOL 的 OFL 版）。来源：https://openfontlicense.org/ofl-faq/

- FAQ 2.6：子集化属于修改，通常不能继续使用保留字体名（RFN）。
- FAQ 2.2.1：字体数据不变、只转成 WOFF 时，可以不改名。
- FAQ 1.1、1.13：可以用于任何设计工作，作品本身不受 OFL 约束。
- 产品影响：自托管时，有 RFN 的字体（思源的「Source」、霞鹜的「霞鹜/LXGW」、得意黑的「Smiley/得意黑」）做子集化后，要改掉字体内部的 name 表。Noto CJK 没有 RFN，不受这条限制。

**阿里巴巴普惠体 3.0 法律声明。** 通过语雀公开 API 取得原文，内容更新于 2023-05-31。

- 授权条款原文：「该授权是免费的普通许可，用户可基于合法目的用于商业用途或非商业用途」。
- 禁止条款原文：「未经阿里巴巴书面授权，任何人不得：1）对阿里巴巴字体进行仿制、转换、翻译、反编译、反向工程、拆分、破解……3）……单独定价出售、出租、出借、转让、转授权」。

**HarmonyOS Sans。** 来源：OpenHarmony 仓库中的 LICENSE_Fonts。

- 原文：「use, copy, merge, embed, bundle, redistribute and/or sell unmodified copies … with any software except for fonts software」。
- 限制条件：「prominent notice in the software」；「may not make any modifications」；「revocable」。

**MiSans。** 来源：hyperos.mi.com 下载页内嵌的协议。

- 授权性质：「不可转让的、非独占的、免版税的、可撤销的、全球性的版权许可」。
- 三项条件：「应在软件中特别注明使用了 MiSans 字体」；「不得……改编或二次开发」；「不得单独……进一步分发字体软件或其任何副本」。

**OPPO Sans。** 来源：coloros.com，2024-11-26。

- 授权原文：「允许个人或企业免费使用，含商业用途」。
- 四项禁止：「不对字体进行改编或二次开发；不对外售卖字体；不向他方提供其他下载渠道；不用于违法用途」。

**Apple SLA（macOS Tahoe 26）。**

- §2E 原文：「you may use the fonts included with the Apple Software to display and print content while running the Apple Software; however, you may only embed fonts in content if that is permitted by the embedding restrictions」。
- §2J 原文：「not … install, use or run the Apple Software on any non-Apple-branded computer」。

**微软 Font redistribution FAQ。** 页面更新于 2024-11-19。

- 原文：「You do not have rights to: copy fonts from a Windows installation to a web server … convert the font to … WOFF or WOFF2」。
- 原文：「We view creating graphic files as being essentially the same as printing」。

**方正。**

- 把字体使用分成内部使用、内置使用、发布使用三类。
- 「免费字体」共五种，只对「发布使用」免费。
- 第 7 条注释：标准报价不包括以嵌入方式用到网站、程序中的情况。

**汉仪。**

- 原文：「汉仪字库的商业使用授权（除个人非商用以外的任何使用方式之授权）均需事先获得汉仪公司的书面许可」。
- 个人非商用：「在您完成注册并遵守《汉仪字库个人非商用许可协议》之前提下……免收许可使用费的普通许可」。

### 1.3 开放决策清单（需要拍板）

1. **D1：要不要新增一档。** 阿里巴巴普惠体、HarmonyOS Sans、MiSans、OPPO Sans、方正免费字体有一个共同点：做商用图片没问题，但不能（或原文没说能）自托管子集 webfont。现有三档都放不下它们。可选方案：
   - (a) 新增一档，如「🔵 仅图片／原样引用」；
   - (b) 一律归入 🔴；
   - (c) 一律标 unknown。
2. **D2：RFN 字体自托管时怎么处理。** 适用于思源、霞鹜、得意黑。可选方案：
   - (a) skill 生成子集时强制改写 name 表；
   - (b) 只推荐没有 RFN 的 Noto CJK 做 webfont；
   - (c) 霞鹜文楷向作者 @lxgw 书面确认自托管是否适用例外。
3. **D3：站酷系列以哪个版本为准。** 是只收录 google/fonts 中有 OFL 原文的三款，还是去读站酷下载包里的使用声明 .txt，再决定高端黑、酷黑、文艺体的档位。读 .txt 要下载 ZIP，需要授权执行。
4. **D4：HarmonyOS Sans 协议要不要复核。** 是否下载华为开发者官网 2026/06 版 ZIP（约 21.6 MB），核对内附协议有没有更新。本次没有下载。

---

## 第 2 部分：标准与规范

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| W3C《中文排版需求》clreq 的文档许可证 | 页脚写「W3C® liability, trademark and **permissive document license** rules apply」，链接指向《W3C Software and Document License（2023 版）》。GitHub 仓库 w3c/clreq 的 LICENCE.md 同样声明使用 W3C Software and Document license。当前版本：W3C Group Note Draft，2026-10-07（https://www.w3.org/TR/2026/DNOTE-clreq-20261007/） | https://www.w3.org/TR/clreq/ ；https://www.w3.org/copyright/software-license-2023/ ；https://github.com/w3c/clreq/blob/gh-pages/LICENCE.md | 已核验 |
| clreq 能否引用、改写、再分发 | 可以。许可原文写的是「Permission to copy, modify, and distribute this work, with or without modification, for any purpose」，不收费。条件有三条：(1) 在再分发或衍生作品中，用户能看到的位置要放许可 NOTICE 全文；(2) 保留原有声明，没有的话放 W3C short notice；(3) 修改处要加版权说明，指向原 W3C 文档并链接到许可。产品影响：skill 规则可以改写 clreq 内容，但仓库要放 NOTICE，改写处要标出处 | https://www.w3.org/copyright/software-license-2023/ | 已核验 |
| GB/T 15834-2011《标点符号用法》状态 | **现行**。发布 2011-12-30，实施 2012-06-01，主管和归口都是教育部（语言）。**有修订计划在途**：计划号 20240034-T-360，修订，全部代替 GB/T 15834-2011；下达日期 2024-03-25，项目周期 12 个月，起草单位商务印书馆有限公司，归口 TC500 全国语言文字标准化技术委员会；当前状态显示为「**暂缓**」。到 2026-10-25 为止没有新版发布 | https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=22EA6D162E4110E752259661E1A0D0A8 ；https://std.samr.gov.cn/gb/search/gbDetailed?id=14CA9D282E0A5AC8E06397BE0A0AEA2E | 已核验（「暂缓」的具体含义和恢复时间：原文未明确） |
| GB/T 15835-2011《出版物上数字用法》状态 | **现行**。发布 2011-07-29，实施 2011-11-01，主管和归口都是教育部（语言）。全国标准信息公共服务平台检索不到修订计划；上一版 GB/T 15835-1995 已废止 | https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=F5DAC3377DA99C8D78AE66735B6359C7 ；https://std.samr.gov.cn/search/stdPage?q=出版物上数字用法 | 已核验 |

---

## 附：本次没有覆盖或没有取到的内容

- 站酷高端黑等字体的下载包内《使用声明.txt》：需要下载 ZIP，本次没有执行，属于 D3。
- 华为开发者官网 HarmonyOS Sans ZIP 内附的协议：本次没有下载，属于 D4。
- OPPO 开放平台页面 open.oppomobile.com 靠 JS 渲染，本次没有取到正文；以同为 OPPO 官方的 coloros.com 文章为准。
- 方正「免费字体」是否需要申请授权书：官网授权页没有写，待确认。
