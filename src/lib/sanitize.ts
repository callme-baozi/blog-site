import sanitizeHtml from "sanitize-html";

// 帖子正文 HTML 白名单：仅保留富文本编辑器产出的安全标签与属性
// 视频/图片以自定义 data-* 属性承载元数据，渲染端再转换为交互组件
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr",
      "strong", "b", "em", "i", "u", "s", "del", "span",
      "h1", "h2", "h3",
      "ul", "ol", "li",
      "blockquote",
      "a",
      "img",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "width", "height"],
      span: ["style", "data-video", "data-src", "data-poster", "data-width", "data-height", "data-duration"],
      div: ["style", "data-video", "data-src", "data-poster", "data-width", "data-height", "data-duration"],
    },
    allowedStyles: {
      span: {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      },
      div: {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  });
}
