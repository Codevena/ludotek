"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className={[
        "prose-vault prose prose-sm max-w-none",
        // Base text — color handled by --tw-prose-body in .prose-vault
        "text-sm leading-7",
        // Paragraphs — clear separation between blocks
        "prose-p:my-4 prose-p:leading-7",
        // Headings
        "prose-headings:text-vault-text prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3",
        // Bold text — uses --vault-prose-bold (white in dark, near-black in light)
        "prose-strong:font-bold",
        // Lists — proper indentation and spacing
        "prose-ul:my-3 prose-ul:pl-5 prose-ol:my-3 prose-ol:pl-5",
        "prose-li:my-1.5 prose-li:leading-7",
        // Links
        "prose-a:text-vault-amber prose-a:no-underline hover:prose-a:text-vault-amber-hover",
      ].join(" ")}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
