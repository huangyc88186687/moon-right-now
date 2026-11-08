# 第三方素材与许可

## Three.js r128

仓库中的 `static/three.min.js` 与 `static/GLTFLoader.js` 来自 [three.js](https://github.com/mrdoob/three.js) r128，按 MIT 许可分发。

```
The MIT License

Copyright © 2010-2021 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## NASA 月球模型与影像

`static/models/moon_opt.glb` 是以下 NASA 公开素材的派生版本：

- NASA Scientific Visualization Studio, [Moon 3D Models for Web（ID 14959）](https://svs.gsfc.nasa.gov/14959) — `moon_small.glb`
- NASA Scientific Visualization Studio, [CGI Moon Kit（ID 4720）](https://svs.gsfc.nasa.gov/4720) — LROC WAC 彩色镶嵌底图、LOLA 高程数据

派生处理：把 GLB 内嵌的 PNG 贴图重压为 JPEG、移除 `KHR_materials_clearcoat` / `KHR_materials_specular` / `KHR_materials_ior` 扩展、把材质设为单面且 `roughnessFactor = 1`。几何、UV 与影像内容未改动。

NASA 制作的内容通常属于公有领域，使用规范见 [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)。使用 NASA 名称、标识或形象不得暗示 NASA 对本项目的认可或背书。本项目与 NASA 无关联。
