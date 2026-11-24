"use client";

import { useState } from "react";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";

/**
 * 轮播的「一次性快照」外壳。
 *
 * 服务端每次渲染都会重新随机抽 10 部（这是需求：每次进入/刷新换一组）。
 * 但同一次浏览里，如果页面因为状态更新、数据加载或 RSC 重新渲染而更新了 props，
 * 轮播不应该跟着换成另一组——那会造成「先显示一组、一秒后又变」的闪烁。
 *
 * 这里用 useState 的惰性初始化把首次拿到的 slides 固定住：
 * 只有组件真正重新挂载（离开再进入、整页刷新）才会拿到新的一组。
 */
export function StableHeroSlides({ slides, heightClass }: { slides: HeroSlide[]; heightClass?: string }) {
  const [frozen] = useState<HeroSlide[]>(slides);
  return <HeroCarousel slides={frozen} heightClass={heightClass} />;
}
