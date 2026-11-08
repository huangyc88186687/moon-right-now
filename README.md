# 此刻的月亮 · The Moon, Right Now

给定任意时刻，把那一刻真实的月亮渲染出来。

月面的明暗交界线不是贴图，也不是预渲染动画：太阳和月球在该时刻的位置由天文历表算出，再照到 NASA 的实测月面模型上。所以天平动、月海边缘随光照角度变化的阴影、新月时暗面那层微弱的地照，都是算出来的，不是画上去的。

在线版本：https://moon-right-now.app.workbuddy.host/?sharecode=YIGSZLEDJN
（链接要带 `sharecode`，裸域名打不开）

源码：https://github.com/huangyc88186687/moon-right-now

## 它算了什么

- **太阳位置**：低精度太阳历表（Astronomical Almanac 级）。
- **月球位置**：Schlyter 低精度月球历表，含 12 项经度摄动、5 项纬度摄动。两个容易踩的坑：该历表历元是 2000 Jan 0.0，比 J2000.0 早 1.5 天，需要 `d + 1.5`；摄动项里的平黄经必须取 `N + w + M` 才能和轨道根数自洽，直接套 218.316° 常数会恒定偏 3.4°。
- **月球姿态**：IAU/WGCCRE 定向参数 α₀、δ₀、W，决定天平动下能多看到一点东侧或西侧。
- **光照**：平行光沿日下点方向入射，暗面由地球方向补一层很弱的地照，强度随月相变化——新月时最亮，满月时几乎看不见。
- **坐标约定**：月固系 x = 经度 0°、y = 东经 90°、z = 北极；映射到场景后 +Z 朝地球、+Y 指北、+X 朝东，因此上弦时右半边亮，与北半球目视一致。

用 PyEphem 4.2.1 做真值对照：

| 时刻（北京时间） | 页面读数 | PyEphem |
| --- | --- | --- |
| 2026-11-09 15:02 新月 | 0.2% | 0.2% |
| 2026-11-17 19:49 上弦 | 50.0% | 50.1% |
| 2026-11-24 22:54 满月 | 99.8% | 99.8% |

月球黄经残差 rms 0.35°、黄纬 0.03°。那 0.35° 是 J2000 平春分点与当天真春分点之间的岁差差，在日月相对几何里自动抵消，不影响照亮比例。

天文计算全在浏览器里跑，不调用任何外部 API；Flask 只负责发页面和静态文件。

## 跑起来

```bash
pip install -r requirements.txt
python main_app.py
# 打开 http://127.0.0.1:5001
```

只需要 Flask，Python 3.8+。端口读 `PORT` 环境变量。

## 怎么用

- 拖动环视，滚轮缩放
- 点击月面任意位置：经纬度、太阳高度角、此刻是月昼还是月夜
- 右侧 9 个真实地标（阿波罗 11 号着陆点、嫦娥三号/四号/五号落区、第谷、哥白尼、雨海、危海、南极-艾特肯盆地），点一下定位
- 底部时间轴播放，1 时/秒 或 1 天/秒，前后各 30 天，一键回到现在
- URL 锚点直达任意时刻：`#2026-11-24T22:54`（北京时间）
- `#cal` 是校准模式，太阳跟随相机，用来核对月面纹理朝向

## 数据从哪来

`static/models/moon_opt.glb` 来自 NASA SVS 的 [Moon 3D Models for Web（ID 14959）](https://svs.gsfc.nasa.gov/14959)，底图是 LROC WAC 彩色镶嵌加 LOLA 高程，原始发布见 [CGI Moon Kit（ID 4720）](https://svs.gsfc.nasa.gov/4720)。原始 `moon_small.glb` 13.8 MB，内嵌 12.1 MB PNG 贴图；这里把贴图重压成 JPEG、移除 `KHR_materials_clearcoat` / `specular` / `ior` 扩展，压到 3.9 MB。几何和影像内容没有改动。

NASA 素材通常属于公有领域，使用条款见 [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)。NASA 没有为这个项目背书。

Three.js r128（含 GLTFLoader）是 MIT；本项目代码也是 MIT。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [LICENSE](LICENSE)。

## 目录

```
main_app.py                 Flask 入口
templates/index.html        单页结构
static/app.js               天文历表 + Three.js 场景 + 交互
static/style.css            仪器面板样式
static/models/moon_opt.glb  NASA 月球模型（3.9 MB）
static/three.min.js         Three.js r128
static/GLTFLoader.js        Three.js GLTFLoader r128
```
