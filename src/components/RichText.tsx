"use client";

import parse, {
  type DOMNode,
  type Element,
  type HTMLReactParserOptions,
} from "html-react-parser";
import VideoPlayer from "./VideoPlayer";

// 渲染服务端已 sanitize 的帖子 HTML；
// 将 [data-video] 占位元素替换为点击加载的 VideoPlayer 组件。
export default function RichText({ html }: { html: string }) {
  const options: HTMLReactParserOptions = {
    replace: (domNode: DOMNode) => {
      if (
        domNode.type === "tag" &&
        (domNode.name === "div" || domNode.name === "span") &&
        "attribs" in domNode &&
        domNode.attribs?.["data-video"] !== undefined
      ) {
        const el = domNode as Element;
        const src = el.attribs["data-src"];
        if (!src) return <></>;
        return (
          <VideoPlayer
            src={src}
            poster={el.attribs["data-poster"] || undefined}
            width={el.attribs["data-width"] ? Number(el.attribs["data-width"]) : undefined}
            height={el.attribs["data-height"] ? Number(el.attribs["data-height"]) : undefined}
            duration={el.attribs["data-duration"] ? Number(el.attribs["data-duration"]) : undefined}
          />
        );
      }
      return undefined;
    },
  };

  return <div className="post-content">{parse(html, options)}</div>;
}
